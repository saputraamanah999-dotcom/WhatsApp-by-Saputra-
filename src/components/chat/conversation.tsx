"use client"

import { useEffect, useState, useRef } from "react"
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore"
import { db, auth } from "@/lib/firebase"
import { Avatar } from "@/components/ui/avatar-nb"
import { MessageBubble } from "@/components/chat/message-bubble"
import { MessageComposer } from "@/components/chat/composer"
import { api, formatTime, timeAgo, renderText, formatDay } from "@/lib/api"
import { chatIdOf, isOnline, parseReactions, stringifyReactions } from "@/lib/utils"
import type { Message, UserProfile } from "@/lib/types"
import { toast } from "sonner"

interface ConversationProps {
  partnerId?: string
  groupId?: string
  onBack: () => void
  onStartCall: (calleeId: string, name: string, photo: string | null, type: "voice" | "video") => void
  onProfile?: (uid?: string | null) => void
}

export function Conversation({ partnerId, groupId, onBack, onStartCall, onProfile }: ConversationProps) {
  const [me, setMe] = useState<UserProfile | null>(null)
  const [partner, setPartner] = useState<UserProfile | null>(null)
  const [groupInfo, setGroupInfo] = useState<any>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [typing, setTyping] = useState(false)
  const [replyTo, setReplyTo] = useState<{ id: string; preview: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const typingTimerRef = useRef<any>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const uid = me?.id

  // Load me
  useEffect(() => {
    api<{ user: UserProfile }>("/api/firebase/users?mine=1").then((r) => setMe(r.user)).catch(() => {})
  }, [])

  // Subscribe to real-time updates via Firestore onSnapshot
  useEffect(() => {
    if (!uid) return
    if (partnerId) {
      // Subscribe to partner user doc
      const partnerUnsub = onSnapshot(doc(db, "users", partnerId), (snap) => {
        if (snap.exists()) {
          setPartner({ id: snap.id, ...snap.data() } as UserProfile)
        }
      })
      return () => partnerUnsub()
    }
    if (groupId) {
      const groupUnsub = onSnapshot(doc(db, "groups", groupId), (snap) => {
        if (snap.exists()) {
          setGroupInfo({ id: snap.id, ...snap.data() })
        }
      })
      return () => groupUnsub()
    }
  }, [uid, partnerId, groupId])

  // Subscribe to messages
  useEffect(() => {
    if (!uid) return
    setLoading(true)

    let unsub: (() => void) | undefined
    if (partnerId) {
      const cid = chatIdOf(uid, partnerId)
      const q = query(collection(db, "dms"), where("chatId", "==", cid), orderBy("createdAt", "asc"))
      unsub = onSnapshot(q, (snap) => {
        const items: Message[] = []
        snap.forEach((doc) => {
          const d = doc.data()
          if (d.deletedAt) return
          items.push({
            id: doc.id,
            chatId: d.chatId,
            senderId: d.senderId,
            receiverId: d.receiverId,
            text: d.text,
            type: d.type,
            mediaURL: d.mediaURL,
            replyToId: d.replyToId,
            status: d.status,
            reactions: d.reactions || "{}",
            createdAt: d.createdAt,
          })
        })
        setMessages(items)
        setLoading(false)

        // Mark as read
        const unread = items.filter((m) => m.receiverId === uid && m.status !== "read")
        if (unread.length > 0) {
          unread.forEach((m) => {
            updateDoc(doc(db, "dms", m.id), { status: "read" }).catch(() => {})
          })
        }
      }, (err) => {
        console.error("[conv] DM listen error:", err)
        setLoading(false)
      })
    } else if (groupId) {
      const q = query(collection(db, "group_messages"), where("groupId", "==", groupId), orderBy("createdAt", "asc"))
      unsub = onSnapshot(q, async (snap) => {
        const items: Message[] = []
        for (const docSnap of snap.docs) {
          const d = docSnap.data()
          // Get sender info
          const senderDoc = await getDoc(doc(db, "users", d.senderId))
          const sender = senderDoc.exists() ? senderDoc.data() : null
          items.push({
            id: docSnap.id,
            groupId: d.groupId,
            senderId: d.senderId,
            senderUsername: sender?.username || "",
            senderDisplayName: sender?.displayName || "",
            senderPhoto: sender?.photoURL || null,
            senderVerified: sender?.verified || false,
            text: d.text,
            type: d.type,
            mediaURL: d.mediaURL,
            replyToId: d.replyToId,
            reactions: d.reactions || "{}",
            createdAt: d.createdAt,
          })
        }
        setMessages(items)
        setLoading(false)
      }, (err) => {
        console.error("[conv] group listen error:", err)
        setLoading(false)
      })
    }
    return () => { if (unsub) unsub() }
  }, [uid, partnerId, groupId])

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Send text message
  const sendText = async (text: string, replyToId?: string | null) => {
    if (!uid || !partnerId) return
    try {
      const cid = chatIdOf(uid, partnerId)
      await addDoc(collection(db, "dms"), {
        chatId: cid,
        senderId: uid,
        receiverId: partnerId,
        text,
        type: "text",
        mediaURL: null,
        replyToId: replyToId || null,
        status: "sent",
        reactions: "{}",
        createdAt: Date.now(),
        senderUsername: me?.username,
      })
      setReplyTo(null)
    } catch (e: any) {
      toast.error("Gagal kirim: " + e.message)
    }
  }

  const sendMedia = async (url: string, type: "image" | "video" | "audio" | "voice", replyToId?: string | null) => {
    if (!uid || !partnerId) return
    try {
      const cid = chatIdOf(uid, partnerId)
      await addDoc(collection(db, "dms"), {
        chatId: cid,
        senderId: uid,
        receiverId: partnerId,
        text: "",
        type,
        mediaURL: url,
        replyToId: replyToId || null,
        status: "sent",
        reactions: "{}",
        createdAt: Date.now(),
        senderUsername: me?.username,
      })
      setReplyTo(null)
    } catch (e: any) {
      toast.error("Gagal kirim media: " + e.message)
    }
  }

  const sendTyping = (isTyping: boolean) => {
    // Typing indicator not implemented with Firestore (would need separate collection)
    // Skipped for simplicity
  }

  const react = async (messageId: string, emoji: string) => {
    try {
      const ref = doc(db, "dms", messageId)
      const snap = await getDoc(ref)
      if (!snap.exists()) return
      const reactions = parseReactions(snap.data().reactions)
      const list: string[] = reactions[emoji] || []
      const idx = list.indexOf(uid!)
      if (idx >= 0) list.splice(idx, 1)
      else list.push(uid!)
      if (list.length) reactions[emoji] = list
      else delete reactions[emoji]
      await updateDoc(ref, { reactions: stringifyReactions(reactions) })
    } catch (e: any) {
      toast.error("Gagal: " + e.message)
    }
  }

  const deleteMessage = async (messageId: string) => {
    if (!confirm("Hapus pesan ini?")) return
    try {
      await updateDoc(doc(db, "dms", messageId), { text: "", type: "system", deletedAt: Date.now() })
    } catch (e: any) {
      toast.error("Gagal hapus: " + e.message)
    }
  }

  const title = partner?.displayName || partner?.username || groupInfo?.name || "Chat"
  const subtitle = groupInfo
    ? `${groupInfo.memberCount || 0} anggota`
    : partner
      ? (isOnline(partner.lastSeen as any) ? "online" : "terakhir dilihat " + timeAgo(partner.lastSeen))
      : ""

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-card">
      <header className="nb-safe-top flex items-center gap-2 p-3 border-b-[2.5px] border-border bg-muted sticky top-0 z-10" style={{ background: "var(--secondary)" }}>
        <button className="nb-btn-icon md:hidden" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <Avatar
          name={partner?.username || groupInfo?.name}
          src={partner?.photoURL || groupInfo?.photoURL || null}
          size={42}
          online={partner ? isOnline(partner.lastSeen as any) : false}
          verified={partner?.verified}
          onClick={() => onProfile?.(partner?.id)}
        />
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onProfile?.(partner?.id)}>
          <div className="font-bold text-base truncate">{title}</div>
          <div className="text-xs text-muted-foreground truncate">
            {typing ? <span style={{ color: "var(--color-nb-green)" }}>sedang mengetik…</span> : subtitle}
          </div>
        </div>
        {partner && (
          <>
            <button
              className="nb-btn-icon"
              title="Voice call"
              onClick={() => onStartCall(partner.id, partner.displayName || partner.username, partner.photoURL || null, "voice")}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.8.7a2 2 0 011.7 2z" />
              </svg>
            </button>
            <button
              className="nb-btn-icon"
              title="Video call"
              onClick={() => onStartCall(partner.id, partner.displayName || partner.username, partner.photoURL || null, "video")}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 7l-7 5 7 5V7zM1 5h15v14H1z" />
              </svg>
            </button>
          </>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto nb-scroll p-3 nb-dot-pattern" style={{ background: "var(--background)" }}>
        {loading ? (
          <div className="flex flex-col gap-2">
            {[1,2,3].map((i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                <div className="nb-bubble" style={{ width: 200, height: 40 }}>
                  <div className="animate-pulse w-full h-full bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center gap-2 p-6">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <div className="font-bold">Belum ada pesan</div>
            <div className="text-xs">Sapa duluan untuk mulai percakapan</div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {messages.map((msg, i) => {
              const prev = messages[i - 1]
              const showDay = !prev || formatDay(prev.createdAt) !== formatDay(msg.createdAt)
              const mine = msg.senderId === uid
              const showSender = !!groupId && !mine
              return (
                <div key={msg.id} className="group">
                  {showDay && <div className="nb-chip mx-auto my-2" style={{ background: "var(--secondary)" }}>{formatDay(msg.createdAt)}</div>}
                  <MessageBubble
                    msg={msg}
                    mine={mine}
                    showSender={showSender}
                    onReact={(emoji) => react(msg.id, emoji)}
                    onReply={() => setReplyTo({ id: msg.id, preview: msg.text.slice(0, 60) || "[media]" })}
                    onDelete={() => deleteMessage(msg.id)}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      <MessageComposer
        onSendText={sendText}
        onSendMedia={sendMedia}
        onTyping={sendTyping}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        placeholder={partner ? `Pesan ke @${partner.username}…` : "Ketik pesan…"}
      />
    </div>
  )
}
