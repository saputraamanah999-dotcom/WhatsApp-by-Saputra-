"use client"

import { useEffect, useState, useRef } from "react"
import { doc, updateDoc, onSnapshot, collection, query, where } from "firebase/firestore"
import { db, auth } from "@/lib/firebase"
import { onAuthStateChanged } from "firebase/auth"

/**
 * Hook untuk update presence (online/lastSeen) user secara berkala
 * Listen ke perubahan presence user lain
 */
export function usePresence() {
  const [onlineUsers, setOnlineUsers] = useState<{ uid: string; username: string }[]>([])
  const heartbeatRef = useRef<any>(null)

  // Update presence user sendiri
  useEffect(() => {
    let active = true
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user || !active) return
      // Set online
      try {
        await updateDoc(doc(db, "users", user.uid), {
          online: true,
          lastSeen: Date.now(),
        })
      } catch (e) {
        // ignore
      }

      // Heartbeat setiap 20 detik
      heartbeatRef.current = setInterval(async () => {
        try {
          await updateDoc(doc(db, "users", user.uid), {
            online: true,
            lastSeen: Date.now(),
          })
        } catch (e) {
          // ignore
        }
      }, 20000)

      // Listen ke presence user lain (online dalam 60 detik terakhir)
      const oneMinAgo = Date.now() - 60000
      const q = query(collection(db, "users"), where("lastSeen", ">", oneMinAgo))
      const unsubPresence = onSnapshot(q, (snap) => {
        const list: { uid: string; username: string }[] = []
        snap.forEach((doc) => {
          const d = doc.data()
          if (doc.id !== user.uid && d.username) {
            list.push({ uid: doc.id, username: d.username })
          }
        })
        setOnlineUsers(list)
      })

      // Cleanup on logout
      return () => {
        if (heartbeatRef.current) clearInterval(heartbeatRef.current)
        unsubPresence()
      }
    })

    return () => {
      active = false
      unsub()
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    }
  }, [])

  return { onlineUsers }
}
