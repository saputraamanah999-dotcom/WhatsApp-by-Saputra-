"use client"

import { Avatar } from "@/components/ui/avatar-nb"
import { formatTime, renderText } from "@/lib/api"
import type { ChatListItem } from "@/lib/types"
import { isOnline } from "@/lib/utils"

interface ChatListProps {
  items: ChatListItem[]
  onOpenChat: (partnerId: string) => void
  onRefresh?: () => void
}

export function ChatList({ items, onOpenChat }: ChatListProps) {
  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground gap-2">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
        <div className="font-bold text-base">Belum ada chat</div>
        <div className="text-xs">Cari username lewat tombol 🔍 di atas untuk mulai chat</div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto nb-scroll">
      {items.map((item) => (
        <button
          key={item.partner.id}
          className="w-full flex items-center gap-3 p-3 border-b-2 border-border hover:bg-muted transition-colors text-left"
          onClick={() => onOpenChat(item.partner.id)}
        >
          <Avatar
            name={item.partner.username}
            src={item.partner.photoURL || null}
            size={48}
            online={isOnline(item.partner.lastSeen as any)}
            verified={item.partner.verified}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-bold text-sm truncate flex-1">{item.partner.displayName || item.partner.username}</span>
              <span className="text-[11px] text-muted-foreground">{formatTime(item.lastMessage.createdAt)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground truncate flex-1">
                {item.lastMessage.me && "Kamu: "}
                <span dangerouslySetInnerHTML={{ __html: renderText(item.lastMessage.text || "") }} />
              </span>
              {item.unread > 0 && (
                <span className="min-w-[20px] h-[20px] px-1.5 rounded-full text-[11px] font-bold grid place-items-center" style={{ background: "var(--color-nb-pink)", color: "#111", border: "1.5px solid var(--border)" }}>
                  {item.unread > 99 ? "99+" : item.unread}
                </span>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
