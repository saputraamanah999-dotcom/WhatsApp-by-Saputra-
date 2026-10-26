"use client"

import { useState } from "react"
import { toast } from "sonner"
import type { Story } from "@/lib/types"
import { api } from "@/lib/api"
import { io } from "socket.io-client"

interface StoryComposerProps {
  onClose: () => void
}

const BG_COLORS = [
  "#8b5cf6", "#ff4d8d", "#12b886", "#ff9f1c", "#1a1aff", "#6ab7ff", "#ff8fab", "#5cf29a",
]

export function StoryComposer({ onClose }: StoryComposerProps) {
  const [text, setText] = useState("")
  const [bg, setBg] = useState(BG_COLORS[0])
  const [posting, setPosting] = useState(false)

  const post = async () => {
    if (!text.trim() || posting) return
    setPosting(true)
    try {
      const r = await api<{ story: Story }>("/api/firebase/stories", {
        method: "POST",
        json: { type: "text", text, bg, duration: 5, audience: "all" },
      })
      // Broadcast via socket
      try {
        const sock = io("/?XTransformPort=3003", { transports: ["websocket", "polling"] })
        sock.emit("story:new", { ownerId: r.story.ownerId, ownerUsername: r.story.owner.username, storyId: r.story.id })
        setTimeout(() => sock.disconnect(), 500)
      } catch {}
      toast.success("Story diposting!")
      onClose()
    } catch (e: any) {
      toast.error("Gagal posting: " + e.message)
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 nb-fade" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="nb-card-lg p-6 w-full max-w-md nb-rise flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Buat Story</h2>
          <button className="nb-btn-icon" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div
          className="rounded-lg p-6 min-h-[200px] flex items-center justify-center text-center text-white font-bold text-xl nb-pulse"
          style={{ background: bg, border: "3px solid var(--border)", boxShadow: "4px 4px 0 var(--border)" }}
        >
          <textarea
            className="bg-transparent text-center text-white text-xl font-bold w-full outline-none resize-none placeholder:text-white/60"
            placeholder="Tulis sesuatu…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={300}
            autoFocus
            style={{ caretColor: "white" }}
          />
        </div>

        <div className="flex gap-2 justify-center flex-wrap">
          {BG_COLORS.map((c) => (
            <button
              key={c}
              className="w-9 h-9 rounded-full"
              style={{ background: c, border: "2.5px solid var(--border)", outline: bg === c ? "3px solid var(--color-nb-pink)" : "none", outlineOffset: 2, cursor: "pointer" }}
              onClick={() => setBg(c)}
            />
          ))}
        </div>

        <div className="flex gap-2 mt-2">
          <button className="nb-btn flex-1" onClick={onClose}>Batal</button>
          <button className="nb-btn nb-btn-primary flex-1" onClick={post} disabled={posting || !text.trim()}>
            {posting ? "Memposting…" : "Posting Story"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground text-center">Story akan tampil ke semua orang selama 24 jam.</p>
      </div>
    </div>
  )
}
