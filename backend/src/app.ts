
import { STATUS_CODES } from "./core/utils/common/constants";
import { NODE_ENV } from "./core/config/envConfig";
import moduleRoutes from "./modules/index.routes";
import { sendError } from "./core/utils/common/response";
import fastifyApp from "./core/config/serverConfig";

import { FastifyReply, FastifyRequest } from "fastify";
const app = fastifyApp;

// NOTE: Do NOT add an abort listener here that calls sendError().
// By the time a request is aborted the Fastify reply is already finalised,
// calling sendError() on it throws "fulfilled is not a function" which kills
// the Bun process and causes a 502 crash loop on Render.

import { healthRoutes } from "./modules/system/health";

app.register(moduleRoutes, { prefix: "/api/v1" });
app.register(healthRoutes); // Expose /health at root for infrastructure checks

app.setNotFoundHandler((req: FastifyRequest, res: FastifyReply) => {
  return sendError(res, "Route not found", STATUS_CODES.NOT_FOUND);
});

import errorHandler from "./core/middlewares/errorHandlerMiddleware";
app.setErrorHandler(errorHandler);

export default app;
