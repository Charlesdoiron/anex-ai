import { cookies } from "next/headers"
import { auth } from "./auth"

/**
 * Get the current session on the server side
 * Use this in Server Components and Server Actions
 */
export async function getSession() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get("better-auth.session_token")

  if (!sessionToken?.value) {
    return null
  }

  try {
    const session = await auth.api.getSession({
      headers: {
        cookie: `better-auth.session_token=${sessionToken.value}`,
      },
    })

    return session
  } catch (error) {
    console.error("Failed to get session:", error)
    return null
  }
}

/**
 * Get the current user
 * Returns null if not authenticated
 */
export async function getCurrentUser() {
  const session = await getSession()
  return session?.user || null
}

/**
 * Require authentication for a page
 * Throws an error if user is not authenticated
 */
export async function requireAuth() {
  const session = await getSession()

  if (!session) {
    throw new Error("Unauthorized")
  }

  return session
}
