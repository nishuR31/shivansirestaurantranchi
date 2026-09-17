import fastify, { FastifyReply, FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import multipart from "@fastify/multipart";
import compress from "@fastify/compress";
import rateLimiter from "../middlewares/rateLimiter";
import version from "../utils/helpers/version";
import { WEB_ORIGIN } from "./envConfig";
import { env } from "node:process";

let fastifyApp = fastify({ logger: true, exposeHeadRoutes: true });

await fastifyApp.register(cors, {
  origin: process.env.NODE_ENV === "production" ? WEB_ORIGIN : true,
  credentials: true,
});
await fastifyApp.register(cookie);
await fastifyApp.register(rateLimiter);
await fastifyApp.register(compress, {
  encodings: ["gzip", "deflate", "br"],
});
await fastifyApp.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
});

await fastifyApp.register(swagger, {
  openapi: {
    info: {
      title: "AuthService API",
      description: "Authentication and User Management Microservice",
      version: "1.0.0",
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
  },
});

await fastifyApp.register(swaggerUi, {
  routePrefix: "/docs",
  uiConfig: { deepLinking: true },
  staticCSP: false,
});

fastifyApp.get("/", (req: FastifyRequest, res: FastifyReply) => {
  res
    .code(200)
    .send({ message: "Server fired up", version: version, mode: env.NODE_ENV });
});

export default fastifyApp;
export type { fastifyApp };
