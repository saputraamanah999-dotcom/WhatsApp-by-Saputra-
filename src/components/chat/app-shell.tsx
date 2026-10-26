"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useAuth } from "@/components/providers"
import { useTheme } from "next-themes"
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
  getDoc,
} from "firebase/firestore"
import { db, auth } from "@/lib/firebase"
import { onAuthStateChanged } from "firebase/auth"
import { toast } from "sonner"
import { Avatar } from "@/components/ui/avatar-nb"
import { ChatList } from "@/components/chat/chat-list"
import { Conversation } from "@/components/chat/conversation"
import { StoriesBar } from "@/components/stories/stories-bar"
import { StoryViewer } from "@/components/stories/story-viewer"
import { StoryComposer } from "@/components/stories/story-composer"
import { CallOverlay } from "@/components/calls/call-overlay"
import { ProfileModal } from "@/components/common/profile-modal"
import { AdminPanel } from "@/components/admin/admin-panel"
import { NotificationsPanel } from "@/components/notifications/notifications-panel"
import { GlobalChatView } from "@/components/chat/global-chat-view"
import { GroupsView } from "@/components/groups/groups-view"
import { ChannelsView } from "@/components/channels/channels-view"
import { SearchModal } from "@/components/common/search-modal"
import { api, timeAgo } from "@/lib/api"
import { WebRTCCall, listenForIncomingCalls } from "@/lib/webrtc"
import type { UserProfile, ChatListItem, Notification } from "@/lib/types"
import { isOnline, chatIdOf } from "@/lib/utils"

type Tab = "chats" | "global" | "groups" | "channels" | "stories"
type ViewMode = "tab" | "conversation"

interface IncomingCall {
  callId: string
  callerId: string
  callerUsername: string
  callType: "voice" | "video"
  offer: any
}

