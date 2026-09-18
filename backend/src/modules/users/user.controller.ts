import { FastifyReply, FastifyRequest } from "fastify";
import bcrypt from "bcrypt";
import { prismaAdmin, prismaAudit } from "../../core/config/databaseConfig";
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from "../../core/utils/errors/error";
import { $Enums } from "../../generated/prismaAdmin";

const ROOT_EMAIL = "nishanrajak01@gmail.com";

// ─── Helpers ────────────────────────────────────────────────────────────────

function assertCanModify(
  requestorRole: string,
  targetRole: string,
  targetId: string,
  requestorId: string,
) {
  if (requestorRole === "ADMIN") {
    if (targetRole === "SUPERADMIN")
      throw new ForbiddenError("Admins cannot modify a SUPERADMIN");
    if (targetRole === "ADMIN" && targetId !== requestorId)
      throw new ForbiddenError("Admins cannot modify other Admins. Ask a SUPERADMIN.");
  }
}

// ─── GET /data/users ─────────────────────────────────────────────────────────

export const getAllUsers = async (req: FastifyRequest, reply: FastifyReply) => {
  const users = await prismaAdmin.admin.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      isActive: true,
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });
  return reply.send({ success: true, users });
};

// ─── POST /data/users ─────────────────────────────────────────────────────────

export const createUser = async (
  req: FastifyRequest<{
    Body: {
      name?: string;
      email: string;
      password: string;
      role: "USER" | "ADMIN" | "SUPERADMIN";
    };
  }>,
  reply: FastifyReply,
) => {
  const { name, email, password, role } = req.body;
  const requestor = req.user!;
  const cleanEmail = email.trim().toLowerCase();

  if (!["USER", "ADMIN", "SUPERADMIN"].includes(role))
    throw new BadRequestError("Invalid role");
  if (!cleanEmail || !password) throw new BadRequestError("Email and password are required");

  // Admin cannot create a SUPERADMIN
  if (requestor.role === "ADMIN" && role === "SUPERADMIN")
    throw new ForbiddenError("Admins cannot create SUPERADMIN accounts");

  const existing = await prismaAdmin.admin.findUnique({ where: { email: cleanEmail } });
  if (existing) throw new BadRequestError("A user with this email already exists");

  const user = await prismaAdmin.admin.create({
    data: { name: name || "", email: cleanEmail, password, role: role as $Enums.Role },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      isActive: true,
    },
  });

  return reply.status(201).send({ success: true, user });
};

// ─── PATCH /data/users/:id ────────────────────────────────────────────────────

export const updateUser = async (
  req: FastifyRequest<{
    Params: { id: string };
    Body: { name?: string; email?: string; isActive?: boolean };
  }>,
  reply: FastifyReply,
) => {
  const { id } = req.params;
  const { name, email, isActive } = req.body;
  const requestor = req.user!;

  const targetUser = await prismaAdmin.admin.findUnique({ where: { id } });
  if (!targetUser) throw new NotFoundError("User not found");

  assertCanModify(requestor.role, targetUser.role, targetUser.id, requestor.id);

  const cleanEmail = email ? email.trim().toLowerCase() : undefined;

  // If changing email, make sure it's not taken
  if (cleanEmail && cleanEmail !== targetUser.email) {
    const clash = await prismaAdmin.admin.findUnique({ where: { email: cleanEmail } });
    if (clash) throw new BadRequestError("Email already in use by another account");
  }

  const updated = await prismaAdmin.admin.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(cleanEmail !== undefined && { email: cleanEmail }),
      ...(isActive !== undefined && { isActive }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      isActive: true,
    },
  });

  return reply.send({ success: true, user: updated });
};

// ─── PATCH /data/users/:id/role ───────────────────────────────────────────────

export const updateRole = async (
  req: FastifyRequest<{
    Params: { id: string };
    Body: { role: "USER" | "ADMIN" | "SUPERADMIN" };
  }>,
  reply: FastifyReply,
) => {
  const { id } = req.params;
  const { role } = req.body;
  const requestor = req.user!;

  if (!["USER", "ADMIN", "SUPERADMIN"].includes(role))
    throw new BadRequestError("Invalid role");

  const targetUser = await prismaAdmin.admin.findUnique({ where: { id } });
  if (!targetUser) throw new NotFoundError("User not found");

  // Protect root superadmin
  if (targetUser.email === ROOT_EMAIL && role !== "SUPERADMIN")
    throw new ForbiddenError("The root SUPERADMIN cannot be demoted.");

  assertCanModify(requestor.role, targetUser.role, targetUser.id, requestor.id);

  if (requestor.role === "ADMIN") {
    if (role === "SUPERADMIN") {
      throw new ForbiddenError("Only SUPERADMIN can assign SUPERADMIN role");
    }
  }

  const updated = await prismaAdmin.$transaction(async (tx) => {
    const user = await tx.admin.update({
      where: { id },
      data: { role: role as $Enums.Role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        isActive: true,
      },
    });

    return user;
  });

  await prismaAudit.auditLog.create({
    data: {
      action: "ROLE_CHANGE",
      entity: "USER",
      entityId: id,
      details: { oldRole: targetUser.role, newRole: role },
      adminId: requestor.id,
    },
  });

  return reply.send({ success: true, user: updated });
};

// ─── DELETE /data/users/:id ───────────────────────────────────────────────────

export const deleteUser = async (
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) => {
  const { id } = req.params;
  const requestor = req.user!;

  const targetUser = await prismaAdmin.admin.findUnique({ where: { id } });
  if (!targetUser) throw new NotFoundError("User not found");

  if (targetUser.id === requestor.id)
    throw new ForbiddenError("You cannot delete your own account");
  if (targetUser.email === ROOT_EMAIL)
    throw new ForbiddenError("The root SUPERADMIN cannot be deleted");

  if (targetUser.role === "SUPERADMIN") {
    const superadminsCount = await prismaAdmin.admin.count({ where: { role: "SUPERADMIN" } });
    const required_approvals = superadminsCount > 1 ? superadminsCount as number - Math.floor(superadminsCount / 2) as number : 0;

    const expires_at = new Date();
    expires_at.setHours(expires_at.getHours() + 48);

    const newRequest = await prismaAdmin.adminActionRequest.create({
      data: {
        requester_id: requestor.id,
        action_type: "DELETE_SUPERADMIN",
        target_id: id,
        payload: { email: targetUser.email },
        required_approvals,
        status: required_approvals === 0 ? "TIME_LOCKED" : "PENDING",
        expires_at
      }
    });

    return reply.send({
      success: true,
      message: required_approvals === 0
        ? "Deletion queued. Time lock initiated."
        : "Governance request created. Deletion requires another SUPERADMIN's approval.",
      request: newRequest
    });
  }

  await prismaAdmin.$transaction(async (tx) => {
    await tx.admin.delete({ where: { id } });
  });

  await prismaAudit.auditLog.create({
    data: {
      action: "DELETE_USER",
      entity: "USER",
      entityId: id,
      details: { deletedEmail: targetUser.email, deletedRole: targetUser.role },
      adminId: requestor.id,
    },
  });

  return reply.send({ success: true, message: "User deleted successfully" });
};
