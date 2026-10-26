"use client"

import { useEffect, useState, useCallback } from "react"
import { Avatar } from "@/components/ui/avatar-nb"
import { api, formatTime, renderText } from "@/lib/api"
import type { Channel, ChannelPost } from "@/lib/types"
import { toast } from "sonner"

export function ChannelsView() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [followed, setFollowed] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState("")
  const [newSlug, setNewSlug] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [creating, setCreating] = useState(false)
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null)
  const [posts, setPosts] = useState<ChannelPost[]>([])
  const [newPost, setNewPost] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [all, f] = await Promise.all([
        api<{ channels: Channel[] }>("/api/firebase/channels"),
        api<{ channels: Channel[] }>("/api/firebase/channels?followed=1"),
      ])
      setChannels(all.channels)
      setFollowed(f.channels)
    } catch {} finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!newName.trim() || creating) return
    setCreating(true)
    try {
      const r = await api<{ channel: Channel }>("/api/firebase/channels", {
        method: "POST",
        json: { name: newName, slug: newSlug, description: newDesc },
      })
      toast.success("Channel dibuat!")
      setShowCreate(false)
      setNewName(""); setNewSlug(""); setNewDesc("")
      load()
      setActiveChannel(r.channel)
    } catch (e: any) {
      toast.error("Gagal: " + e.message)
    } finally {
      setCreating(false)
    }
  }

  const follow = async (cid: string) => {
    try {
      await api("/api/firebase/channels/follow", { method: "POST", json: { channelId: cid } })
      toast.success("Mengikuti channel!")
      load()
    } catch (e: any) {
      toast.error("Gagal: " + e.message)
    }
  }

  const unfollow = async (cid: string) => {
    try {
      await api(`/api/channels/follow?channelId=${cid}`, { method: "DELETE" })
      toast.success("Berhenti mengikuti")
      load()
    } catch (e: any) {
      toast.error("Gagal: " + e.message)
    }
  }

  const openChannel = async (c: Channel) => {
    setActiveChannel(c)
    try {
      const r = await api<{ posts: ChannelPost[] }>(`/api/channels/posts?channelId=${c.id}`)
      setPosts(r.posts)
    } catch (e: any) {
      toast.error("Gagal memuat post: " + e.message)
    }
  }

  const publishPost = async () => {
    if (!activeChannel || !newPost.trim()) return
    try {
      const r = await api<{ post: ChannelPost }>("/api/firebase/channels/posts", {
        method: "POST",
        json: { channelId: activeChannel.id, text: newPost },
      })
      setPosts((prev) => [r.post, ...prev])
      setNewPost("")
      toast.success("Post dipublikasikan!")
    } catch (e: any) {
      toast.error("Gagal: " + e.message)
    }
  }

  if (activeChannel) {
    const isOwner = false // TODO: compare with my uid
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-card">
        <header className="flex items-center gap-2 p-3 border-b-[2.5px] border-border" style={{ background: "var(--color-nb-cyan)" }}>
          <button className="nb-btn-icon" onClick={() => setActiveChannel(null)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <Avatar name={activeChannel.name} src={activeChannel.photoURL || null} size={42} />
          <div className="flex-1">
            <div className="font-bold text-base truncate">{activeChannel.name}</div>
            <div className="text-xs text-muted-foreground">@{activeChannel.slug} · {activeChannel.followerCount} followers</div>
          </div>
        </header>

        {activeChannel.description && (
          <div className="p-3 border-b-2 border-border text-sm">{activeChannel.description}</div>
        )}

        {/* Composer if owner */}
        <div className="p-3 border-b-2 border-border flex gap-2">
          <textarea
            className="nb-input flex-1"
            placeholder="Tulis post untuk channel ini…"
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            rows={2}
            maxLength={5000}
          />
          <button className="nb-btn nb-btn-primary" onClick={publishPost} disabled={!newPost.trim()}>
            Post
          </button>
        </div>

        <div className="flex-1 overflow-y-auto nb-scroll p-3 flex flex-col gap-3">
          {posts.length === 0 ? (
            <div className="text-center text-muted-foreground py-6 text-sm">
              <div className="text-3xl mb-2">📭</div>
              Belum ada post di channel ini
            </div>
          ) : (
            posts.map((p) => (
              <div key={p.id} className="nb-card-sm p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Avatar name={p.authorUsername} src={p.authorPhoto || null} size={32} verified={p.authorVerified} />
                  <div>
                    <div className="text-sm font-bold">{p.authorDisplayName || p.authorUsername}</div>
                    <div className="text-xs text-muted-foreground">@{p.authorUsername} · {formatTime(p.createdAt)}</div>
                  </div>
                </div>
                <div
                  className="text-sm whitespace-pre-wrap break-words leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderText(p.text) }}
                />
                {p.mediaURL && (
                   
                  <img src={p.mediaURL} alt="" className="mt-2 rounded-lg max-w-full" style={{ border: "2px solid var(--border)" }} />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-card">
      <header className="flex items-center gap-2 p-3 border-b-[2.5px] border-border" style={{ background: "var(--color-nb-cyan)" }}>
        <Avatar name="📢" size={42} />
        <div className="flex-1">
          <div className="font-bold text-base">Channel</div>
          <div className="text-xs text-muted-foreground">{followed.length} diikuti · {channels.length} total</div>
        </div>
        <button className="nb-btn nb-btn-accent text-sm py-2" onClick={() => setShowCreate(true)}>
          + Buat
        </button>
      </header>

      <div className="flex-1 overflow-y-auto nb-scroll">
        {followed.length > 0 && (
          <>
            <div className="text-xs font-bold p-2 bg-muted">DIKUTI</div>
            {followed.map((c) => (
              <button
                key={c.id}
                className="w-full p-3 border-b-2 border-border hover:bg-muted transition-colors flex items-center gap-3 text-left"
                onClick={() => openChannel(c)}
              >
                <Avatar name={c.name} src={c.photoURL || null} size={48} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground truncate">@{c.slug} · {c.followerCount} followers</div>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            ))}
          </>
        )}

        <div className="text-xs font-bold p-2 bg-muted">SEMUA CHANNEL</div>
        {loading ? (
          <div className="text-center text-muted-foreground py-6 text-sm">Memuat…</div>
        ) : channels.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center gap-2 p-6">
            <div className="text-4xl">📢</div>
            <div className="font-bold">Belum ada channel</div>
            <div className="text-xs">Jadilah yang pertama membuat channel!</div>
          </div>
        ) : (
          channels.map((c) => (
            <div key={c.id} className="p-3 border-b-2 border-border hover:bg-muted transition-colors flex items-center gap-3">
              <Avatar name={c.name} src={c.photoURL || null} size={48} />
              <div className="flex-1 min-w-0">
                <button className="font-bold text-sm truncate block text-left w-full" onClick={() => openChannel(c)}>
                  {c.name}
                </button>
                <div className="text-xs text-muted-foreground truncate">@{c.slug} · {c.followerCount} followers</div>
                {c.description && <div className="text-xs mt-1 truncate">{c.description}</div>}
              </div>
              <button
                className="nb-btn text-sm py-1.5"
                style={{ background: followed.some((f) => f.id === c.id) ? "var(--muted)" : "var(--secondary)" }}
                onClick={() => followed.some((f) => f.id === c.id) ? unfollow(c.id) : follow(c.id)}
              >
                {followed.some((f) => f.id === c.id) ? "Mengikuti" : "Ikuti"}
              </button>
            </div>
          ))
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 nb-fade" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setShowCreate(false)}>
          <div className="nb-card-lg p-6 w-full max-w-md nb-rise flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">Buat Channel Baru</h2>
            <label className="text-xs font-bold">Nama Channel</label>
            <input className="nb-input" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={50} placeholder="contoh: Berita Teknologi" />
            <label className="text-xs font-bold">Slug (URL)</label>
            <input className="nb-input" value={newSlug} onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} maxLength={30} placeholder="berita_teknologi" />
            <label className="text-xs font-bold">Deskripsi</label>
            <textarea className="nb-input" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} maxLength={500} rows={3} placeholder="Tentang channel ini…" />
            <div className="flex gap-2 mt-2">
              <button className="nb-btn flex-1" onClick={() => setShowCreate(false)}>Batal</button>
              <button className="nb-btn nb-btn-primary flex-1" onClick={create} disabled={creating || !newName.trim()}>
                {creating ? "Membuat…" : "Buat"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
