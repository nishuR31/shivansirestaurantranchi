import AuditLogRepository from "../../core/repositories/auditLogRepository";
import UserRepository from "../../core/repositories/userRepository";
import AdminRepository from "../../core/repositories/adminRepository";
import { JwtPayload, RegisterBody, testUser, TokenPair } from "../../core/types";
import {
  ConflictError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../../core/utils/errors/error";
import { sendEmail, sendWelcomeEmail } from "../../core/utils/helpers/email";
import {
  blacklistToken,
  generateAccessToken,
  generateTokenPair,
  getStoredRefreshToken,
  removeRefreshToken,
  storeRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../../core/utils/helpers/jwt";
import bcrypt from "bcrypt";
import {
  generateTotpQrCode,
  generateTotpSecret,
  verifyTotpToken,
} from "../../core/utils/helpers/totp";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import logger from "../../core/config/loggerConfig";
import { normalizePhone } from "../../core/utils/phone";
import { hash } from "../../core/utils/helpers/hash";
import { prismaApp, prismaAdmin } from "../../core/config/databaseConfig";
import { sendError, sendSuccess } from "../../core/utils/common/response";
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL,
  WEB_ORIGIN,
  BUSINESS_NAME,
} from "../../core/config/envConfig";
import crypto from "crypto";

const rpName = BUSINESS_NAME;
const rpID = new URL(WEB_ORIGIN).hostname;
const origin = WEB_ORIGIN;

const userRepo = new UserRepository();
const adminRepo = new AdminRepository();
const auditLogRepo = new AuditLogRepository();

export default class AuthService {
  private assertGoogleConfig() {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new InternalServerError(
        "Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI.",
      );
    }
  }

  getGoogleAuthUrl(state: string) {
    this.assertGoogleConfig();

    const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    googleAuthUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID!);
    googleAuthUrl.searchParams.set("redirect_uri", GOOGLE_CALLBACK_URL!);
    googleAuthUrl.searchParams.set("response_type", "code");
    googleAuthUrl.searchParams.set("scope", "openid email profile");
    googleAuthUrl.searchParams.set("state", state);
    googleAuthUrl.searchParams.set("access_type", "offline");
    googleAuthUrl.searchParams.set("prompt", "consent");

    return googleAuthUrl.toString();
  }

  generateOAuthState() {
    return crypto.randomBytes(16).toString("hex");
  }

  async loginWithGoogleCode(code: string): Promise<{ user: any; tokens: TokenPair }> {
    this.assertGoogleConfig();

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        redirect_uri: GOOGLE_CALLBACK_URL!,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const tokenErr = await tokenRes.text();
      throw new UnauthorizedError("Google token exchange failed.", { tokenErr });
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      throw new UnauthorizedError("Google did not return an access token.");
    }

    const profileRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileRes.ok) {
      const profileErr = await profileRes.text();
      throw new UnauthorizedError("Failed to fetch Google user profile.", { profileErr });
    }

    const profile = (await profileRes.json()) as {
      email?: string;
      name?: string;
      picture?: string;
      email_verified?: boolean;
    };

    if (!profile.email) {
      throw new UnauthorizedError("Google account email is missing.");
    }

    if (profile.email_verified === false) {
      throw new UnauthorizedError("Google email is not verified.");
    }

    let user = await userRepo.findByEmail(profile.email);

    if (!user) {
      const generatedPassword = await hash(crypto.randomUUID());
      user = await userRepo.create({
        name: profile.name || profile.email.split("@")[0],
        email: profile.email,
        password: generatedPassword,
        role: "USER",
        avatarUrl: profile.picture,
      });
    } else {
      user = await userRepo.update(user.id, {
        name: profile.name || user.name,
        avatarUrl: profile.picture || user.avatarUrl,
        lastLogin: new Date(),
      });
    }

    const payload: JwtPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    const tokens = generateTokenPair(payload);

    await storeRefreshToken(user.id, tokens.refreshToken);
    await userRepo.updateRefreshToken(user.id, tokens.refreshToken);

    const safeUser = { ...user } as any;
    delete safeUser.password;
    delete safeUser.refreshToken;
    delete safeUser.totpSecret;
    delete safeUser.currentChallenge;
    return { user: safeUser, tokens };
  }

  async register(data: RegisterBody): Promise<{ user: any; tokens: TokenPair }> {
    const existing = await userRepo.findByEmail(data.email);
    if (existing) {
      throw new ConflictError("A user with this email already exists.");
    }

    const role = "USER";

    const user = await userRepo.create({
      name: data.name,
      email: data.email,
      password: data.password,
      phone: data.phone ? normalizePhone(data.phone) : undefined,
      role,
    });

    const payload: JwtPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    const tokens = generateTokenPair(payload);

    await storeRefreshToken(user.id, tokens.refreshToken);
    await userRepo.updateRefreshToken(user.id, tokens.refreshToken);

    sendWelcomeEmail(user.email, user.name).catch(() => {});

    await auditLogRepo.logAction({
      action: "REGISTER",
      entity: "User",
      entityId: user.id,
      userId: user.id,
    });

    const safeUser = { ...user } as any;
    delete safeUser.password;
    delete safeUser.refreshToken;
    delete safeUser.totpSecret;
    delete safeUser.currentChallenge;

    return { user: safeUser, tokens };
  }

  async login(
    email: string,
    password: string,
    totpToken?: string,
  ): Promise<{ user: any; tokens: TokenPair; requireTotp?: boolean }> {
    email = email.trim().toLowerCase();
    let user: any = await adminRepo.findByEmail(email);
    let repo: any = adminRepo;
    if (!user) {
      user = await userRepo.findByEmail(email);
      repo = userRepo;
    }
    if (!user) throw new UnauthorizedError("Invalid email or password.");
    if (!user.isActive) {
      throw new UnauthorizedError("Account is deactivated. Contact admin.");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new UnauthorizedError("Invalid email or password.");

    if (user.isTotpEnabled) {
      if (!totpToken) {
        return {
          user: { id: user.id },
          tokens: { accessToken: "", refreshToken: "" },
          requireTotp: true,
        };
      }
      if (!user.totpSecret || !verifyTotpToken(totpToken, user.totpSecret)) {
        throw new UnauthorizedError("Invalid TOTP token.");
      }
    }

    const payload: JwtPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    const tokens = generateTokenPair(payload);

    await storeRefreshToken(user.id, tokens.refreshToken);
    await repo.updateRefreshToken(user.id, tokens.refreshToken);
    await repo.updateLastLogin(user.id);

    const safeUser = { ...user } as any;
    delete safeUser.password;
    delete safeUser.refreshToken;
    delete safeUser.totpSecret;
    delete safeUser.currentChallenge;

    return { user: safeUser, tokens };
  }

  async logout(userId: string, accessToken: string, role?: string): Promise<void> {
    await blacklistToken(accessToken);
    await removeRefreshToken(userId);
    if (role === "ADMIN" || role === "SUPERADMIN") {
      await adminRepo.updateRefreshToken(userId, null);
    } else {
      await userRepo.updateRefreshToken(userId, null);
    }
    logger.info(`User/Admin ${userId} logged out.`);
  }

  async passless(
    email: string,
  ): Promise<{ email: string; name?: string; token: string; role: string }> {
    email = email.trim().toLowerCase();
    let user = await userRepo.findByEmail(email);
    if (!user) throw new NotFoundError("User not found with this email");
    let accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    let role = await hash(user.role);
    return { email: user?.email, name: user?.name ?? "user", token: accessToken, role };
  }

  async testPassless(): Promise<{
    email: string;
    name?: string;
    token: string;
    role: string;
  }> {
    let user = testUser;
    let accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    let role = await hash(user.role);
    return { email: user?.email, name: user?.name ?? "User", token: accessToken, role };
  }

  async passlessVerify(token: string, userRole: string): Promise<boolean> {
    let { id, email, role } = await verifyAccessToken(token);
    let tamperedRole = await bcrypt.compare(role, userRole);
    if (!tamperedRole) throw new UnauthorizedError("Url is tampered");
    let user = await userRepo.findByEmail(email);
    if (!user) throw new NotFoundError("User not found with this email");
    let validRole = bcrypt.compare(user.role, userRole);
    let verified = user.id === id && user.email === email && validRole;
    return verified;
  }

  async testPasslessVerify(token: string, userRole: string): Promise<boolean> {
    let decoded = await verifyAccessToken(token);

    if (!decoded) throw new UnauthorizedError("Invalid or expired tokens");
    let { email, id, role } = decoded;
    console.log(role, userRole);

    let user = testUser;
    let tamperedRole = await bcrypt.compare(role, userRole);
    if (!tamperedRole) throw new UnauthorizedError("Tampered Role", { tamperedRole });
    let validRole = bcrypt.compare(user.role, userRole);
    let verified = user.id === id && user.email === email && validRole;
    return verified;
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const decoded = await verifyRefreshToken(refreshToken);

    const storedToken = await getStoredRefreshToken(decoded.id);
    if (!storedToken || storedToken !== refreshToken) {
      throw new UnauthorizedError("Refresh token is invalid or has been revoked.");
    }

    const tokenRepo: any =
      decoded.role === "ADMIN" || decoded.role === "SUPERADMIN" ? adminRepo : userRepo;
    const user = await tokenRepo.findById(decoded.id);
    if (!user.isActive) throw new UnauthorizedError("Account is deactivated");

    const payload: JwtPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    const tokens = generateTokenPair(payload);

    await storeRefreshToken(user.id, tokens.refreshToken);
    await tokenRepo.updateRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    accessToken: string,
    role?: string,
  ): Promise<void> {
    const repo: any = role === "ADMIN" || role === "SUPERADMIN" ? adminRepo : userRepo;
    const user = await repo.findById(userId);

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) throw new ValidationError("Current password is incorrect");

    await repo.update(userId, { password: newPassword });

    await blacklistToken(accessToken);
    await removeRefreshToken(userId);
    await repo.updateRefreshToken(userId, null);

    await auditLogRepo.logAction({
      action: "CHANGE_PASSWORD",
      entity: "User",
      entityId: userId,
      userId,
    });
  }

  async enableTotp(
    userId: string,
    role: string,
  ): Promise<{ secret: string; qrCode: string }> {
    const repo: any = role === "ADMIN" || role === "SUPERADMIN" ? adminRepo : userRepo;
    const user = await repo.findById(userId);

    if (user.isTotpEnabled) throw new ConflictError("TOTP is already enabled");

    const secret = generateTotpSecret();
    const qrCode = await generateTotpQrCode(user.email, secret);

    await repo.updateTotpSecret(userId, secret, false);

    return { secret, qrCode };
  }

  async verifyAndActivateTotp(userId: string, token: string, role: string): Promise<void> {
    const repo: any = role === "ADMIN" || role === "SUPERADMIN" ? adminRepo : userRepo;
    const user = await repo.findById(userId);

    if (!user.totpSecret) {
      throw new NotFoundError("No TOTP secret found. Call enable first.");
    }

    if (user.isTotpEnabled) {
      throw new ConflictError("TOTP is already active.");
    }

    const isValid = await verifyTotpToken(token, user.totpSecret);
    console.log(`[TOTP VERIFY] User: ${user.email}, DB Secret: ${user.totpSecret}, Input Token: '${token}', Is Valid: ${isValid}`);
    
    if (!isValid) {
      throw new ValidationError("Invalid TOTP token. Please try again.");
    }

    await repo.updateTotpSecret(userId, user.totpSecret, true);

    await auditLogRepo.logAction({
      action: "ENABLE_TOTP",
      entity: "User",
      entityId: userId,
      userId,
    });
  }

  async disableTotp(userId: string, role: string): Promise<void> {
    const repo: any = role === "ADMIN" || role === "SUPERADMIN" ? adminRepo : userRepo;
    const user = await repo.findById(userId);

    await repo.updateTotpSecret(userId, null, false);

    await auditLogRepo.logAction({
      action: "DISABLE_TOTP",
      entity: "User",
      entityId: userId,
      userId,
    });
  }

  // --- WebAuthn Passkeys ---

  async generateWebAuthnRegistration(userId: string, role: string, overrideRpID?: string) {
    const repo: any = role === "ADMIN" || role === "SUPERADMIN" ? adminRepo : userRepo;
    const user = await repo.findById(userId, { include: { passkeys: true } });

    const options = await generateRegistrationOptions({
      rpName,
      rpID: overrideRpID || rpID,
      userID: new Uint8Array(Buffer.from(user.id)),
      userName: user.email,
      attestationType: "none",
      excludeCredentials: user.passkeys.map((key: any) => ({
        // Prisma Bytes returns Buffer; @simplewebauthn v13 needs base64url string for `id`
        id: Buffer.isBuffer(key.credentialID)
          ? key.credentialID.toString("base64url")
          : String(key.credentialID),
        transports: key.transports as any[],
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    await repo.update(user.id, { currentChallenge: options.challenge });

    return options;
  }

  async verifyWebAuthnRegistration(
    userId: string,
    response: RegistrationResponseJSON,
    role: string,
    overrideOrigin?: string,
    overrideRpID?: string
  ) {
    const repo: any = role === "ADMIN" || role === "SUPERADMIN" ? adminRepo : userRepo;
    const user = await repo.findById(userId);

    if (!user.currentChallenge) {
      throw new ValidationError("No passkey registration challenge found for this user.");
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: user.currentChallenge,
        expectedOrigin: overrideOrigin || origin,
        expectedRPID: overrideRpID || rpID,
      });
    } catch (error: any) {
      throw new ValidationError(`Passkey verification failed: ${error.message}`);
    }

    if (verification.verified && verification.registrationInfo) {
      const { credential } = verification.registrationInfo;
      // credential.id might be a base64url string or Uint8Array in @simplewebauthn v13
      const credentialIDBuffer = typeof credential.id === "string" 
        ? Buffer.from(credential.id, "base64url") 
        : Buffer.from(credential.id);
        
      const credentialPublicKeyBuffer = typeof credential.publicKey === "string"
        ? Buffer.from(credential.publicKey, "base64url")
        : Buffer.from(credential.publicKey);

      await repo.addPasskey({
        credentialID: credentialIDBuffer,
        credentialPublicKey: credentialPublicKeyBuffer,
        counter: BigInt(credential.counter),
        transports: response.response.transports || [],
        [role === "ADMIN" || role === "SUPERADMIN" ? "adminId" : "userId"]: user.id,
      });

      await repo.update(user.id, { currentChallenge: null });
      return { success: true };
    }

    throw new ValidationError("Passkey registration failed.");
  }

  async deletePasskeys(userId: string, role: string) {
    if (role === "ADMIN" || role === "SUPERADMIN") {
      await prismaAdmin.passkey.deleteMany({ where: { adminId: userId } });
    } else {
      await prismaApp.passkey.deleteMany({ where: { userId } });
    }
  }

  async generateWebAuthnAuthentication(email: string, overrideRpID?: string) {
    let user: any = await adminRepo.findByEmail(email);
    let repo: any = adminRepo;
    if (!user) {
      user = await userRepo.findByEmail(email);
      repo = userRepo;
    }
    if (!user) throw new NotFoundError("User not found.");

    const passkeys = user.role === "ADMIN" || user.role === "SUPERADMIN"
      ? await prismaAdmin.passkey.findMany({ where: { adminId: user.id } })
      : await prismaApp.passkey.findMany({ where: { userId: user.id } });

    const options = await generateAuthenticationOptions({
      rpID: overrideRpID || rpID,
      allowCredentials: passkeys.map((key: any) => ({
        id: Buffer.isBuffer(key.credentialID)
          ? key.credentialID.toString("base64url")
          : String(key.credentialID),
        transports: key.transports as any[],
      })),
      userVerification: "preferred",
    });

    await repo.update(user.id, { currentChallenge: options.challenge });

    return options;
  }

  async verifyWebAuthnAuthentication(
    email: string,
    response: AuthenticationResponseJSON,
    overrideOrigin?: string,
    overrideRpID?: string
  ) {
    let user: any = await adminRepo.findByEmail(email);
    let repo: any = adminRepo;
    if (!user) {
      user = await userRepo.findByEmail(email);
      repo = userRepo;
    }
    if (!user) throw new NotFoundError("User not found.");

    if (!user.currentChallenge) {
      throw new ValidationError("No passkey authentication challenge found.");
    }

    const passkeys = user.role === "ADMIN" || user.role === "SUPERADMIN"
      ? await prismaAdmin.passkey.findMany({ where: { adminId: user.id } })
      : await prismaApp.passkey.findMany({ where: { userId: user.id } });

    // response.id is base64url string in @simplewebauthn v13
    const passkey = passkeys.find(
      (pk: any) =>
        (Buffer.isBuffer(pk.credentialID)
          ? pk.credentialID.toString("base64url")
          : String(pk.credentialID)) === response.id,
    );

    if (!passkey) {
      throw new ValidationError("Passkey is not registered with this user.");
    }

    let verification;
    try {
      // credentialID stored as Prisma Bytes (Buffer); @simplewebauthn v13 expects a base64url string for `id`
      const credentialIdStr = Buffer.isBuffer(passkey.credentialID)
        ? passkey.credentialID.toString("base64url")
        : String(passkey.credentialID);
      // credentialPublicKey stored as Buffer; @simplewebauthn needs Uint8Array<ArrayBuffer> (no SharedArrayBuffer)
      const publicKeyBytes = new Uint8Array(
        Buffer.from(passkey.credentialPublicKey as unknown as Buffer).buffer.slice(0),
      ) as Uint8Array<ArrayBuffer>;

      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: user.currentChallenge,
        expectedOrigin: overrideOrigin || origin,
        expectedRPID: overrideRpID || rpID,
        credential: {
          id: credentialIdStr,
          publicKey: publicKeyBytes,
          counter: Number(passkey.counter),
          transports: passkey.transports as any[],
        },
      });
    } catch (error: any) {
      throw new UnauthorizedError(`Passkey authentication failed: ${error.message}`);
    }

    if (verification.verified && verification.authenticationInfo) {
      if (user.role === "ADMIN" || user.role === "SUPERADMIN") {
        await prismaAdmin.passkey.update({
          where: { id: passkey.id },
          data: { counter: BigInt(verification.authenticationInfo.newCounter) },
        });
      } else {
        await prismaApp.passkey.update({
          where: { id: passkey.id },
          data: { counter: BigInt(verification.authenticationInfo.newCounter) },
        });
      }

      await repo.update(user.id, { currentChallenge: null, lastLogin: new Date() });

      const payload: JwtPayload = {
        id: user.id,
        email: user.email,
        role: user.role,
      };
      const tokens = generateTokenPair(payload);

      await storeRefreshToken(user.id, tokens.refreshToken);
      await repo.updateRefreshToken(user.id, tokens.refreshToken);

      const safeUser = { ...user } as any;
      delete safeUser.password;
      delete safeUser.refreshToken;
      delete safeUser.totpSecret;
      delete safeUser.currentChallenge;
      return { user: safeUser, tokens };
    }

    throw new UnauthorizedError("Passkey authentication failed.");
  }
}

// let a = new AuthService();
// let { email, role, token, name } = await a.testPassless();
// console.table({ email, role, token, name });
// console.log(await a.testPasslessVerify(token, role));
