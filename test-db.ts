import { PrismaClient } from "./backend/generated/prismaAudit/index.js";
const prisma = new PrismaClient();
async function main() {
  const logs = await prisma.auditLog.findMany();
  console.log("Audit Logs:", logs);
}
main().catch(console.error).finally(() => prisma.$disconnect());
