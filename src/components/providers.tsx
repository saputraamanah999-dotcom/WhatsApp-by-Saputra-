"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { onAuthStateChanged, signOut as fbSignOut, getIdToken } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { ThemeProvider } from "next-themes"

interface AuthContextValue {
  user: { uid: string; email: string | null } | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signOut: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthContextValue["user"]>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setUser({ uid: fbUser.uid, email: fbUser.email })
        // Refresh ID token in cookie periodically
        try {
          const token = await getIdToken(fbUser)
          await fetch("/api/auth/firebase", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "login", idToken: token }),
          })
        } catch (e) {
          // ignore
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const signOut = async () => {
    try {
      await fetch("/api/auth/firebase", { method: "DELETE" })
    } catch {}
    await fbSignOut(auth)
    window.location.href = "/"
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        {children}
      </ThemeProvider>
    </AuthContext.Provider>
  )
}
