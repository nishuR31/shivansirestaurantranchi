import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from CWD, root/.env, or relative to src/config
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
import { z } from "zod";

const envSchema = z.object({
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(3000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  BUSINESS_NAME: z.string().default("Maa Tara Sweets"),
  LOG_LEVEL: z.string().default("debug"),
  // Database
  ADMIN_DATABASE_URL: z.string().min(1),
  ADMIN_DIRECT_URL: z.string().optional(),
  AUDIT_DATABASE_URL: z.string().min(1),
  AUDIT_DIRECT_URL: z.string().optional(),
  APP_DATABASE_URL: z.string().min(1),
  APP_DIRECT_URL: z.string().optional(),
  SALT_ROUND: z.number().optional().default(10),

  // Auth
  JWT_ACCESS_SECRET: z.string().min(16).default("dev-access-secret-change-in-production"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16)
    .default("dev-refresh-secret-change-in-production"),
  JWT_EXPIRES_IN_ACCESS: z.string().default("15m"),
  JWT_EXPIRES_IN_REFRESH: z.string().default("7d"),
  BCRYPT_SALT_ROUND: z.coerce.number().int().positive().default(10),
  TOTP_ISSUER: z.string().default(process.env.BUSINESS_NAME || "MaaTaraSweets"),

  // Rate Limiting
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_WINDOW: z.string().default("1 minute"),

  // Redis (optional)
  REDIS_URL_RATELIMIT: z.string().url().optional().or(z.literal("")),
  REDIS_URL_CACHE: z.string().url().optional().or(z.literal("")),

  // Razorpay (optional — mock mode without keys)
  RAZORPAY_KEY_ID: z.string().optional().or(z.literal("")),
  RAZORPAY_KEY_SECRET: z.string().optional().or(z.literal("")),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().or(z.literal("")),
  RAZORPAY_KEY_ID_TEST: z.string().optional().or(z.literal("")),
  RAZORPAY_KEY_SECRET_TEST: z.string().optional().or(z.literal("")),

  // Email/SMTP (optional — silent no-op without keys)
  SMTP_HOST: z.string().optional().or(z.literal("")),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional().or(z.literal("")),
  SMTP_PASS: z.string().optional().or(z.literal("")),
  SMTP_FROM: z
    .string()
    .default(
      `${process.env.BUSINESS_NAME || "MaaTaraSweets"} <${process.env.SMTP_USER || process.env.GMAIL_USER || ""}>`,
    ),

  // Email Sending Provider Preference ("auto" | "gmail" | "smtp" | "brevo")
  EMAIL_TRANSPORT: z.enum(["auto", "gmail", "smtp", "brevo"]).default("auto"),

  // Brevo API
  BREVO_API_KEY: z.string().optional().or(z.literal("")),

  // Gmail API (HTTPS REST API for platforms like Render where outbound SMTP is blocked)
  GMAIL_CLIENT_ID: z.string().optional().or(z.literal("")),
  GMAIL_CLIENT_SECRET: z.string().optional().or(z.literal("")),
  GMAIL_REFRESH_TOKEN: z.string().optional().or(z.literal("")),
  GMAIL_USER: z.string().optional().or(z.literal("")),

  //Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional().or(z.literal("")),
  GOOGLE_CLIENT_SECRET: z.string().optional().or(z.literal("")),
  GOOGLE_CALLBACK_URL: z.string().url().optional().or(z.literal("")),

  // Admin
  ADMIN_EMAIL: z.string().email().optional(),

  // Image hosting (imgbb)
  IMGBB_API_KEY: z.string().min(1).optional(),
  IMGBB_API_URL: z.string().url().default("https://api.imgbb.com/1/upload"),

  // Supabase (image storage)
  SUPABASE_URL: z.string().url().optional().or(z.literal("")),
  SUPABASE_ANON_KEY: z.string().optional().or(z.literal("")),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().or(z.literal("")),
  SUPABASE_STORAGE_BUCKET: z.string().default("product-images"),
});

const env = envSchema.parse(process.env);

export const {
  HOST,
  NODE_ENV,
  API_PORT,
  WEB_ORIGIN,
  BUSINESS_NAME,
  LOG_LEVEL,
  ADMIN_DATABASE_URL,
  ADMIN_DIRECT_URL,
  APP_DATABASE_URL,
  SALT_ROUND,
  APP_DIRECT_URL,
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
  JWT_EXPIRES_IN_ACCESS,
  JWT_EXPIRES_IN_REFRESH,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW,
  REDIS_URL_CACHE,
  REDIS_URL_RATELIMIT,
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET,
  RAZORPAY_KEY_ID_TEST,
  RAZORPAY_KEY_SECRET_TEST,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
  EMAIL_TRANSPORT,
  BREVO_API_KEY,
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REFRESH_TOKEN,
  GMAIL_USER,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL,
  ADMIN_EMAIL,
  IMGBB_API_KEY,
  IMGBB_API_URL,
  BCRYPT_SALT_ROUND,
  TOTP_ISSUER,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_STORAGE_BUCKET,
} = env;

// Export legacy aliases for other files
export const JWT_ACCESS_EXPIRY = JWT_EXPIRES_IN_ACCESS;
export const JWT_REFRESH_EXPIRY = JWT_EXPIRES_IN_REFRESH;
export const SMTP_FROM_EMAIL = SMTP_USER;
export const SMTP_FROM_NAME = BUSINESS_NAME;
export const SMTP_PASSWORD = SMTP_PASS;

export default env;
