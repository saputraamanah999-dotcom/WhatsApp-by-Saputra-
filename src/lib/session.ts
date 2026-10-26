// Session helper - Firebase ID token from Authorization header OR custom cookie
import { cookies } from "next/headers"
import { verifyIdToken } from "@/lib/firebase-server"

export const SESSION_COOKIE = "neobrutal-session"

/**
 * Get current user UID from request (server-side)
 */
export async function getCurrentUid(req?: Request): Promise<string | null> {
  // 1. Try Authorization header first
  if (req) {
    const authHeader = req.headers.get("authorization")
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7)
      const uid = await verifyIdToken(token)
      if (uid) return uid
    }
  }

  // 2. Try cookie
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value
    if (!sessionCookie) return null
    const uid = await verifyIdToken(sessionCookie)
    return uid
  } catch (e) {
    return null
  }
}

/**
 * Check if user has admin role
 */
export function isAdminRole(user: any): boolean {
  return user?.role === "admin" || user?.role === "superadmin"
}

/**
 * Check if user is superadmin
 */
export function isSuperAdminRole(user: any): boolean {
  return user?.role === "superadmin"
}
