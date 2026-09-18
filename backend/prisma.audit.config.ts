import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/audit.schema.prisma",
  migrations: {
    path: "prisma/migrations/audit",
  },
  datasource: {
    url: process.env["AUDIT_DATABASE_URL"],
  },
});
