"use client"

import { useState } from "react"
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  getIdToken,
} from "firebase/auth"
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  limit as fbLimit,
  query,
  getDocs,
} from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { toast } from "sonner"
import { normalizeUsername, isValidUsername } from "@/lib/utils"

export function AuthScreen() {
  const [mode, setMode] = useState<"login" | "register">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [username, setUsername] = useState("")
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    try {
      if (mode === "register") {
        const emailLc = email.trim().toLowerCase()
        const uname = normalizeUsername(username)
        if (!isValidUsername(uname)) {
          throw new Error("Username harus 3-20 karakter: huruf kecil, angka, dan _")
        }

        // Step 1: Check username uniqueness in Firestore
        const unameDoc = await getDoc(doc(db, "usernames", uname))
        if (unameDoc.exists()) {
          throw new Error("Username sudah dipakai, coba yang lain")
        }

        // Step 2: Create Firebase Auth user
        const cred = await createUserWithEmailAndPassword(auth, emailLc, password)

        // Step 3: Check if first user (superadmin)
        const usersSnap = await getDocs(query(collection(db, "users"), fbLimit(1)))
        const isFirst = usersSnap.empty
        const role = isFirst ? "superadmin" : "user"

        // Step 4: Create username doc
        await setDoc(doc(db, "usernames", uname), {
          uid: cred.user.uid,
          createdAt: Date.now(),
        })

        // Step 5: Create user doc
        await setDoc(doc(db, "users", cred.user.uid), {
          email: emailLc,
          username: uname,
          displayName: uname,
          bio: "",
          photoURL: null,
          role,
          banned: false,
          verified: isFirst,
          online: true,
          lastSeen: Date.now(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })

        toast.success(`Akun dibuat! Role: ${role}`)
        // Cookie will be set by Providers component via onAuthStateChanged
        setTimeout(() => window.location.reload(), 500)
      } else {
        // Login: sign in with Firebase Auth
        const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password)
        // Update online status
        await updateDoc(doc(db, "users", cred.user.uid), {
          online: true,
          lastSeen: Date.now(),
        })
        // Send ID token to server to set HTTP-only cookie
        const token = await getIdToken(cred.user)
        try {
          await fetch("/api/auth/firebase", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "login", idToken: token }),
          })
        } catch (e) {
          // Cookie not set, but auth state is in IndexedDB. Will work for client-side operations.
        }
        toast.success("Berhasil masuk!")
        setTimeout(() => window.location.reload(), 500)
      }
    } catch (e: any) {
      toast.error(translateError(e.message || e.code || "Terjadi kesalahan"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 nb-dot-pattern" style={{ background: "linear-gradient(160deg, #8b5cf6 0 38%, var(--background) 38%)" }}>
      <div className="nb-card-lg p-8 w-full max-w-md nb-rise flex flex-col items-center text-center gap-3">
        <div className="w-20 h-20 rounded-full grid place-items-center nb-pulse" style={{ background: "var(--color-nb-pink)", border: "3px solid var(--border)", boxShadow: "4px 4px 0 var(--border)" }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mt-2" style={{ color: "#1a1aff" }}>Neobrutal Chat</h1>
        <p className="text-sm text-muted-foreground">
          Platform chat real-time dengan tema Neobrutalism. Powered by Firebase.
        </p>

        <form onSubmit={submit} className="flex flex-col gap-3 w-full mt-4">
          {mode === "register" && (
            <input
              className="nb-input"
              placeholder="Username (3-20 huruf kecil, angka, _)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={20}
              pattern="^[a-z0-9_]{3,20}$"
              title="3-20 karakter: huruf kecil, angka, dan _"
            />
          )}
          <input
            type="email"
            className="nb-input"
            placeholder="Email aktif"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            className="nb-input"
            placeholder="Password (min. 6 karakter)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <button
            type="submit"
            disabled={loading}
            className="nb-btn nb-btn-primary w-full disabled:opacity-50"
          >
            {loading ? "Memproses…" : mode === "login" ? "Masuk" : "Daftar"}
          </button>
        </form>

        <button
          className="nb-btn nb-btn-cyan w-full"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Belum punya akun? Daftar" : "Sudah punya akun? Masuk"}
        </button>

        <p className="text-xs text-muted-foreground mt-2">
          🔥 Database: Firebase Firestore (projekwhattsaf)<br />
          Akun pertama otomatis menjadi <b>Superadmin</b>.
        </p>
      </div>
    </div>
  )
}

function translateError(msg: string): string {
  const map: Record<string, string> = {
    "auth/email-already-in-use": "Email sudah terdaftar. Silakan login.",
    "auth/invalid-email": "Format email tidak valid.",
    "auth/weak-password": "Password terlalu lemah (min. 6 karakter).",
    "auth/user-not-found": "Email tidak terdaftar.",
    "auth/wrong-password": "Password salah.",
    "auth/invalid-credential": "Email atau password salah.",
    "auth/too-many-requests": "Terlalu banyak percobaan. Coba lagi nanti.",
    "auth/network-request-failed": "Koneksi internet bermasalah.",
  }
  if (map[msg]) return map[msg]
  if (msg.startsWith("auth/")) return "Error autentikasi: " + msg.replace("auth/", "")
  return msg
}
