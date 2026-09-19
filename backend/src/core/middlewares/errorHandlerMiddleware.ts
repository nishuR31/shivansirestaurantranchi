import { FastifyReply, FastifyRequest } from "fastify";

import { AppError } from "../utils/errors/error.js";
import { NODE_ENV } from "../../core/config/envConfig.js";
import { sendError } from "../utils/common/response.js";

export default function errorHandler(
  err: unknown,
  req: FastifyRequest,
  res: FastifyReply,
) {
  const error =
    err instanceof AppError
      ? err
      : new AppError(
          err instanceof Error ? err.message : "Something went wrong.",
          (err as any)?.statusCode ?? 500,
        );

  const { message, statusCode, name, stack, details } = error;

  req.log.error(
    {
      err: error,
      errorName: name,
      statusCode,
      details,
      url: req.url,
      method: req.method,
    },
    `${name || "Error"}: ${message}`,
  );

  let safeMessage = message;
  let safeStatusCode = statusCode;

  // Redact Prisma errors from being sent to the client
  if (
    name.includes("PrismaClient") ||
    err?.constructor?.name?.includes("PrismaClient")
  ) {
    safeMessage = "A database error occurred.";
    safeStatusCode = 500;
  }

  const errDetails =
    NODE_ENV === "development"
      ? {
          name,
          stack,
          details,
        }
      : undefined;

  sendError(res, safeMessage, safeStatusCode, errDetails);
}
