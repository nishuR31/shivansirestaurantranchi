import { PrismaClient as PrismaAuditClient } from "../../generated/prismaAudit";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient as PrismaAdminClient } from "../../generated/prismaAdmin";
import { PrismaClient as PrismaAppClient } from "../../generated/prismaApp";
import env from "./envConfig";
import bcrypt from "bcrypt";
import logger from "./loggerConfig";

const connectionStringAdmin = env.ADMIN_DATABASE_URL;
const connectionStringApp = env.APP_DATABASE_URL;
const connectionStringAudit = env.AUDIT_DATABASE_URL;

const poolAdmin = new Pool({
  connectionString: connectionStringAdmin,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
});
const adapterAdmin = new PrismaPg(poolAdmin);
const basePrismaAdmin = new PrismaAdminClient({ adapter: adapterAdmin });

const poolApp = new Pool({
  connectionString: connectionStringApp,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
});
const adapterApp = new PrismaPg(poolApp);
const basePrismaApp = new PrismaAppClient({ adapter: adapterApp });

const poolAudit = new Pool({
  connectionString: connectionStringAudit,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
});
const adapterAudit = new PrismaPg(poolAudit);
const basePrismaAudit = new PrismaAuditClient({ adapter: adapterAudit });
export const prismaAudit = basePrismaAudit;

interface UserData {
  password?: string;
  [key: string]: any;
}

const SALT_ROUNDS = env.SALT_ROUND || 10;

async function hashUserPassword(data: UserData): Promise<void> {
  if (data && data.password) {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    data.password = await bcrypt.hash(data.password, salt);
  }
}

export const prismaAdmin = basePrismaAdmin.$extends({
  query: {
    admin: {
      async create({ args, query }: any) {
        await hashUserPassword(args.data);
        return query(args);
      },
      async update({ args, query }: any) {
        await hashUserPassword(args.data);
        return query(args);
      },
    },
  },
}) as unknown as PrismaAdminClient;

export const prismaApp = basePrismaApp.$extends({
  query: {
    user: {
      async create({ args, query }: any) {
        await hashUserPassword(args.data);
        return query(args);
      },
      async update({ args, query }: any) {
        await hashUserPassword(args.data);
        return query(args);
      },
    },
  },
}) as unknown as PrismaAppClient;

function shutDownHandler(signal: string) {
  return async () => {
    logger.info(`Received ${signal}, shutting down gracefully.`);
    await basePrismaAdmin.$disconnect();
    await basePrismaApp.$disconnect();
    await basePrismaAudit.$disconnect();
    logger.info(`Database connections closed.`);
    process.exit(0);
  };
}

process.on("SIGINT", shutDownHandler("SIGINT"));
process.on("SIGTERM", shutDownHandler("SIGTERM"));

export default { prismaApp, prismaAdmin, prismaAudit };
