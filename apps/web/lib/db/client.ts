// @route apps/web/lib/db/client.ts
// npm install @neondatabase/serverless

import { neon } from '@neondatabase/serverless'

// DATABASE_URL vem do painel do Neon → Connection string → Pooled connection
export const sql = neon(process.env.DATABASE_URL!)