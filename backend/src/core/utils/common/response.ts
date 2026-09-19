// import { Response } from "express";

import { FastifyReply } from "fastify";

export function sendSuccess(
  res: FastifyReply,
  message: string,
  statusCode: number,
  data: Record<string, any> | string | number | boolean | null,
  details?: Record<string, any>,
) {
  return res.code(statusCode).send({
    success: true,
    message,
    data,
    details,
  });
}

export function sendError(
  res: FastifyReply,
  message: String = "Error occured",
  statusCode: number = 500,
  details?: any,
) {
  let code = "INTERNAL_SERVER_ERROR";
  if (statusCode === 400) code = "BAD_REQUEST";
  else if (statusCode === 401) code = "UNAUTHORIZED";
  else if (statusCode === 403) code = "FORBIDDEN";
  else if (statusCode === 404) code = "NOT_FOUND";
  else if (statusCode === 405) code = "METHOD_NOT_ALLOWED";
  else if (statusCode === 409) code = "CONFLICT";
  else if (statusCode === 422) code = "UNPROCESSABLE_ENTITY";
  else if (statusCode === 429) code = "TOO_MANY_REQUESTS";

  return res.code(statusCode).send({
    success: false,
    error: {
      code,
      message,
      requestId: (res.request as any)?.id,
      details,
    },
  });
}

export function sendNotFoundError(
  res: FastifyReply,
  message: String = "Resource not found",
  statusCode: number = 404,
  details?: Record<string, any>,
) {
  return sendError(res, message, statusCode, details);
}

export function sendConflictError(
  res: FastifyReply,
  message: String = "Resource already exists",
  statusCode: number = 409,
  details?: Record<string, any>,
) {
  return sendError(res, message, statusCode, details);
}

export function sendBadRequestError(
  res: FastifyReply,
  message: String = "Invalid request",
  statusCode: number = 400,
  details?: Record<string, any>,
) {
  return sendError(res, message, statusCode, details);
}

export function sendUnauthorizedError(
  res: FastifyReply,
  message: String = "Unauthorized access",
  statusCode: number = 401,
  details?: Record<string, any>,
) {
  return sendError(res, message, statusCode, details);
}

export function sendPaymentRequiredError(
  res: FastifyReply,
  message: String = "Payment required",
  statusCode: number = 402,
  details?: Record<string, any>,
) {
  return sendError(res, message, statusCode, details);
}

export function sendRedirectionError(
  res: FastifyReply,
  message: String = "Redirecting to login page",
  statusCode: number = 302,
  details?: Record<string, any>,
) {
  return sendError(res, message, statusCode, details);
}

export function sendRateLimitError(
  res: FastifyReply,
  message: String = "Rate limit exceeded",
  statusCode: number = 429,
  details?: Record<string, any>,
) {
  return sendError(res, message, statusCode, details);
}

export function sendInternalServerError(
  res: FastifyReply,
  message: String = "Internal server error",
  statusCode: number = 500,
  details?: Record<string, any>,
) {
  return sendError(res, message, statusCode, details);
}

export function sendMethodNotAllowedError(
  res: FastifyReply,
  message: String = "Method not allowed",
  statusCode: number = 405,
  details?: Record<string, any>,
) {
  return sendError(res, message, statusCode, details);
}

export function sendValidationError(
  res: FastifyReply,
  message: String = "Validation error",
  statusCode: number = 400,
  details?: Record<string, any>,
) {
  return sendError(res, message, statusCode, details);
}
