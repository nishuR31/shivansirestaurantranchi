import { FastifyRequest, FastifyReply } from "fastify";
import { prismaApp, prismaAdmin, prismaAudit } from "../../core/config/databaseConfig";
import logger from "../../core/config/loggerConfig";
import { z } from "zod";
import { sendError, sendSuccess } from "../../core/utils/common/response";
import { STATUS_CODES } from "../../core/utils/common/constants";

export const getRequests = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const user = req.user as any;
    if (user.role !== "SUPERADMIN") return sendError(res, "Only superadmins can access governance", STATUS_CODES.FORBIDDEN);

    const now = new Date();
    await prismaAdmin.adminActionRequest.updateMany({
      where: { status: "PENDING", expires_at: { lt: now } },
      data: { status: "EXPIRED" }
    });

    const requests = await prismaAdmin.adminActionRequest.findMany({
      orderBy: { created_at: "desc" },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        votes: {
          include: {
            voter: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });

    return sendSuccess(res, "Requests fetched", STATUS_CODES.OK, { requests });
  } catch (error: any) {
    logger.error(`Error in getRequests: ${error.message}`);
    return sendError(res, "Internal server error", STATUS_CODES.INTERNAL_SERVER_ERROR);
  }
};

const requestSchema = z.object({
  action_type: z.enum(["SUSPEND_APP", "DELETE_SUPERADMIN", "MODIFY_API_KEYS"]),
  target_id: z.string().optional().nullable(),
  payload: z.any().optional(),
});

export const requestAction = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const user = req.user as any;
    if (user.role !== "SUPERADMIN") return sendError(res, "Only superadmins can propose governance actions", STATUS_CODES.FORBIDDEN);

    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, "Invalid request data", STATUS_CODES.BAD_REQUEST, { details: parsed.error.format() });

    const superadmins = await prismaAdmin.admin.count({ where: { role: "SUPERADMIN" } });
    
    // Policy: every other SUPERADMIN must approve
    const required_approvals = Math.max(superadmins - 1, 0);

    const expires_at = new Date();
    expires_at.setHours(expires_at.getHours() + 48);

    const newRequest = await prismaAdmin.adminActionRequest.create({
      data: {
        requester_id: user.id,
        action_type: parsed.data.action_type,
        target_id: parsed.data.target_id,
        payload: parsed.data.payload ?? {},
        required_approvals,
        status: required_approvals === 0 ? "TIME_LOCKED" : "PENDING",
        expires_at
      }
    });

    await prismaAudit.auditLog.create({
      data: {
        adminId: user.id,
        adminEmail: user.email || "unknown",
        action: "PROPOSE_GOVERNANCE",
        table: "adminActionRequest",
        recordId: newRequest.id,
      }
    });

    // Send notifications to all other superadmins here...

    return sendSuccess(res, "Action requested", STATUS_CODES.OK, { request: newRequest });
  } catch (error: any) {
    logger.error(`Error in requestAction: ${error.message}`);
    return sendError(res, "Internal server error", STATUS_CODES.INTERNAL_SERVER_ERROR);
  }
};

