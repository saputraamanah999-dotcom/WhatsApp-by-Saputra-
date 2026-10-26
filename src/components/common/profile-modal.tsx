"use client"

import { useEffect, useState } from "react"
import { Avatar } from "@/components/ui/avatar-nb"
import { api, timeAgo } from "@/lib/api"
import type { UserProfile } from "@/lib/types"
import { isOnline } from "@/lib/utils"
import { toast } from "sonner"

interface ProfileModalProps {
  userId: string
  onClose: () => void
  onMessage?: (uid: string) => void
}

export function ProfileModal({ userId, onClose, onMessage }: ProfileModalProps) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [me, setMe] = useState<UserProfile | null>(null)
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState("")
  const [bio, setBio] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api<{ user: UserProfile }>("/api/firebase/users?mine=1").then((r) => {
      setMe(r.user)
      if (r.user.id === userId) {
        setEditing(true)
        setDisplayName(r.user.displayName || "")
        setBio(r.user.bio || "")
      }
    }).catch(() => {})
    // Load target user
    api<{ users: UserProfile[] }>("/api/firebase/users").then((r) => {
      const u = r.users.find((x) => x.id === userId)
      if (u) setUser(u)
    }).catch(() => {})
  }, [userId])

  const save = async () => {
    setSaving(true)
    try {
      await api("/api/firebase/users", { method: "PATCH", json: { displayName, bio } })
      toast.success("Profil diperbarui")
      setEditing(false)
    } catch (e: any) {
      toast.error("Gagal: " + e.message)
    } finally {
      setSaving(false)
    }
  }

  const isMe = me?.id === userId
  const target = isMe ? me : user

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 nb-fade" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="nb-card-lg p-6 w-full max-w-md nb-rise flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{isMe ? "Profil Saya" : "Profil Pengguna"}</h2>
          <button className="nb-btn-icon" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {target ? (
          <>
            <div className="flex flex-col items-center gap-2">
              <Avatar
                name={target.username}
                src={target.photoURL || null}
                size={96}
                online={isOnline(target.lastSeen as any)}
                verified={target.verified}
              />
              <div className="text-xl font-bold">{target.displayName || target.username}</div>
              <div className="text-sm text-muted-foreground">@{target.username}</div>
              <div className="flex gap-2">
                {target.verified && (
                  <span className="nb-chip" style={{ background: "var(--color-nb-blue)", color: "#111" }}>
                    ✓ Verified
                  </span>
                )}
                {target.role !== "user" && (
                  <span className="nb-chip" style={{ background: "var(--color-nb-pink)", color: "#111" }}>
                    {target.role === "superadmin" ? "👑 Superadmin" : "🛡️ Admin"}
                  </span>
                )}
              </div>
            </div>

            {editing ? (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold">Nama Tampilan</label>
                <input className="nb-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={30} />
                <label className="text-xs font-bold">Bio</label>
                <textarea className="nb-input" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} rows={3} />
                <button className="nb-btn nb-btn-primary" onClick={save} disabled={saving}>
                  {saving ? "Menyimpan…" : "Simpan Profil"}
                </button>
              </div>
            ) : (
              <div className="nb-card-sm p-3 text-sm">
                <div className="text-xs text-muted-foreground mb-1">Bio</div>
                <div>{target.bio || "Belum ada bio."}</div>
                <div className="text-xs text-muted-foreground mt-3 mb-1">Status</div>
                <div>{isOnline(target.lastSeen as any) ? "🟢 Online" : "🔴 Offline · " + timeAgo(target.lastSeen)}</div>
                <div className="text-xs text-muted-foreground mt-3 mb-1">Bergabung</div>
                <div>{new Date(target.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</div>
              </div>
            )}

            {!isMe && onMessage && (
              <button className="nb-btn nb-btn-primary" onClick={() => onMessage(target.id)}>
                Kirim Pesan
              </button>
            )}
          </>
        ) : (
          <div className="text-center text-muted-foreground py-6">Memuat…</div>
        )}
      </div>
    </div>
  )
}
