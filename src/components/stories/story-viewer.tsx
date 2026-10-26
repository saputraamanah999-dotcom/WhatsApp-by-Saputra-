"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { Avatar } from "@/components/ui/avatar-nb"
import { api, formatTime } from "@/lib/api"
import type { Story } from "@/lib/types"
import { toast } from "sonner"
import { io } from "socket.io-client"

interface StoryViewerProps {
  ownerUid: string
  onClose: () => void
}

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"]

export function StoryViewer({ ownerUid, onClose }: StoryViewerProps) {
  const [stories, setStories] = useState<Story[]>([])
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState<{ id: string; username: string } | null>(null)
  const timerRef = useRef<any>(null)

  useEffect(() => {
    api<{ user: any }>("/api/firebase/users?mine=1").then((r) => setMe({ id: r.user.id, username: r.user.username })).catch(() => {})
  }, [])

  useEffect(() => {
    api<{ stories: Story[] }>("/api/firebase/stories").then((r) => {
      const mine = r.stories.filter((s) => s.ownerId === ownerUid)
      setStories(mine.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [ownerUid])

  const advance = useCallback(() => {
    setCurrent((c) => {
      if (c + 1 >= stories.length) {
        onClose()
        return c
      }
      return c + 1
    })
  }, [stories.length, onClose])

  useEffect(() => {
    if (stories.length === 0) return
    const story = stories[current]
    if (!story) return

    // Mark viewed
    api("/api/firebase/stories/view", { method: "POST", json: { storyId: story.id } }).catch(() => {})
    try {
      const sock = io("/?XTransformPort=3003", { transports: ["websocket", "polling"] })
      sock.emit("story:view", { storyId: story.id, ownerId: story.ownerId, viewerId: me?.id, viewerUsername: me?.username })
      setTimeout(() => sock.disconnect(), 500)
    } catch {}

    const dur = (story.duration || 5) * 1000
    timerRef.current = setTimeout(advance, dur)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [current, stories, me, advance])

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center nb-fade" style={{ background: "rgba(0,0,0,0.95)" }}>
        <div className="text-white text-sm">Memuat story…</div>
      </div>
    )
  }

  if (stories.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center nb-fade" style={{ background: "rgba(0,0,0,0.95)" }} onClick={onClose}>
        <div className="text-white">Belum ada story. Klik untuk tutup.</div>
      </div>
    )
  }

  const story = stories[current]
  if (!story) return null

  const isMine = story.ownerId === me?.id

  const react = async (emoji: string) => {
    try {
      await api("/api/firebase/stories/reaction", { method: "POST", json: { storyId: story.id, emoji } })
      try {
        const sock = io("/?XTransformPort=3003", { transports: ["websocket", "polling"] })
        sock.emit("story:reaction", { storyId: story.id, ownerId: story.ownerId, emoji, byUid: me?.id, byUsername: me?.username })
        setTimeout(() => sock.disconnect(), 500)
      } catch {}
      toast(emoji + " terkirim!")
    } catch (e: any) {
      toast.error("Gagal: " + e.message)
    }
  }

  const del = async () => {
    if (!confirm("Hapus story ini?")) return
    try {
      await api(`/api/stories?id=${story.id}`, { method: "DELETE" })
      toast.success("Story dihapus")
      advance()
    } catch (e: any) {
      toast.error("Gagal: " + e.message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center nb-fade" style={{ background: "rgba(0,0,0,0.95)" }} onClick={onClose}>
      {/* Progress bars */}
      <div className="absolute top-0 left-0 right-0 p-2 flex gap-1 z-10">
        {stories.map((_, i) => (
          <div key={i} className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.3)" }}>
            <div
              className="h-full"
              style={{
                background: "white",
                width: i < current ? "100%" : i === current ? "100%" : "0%",
                transition: i === current ? `width ${story.duration || 5}s linear` : undefined,
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-6 left-0 right-0 p-3 flex items-center gap-2 z-10" onClick={(e) => e.stopPropagation()}>
        <Avatar name={story.owner.username} src={story.owner.photoURL || null} size={36} verified={story.owner.verified} />
        <div className="flex-1">
          <div className="text-white font-bold text-sm">@{story.owner.username}</div>
          <div className="text-white/70 text-xs">{formatTime(story.createdAt)}</div>
        </div>
        <button className="text-white p-2" onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div
        className="relative w-full max-w-md mx-4 aspect-[9/16] rounded-2xl flex items-center justify-center text-center overflow-hidden"
        style={{ background: story.bg || "#8b5cf6", border: "3px solid #fff", boxShadow: "8px 8px 0 #000" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-white font-bold text-2xl px-6 whitespace-pre-wrap break-words">{story.text}</div>

        {/* Click zones for prev/next */}
        <button
          className="absolute left-0 top-0 bottom-0 w-1/3"
          onClick={(e) => { e.stopPropagation(); setCurrent((c) => Math.max(0, c - 1)) }}
        />
        <button
          className="absolute right-0 top-0 bottom-0 w-2/3"
          onClick={(e) => { e.stopPropagation(); advance() }}
        />
      </div>

      {/* Footer actions */}
      <div className="absolute bottom-6 left-0 right-0 p-3 flex items-center justify-center gap-2 z-10" onClick={(e) => e.stopPropagation()}>
        {!isMine ? (
          <div className="flex gap-2">
            {REACTION_EMOJIS.map((e) => (
              <button
                key={e}
                className="w-11 h-11 rounded-full text-2xl hover:scale-125 transition-transform"
                style={{ background: "rgba(255,255,255,0.2)", border: "2px solid white" }}
                onClick={() => react(e)}
              >
                {e}
              </button>
            ))}
          </div>
        ) : (
          <button className="nb-btn nb-btn-danger" onClick={del}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline mr-1">
              <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            </svg>
            Hapus
          </button>
        )}
      </div>
    </div>
  )
}
