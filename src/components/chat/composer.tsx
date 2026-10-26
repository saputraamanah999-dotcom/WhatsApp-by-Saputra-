"use client"

import { useState, useRef, useEffect } from "react"
import { toast } from "sonner"
import { useVoiceRecorder } from "@/hooks/use-voice-recorder"
import { api, formatDuration } from "@/lib/api"

interface ComposerProps {
  onSendText: (text: string, replyToId?: string | null) => void
  onSendMedia: (url: string, type: "image" | "video" | "audio" | "voice", replyToId?: string | null) => void
  onTyping?: (typing: boolean) => void
  replyTo?: { id: string; preview: string } | null
  onCancelReply?: () => void
  placeholder?: string
}

const EMOJI_SET = ["😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","😉","😍","🥰","😘","😋","😎","🤩","🥳","😏","😒","😞","😔","😢","😭","😤","😡","🤯","😱","😨","😰","🤔","🤗","🤭","🙄","😴","🤒","🤧","👍","👎","👏","🙌","🙏","💪","👋","✌️","🤝","❤️","🧡","💛","💚","💙","💜","🖤","💔","🔥","✨","🎉","💯","⭐","🌹","🍕","🍔","☕","🎂","🎁","📞","💬"]

export function MessageComposer({ onSendText, onSendMedia, onTyping, replyTo, onCancelReply, placeholder }: ComposerProps) {
  const [text, setText] = useState("")
  const [showEmoji, setShowEmoji] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLInputElement>(null)
  const typingTimerRef = useRef<any>(null)
  const lastTypingRef = useRef(false)
  const recorder = useVoiceRecorder()

  useEffect(() => {
    return () => {
      if (recorder.recording) URL.revokeObjectURL(recorder.recording.url)
    }
     
  }, [])

  const sendText = () => {
    const t = text.trim()
    if (!t) return
    onSendText(t, replyTo?.id || null)
    setText("")
    if (lastTypingRef.current) {
      lastTypingRef.current = false
      onTyping?.(false)
    }
  }

  const onTextChange = (v: string) => {
    setText(v)
    if (!lastTypingRef.current) {
      lastTypingRef.current = true
      onTyping?.(true)
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => {
      lastTypingRef.current = false
      onTyping?.(false)
    }, 2500)
  }

  const uploadFile = async (file: File, kind: "image" | "video" | "audio" | "document") => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const r = await api<{ url: string; type: string; kind: string }>("/api/firebase/media", { method: "POST", body: fd })
      let type: "image" | "video" | "audio" | "voice" = "image"
      if (kind === "image") type = "image"
      else if (kind === "video") type = "video"
      else if (kind === "audio" || kind === "document") type = "audio"
      onSendMedia(r.url, type, replyTo?.id || null)
    } catch (e: any) {
      toast.error("Gagal upload: " + e.message)
    } finally {
      setUploading(false)
    }
  }

  const uploadVoice = async () => {
    if (!recorder.recording) return
    setUploading(true)
    try {
      const fd = new FormData()
      const ext = recorder.recording.blob.type.includes("webm") ? "webm" : "ogg"
      fd.append("file", recorder.recording.blob, `voice.${ext}`)
      const r = await api<{ url: string }>("/api/firebase/media", { method: "POST", body: fd })
      onSendMedia(r.url, "voice", replyTo?.id || null)
      recorder.clear()
    } catch (e: any) {
      toast.error("Gagal kirim voice: " + e.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="border-t-2 border-border bg-background p-2 flex flex-col gap-2" style={{ borderTopWidth: "2.5px", borderTopColor: "var(--border)" }}>
      {replyTo && (
        <div className="flex items-center gap-2 px-2 py-1 nb-card-sm" style={{ background: "var(--muted)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 14l-4-4 4-4M5 10h11a4 4 0 014 4v2" />
          </svg>
          <div className="flex-1 truncate text-xs">
            Membalas: <b>{replyTo.preview}</b>
          </div>
          <button onClick={onCancelReply} className="text-xs hover:opacity-70">×</button>
        </div>
      )}

      {recorder.recording && (
        <div className="flex items-center gap-2 p-2 nb-card-sm">
          <div className="flex-1">
            <div className="text-xs font-bold mb-1">Voice note preview ({formatDuration(recorder.recording.durationSec)})</div>
            <audio src={recorder.recording.url} controls className="w-full h-8" />
          </div>
          <button className="nb-btn nb-btn-green text-sm py-1 px-3" onClick={uploadVoice} disabled={uploading}>
            Kirim
          </button>
          <button className="nb-btn nb-btn-gray text-sm py-1 px-3" onClick={() => recorder.clear()}>Buang</button>
        </div>
      )}

      {recorder.isRecording && (
        <div className="flex items-center gap-2 p-2 nb-card-sm" style={{ background: "var(--color-nb-red)", color: "#fff" }}>
          <span className="w-3 h-3 rounded-full bg-white animate-pulse" />
          <div className="flex-1 text-sm font-bold">Merekam… {formatDuration(recorder.duration)}</div>
          <button className="nb-btn nb-btn-gray text-sm py-1 px-3" onClick={recorder.stop}>Selesai</button>
          <button className="nb-btn nb-btn-gray text-sm py-1 px-3" onClick={recorder.cancel}>Batal</button>
        </div>
      )}

      {uploading && (
        <div className="text-xs px-2 py-1 text-center text-muted-foreground">Uploading…</div>
      )}

      {showEmoji && (
        <div className="nb-card-sm p-2 grid grid-cols-8 gap-1 max-h-40 overflow-y-auto nb-scroll">
          {EMOJI_SET.map((e) => (
            <button
              key={e}
              className="text-2xl p-1 hover:bg-muted rounded transition-colors"
              onClick={() => { setText((t) => t + e) }}
            >{e}</button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          ref={imageRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) uploadFile(f, "image")
            e.target.value = ""
          }}
        />
        <input
          ref={fileRef}
          type="file"
          accept="video/*,audio/*,application/pdf,text/plain"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) {
              if (f.type.startsWith("video/")) uploadFile(f, "video")
              else if (f.type.startsWith("audio/")) uploadFile(f, "audio")
              else uploadFile(f, "document")
            }
            e.target.value = ""
          }}
        />
        <button
          className="nb-btn-icon"
          title="Emoji"
          onClick={() => setShowEmoji((s) => !s)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
          </svg>
        </button>
        <button className="nb-btn-icon" title="Gambar" onClick={() => imageRef.current?.click()} disabled={uploading}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        </button>
        <button className="nb-btn-icon" title="File" onClick={() => fileRef.current?.click()} disabled={uploading}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66L9.41 17.41a2 2 0 11-2.83-2.83l8.49-8.48" />
          </svg>
        </button>
        <input
          className="nb-input flex-1"
          placeholder={placeholder || "Ketik pesan…"}
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              sendText()
            }
          }}
          autoComplete="off"
        />
        {text.trim() ? (
          <button className="nb-btn nb-btn-primary" onClick={sendText} disabled={uploading}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />
            </svg>
          </button>
        ) : (
          <button
            className="nb-btn nb-btn-accent"
            title="Rekam voice note"
            onClick={() => recorder.isRecording ? recorder.stop() : recorder.start()}
            disabled={uploading}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill={recorder.isRecording ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v3" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
