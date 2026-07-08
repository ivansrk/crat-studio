import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client'

// Prisma 7: генератор "prisma-client" больше не принимает datasource.url в схеме —
// подключение передаётся клиенту через driver adapter (см. prisma.config.ts для CLI/миграций).
const g = globalThis as unknown as { prisma?: PrismaClient }
export const db =
  g.prisma ?? new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
if (process.env.NODE_ENV !== 'production') g.prisma = db