export function AppShell() {
  const { user: session, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const uid = session?.uid

  const [me, setMe] = useState<UserProfile | null>(null)
  const isAdminUser = me?.role === "admin" || me?.role === "superadmin"

  const [activeTab, setActiveTab] = useState<Tab>("chats")
  const [activeChat, setActiveChat] = useState<{ partnerId?: string; groupId?: string } | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("tab")
  const [chatList, setChatList] = useState<ChatListItem[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [showProfile, setShowProfile] = useState<string | null>(null)
  const [showAdmin, setShowAdmin] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [showStoryComposer, setShowStoryComposer] = useState(false)
  const [showStoryViewer, setShowStoryViewer] = useState<string | null>(null)
  const [showMyStories, setShowMyStories] = useState(false)

  // Call state
  const [callState, setCallState] = useState<{
    active: boolean
    incoming?: IncomingCall | null
    outgoing?: { callId: string; calleeId: string; calleeName: string; calleePhoto?: string | null; callType: "voice" | "video" } | null
    connected?: boolean
    callKind?: "voice" | "video"
    peerName?: string
    peerPhoto?: string | null
    duration?: number
    muted?: boolean
    videoOff?: boolean
  }>({ active: false })
  const webrtcRef = useRef<WebRTCCall | null>(null)
  const callTimerRef = useRef<any>(null)

  // ===== Load my profile =====
  useEffect(() => {
    if (!uid) return
    api<{ user: UserProfile }>("/api/firebase/users?mine=1").then((r) => setMe(r.user)).catch(() => {})
  }, [uid])

  // ===== Subscribe to DM chat list (last messages) =====
  useEffect(() => {
    if (!uid) return
    // Listen to all DMs where I'm sender or receiver, get latest message per partner
    // For simplicity, fetch periodically (since onSnapshot with groupBy isn't supported)
    const loadChatList = async () => {
      try {
        const r = await api<{ chats: ChatListItem[] }>("/api/firebase/messages/dm")
        setChatList(r.chats)
      } catch (e) {
        // ignore
      }
    }
    loadChatList()
    const heartbeat = setInterval(loadChatList, 10000)
    return () => clearInterval(heartbeat)
  }, [uid])

  // ===== Subscribe to notifications =====
  useEffect(() => {
    if (!uid) return
    const q = query(collection(db, "notifications"), where("recipientId", "==", uid), orderBy("createdAt", "desc"))
    const unsub = onSnapshot(q, (snap) => {
      const items: Notification[] = []
      snap.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as Notification)
      })
      setNotifications(items.slice(0, 50))

      // Show toast for new mentions
      snap.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data()
          if (data.createdAt > Date.now() - 5000) { // within last 5 seconds
            toast(`@${data.actorUsername || "seseorang"} ${data.type === "mention" ? "menyebutmu" : "memberi notifikasi"}`, {
              description: data.text,
            })
          }
        }
      })
    })
    return () => unsub()
  }, [uid])

  // ===== Request notification permission =====
  useEffect(() => {
    if (!uid) return
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      const t = setTimeout(() => {
        Notification.requestPermission().catch(() => {})
      }, 5000)
      return () => clearTimeout(t)
    }
  }, [uid])

  // ===== Keyboard shortcut Ctrl+K =====
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        setShowSearch(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // ===== Update my lastSeen periodically =====
  useEffect(() => {
    if (!uid) return
    const update = async () => {
      try {
        await updateDoc(doc(db, "users", uid), { online: true, lastSeen: Date.now() })
      } catch (e) {
        // ignore
      }
    }
    update()
    const heartbeat = setInterval(update, 20000)
    const onVisibility = () => {
      if (document.visibilityState === "visible") update()
      else {
        updateDoc(doc(db, "users", uid), { online: false, lastSeen: Date.now() }).catch(() => {})
      }
    }
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("beforeunload", () => {
      updateDoc(doc(db, "users", uid), { online: false, lastSeen: Date.now() }).catch(() => {})
    })
    return () => {
      clearInterval(heartbeat)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [uid])

  // ===== Listen for incoming calls =====
  useEffect(() => {
    if (!uid) return
    const unsub = listenForIncomingCalls(uid, (call) => {
      if (callState.active) {
        // Already in a call — reject
        WebRTCCall.rejectCall(call.id).catch(() => {})
        return
      }
      setCallState({
        active: true,
        incoming: {
          callId: call.id,
          callerId: call.callerId,
          callerUsername: call.callerUsername,
          callType: call.callType,
          offer: call.offer,
        },
        callKind: call.callType,
        peerName: call.callerUsername,
      })
    })
    return () => unsub()
     
  }, [uid])

  // ===== Call management =====
  const startCallTimer = () => {
    if (callTimerRef.current) clearInterval(callTimerRef.current)
    let sec = 0
    callTimerRef.current = setInterval(() => {
      sec++
      setCallState((s) => ({ ...s, duration: sec }))
    }, 1000)
  }

  const startOutgoingCall = async (calleeId: string, calleeName: string, calleePhoto: string | null, callType: "voice" | "video") => {
    if (callState.active) {
      toast.error("Sedang dalam panggilan lain")
      return
    }
    try {
      // Create call document in Firestore
      const callRef = await addDoc(collection(db, "calls"), {
        callerId: uid!,
        calleeId,
        callType,
        status: "ringing",
        createdAt: Date.now(),
      })
      const callId = callRef.id
      setCallState({
        active: true,
        outgoing: { callId, calleeId, calleeName, calleePhoto, callType },
        callKind: callType,
        peerName: calleeName,
        peerPhoto: calleePhoto,
      })
      const webrtc = new WebRTCCall({
        callId,
        callerId: uid!,
        calleeId,
        callType,
        isCaller: true,
        onStateChange: (state) => {
          if (state === "connected") {
            setCallState((s) => ({ ...s, connected: true }))
            startCallTimer()
          } else if (state === "failed") {
            toast.error("Koneksi gagal")
            endCall("failed")
          }
        },
        onEnded: () => {
          toast("Panggilan diakhiri")
          endCall("ended")
        },
      })
      webrtcRef.current = webrtc
      await webrtc.start()
    } catch (e: any) {
      toast.error("Gagal memulai panggilan: " + e.message)
      endCall("failed")
    }
  }

  const acceptIncomingCall = async () => {
    if (!callState.incoming) return
    const inc = callState.incoming
    try {
      const webrtc = new WebRTCCall({
        callId: inc.callId,
        callerId: inc.callerId,
        calleeId: uid!,
        callType: inc.callType,
        isCaller: false,
        remoteOffer: inc.offer,
        onStateChange: (state) => {
          if (state === "connected") {
            setCallState((s) => ({ ...s, connected: true }))
            startCallTimer()
          } else if (state === "failed") {
            toast.error("Koneksi gagal")
            endCall("failed")
          }
        },
        onEnded: () => {
          toast("Panggilan diakhiri")
          endCall("ended")
        },
      })
      webrtcRef.current = webrtc
      await webrtc.start()
      setCallState({
        active: true,
        incoming: null,
        callKind: inc.callType,
        peerName: inc.callerUsername,
        connected: true,
      })
    } catch (e: any) {
      toast.error("Gagal menerima: " + e.message)
      endCall("failed")
    }
  }

  const rejectIncomingCall = async () => {
    if (callState.incoming) {
      await WebRTCCall.rejectCall(callState.incoming.callId).catch(() => {})
    }
    setCallState({ active: false })
  }

  const endCall = async (reason: string = "ended") => {
    if (webrtcRef.current) {
      webrtcRef.current.end()
      webrtcRef.current = null
    }
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current)
      callTimerRef.current = null
    }
    const callId = callState.outgoing?.callId || callState.incoming?.callId
    if (callId) {
      await WebRTCCall.endCall(callId, callState.duration).catch(() => {})
    }
    setCallState({ active: false })
  }

  const toggleMute = () => {
    if (webrtcRef.current) {
      const muted = webrtcRef.current.toggleMute()
      setCallState((s) => ({ ...s, muted }))
    }
  }

  const toggleVideo = () => {
    if (webrtcRef.current) {
      const off = webrtcRef.current.toggleVideo()
      setCallState((s) => ({ ...s, videoOff: off }))
    }
  }

  const switchCamera = async () => {
    if (webrtcRef.current) {
      const ok = await webrtcRef.current.switchCamera()
      if (!ok) toast.error("Gagal ganti kamera")
    }
  }

  // ===== Open conversation =====
  const openChat = (partnerId: string) => {
    setActiveChat({ partnerId })
    setViewMode("conversation")
  }

  const openGroup = (groupId: string) => {
    setActiveChat({ groupId })
    setViewMode("conversation")
  }

  const closeConversation = () => {
    setActiveChat(null)
    setViewMode("tab")
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden nb-dot-pattern">
      <AdminBanner />

      <div className="flex-1 flex min-h-0">
        <aside
          className={`${activeChat && viewMode === "conversation" ? "hidden md:flex" : "flex"} flex-col w-full md:w-[400px] md:max-w-[400px] border-r-2 md:border-r-[2.5px] border-border bg-card`}
        >
          <header className="nb-safe-top flex items-center gap-2 p-3 border-b-[2.5px] border-border bg-muted" style={{ background: "var(--secondary)" }}>
            <Avatar
              name={me?.username || "?"}
              src={me?.photoURL || null}
              size={42}
              online
              verified={me?.verified}
              onClick={() => setShowProfile(uid || null)}
            />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-base truncate">{me?.displayName || me?.username}</div>
              <div className="text-xs text-muted-foreground truncate">@{me?.username}</div>
            </div>
            <button className="nb-btn-icon" title="Cari (Ctrl+K)" onClick={() => setShowSearch(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </button>
            <button className="nb-btn-icon relative" title="Notifikasi" onClick={() => setShowNotifs(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold grid place-items-center" style={{ background: "var(--color-nb-pink)", color: "#111", border: "1.5px solid var(--border)" }}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
            <button className="nb-btn-icon" title="Ganti tema" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
                </svg>
              )}
            </button>
            {isAdminUser && (
              <button className="nb-btn-icon" title="Panel Admin" onClick={() => setShowAdmin(true)} style={{ background: "var(--color-nb-pink)", color: "#fff" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </button>
            )}
            <button className="nb-btn-icon" title="Keluar" onClick={() => signOut()}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
            </button>
          </header>

          <div className="p-2 border-b-[2.5px] border-border">
            <button
              className="nb-input text-left text-sm text-muted-foreground hover:bg-muted transition-colors"
              onClick={() => setShowSearch(true)}
            >
              🔍 Cari user, grup, channel…
            </button>
          </div>

          <StoriesBar onView={setShowStoryViewer} onCompose={() => setShowStoryComposer(true)} onViewMine={() => setShowMyStories(true)} />

          <div className="flex border-b-[2.5px] border-border nb-no-scrollbar overflow-x-auto">
            {([
              { k: "chats", label: "Chat", icon: "💬" },
              { k: "global", label: "Global", icon: "🌍" },
              { k: "groups", label: "Grup", icon: "👥" },
              { k: "channels", label: "Channel", icon: "📢" },
            ] as { k: Tab; label: string; icon: string }[]).map((t) => (
              <button
                key={t.k}
                className={`flex-1 min-w-[80px] py-3 px-2 font-bold text-sm whitespace-nowrap border-b-4 transition-colors`}
                style={{
                  borderBottomColor: activeTab === t.k ? "var(--border)" : "transparent",
                  background: activeTab === t.k ? "var(--secondary)" : "transparent",
                  color: activeTab === t.k ? "#111" : undefined,
                }}
                onClick={() => { setActiveTab(t.k); setViewMode("tab"); setActiveChat(null) }}
              >
                <span className="mr-1">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-hidden">
            {activeTab === "chats" && (
              <ChatList
                items={chatList}
                onOpenChat={openChat}
                onRefresh={() => {}}
              />
            )}
            {activeTab === "global" && (
              <GlobalChatView
                onOpenProfile={(pid) => { openChat(pid) }}
              />
            )}
            {activeTab === "groups" && (
              <GroupsView onOpenGroup={openGroup} />
            )}
            {activeTab === "channels" && (
              <ChannelsView />
            )}
          </div>
        </aside>

        <main className={`${activeChat && viewMode === "conversation" ? "flex" : "hidden md:flex"} flex-1 flex-col min-w-0`}>
          {activeChat && viewMode === "conversation" ? (
            <Conversation
              partnerId={activeChat.partnerId}
              groupId={activeChat.groupId}
              onBack={closeConversation}
              onStartCall={startOutgoingCall}
              onProfile={(pid) => setShowProfile(pid || null)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center nb-dot-pattern">
              <div className="w-24 h-24 rounded-full grid place-items-center nb-pulse" style={{ background: "var(--color-nb-pink)", border: "3px solid var(--border)", boxShadow: "5px 5px 0 var(--border)" }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold" style={{ color: "#1a1aff" }}>Neobrutal Chat</h1>
              <p className="text-sm text-muted-foreground max-w-md">
                Pilih chat di kiri, atau cari username pengguna untuk mulai ngobrol.
                Tekan <kbd className="nb-chip">Ctrl+K</kbd> untuk pencarian cepat.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-3 max-w-md text-left">
                <div className="nb-card-sm p-3">
                  <div className="text-xs text-muted-foreground mb-1">⚡ Real-time</div>
                  <div className="font-bold text-sm">Chat pribadi & grup</div>
                </div>
                <div className="nb-card-sm p-3">
                  <div className="text-xs text-muted-foreground mb-1">📞 WebRTC</div>
                  <div className="font-bold text-sm">Voice / Video call</div>
                </div>
                <div className="nb-card-sm p-3">
                  <div className="text-xs text-muted-foreground mb-1">🎤 Mic</div>
                  <div className="font-bold text-sm">Voice note</div>
                </div>
                <div className="nb-card-sm p-3">
                  <div className="text-xs text-muted-foreground mb-1">📱 Story</div>
                  <div className="font-bold text-sm">Status 24 jam</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">🔥 Powered by Firebase Firestore</p>
            </div>
          )}
        </main>
      </div>

      {callState.active && (
        <CallOverlay
          state={callState}
          webrtc={webrtcRef.current}
          onAccept={acceptIncomingCall}
          onReject={rejectIncomingCall}
          onEnd={() => endCall("ended")}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onSwitchCamera={switchCamera}
        />
      )}

      {showProfile !== null && (
        <ProfileModal
          userId={showProfile}
          onClose={() => setShowProfile(null)}
          onMessage={(pid) => { setShowProfile(null); openChat(pid) }}
        />
      )}
      {showStoryComposer && (
        <StoryComposer onClose={() => setShowStoryComposer(false)} />
      )}
      {showStoryViewer && (
        <StoryViewer ownerUid={showStoryViewer} onClose={() => setShowStoryViewer(null)} />
      )}
      {showSearch && (
        <SearchModal
          onClose={() => setShowSearch(false)}
          onOpenUser={(pid) => { setShowSearch(false); openChat(pid) }}
          onOpenGroup={(gid) => { setShowSearch(false); openGroup(gid) }}
        />
      )}
      {showNotifs && (
        <NotificationsPanel
          notifications={notifications}
          onClose={() => setShowNotifs(false)}
          onMarkAllRead={async () => {
            for (const n of notifications.filter((n) => !n.read)) {
              try {
                await updateDoc(doc(db, "notifications", n.id), { read: true })
              } catch (e) {
                // ignore
              }
            }
          }}
        />
      )}
      {showAdmin && isAdminUser && (
        <AdminPanel onClose={() => setShowAdmin(false)} />
      )}
    </div>
  )
}

function AdminBanner() {
  const [banner, setBanner] = useState<{ text: string; active: boolean; kind: string } | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Listen to banner config in real-time
    const unsub = onSnapshot(doc(db, "config", "banner"), (snap) => {
      if (snap.exists()) {
        const d = snap.data()
        setBanner({ text: d.text, active: d.active, kind: d.kind || "info" })
      } else {
        setBanner(null)
      }
    })
    return () => unsub()
  }, [])

  if (!banner?.active || dismissed) return null

  const bg = banner.kind === "danger" ? "var(--color-nb-red)"
    : banner.kind === "warn" ? "var(--color-nb-orange)"
    : banner.kind === "ok" ? "var(--color-nb-green)"
    : "var(--color-nb-blue)"
  return (
    <div className="flex items-center gap-2 p-2 text-sm font-bold text-black" style={{ background: bg, borderBottom: "2.5px solid var(--border)" }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11v2a1 1 0 001 1h2l5 4V6L6 10H4a1 1 0 00-1 1zM16 8a5 5 0 010 8" />
      </svg>
      <span className="flex-1">{banner.text}</span>
      <button className="hover:opacity-70" onClick={() => setDismissed(true)}>×</button>
    </div>
  )
}
