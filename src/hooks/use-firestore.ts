"use client"

import { useEffect, useState, useRef } from "react"
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  DocumentData,
  QueryConstraint,
} from "firebase/firestore"
import { db } from "@/lib/firebase"

/**
 * Subscribe ke Firestore collection dengan real-time updates
 */
export function useFirestoreCollection<T = DocumentData>(
  path: string | null,
  ...constraints: QueryConstraint[]
) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const unsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!path) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData([])
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const q = query(collection(db, path), ...constraints)
      const unsub = onSnapshot(
        q,
        (snap) => {
          const items: T[] = []
          snap.forEach((doc) => {
            items.push({ id: doc.id, ...doc.data() } as T)
          })
          setData(items)
          setLoading(false)
        },
        (err) => {
          console.error("[firestore] listen error:", err)
          setError(err.message)
          setLoading(false)
        }
      )
      unsubRef.current = unsub
      return () => {
        unsub()
        unsubRef.current = null
      }
    } catch (e: any) {
      setError(e.message)
      setLoading(false)
    }
     
  }, [path, JSON.stringify(constraints.map((c) => (c as any)._field || JSON.stringify(c)))])

  return { data, loading, error }
}

/**
 * Subscribe ke single Firestore document
 */
export function useFirestoreDoc<T = DocumentData>(path: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!path) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(null)
       
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const unsub = onSnapshot(
      doc(db, path),
      (snap) => {
        if (snap.exists()) {
          setData({ id: snap.id, ...snap.data() } as T)
        } else {
          setData(null)
        }
        setLoading(false)
      },
      (err) => {
        console.error("[firestore] doc listen error:", err)
        setError(err.message)
        setLoading(false)
      }
    )
    return () => unsub()
  }, [path])

  return { data, loading, error }
}
