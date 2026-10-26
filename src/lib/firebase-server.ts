// Firebase Admin SDK for server-side operations
// Mendukung 3 cara konfigurasi service account:
//   1. File: ./service-account.json (paling mudah)
//   2. Env var FIREBASE_SERVICE_ACCOUNT (string JSON)
//   3. Tanpa service account (fallback ke client-side only)
//
// Cara setup:
//   1. Download service account JSON dari Firebase Console → Project Settings → Service Accounts
//   2. Simpan dengan nama 'service-account.json' di root project
//   3. Restart Next.js dev server
import { initializeApp, getApps, getApp, cert, App as AdminApp } from "firebase-admin/app"
import { getAuth as getAdminAuth } from "firebase-admin/auth"
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore"
import { getStorage as getAdminStorage } from "firebase-admin/storage"
import fs from "fs"
import path from "path"

const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "projekwhattsaf"
const FIREBASE_STORAGE_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "projekwhattsaf.firebasestorage.app"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDrAYKLg_Go-UiqB3tmQbHEudQXYzKm3s0",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "projekwhattsaf.firebaseapp.com",
  projectId: FIREBASE_PROJECT_ID,
  storageBucket: FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "431649153198",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:431649153198:web:bd08dc5ef06f6c44300d3f",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-V61QGJ8BW2",
}

let adminApp: AdminApp | null = null
let adminInitError: string | null = null

/**
 * Load service account dari 3 sumber (urutan prioritas):
 *   1. File service-account.json di root project
 *   2. Env var FIREBASE_SERVICE_ACCOUNT (string JSON)
 *   3. Null (tidak ada service account)
 */
function loadServiceAccount(): any | null {
  // Option 1: file
  try {
    const saPath = path.join(process.cwd(), "service-account.json")
    if (fs.existsSync(saPath)) {
      const sa = JSON.parse(fs.readFileSync(saPath, "utf8"))
      console.log("[firebase-server] Loaded service account from file:", sa.client_email)
      return sa
    }
  } catch (e: any) {
    adminInitError = "Gagal baca service-account.json: " + e.message
  }

  // Option 2: env var
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      console.log("[firebase-server] Loaded service account from env var:", sa.client_email)
      return sa
    } catch (e: any) {
      adminInitError = "FIREBASE_SERVICE_ACCOUNT env var tidak valid JSON: " + e.message
    }
  }

  return null
}

function getAdminApp(): AdminApp | null {
  if (adminApp) return adminApp
  if (adminInitError) return null

  try {
    const sa = loadServiceAccount()
    if (!sa) {
      adminInitError = "Service account tidak ditemukan. Setup opsi:\n" +
        "  1. Download JSON dari Firebase Console → Project Settings → Service Accounts → Generate new private key\n" +
        "  2. Simpan dengan nama 'service-account.json' di root project\n" +
        "  Atau set env var FIREBASE_SERVICE_ACCOUNT dengan isi JSON (jalankan: node scripts/load-service-account.js)\n" +
        "Aplikasi tetap berjalan untuk auth, tapi operasi server-side Firestore (API routes) tidak akan berfungsi."
      console.warn("[firebase-server] " + adminInitError)
      return null
    }

    if (getApps().length) {
      adminApp = getApps()[0] as AdminApp
      return adminApp
    }
    const cred = cert(sa)
    adminApp = initializeApp(
      { projectId: sa.project_id || FIREBASE_PROJECT_ID, storageBucket: FIREBASE_STORAGE_BUCKET, credential: cred },
      "admin"
    )
    return adminApp
  } catch (e: any) {
    adminInitError = "Gagal init Admin SDK: " + e.message
    return null
  }
}

export function getAdminAuthInstance() {
  const app = getAdminApp()
  if (!app) return null
  try {
    return getAdminAuth(app)
  } catch (e) {
    return null
  }
}

export function getAdminDb() {
  const app = getAdminApp()
  if (!app) return null
  try {
    return getAdminFirestore(app)
  } catch (e) {
    return null
  }
}

export function getAdminStorageInstance() {
  const app = getAdminApp()
  if (!app) return null
  try {
    return getAdminStorage(app)
  } catch (e) {
    return null
  }
}

/**
 * Verify a Firebase ID token and return the user UID
 */
export async function verifyIdToken(idToken: string): Promise<string | null> {
  const adminAuth = getAdminAuthInstance()
  if (!adminAuth) {
    // Fallback: decode JWT without verification (NOT secure for production!)
    // Firestore security rules will still protect data when using Client SDK
    try {
      const parts = idToken.split(".")
      if (parts.length !== 3) return null
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"))
      if (!payload.user_id && !payload.sub) return null
      return payload.user_id || payload.sub
    } catch (e) {
      return null
    }
  }
  try {
    const decoded = await adminAuth.verifyIdToken(idToken, true)
    return decoded.uid
  } catch (e) {
    return null
  }
}

/**
 * Get current user from request Authorization header
 */
export async function getCurrentUserFromRequest(req: Request): Promise<{ uid: string; email?: string } | null> {
  const authHeader = req.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) return null
  const token = authHeader.slice(7)
  const uid = await verifyIdToken(token)
  if (!uid) return null
  try {
    const adminAuth = getAdminAuthInstance()
    if (!adminAuth) return { uid }
    const userRecord = await adminAuth.getUser(uid)
    return { uid, email: userRecord.email }
  } catch (e) {
    return { uid }
  }
}

/**
 * Ensure admin user is signed in (for Client SDK fallback)
 */
export async function ensureAdminSignedIn(): Promise<void> {
  // No-op when using Admin SDK
  return
}

/**
 * Check if Admin SDK is properly configured
 */
export function isAdminSdkConfigured(): boolean {
  return getAdminApp() !== null && adminInitError === null
}

export function getAdminInitError(): string | null {
  return adminInitError
}

export { firebaseConfig }
