"use client"

import { useRef, useState, useCallback } from "react"

export interface Recording {
  blob: Blob
  url: string
  durationSec: number
}

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [recording, setRecording] = useState<Recording | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef<number>(0)
  const timerRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const start = useCallback(async () => {
    setError(null)
    setRecording(null)
    setDuration(0)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" })
        const url = URL.createObjectURL(blob)
        const dur = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000))
        setRecording({ blob, url, durationSec: dur })
        if (streamRef.current) {
          for (const t of streamRef.current.getTracks()) t.stop()
          streamRef.current = null
        }
      }
      startTimeRef.current = Date.now()
      timerRef.current = setInterval(() => {
        setDuration(Math.round((Date.now() - startTimeRef.current) / 1000))
      }, 250)
      mr.start(250)
      setIsRecording(true)
    } catch (e: any) {
      setError(
        e.name === "NotAllowedError"
          ? "Izin mikrofon ditolak. Aktifkan di pengaturan browser."
          : e.name === "NotFoundError"
            ? "Mikrofon tidak ditemukan."
            : e.message || "Gagal merekam"
      )
    }
  }, [])

  const stop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    }
    if (timerRef.current) clearInterval(timerRef.current)
    setIsRecording(false)
  }, [])

  const cancel = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.onstop = null
      mediaRecorderRef.current.stop()
    }
    if (timerRef.current) clearInterval(timerRef.current)
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop()
      streamRef.current = null
    }
    setIsRecording(false)
    setRecording(null)
    setDuration(0)
  }, [])

  const clear = useCallback(() => {
    if (recording) URL.revokeObjectURL(recording.url)
    setRecording(null)
    setDuration(0)
  }, [recording])

  return {
    isRecording,
    duration,
    recording,
    error,
    start,
    stop,
    cancel,
    clear,
  }
}
