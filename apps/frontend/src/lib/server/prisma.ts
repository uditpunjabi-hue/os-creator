import 'server-only';
import { PrismaClient } from '@prisma/client';

// Serverless-safe singleton. Next.js dev hot-reload creates a new module
// instance on every save — without this we'd leak Prisma clients (each
// holds a pg connection) and exhaust the Supabase pooler quickly. In prod
// (Vercel Functions), each invocation reuses the warm process when warm
// and creates exactly one client on cold start.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'production'
        ? ['error']
        : ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
