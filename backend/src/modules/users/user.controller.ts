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

  if (!["USER", "ADMIN"].includes(role))
    throw new BadRequestError("Only USER and ADMIN roles can be created directly");

  if (!cleanEmail || !password) throw new BadRequestError("Email and password are required");

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

  if (!["USER", "ADMIN"].includes(role))
    throw new BadRequestError("Only USER and ADMIN roles can be assigned directly");

  const targetUser = await prismaAdmin.admin.findUnique({ where: { id } });
  if (!targetUser) throw new NotFoundError("User not found");

  if (targetUser.role === "SUPERADMIN")
    throw new ForbiddenError("Cannot demote a SUPERADMIN directly. Use the Governance system.");

  assertCanModify(requestor.role, targetUser.role, targetUser.id, requestor.id);

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
      table: "users",
      recordId: id,
      details: { oldRole: targetUser.role, newRole: role },
      adminId: requestor.id,
      adminEmail: requestor.email || "unknown",
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
    throw new ForbiddenError("Cannot delete a SUPERADMIN directly. Use the Governance system.");
  }

  await prismaAdmin.$transaction(async (tx) => {
    await tx.admin.delete({ where: { id } });
  });

  await prismaAudit.auditLog.create({
    data: {
      action: "DELETE_USER",
      table: "users",
      recordId: id,
      details: { deletedEmail: targetUser.email, deletedRole: targetUser.role },
      adminId: requestor.id,
      adminEmail: requestor.email || "unknown",
    },
  });

  return reply.send({ success: true, message: "User deleted successfully" });
};
