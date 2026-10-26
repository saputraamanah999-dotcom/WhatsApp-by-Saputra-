"use client"

import { useEffect, useRef, useState } from "react"
import { Avatar } from "@/components/ui/avatar-nb"
import { formatDuration } from "@/lib/api"
import type { WebRTCCall } from "@/lib/webrtc"

interface CallOverlayProps {
  state: {
    active: boolean
    incoming?: any | null
    outgoing?: { callId: string; calleeId: string; calleeName: string; calleePhoto?: string | null; callType: "voice" | "video" } | null
    connected?: boolean
    callKind?: "voice" | "video"
    peerName?: string
    peerPhoto?: string | null
    duration?: number
    muted?: boolean
    videoOff?: boolean
  }
  webrtc: WebRTCCall | null
  onAccept: () => void
  onReject: () => void
  onEnd: () => void
  onToggleMute: () => void
  onToggleVideo: () => void
  onSwitchCamera: () => void
}

export function CallOverlay({ state, webrtc, onAccept, onReject, onEnd, onToggleMute, onToggleVideo, onSwitchCamera }: CallOverlayProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const [localStreamReady, setLocalStreamReady] = useState(false)
  const [remoteStreamReady, setRemoteStreamReady] = useState(false)

  // Attach streams
  useEffect(() => {
    if (!webrtc) return
    const checkStreams = () => {
      if (webrtc.localStream && !localStreamReady) {
        setLocalStreamReady(true)
        if (localVideoRef.current && state.callKind === "video") {
          localVideoRef.current.srcObject = webrtc.localStream
        }
      }
      if (webrtc.remoteStream && !remoteStreamReady) {
        setRemoteStreamReady(true)
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = webrtc.remoteStream
        if (remoteVideoRef.current && state.callKind === "video") {
          remoteVideoRef.current.srcObject = webrtc.remoteStream
        }
      }
    }
    const t = setInterval(checkStreams, 200)
    return () => clearInterval(t)
  }, [webrtc, localStreamReady, remoteStreamReady, state.callKind])

  const isVideoCall = state.callKind === "video"
  const isVoiceCall = !isVideoCall
  const isIncoming = !!state.incoming && !state.outgoing
  const isOutgoing = !!state.outgoing && !state.connected
  const peerName = state.peerName || state.outgoing?.calleeName || state.incoming?.callerUsername || "Tidak diketahui"
  const peerPhoto = state.peerPhoto || state.outgoing?.calleePhoto || null

  let statusText = ""
  if (isIncoming) statusText = "Panggilan masuk…"
  else if (isOutgoing) statusText = "Memanggil…"
  else if (state.connected) statusText = state.duration ? formatDuration(state.duration) : "Tersambung"
  else statusText = "Menghubungkan…"

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between p-6 nb-fade nb-dot-pattern"
      style={{
        background: isVideoCall && state.connected
          ? "#000"
          : "linear-gradient(170deg, var(--color-nb-purple), #1a0f2e)",
        color: "#fff",
      }}
    >
      {/* Hidden audio element to capture remote audio */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Status bar */}
      <div className="w-full text-center mt-8 nb-safe-top">
        <div className="text-xs opacity-70 mb-1">{isVideoCall ? "Video call" : "Voice call"}</div>
        <div className="nb-chip mx-auto" style={{ background: "var(--secondary)", color: "#111" }}>
          {statusText}
        </div>
      </div>

      {/* Avatar / Video area */}
      <div className="flex-1 flex items-center justify-center w-full">
        {isVideoCall && state.connected && remoteStreamReady ? (
          <div className="relative w-full h-full">
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <div className="absolute top-4 right-4 w-32 h-44 rounded-lg overflow-hidden border-2 border-white shadow-lg">
              <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Avatar
              name={peerName}
              src={peerPhoto}
              size={130}
              className={!state.connected ? "nb-pulse" : ""}
            />
            <div className="text-2xl font-bold">{peerName}</div>
          </div>
        )}
      </div>

      {/* Local video for outgoing video call (preview) */}
      {isVideoCall && !state.connected && (
        <div className="absolute top-20 right-4 w-32 h-44 rounded-lg overflow-hidden border-2 border-white shadow-lg" style={{ transform: "scaleX(-1)" }}>
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        </div>
      )}

      {/* Call controls */}
      <div className="w-full max-w-md pb-8 nb-safe-bottom flex flex-col items-center gap-4">
        {/* Hidden local video for voice calls — we still need the ref for video calls */}
        {!isVideoCall && (
          <video ref={localVideoRef} autoPlay playsInline muted className="hidden" />
        )}

        {isIncoming ? (
          <div className="flex gap-8 items-center">
            <button
              className="w-16 h-16 rounded-full grid place-items-center hover:scale-110 transition-transform"
              style={{ background: "var(--color-nb-green)", border: "3px solid #000", boxShadow: "4px 4px 0 #000" }}
              onClick={onAccept}
              title="Terima"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.8.7a2 2 0 011.7 2z" />
              </svg>
            </button>
            <button
              className="w-16 h-16 rounded-full grid place-items-center hover:scale-110 transition-transform"
              style={{ background: "var(--color-nb-red)", border: "3px solid #000", boxShadow: "4px 4px 0 #000" }}
              onClick={onReject}
              title="Tolak"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: "rotate(135deg)" }}>
                <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.8.7a2 2 0 011.7 2z" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="flex gap-6 items-center">
            {isVideoCall && state.connected && (
              <button
                className="w-14 h-14 rounded-full grid place-items-center hover:scale-110 transition-transform"
                style={{ background: state.videoOff ? "var(--color-nb-red)" : "rgba(255,255,255,0.2)", border: "3px solid #fff" }}
                onClick={onToggleVideo}
                title={state.videoOff ? "Nyalakan kamera" : "Matikan kamera"}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 7l-7 5 7 5V7zM1 5h15v14H1z" />
                </svg>
              </button>
            )}
            {isVideoCall && state.connected && (
              <button
                className="w-14 h-14 rounded-full grid place-items-center hover:scale-110 transition-transform"
                style={{ background: "rgba(255,255,255,0.2)", border: "3px solid #fff" }}
                onClick={onSwitchCamera}
                title="Ganti kamera"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 4v6h-6M1 20v-6h6" />
                  <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                </svg>
              </button>
            )}
            <button
              className="w-14 h-14 rounded-full grid place-items-center hover:scale-110 transition-transform"
              style={{ background: state.muted ? "var(--color-nb-red)" : "rgba(255,255,255,0.2)", border: "3px solid #fff" }}
              onClick={onToggleMute}
              title={state.muted ? "Buka mikrofon" : "Bisukan mikrofon"}
            >
              {state.muted ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v3M2 2l20 20" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v3" />
                </svg>
              )}
            </button>
            <button
              className="w-16 h-16 rounded-full grid place-items-center hover:scale-110 transition-transform nb-pulse"
              style={{ background: "var(--color-nb-red)", border: "3px solid #000", boxShadow: "4px 4px 0 #000" }}
              onClick={onEnd}
              title="Akhiri panggilan"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: "rotate(135deg)" }}>
                <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.8.7a2 2 0 011.7 2z" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
