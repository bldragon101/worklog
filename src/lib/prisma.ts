import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Add pgbouncer=true to avoid prepared statement caching issues with connection poolers
const getDatasourceUrl = () => {
  const url = process.env.DATABASE_URL || "";
  if (url.includes("pgbouncer=true")) {
    return url;
  }
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}pgbouncer=true`;
};

const adapter = new PrismaPg({
  connectionString: getDatasourceUrl(),
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
