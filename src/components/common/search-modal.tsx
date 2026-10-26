"use client"

import { useEffect, useState } from "react"
import { Avatar } from "@/components/ui/avatar-nb"
import { api } from "@/lib/api"
import { isOnline } from "@/lib/utils"
import type { UserProfile, Group, Channel } from "@/lib/types"

interface SearchModalProps {
  onClose: () => void
  onOpenUser: (uid: string) => void
  onOpenGroup: (gid: string) => void
}

export function SearchModal({ onClose, onOpenUser, onOpenGroup }: SearchModalProps) {
  const [q, setQ] = useState("")
  const [users, setUsers] = useState<UserProfile[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (q.trim().length < 2) {
      setUsers([])
      setGroups([])
      setChannels([])
      return
    }
    let cancelled = false
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const r = await api<{ users: UserProfile[]; groups: Group[]; channels: Channel[] }>(`/api/search?q=${encodeURIComponent(q.trim().toLowerCase())}`)
        if (!cancelled) {
          setUsers(r.users)
          setGroups(r.groups)
          setChannels(r.channels)
        }
      } catch {} finally {
        if (!cancelled) setLoading(false)
      }
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [q])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20 nb-fade" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="nb-card-lg p-4 w-full max-w-2xl nb-rise flex flex-col gap-3 max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <input
            className="nb-input flex-1"
            placeholder="Cari user, grup, atau channel…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          <button className="nb-btn-icon" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto nb-scroll">
          {loading && <div className="text-center text-muted-foreground py-4 text-sm">Mencari…</div>}

          {!loading && q.trim().length >= 2 && users.length === 0 && groups.length === 0 && channels.length === 0 && (
            <div className="text-center text-muted-foreground py-4 text-sm">
              Tidak ada hasil untuk "<b>{q}</b>"
            </div>
          )}

          {users.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-bold mb-2 text-muted-foreground px-2">PENGGUNA ({users.length})</div>
              {users.map((u) => (
                <button
                  key={u.id}
                  className="w-full flex items-center gap-3 p-2 hover:bg-muted rounded-lg transition-colors text-left"
                  onClick={() => onOpenUser(u.id)}
                >
                  <Avatar
                    name={u.username}
                    src={u.photoURL || null}
                    size={40}
                    online={isOnline(u.lastSeen as any)}
                    verified={u.verified}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{u.displayName || u.username}</div>
                    <div className="text-xs text-muted-foreground truncate">@{u.username}</div>
                  </div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                </button>
              ))}
            </div>
          )}

          {groups.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-bold mb-2 text-muted-foreground px-2">GRUP ({groups.length})</div>
              {groups.map((g) => (
                <button
                  key={g.id}
                  className="w-full flex items-center gap-3 p-2 hover:bg-muted rounded-lg transition-colors text-left"
                  onClick={() => onOpenGroup(g.id)}
                >
                  <Avatar name={g.name} size={40} />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{g.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{g.memberCount} anggota · {g.visibility}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {channels.length > 0 && (
            <div>
              <div className="text-xs font-bold mb-2 text-muted-foreground px-2">CHANNEL ({channels.length})</div>
              {channels.map((c) => (
                <a
                  key={c.id}
                  className="w-full flex items-center gap-3 p-2 hover:bg-muted rounded-lg transition-colors"
                  href="#"
                  onClick={(e) => { e.preventDefault(); /* TODO: open channel */ }}
                >
                  <Avatar name={c.name} size={40} />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground truncate">@{c.slug} · {c.followerCount} followers</div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="text-xs text-muted-foreground text-center border-t-2 border-border pt-2">
          Ketik minimal 2 huruf untuk mulai mencari
        </div>
      </div>
    </div>
  )
}
