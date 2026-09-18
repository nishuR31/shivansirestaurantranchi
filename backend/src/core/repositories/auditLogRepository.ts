import { prismaAudit } from "../config/databaseConfig";
import { AuditLog } from "../../generated/prismaAudit";
import { AuditLogEntry } from "../types";
import BaseRepository from "./baseRepository";

export default class AuditLogRepository extends BaseRepository<AuditLog> {
  constructor() {
    super("auditLog", prismaAudit);
  }

  async logAction(entry: AuditLogEntry): Promise<AuditLog> {
    return this.create({
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      adminId: entry.adminId ?? entry.userId,
      details: entry.details || {},
    });
  }

  async findByEntity(entity: string, entityId: string): Promise<AuditLog[]> {
    return this.findAll({
      where: { entity, entityId },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async findByUser(userId: string): Promise<AuditLog[]> {
    return this.findAll({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }
}
