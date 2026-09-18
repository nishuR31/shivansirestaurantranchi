import { FastifyRequest, FastifyReply } from "fastify";
import { prismaApp, prismaAdmin } from "../../core/config/databaseConfig";
import logger from "../../core/config/loggerConfig";
import { z } from "zod";

export const getRequests = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const user = req.user as any;
    if (user.role !== "SUPERADMIN") return res.status(403).send({ error: "Only superadmins can access governance" });

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

    return res.send({ success: true, requests });
  } catch (error: any) {
    logger.error(`Error in getRequests: ${error.message}`);
    return res.status(500).send({ error: "Internal server error" });
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
    if (user.role !== "SUPERADMIN") return res.status(403).send({ error: "Only superadmins can propose governance actions" });

    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).send({ error: "Invalid request data", details: parsed.error.format() });

    const superadmins = await prismaAdmin.admin.count({ where: { role: "SUPERADMIN" } });
    const required_approvals = superadmins > 1 ? superadmins - Math.floor(superadmins / 2) : 0; // Requires ALL other superadmins to approve

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

    // Send notifications to all other superadmins here...

    return res.send({ success: true, request: newRequest });
  } catch (error: any) {
    logger.error(`Error in requestAction: ${error.message}`);
    return res.status(500).send({ error: "Internal server error" });
  }
};

export const submitVote = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const user = req.user as any;
    if (user.role !== "SUPERADMIN") return res.status(403).send({ error: "Only superadmins can vote" });

    const { id } = req.params as any;
    const { vote } = req.body as any; // "APPROVE" or "REJECT"

    if (vote !== "APPROVE" && vote !== "REJECT") {
      return res.status(400).send({ error: "Invalid vote" });
    }

    const actionRequest = await prismaAdmin.adminActionRequest.findUnique({
      where: { id }
    });

    if (!actionRequest) return res.status(404).send({ error: "Request not found" });
    if (actionRequest.status !== "PENDING") return res.status(400).send({ error: "Request is no longer pending" });
    if (actionRequest.requester_id === user.id) return res.status(400).send({ error: "You cannot vote on your own request" });
    if (actionRequest.target_id === user.id) return res.status(400).send({ error: "You cannot vote on a request targeting yourself" });

    // Record vote
    const existingVote = await prismaAdmin.adminActionVote.findFirst({
      where: { request_id: id, voter_id: user.id }
    });

    if (existingVote) {
      await prismaAdmin.adminActionVote.update({
        where: { id: existingVote.id },
        data: { vote }
      });
    } else {
      await prismaAdmin.adminActionVote.create({
        data: { request_id: id, voter_id: user.id, vote }
      });
    }

    // Check approvals
    const approvalsCount = await prismaAdmin.adminActionVote.count({
      where: { request_id: id, vote: "APPROVE" }
    });

    if (approvalsCount >= actionRequest.required_approvals) {
      await prismaAdmin.adminActionRequest.update({
        where: { id },
        data: { status: "EXECUTED", approvals: approvalsCount }
      });

      // Execution Logic
      if (actionRequest.action_type === "SUSPEND_APP") {
        const payload = actionRequest.payload as any;
        await prismaAdmin.restaurantSettings.updateMany({
          data: {
            is_suspended: true,
            shutdown_message: payload?.message ?? "Restaurant suspended",
            shutdown_code: 402
          }
        });
      } else if (actionRequest.action_type === "DELETE_SUPERADMIN") {
        if (actionRequest.target_id) {
          await prismaAdmin.admin.delete({ where: { id: actionRequest.target_id } });
        }
      }

      return res.send({ success: true, executed: true });
    }

    return res.send({ success: true, executed: false });
  } catch (error: any) {
    logger.error(`Error in submitVote: ${error.message}`);
    return res.status(500).send({ error: "Internal server error" });
  }
};
