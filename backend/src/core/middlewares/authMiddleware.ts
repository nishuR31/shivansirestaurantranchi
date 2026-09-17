// import { Request, Response, NextFunction } from "express";

import { FastifyReply, FastifyRequest } from "fastify";
import { User } from "../types";
import { verifyAccessToken } from "../utils/helpers/jwt";
import { UnauthorizedError } from "../utils/errors/error";
import asyncHandler from "../utils/common/asyncHandler";

export const authenticate = asyncHandler(
  async (req: FastifyRequest, res: FastifyReply) => {
    // Accept token from Authorization: Bearer header OR httpOnly accessToken cookie
    const token = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : req.cookies?.accessToken;

    if (!token) {
      throw new UnauthorizedError("Access denied. No token provided. Please log in.");
    }

    const decoded = await verifyAccessToken(token);

    delete req.headers.role;
    delete req.headers["x-role"];
    delete req.headers["x-user-role"];

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    } as User;
  },
);
