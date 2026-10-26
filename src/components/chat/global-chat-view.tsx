"use client"

import { useEffect, useState, useRef } from "react"
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  addDoc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore"
import { db, auth } from "@/lib/firebase"
import { Avatar } from "@/components/ui/avatar-nb"
import { MessageComposer } from "@/components/chat/composer"
import { api, formatTime, renderText, parseMentions, formatDay } from "@/lib/api"
import { parseReactions, stringifyReactions } from "@/lib/utils"
import type { Message } from "@/lib/types"
import { toast } from "sonner"

interface GlobalChatViewProps {
  onOpenProfile?: (uid: string) => void
}

export function GlobalChatView({ onOpenProfile }: GlobalChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [online, setOnline] = useState(0)
  const [me, setMe] = useState<{ id: string; username: string } | null>(null)
  const [replyTo, setReplyTo] = useState<{ id: string; preview: string } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api<{ user: any }>("/api/firebase/users?mine=1").then((r) => setMe({ id: r.user.id, username: r.user.username })).catch(() => {})
  }, [])

  // Subscribe to global messages
  useEffect(() => {
    const q = query(collection(db, "global"), orderBy("createdAt", "asc"))
    const unsub = onSnapshot(q, async (snap) => {
      const items: Message[] = []
      for (const docSnap of snap.docs) {
        const d = docSnap.data()
        // Get sender info
        const senderDoc = await getDoc(doc(db, "users", d.senderId))
        const sender = senderDoc.exists() ? senderDoc.data() : null
        items.push({
          id: docSnap.id,
          senderId: d.senderId,
          senderUsername: sender?.username || "",
          senderDisplayName: sender?.displayName || "",
          senderPhoto: sender?.photoURL || null,
          senderVerified: sender?.verified || false,
          text: d.text,
          type: d.type,
          mediaURL: d.mediaURL,
          reactions: d.reactions || "{}",
          replyToId: d.replyToId,
          pinned: d.pinned || false,
          createdAt: d.createdAt,
        })
      }
      setMessages(items.slice(-200)) // Last 200 messages
      setLoading(false)
    }, (err) => {
      console.error("[global] listen error:", err)
      toast.error("Gagal memuat global chat: " + err.message)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  // Listen to online users count (presence)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      let count = 0
      snap.forEach((doc) => {
        const d = doc.data()
        if (d.lastSeen && (Date.now() - d.lastSeen) < 60000) count++
      })
      setOnline(count)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const sendText = async (text: string, replyToId?: string | null) => {
    if (!me) return
    try {
      await addDoc(collection(db, "global"), {
        senderId: me.id,
        senderUsername: me.username,
        text,
        type: "text",
        mediaURL: null,
        replyToId: replyToId || null,
        reactions: "{}",
        pinned: false,
        createdAt: Date.now(),
      })

      // Mention notifications
      const mentions = parseMentions(text)
      for (const uname of mentions) {
        const unameDoc = await getDoc(doc(db, "usernames", uname))
        if (unameDoc.exists()) {
          const targetUid = unameDoc.data()!.uid
          if (targetUid !== me.id) {
            await addDoc(collection(db, "notifications"), {
              recipientId: targetUid,
              actorId: me.id,
              actorUsername: me.username,
              type: "mention",
              targetType: "global",
              text: `${me.username} menyebutmu di Chat Global`,
              read: false,
              createdAt: Date.now(),
            })
          }
        }
      }
      setReplyTo(null)
    } catch (e: any) {
      toast.error("Gagal kirim: " + e.message)
    }
  }

  const sendMedia = async (url: string, type: "image" | "video" | "audio" | "voice", replyToId?: string | null) => {
    if (!me) return
    try {
      await addDoc(collection(db, "global"), {
        senderId: me.id,
        senderUsername: me.username,
        text: "",
        type,
        mediaURL: url,
        replyToId: replyToId || null,
        reactions: "{}",
        pinned: false,
        createdAt: Date.now(),
      })
      setReplyTo(null)
    } catch (e: any) {
      toast.error("Gagal kirim: " + e.message)
    }
  }

  const react = async (messageId: string, emoji: string) => {
    if (!me) return
    try {
      const ref = doc(db, "global", messageId)
      const snap = await getDoc(ref)
      if (!snap.exists()) return
      const reactions = parseReactions(snap.data().reactions)
      const list: string[] = reactions[emoji] || []
      const idx = list.indexOf(me.id)
      if (idx >= 0) list.splice(idx, 1)
      else list.push(me.id)
      if (list.length) reactions[emoji] = list
      else delete reactions[emoji]
      await updateDoc(ref, { reactions: stringifyReactions(reactions) })
    } catch (e: any) {
      toast.error("Gagal: " + e.message)
    }
  }

  const del = async (messageId: string) => {
    if (!confirm("Hapus pesan ini untuk semua orang?")) return
    try {
      await deleteDoc(doc(db, "global", messageId))
    } catch (e: any) {
      toast.error("Gagal hapus: " + e.message)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-card">
      <header className="flex items-center gap-2 p-3 border-b-[2.5px] border-border bg-muted" style={{ background: "var(--color-nb-cyan)" }}>
        <Avatar name="🌍" size={42} />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-base">Chat Global 🌍</div>
          <div className="text-xs text-muted-foreground">{online} anggota online</div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto nb-scroll p-3 nb-dot-pattern" style={{ background: "var(--background)" }}>
        {loading ? (
          <div className="text-center text-muted-foreground text-sm py-6">Memuat pesan global…</div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center gap-2 p-6">
            <div className="text-4xl">🌍</div>
            <div className="font-bold">Chat Global kosong</div>
            <div className="text-xs">Jadilah yang pertama mengirim pesan!</div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {messages.map((msg, i) => {
              const prev = messages[i - 1]
              const showDay = !prev || formatDay(prev.createdAt) !== formatDay(msg.createdAt)
              const mine = msg.senderId === me?.id
              return (
                <div key={msg.id} className="group">
                  {showDay && <div className="nb-chip mx-auto my-2" style={{ background: "var(--secondary)" }}>{formatDay(msg.createdAt)}</div>}
                  <div className={`flex ${mine ? "justify-end" : "justify-start"} nb-bubble-in`}>
                    <div className="nb-bubble" style={mine ? { background: "var(--color-nb-green)" } : {}}>
                      {!mine && (
                        <button
                          className="text-xs font-bold mb-1 hover:underline block"
                          style={{ color: "#1a1aff" }}
                          onClick={() => onOpenProfile?.(msg.senderId)}
                        >
                          @{msg.senderUsername}
                        </button>
                      )}
                      {(msg.type === "image" || msg.type === "video" || msg.type === "audio" || msg.type === "voice") && msg.mediaURL && (
                        <div className="mb-1">
                          {msg.type === "image" && <img src={msg.mediaURL} alt="" className="rounded-lg max-w-full max-h-72" style={{ border: "2px solid var(--border)" }} />}
                          {msg.type === "video" && <video src={msg.mediaURL} controls className="rounded-lg max-w-full max-h-72" style={{ border: "2px solid var(--border)" }} />}
                          {(msg.type === "voice" || msg.type === "audio") && <audio src={msg.mediaURL} controls className="w-full min-w-[200px]" />}
                        </div>
                      )}
                      {msg.text && (
                        <div className="text-[14.5px] leading-snug whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: renderText(msg.text) }} />
                      )}
                      <div className="flex items-center gap-1 mt-0.5 -mb-0.5 float-right ml-2">
                        <span className="text-[10px] text-muted-foreground">{formatTime(msg.createdAt)}</span>
                      </div>
                      {Object.keys(parseReactions(msg.reactions as any)).length > 0 && (
                        <div className="clear-both mt-1 flex gap-1 flex-wrap">
                          {Object.entries(parseReactions(msg.reactions as any)).filter(([, ids]: any) => ids.length > 0).map(([emoji, ids]: any) => (
                            <span key={emoji} className="nb-chip" style={{ background: "var(--secondary)", fontSize: 11 }}>
                              {emoji} {ids.length > 1 ? ids.length : ""}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="absolute -top-9 opacity-0 group-hover:opacity-100 transition-opacity nb-card-sm flex gap-1 p-1 z-10" style={{ left: mine ? "auto" : 0, right: mine ? 0 : "auto" }}>
                        {["👍","❤️","😂","😮","😢","🙏"].map((e) => (
                          <button key={e} className="hover:scale-125 transition-transform text-lg" onClick={() => react(msg.id, e)}>{e}</button>
                        ))}
                        <button className="text-base hover:scale-125 transition-transform" title="Balas" onClick={() => setReplyTo({ id: msg.id, preview: msg.text.slice(0, 60) || "[media]" })}>↩</button>
                        {mine && <button className="text-base hover:scale-125 transition-transform" title="Hapus" onClick={() => del(msg.id)}>🗑</button>}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <MessageComposer
        onSendText={sendText}
        onSendMedia={sendMedia}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        placeholder="Ketik pesan ke Chat Global…"
      />
    </div>
  )
}
