import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { normalizeUsername, isValidUsername } from "@/lib/utils"

const DEV_EMAIL = "admin@neobrutal.chat"

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        action: { label: "Action", type: "text" },
        username: { label: "Username", type: "text" },
      },
      async authorize(creds) {
        if (!creds?.email || !creds?.password) return null
        const email = creds.email.trim().toLowerCase()
        const action = creds.action || "login"

        if (action === "register") {
          const username = normalizeUsername(creds.username || "")
          if (!isValidUsername(username)) {
            throw new Error("Username harus 3-20 karakter: huruf kecil, angka, dan _")
          }
          const existsEmail = await db.user.findUnique({ where: { email } })
          if (existsEmail) throw new Error("Email sudah terdaftar. Silakan login.")
          const existsUsername = await db.user.findUnique({ where: { username } })
          if (existsUsername) throw new Error("Username sudah dipakai, coba yang lain.")

          const hash = await bcrypt.hash(creds.password, 10)
          const isFirstUser = (await db.user.count()) === 0
          const user = await db.user.create({
            data: {
              email,
              username,
              displayName: username,
              passwordHash: hash,
              role: isFirstUser ? "superadmin" : "user",
              verified: isFirstUser,
            },
          })
          return { id: user.id, email: user.email, name: user.username, role: user.role } as any
        }

        // Login
        const user = await db.user.findUnique({ where: { email } })
        if (!user) throw new Error("Email tidak ditemukan. Daftar dulu ya.")
        if (user.banned) throw new Error("Akun diblokir oleh admin.")
        const ok = await bcrypt.compare(creds.password, user.passwordHash)
        if (!ok) throw new Error("Password salah.")
        await db.user.update({
          where: { id: user.id },
          data: { online: true, lastSeen: new Date() },
        })
        return {
          id: user.id,
          email: user.email,
          name: user.username,
          role: user.role,
          banned: user.banned,
        } as any
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id
        token.role = (user as any).role || "user"
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token) {
        ;(session.user as any).id = token.uid as string
        ;(session.user as any).role = (token.role as string) || "user"
      }
      return session
    },
  },
}

export async function getCurrentUser(req?: Request) {
  const { getServerSession } = await import("next-auth")
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  return session.user as { id: string; name: string; email: string; role: string }
}

export function isAdmin(user: { role: string } | null | undefined): boolean {
  return !!user && (user.role === "admin" || user.role === "superadmin")
}

export function isSuperAdmin(user: { role: string } | null | undefined): boolean {
  return !!user && user.role === "superadmin"
}
