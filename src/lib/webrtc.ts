// WebRTC manager with Firestore-based signaling (no Socket.io needed)
// Signaling events are exchanged via Firestore `calls/{callId}` document + subcollections

import { doc, onSnapshot, updateDoc, collection, addDoc, deleteDoc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

export interface CallOptions {
  callId: string
  callerId: string
  calleeId: string
  callType: "voice" | "video"
  isCaller: boolean
  remoteOffer?: any
  onLocalStream?: (stream: MediaStream) => void
  onRemoteStream?: (stream: MediaStream) => void
  onStateChange?: (state: CallState) => void
  onEnded?: () => void
}

export type CallState =
  | "idle"
  | "requesting-permission"
  | "creating-offer"
  | "ringing"
  | "connecting"
  | "connected"
  | "ended"
  | "rejected"
  | "failed"

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turns:openrelay.metered.ca:443?transport=tcp",
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
  iceCandidatePoolSize: 10,
}

export class WebRTCCall {
  pc: RTCPeerConnection | null = null
  localStream: MediaStream | null = null
  remoteStream: MediaStream | null = null
  state: CallState = "idle"
  private opts: CallOptions
  private disposed = false
  private unsubCallDoc: (() => void) | null = null
  private unsubCandidates: (() => void) | null = null

  constructor(opts: CallOptions) {
    this.opts = opts
  }

  private setState(s: CallState) {
    if (this.state === s) return
    this.state = s
    this.opts.onStateChange?.(s)
  }

  async start(): Promise<void> {
    try {
      this.setState("requesting-permission")
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: this.opts.callType === "video",
      }
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints)
      this.opts.onLocalStream?.(this.localStream)

      this.pc = new RTCPeerConnection(ICE_CONFIG)
      this.remoteStream = new MediaStream()
      this.opts.onRemoteStream?.(this.remoteStream)

      for (const track of this.localStream.getTracks()) {
        this.pc.addTrack(track, this.localStream)
      }

      this.pc.ontrack = (e) => {
        if (this.remoteStream) {
          for (const t of e.streams[0].getTracks()) {
            this.remoteStream.addTrack(t)
          }
        }
        this.opts.onRemoteStream?.(this.remoteStream!)
      }

      this.pc.onicecandidate = (e) => {
        if (e.candidate) {
          // Send candidate to Firestore
          addDoc(collection(db, "calls", this.opts.callId, "candidates"), {
            from: this.opts.callerId,
            candidate: JSON.stringify(e.candidate.toJSON()),
            createdAt: Date.now(),
          }).catch(() => {})
        }
      }

      this.pc.onconnectionstatechange = () => {
        const s = this.pc?.connectionState
        if (s === "connected") this.setState("connected")
        else if (s === "failed") this.setState("failed")
      }

      // Listen for ICE candidates from the other party
      this.unsubCandidates = onSnapshot(
        collection(db, "calls", this.opts.callId, "candidates"),
        (snap) => {
          snap.docChanges().forEach((change) => {
            if (change.type === "added") {
              const data = change.doc.data()
              if (data.from !== this.opts.callerId) {
                // It's from the other party
                try {
                  const candidate = JSON.parse(data.candidate)
                  this.pc?.addIceCandidate(candidate).catch(() => {})
                } catch (e) {
                  // ignore
                }
              }
            }
          })
        }
      )

      // Listen for call document changes (offer/answer/ended)
      this.unsubCallDoc = onSnapshot(
        doc(db, "calls", this.opts.callId),
        async (snap) => {
          if (!snap.exists()) return
          const data = snap.data()
          // If status is ended, clean up
          if (data.status === "ended" || data.status === "rejected" || data.status === "missed" || data.status === "failed") {
            this.opts.onEnded?.()
            return
          }
          // If we are caller and we get answer
          if (this.opts.isCaller && data.answer && this.pc && !this.pc.currentRemoteDescription) {
            await this.pc.setRemoteDescription(data.answer)
            this.setState("connecting")
          }
        }
      )

