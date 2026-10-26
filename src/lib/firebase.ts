// Firebase client SDK configuration
// Uses env vars if available, falls back to hardcoded values (for the user's projekwhattsaf project)
import { initializeApp, getApps, getApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getStorage } from "firebase/storage"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDrAYKLg_Go-UiqB3tmQbHEudQXYzKm3s0",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "projekwhattsaf.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "projekwhattsaf",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "projekwhattsaf.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "431649153198",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:431649153198:web:bd08dc5ef06f6c44300d3f",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-V61QGJ8BW2",
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export { app, firebaseConfig }
