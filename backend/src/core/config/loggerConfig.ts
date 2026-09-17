// import winston from "winston";
// import { LOG_LEVEL, NODE_ENV } from "./envConfig";
// import DailyRotateFile from "winston-daily-rotate-file";

// const isDev: boolean = NODE_ENV === "development";

// const customFormat = winston.format.printf(
//   ({ timestamp, level, message, stack, ...meta }) => {
//     if (isDev) {
//       return `${timestamp} ${level}: ${message}${stack ? `\n${stack}` : ""}`;
//     }
//     const logObject: Record<string, any> = {
//       timestamp,
//       level,
//       message,
//       ...meta,
//     };
//     if (stack) {
//       logObject.stack = stack;
//     }
//     return JSON.stringify(logObject);
//   },
// );

// const baseFormat = winston.format.combine(
//   winston.format.timestamp({ format: "DD-MM-YYYY HH:mm:ss" }),
//   winston.format.tson(),
//   winston.format.errors({ stack: true }),
//   customFormat,
// );

// const consoleFormat = winston.format.combine(
//   winston.format.timestamp({ format: "DD-MM-YYYY HH:mm:ss" }),
//   winston.format.errors({ stack: true }),
//   winston.format.colorize({ all: true }),
//   customFormat,
// );

// const logger = winston.createLogger({
//   level: LOG_LEVEL,
//   format: baseFormat,
//   exitOnError: false,
//   transports: [
//     new winston.transports.Console({
//       handleExceptions: true,
//       format: consoleFormat,
//     }),
//     new DailyRotateFile({
//       filename: "logs/%DATE%-combined.log",
//       datePattern: "YYYY-MM-DD",
//       zippedArchive: true,
//       maxFiles: "14d",
//       maxSize: "20m",
//       level: "info",
//     }),
//     new DailyRotateFile({
//       filename: "logs/%DATE%-errors.log",
//       datePattern: "YYYY-MM-DD",
//       zippedArchive: true,
//       maxFiles: "30d",
//       maxSize: "20m",
//       level: "error",
//       handleExceptions: true,
//     }),
//   ],
// });

// export default logger;

import pino from "pino";

import { LOG_LEVEL, NODE_ENV } from "./envConfig";

const isDev = NODE_ENV === "development";

const logger = pino({
  level: LOG_LEVEL,

  base: {
    service: "maatara-api",
  },

  timestamp: pino.stdTimeFunctions.isoTime,

  serializers: {
    err: pino.stdSerializers.err,
  },

  formatters: {
    level: (label) => ({
      level: label,
    }),
  },

  ...(isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "dd-mm-yyyy HH:MM:ss",
            ignore: "pid,hostname",
            singleLine: false,
          },
        },
      }
    : {}),
});

export default logger;
