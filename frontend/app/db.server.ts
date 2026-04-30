import { PrismaClient } from "@prisma/client";

console.log("[db.server] module loading...");

declare global {
  var __prisma: PrismaClient | undefined;
}

// Reuse client in development to avoid exhausting DB connections
export const prisma = global.__prisma ?? new PrismaClient();
console.log("[db.server] prisma client created:", typeof prisma);

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
