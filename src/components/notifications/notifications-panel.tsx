"use client"

import { api, timeAgo } from "@/lib/api"
import type { Notification } from "@/lib/types"

interface NotificationsPanelProps {
  notifications: Notification[]
  onClose: () => void
  onMarkAllRead: () => void
}

export function NotificationsPanel({ notifications, onClose, onMarkAllRead }: NotificationsPanelProps) {
  const unread = notifications.filter((n) => !n.read).length

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4 nb-fade" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div
        className="nb-card-lg p-4 w-full max-w-md nb-rise flex flex-col gap-2 mt-16 max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Notifikasi</h2>
          <button className="nb-btn-icon" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {unread > 0 && (
          <button className="nb-btn nb-btn-cyan text-sm py-2" onClick={onMarkAllRead}>
            Tandai semua dibaca ({unread})
          </button>
        )}

        <div className="overflow-y-auto nb-scroll flex flex-col gap-2 flex-1">
          {notifications.length === 0 ? (
            <div className="text-center text-muted-foreground py-6 text-sm">
              <div className="text-3xl mb-2">🔕</div>
              Belum ada notifikasi
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`nb-card-sm p-3 text-sm ${n.read ? "opacity-60" : ""}`}
                style={{ borderLeft: `5px solid ${n.read ? "var(--muted-foreground)" : "var(--color-nb-pink)"}` }}
              >
                <div className="font-bold">{n.text}</div>
                <div className="text-xs text-muted-foreground mt-1">{timeAgo(n.createdAt)}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