      if (this.opts.isCaller) {
        this.setState("creating-offer")
        const offer = await this.pc.createOffer()
        await this.pc.setLocalDescription(offer)
        this.setState("ringing")
        // Save offer to Firestore
        await updateDoc(doc(db, "calls", this.opts.callId), {
          offer: { type: offer.type, sdp: offer.sdp },
          status: "ringing",
          callerId: this.opts.callerId,
          calleeId: this.opts.calleeId,
          callType: this.opts.callType,
          createdAt: Date.now(),
        })
      } else if (this.opts.remoteOffer) {
        this.setState("connecting")
        await this.pc.setRemoteDescription(this.opts.remoteOffer)
        const answer = await this.pc.createAnswer()
        await this.pc.setLocalDescription(answer)
        // Save answer to Firestore
        await updateDoc(doc(db, "calls", this.opts.callId), {
          answer: { type: answer.type, sdp: answer.sdp },
          status: "active",
          startedAt: Date.now(),
        })
      }
    } catch (e: any) {
      console.error("[webrtc] start error:", e)
      this.setState("failed")
      throw e
    }
  }

  /**
   * Reject an incoming call
   */
  static async rejectCall(callId: string): Promise<void> {
    await updateDoc(doc(db, "calls", callId), {
      status: "rejected",
      endedAt: Date.now(),
    })
  }

  /**
   * End an active call
   */
  static async endCall(callId: string, durationSeconds?: number): Promise<void> {
    await updateDoc(doc(db, "calls", callId), {
      status: "ended",
      endedAt: Date.now(),
      durationSeconds: durationSeconds || 0,
    })
  }

  toggleMute(): boolean {
    if (!this.localStream) return false
    const track = this.localStream.getAudioTracks()[0]
    if (track) {
      track.enabled = !track.enabled
      return !track.enabled
    }
    return false
  }

  toggleVideo(): boolean {
    if (!this.localStream) return false
    const track = this.localStream.getVideoTracks()[0]
    if (track) {
      track.enabled = !track.enabled
      return !track.enabled
    }
    return false
  }

  async switchCamera(): Promise<boolean> {
    if (!this.localStream || this.opts.callType !== "video") return false
    const oldTrack = this.localStream.getVideoTracks()[0]
    if (!oldTrack || !this.pc) return false
    const sender = this.pc.getSenders().find((s) => s.track === oldTrack)
    if (!sender) return false
    const oldFacing = oldTrack.getSettings().facingMode || "user"
    const newFacing = oldFacing === "user" ? "environment" : "user"
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacing },
        audio: false,
      })
      const newTrack = newStream.getVideoTracks()[0]
      await sender.replaceTrack(newTrack)
      oldTrack.stop()
      this.localStream.removeTrack(oldTrack)
      this.localStream.addTrack(newTrack)
      this.opts.onLocalStream?.(this.localStream)
      return true
    } catch (e) {
      return false
    }
  }

  end(): void {
    if (this.disposed) return
    this.disposed = true
    if (this.unsubCandidates) this.unsubCandidates()
    if (this.unsubCallDoc) this.unsubCallDoc()
    if (this.localStream) {
      for (const t of this.localStream.getTracks()) t.stop()
      this.localStream = null
    }
    if (this.pc) {
      try { this.pc.close() } catch {}
      this.pc = null
    }
    this.remoteStream = null
    this.setState("ended")
  }
}

/**
 * Listen for incoming calls (for callee)
 */
export function listenForIncomingCalls(
  uid: string,
  onIncoming: (call: { id: string; callerId: string; callerUsername: string; callType: "voice" | "video"; offer: any }) => void
): () => void {
  // Listen to calls collection where calleeId == uid and status == "ringing"
  // We need to query, but to get callerUsername we need a separate listener or join
  // For simplicity, listen to all calls where calleeId == uid and check status

  // Note: We can't easily do where clauses with onSnapshot and not have permission issues
  // Use simple onSnapshot on calls collection and filter client-side
  const q = collection(db, "calls")
  // Limit to recent calls only - we listen and filter
  const unsub = onSnapshot(q, (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type === "added") {
        const data = change.doc.data()
        if (data.calleeId === uid && data.status === "ringing" && data.offer) {
          // Get caller username
          getDoc(doc(db, "users", data.callerId)).then((callerDoc) => {
            const caller = callerDoc.exists() ? callerDoc.data() : null
            onIncoming({
              id: change.doc.id,
              callerId: data.callerId,
              callerUsername: caller?.username || "Tidak diketahui",
              callType: data.callType || "voice",
              offer: data.offer,
            })
          })
        }
      }
    })
  })
  return unsub
}
