"use client"

import { Avatar } from "@/components/ui/avatar-nb"
import { formatTime, renderText } from "@/lib/api"
import { parseReactions } from "@/lib/utils"
import type { Message } from "@/lib/types"

interface BubbleProps {
  msg: Message
  mine: boolean
  showSender?: boolean
  onReact?: (emoji: string) => void
  onReply?: () => void
  onDelete?: () => void
  selected?: boolean
}

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"]

export function MessageBubble({ msg, mine, showSender, onReact, onReply, onDelete, selected }: BubbleProps) {
  const reactions = parseReactions(msg.reactions as any)
  const reactionEntries = Object.entries(reactions).filter(([, ids]) => ids.length > 0)
  const isMedia = msg.type === "image" || msg.type === "video" || msg.type === "audio" || msg.type === "voice"
  const isVoice = msg.type === "voice" || msg.type === "audio"

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} nb-bubble-in`}>
      <div
        className={`nb-bubble nb-bubble-me-${mine ? "1" : "0"} ${selected ? "ring-2 ring-primary" : ""}`}
        style={mine ? { background: "var(--color-nb-green)" } : {}}
      >
        {showSender && !mine && msg.senderUsername && (
          <div className="text-xs font-bold mb-1" style={{ color: "#1a1aff" }}>
            @{msg.senderUsername}
          </div>
        )}
        {isMedia && msg.mediaURL && (
          <div className="mb-1">
            {msg.type === "image" && (
               
              <img src={msg.mediaURL} alt="" className="rounded-lg max-w-full max-h-72" style={{ border: "2px solid var(--border)" }} />
            )}
            {msg.type === "video" && (
              <video src={msg.mediaURL} controls className="rounded-lg max-w-full max-h-72" style={{ border: "2px solid var(--border)" }} />
            )}
            {(msg.type === "voice" || msg.type === "audio") && (
              <audio src={msg.mediaURL} controls className="w-full min-w-[200px]" />
            )}
          </div>
        )}
        {msg.text && (
          <div
            className="text-[14.5px] leading-snug whitespace-pre-wrap break-words"
            dangerouslySetInnerHTML={{ __html: renderText(msg.text) }}
          />
        )}
        <div className="flex items-center gap-1 mt-0.5 -mb-0.5 float-right ml-2">
          <span className="text-[10px] text-muted-foreground">{formatTime(msg.createdAt)}</span>
          {mine && msg.status && (
            <svg viewBox="0 0 18 18" width="14" height="14" style={{ color: msg.status === "read" ? "#34b7f1" : "currentColor" }}>
              <path d="M1.5 9.5l3.5 3.5L12.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              {msg.status === "delivered" || msg.status === "read" ? (
                <path d="M7 12.5l.8.8L16.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              ) : null}
            </svg>
          )}
        </div>
        {reactionEntries.length > 0 && (
          <div className="clear-both mt-1 flex gap-1 flex-wrap">
            {reactionEntries.map(([emoji, ids]) => (
              <span
                key={emoji}
                className="nb-chip"
                style={{
                  background: ids.length > 0 && (ids as string[]).length ? "var(--color-nb-yellow)" : "var(--card)",
                  fontSize: 11,
                }}
              >
                {emoji} {(ids as string[]).length > 1 ? (ids as string[]).length : ""}
              </span>
            ))}
          </div>
        )}

        {/* Hover actions */}
        <div className="absolute -top-9 opacity-0 group-hover:opacity-100 transition-opacity nb-card-sm flex gap-1 p-1 z-10" style={{ left: mine ? "auto" : 0, right: mine ? 0 : "auto" }}>
          {EMOJIS.map((e) => (
            <button key={e} className="hover:scale-125 transition-transform text-lg" onClick={() => onReact?.(e)}>
              {e}
            </button>
          ))}
          {onReply && (
            <button className="text-base hover:scale-125 transition-transform" title="Balas" onClick={onReply}>↩</button>
          )}
          {mine && onDelete && (
            <button className="text-base hover:scale-125 transition-transform" title="Hapus" onClick={onDelete}>🗑</button>
          )}
        </div>
      </div>
    </div>
  )
}
