"use client"

import { useEffect, useState, useCallback } from "react"
import { Avatar } from "@/components/ui/avatar-nb"
import { api, timeAgo } from "@/lib/api"
import type { Story } from "@/lib/types"

interface StoriesBarProps {
  onView: (ownerUid: string) => void
  onCompose: () => void
  onViewMine: () => void
}

export function StoriesBar({ onView, onCompose, onViewMine }: StoriesBarProps) {
  const [stories, setStories] = useState<Story[]>([])
  const [me, setMe] = useState<{ id: string; username: string; photoURL: string | null; verified: boolean } | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await api<{ stories: Story[] }>("/api/firebase/stories")
      setStories(r.stories)
    } catch {}
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    api<{ user: any }>("/api/firebase/users?mine=1").then((r) => setMe(r.user)).catch(() => {})
    const onNew = () => load()
    window.addEventListener("story:new", onNew)
    return () => window.removeEventListener("story:new", onNew)
  }, [load])

  // Group by owner
  const byOwner = stories.reduce((acc, s) => {
    if (!acc[s.ownerId]) acc[s.ownerId] = { owner: s.owner, items: [] }
    acc[s.ownerId].items.push(s)
    return acc
  }, {} as Record<string, { owner: Story["owner"]; items: Story[] }>)

  return (
    <div className="flex gap-3 p-3 border-b-[2.5px] border-border overflow-x-auto nb-no-scrollbar bg-card">
      <button className="flex flex-col items-center gap-1 min-w-[64px]" onClick={onCompose}>
        <div
          className="w-14 h-14 rounded-full grid place-items-center"
          style={{ background: "var(--secondary)", border: "3px solid var(--border)", boxShadow: "2px 2px 0 var(--border)", outline: me?.id ? "3px solid var(--color-nb-pink)" : undefined, outlineOffset: 2 }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </div>
        <span className="text-[11px] truncate max-w-[60px]">Story kamu</span>
      </button>

      {/* My existing stories */}
      {me && byOwner[me.id] && (
        <button className="flex flex-col items-center gap-1 min-w-[64px]" onClick={onViewMine}>
          <Avatar name={me.username} src={me.photoURL} size={56} verified={me.verified} />
          <span className="text-[11px] truncate max-w-[60px]">My stories ({byOwner[me.id].items.length})</span>
        </button>
      )}

      {Object.entries(byOwner)
        .filter(([oid]) => oid !== me?.id)
        .map(([oid, { owner, items }]) => (
          <button key={oid} className="flex flex-col items-center gap-1 min-w-[64px]" onClick={() => onView(oid)}>
            <div style={{ outline: "3px solid var(--color-nb-pink)", outlineOffset: 2, borderRadius: "50%" }}>
              <Avatar name={owner.username} src={owner.photoURL || null} size={56} verified={owner.verified} />
            </div>
            <span className="text-[11px] truncate max-w-[60px]">{owner.username}</span>
          </button>
        ))}
    </div>
  )
}
