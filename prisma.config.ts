import { defineConfig } from 'prisma/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { config } from 'dotenv'
import { resolve } from 'path'

// Prisma evaluates this config before loading .env, so load it explicitly
config({ path: resolve(process.cwd(), '.env') })

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL as string,
  },
  migrate: {
    async adapter(env) {
      const { Pool } = await import('pg')
      return new PrismaPg(new Pool({ connectionString: env.DATABASE_URL }))
    },
  },
})