export const submitVote = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const user = req.user as any;
    if (user.role !== "SUPERADMIN") return sendError(res, "Only superadmins can vote", STATUS_CODES.FORBIDDEN);

    const { id } = req.params as any;
    const { vote } = req.body as any; // "APPROVE" or "REJECT"

    if (vote !== "APPROVE" && vote !== "REJECT") {
      return sendError(res, "Invalid vote", STATUS_CODES.BAD_REQUEST);
    }

    // Wrap voting and execution in a transaction to prevent race conditions
    const result = await prismaAdmin.$transaction(async (tx) => {
      const actionRequest = await tx.adminActionRequest.findUnique({
        where: { id }
      });

      if (!actionRequest) throw new Error("Request not found");
      if (actionRequest.status !== "PENDING") throw new Error("Request is no longer pending");
      if (actionRequest.expires_at < new Date()) {
         // Optionally update status to EXPIRED
         await tx.adminActionRequest.update({ where: { id }, data: { status: "EXPIRED" } });
         throw new Error("GOVERNANCE_REQUEST_EXPIRED");
      }
      if (actionRequest.requester_id === user.id) throw new Error("You cannot vote on your own request");
      if (actionRequest.target_id === user.id) throw new Error("You cannot vote on a request targeting yourself");

      // Record vote (upsert handles existing votes safely using the unique constraint)
      await tx.adminActionVote.upsert({
        where: {
          request_id_voter_id: {
            request_id: id,
            voter_id: user.id
          }
        },
        update: { vote },
        create: { request_id: id, voter_id: user.id, vote }
      });

      // Check approvals
      const approvalsCount = await tx.adminActionVote.count({
        where: { request_id: id, vote: "APPROVE" }
      });
      
      const rejectionsCount = await tx.adminActionVote.count({
        where: { request_id: id, vote: "REJECT" }
      });

      // Policy: 1 rejection kills the proposal
      if (rejectionsCount > 0) {
        await tx.adminActionRequest.update({
          where: { id },
          data: { status: "REJECTED", approvals: approvalsCount }
        });
        return { executed: false, rejected: true };
      }

      if (approvalsCount >= actionRequest.required_approvals) {
        await tx.adminActionRequest.update({
          where: { id },
          data: { status: "EXECUTED", approvals: approvalsCount }
        });

        // Execution Logic
        if (actionRequest.action_type === "SUSPEND_APP") {
          const payload = actionRequest.payload as any;
          await tx.restaurantSettings.updateMany({
            data: {
              is_suspended: payload?.is_suspended ?? true,
              shutdown_message: payload?.message ?? "Restaurant suspended",
              shutdown_code: 402
            }
          });
        } else if (actionRequest.action_type === "DELETE_SUPERADMIN") {
          if (actionRequest.target_id) {
            const superadminCount = await tx.admin.count({ where: { role: "SUPERADMIN" } });
            if (superadminCount <= 1) {
              throw new Error("Cannot delete the last SUPERADMIN");
            }
            const target = await tx.admin.findUnique({ where: { id: actionRequest.target_id } });
            if (!target || target.role !== "SUPERADMIN") {
               throw new Error("Target is not a valid SUPERADMIN");
            }
            await tx.admin.delete({ where: { id: actionRequest.target_id } });
          }
        } else if (actionRequest.action_type === "MODIFY_API_KEYS") {
           // Provide basic handling for modifying API keys
           const payload = actionRequest.payload as any;
           const config = await tx.appConfig.findFirst();
           if (config) {
             await tx.appConfig.update({
               where: { id: config.id },
               data: {
                 whatsapp_token: payload?.whatsapp_token ?? config.whatsapp_token,
                 whatsapp_phone_number_id: payload?.whatsapp_phone_number_id ?? config.whatsapp_phone_number_id
               }
             });
           }
        }
        return { executed: true, rejected: false, action_type: actionRequest.action_type };
      }

      return { executed: false, rejected: false, action_type: actionRequest.action_type };
    });

    await prismaAudit.auditLog.create({
      data: {
        adminId: user.id,
        adminEmail: user.email || "unknown",
        action: `VOTE_GOVERNANCE_${vote}`,
        table: "adminActionRequest",
        recordId: id,
      }
    });

    if (result.executed) {
      await prismaAudit.auditLog.create({
        data: {
          adminId: user.id,
          adminEmail: user.email || "unknown",
          action: `EXECUTE_GOVERNANCE_${result.action_type}`,
          table: "adminActionRequest",
          recordId: id,
        }
      });
    } else if (result.rejected) {
      await prismaAudit.auditLog.create({
        data: {
          adminId: user.id,
          adminEmail: user.email || "unknown",
          action: "REJECT_GOVERNANCE",
          table: "adminActionRequest",
          recordId: id,
        }
      });
    }

    return sendSuccess(res, "Vote recorded", STATUS_CODES.OK, { executed: result.executed, rejected: result.rejected });
  } catch (error: any) {
    logger.error(`Error in submitVote: ${error.message}`);
    // If we threw a specific string from within transaction, pass it
    if (error.message === "GOVERNANCE_REQUEST_EXPIRED" || 
        error.message === "Request not found" ||
        error.message === "Request is no longer pending" ||
        error.message === "You cannot vote on your own request" ||
        error.message === "You cannot vote on a request targeting yourself" ||
        error.message === "Cannot delete the last SUPERADMIN" ||
        error.message === "Target is not a valid SUPERADMIN") {
        return sendError(res, error.message, STATUS_CODES.BAD_REQUEST);
    }
    return sendError(res, "Internal server error", STATUS_CODES.INTERNAL_SERVER_ERROR);
  }
};
