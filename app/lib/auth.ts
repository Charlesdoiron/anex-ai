import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { prisma } from "./prisma"

const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET
const BETTER_AUTH_URL =
  process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL

if (!BETTER_AUTH_SECRET) {
  const errorMessage =
    "BETTER_AUTH_SECRET environment variable is required. Please set it in your environment variables."
  console.error(`❌ ${errorMessage}`)
  throw new Error(errorMessage)
}

if (!BETTER_AUTH_URL) {
  console.warn(
    "⚠️  BETTER_AUTH_URL and NEXT_PUBLIC_APP_URL are not set. Auth may not work correctly in production."
  )
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day (will update the session expiry if the user is active)
  },
  baseURL: BETTER_AUTH_URL,
  secret: BETTER_AUTH_SECRET,
})
