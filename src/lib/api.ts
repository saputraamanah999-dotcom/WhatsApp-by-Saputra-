// API client helper — wraps fetch with Firebase auth token injection
import { auth } from "@/lib/firebase"
import { getIdToken } from "firebase/auth"

let cachedToken: string | null = null
let tokenExpiry = 0

async function getIdTokenCached(): Promise<string | null> {
  // Refresh token if expired (every 50 min, since ID tokens last 60 min)
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken
  const user = auth.currentUser
  if (!user) return null
  try {
    const token = await getIdToken(user, false)
    cachedToken = token
    tokenExpiry = Date.now() + 50 * 60 * 1000
    return token
  } catch {
    return null
  }
}

export async function api<T = any>(
  path: string,
  opts?: RequestInit & { json?: any }
): Promise<T> {
  const headers: Record<string, string> = { ...(opts?.headers as any) }
  let body = opts?.body
  if (opts?.json !== undefined) {
    headers["Content-Type"] = "application/json"
    body = JSON.stringify(opts.json)
  }
  // Inject Firebase ID token if available
  const token = await getIdTokenCached()
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }
  const res = await fetch(path, {
    ...opts,
    headers,
    body,
    credentials: "same-origin",
    cache: "no-store",
  })
  const ct = res.headers.get("content-type") || ""
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    if (ct.includes("json")) {
      try {
        const j = await res.json()
        msg = j.error || j.message || msg
      } catch {}
    } else {
      try { msg = (await res.text()).slice(0, 200) || msg } catch {}
    }
    throw new Error(msg)
  }
  if (ct.includes("json")) return res.json() as Promise<T>
  return (await res.text()) as unknown as T
}

export function formatTime(d: string | Date | number): string {
  return new Date(d).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
}

export function formatDay(d: string | Date | number): string {
  return new Date(d).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export function timeAgo(d: string | Date | number): string {
  const t = typeof d === "number" ? d : new Date(d).getTime()
  const diff = Date.now() - t
  if (diff < 60000) return "baru saja"
  if (diff < 3600000) return Math.floor(diff / 60000) + " menit lalu"
  if (diff < 86400000) return Math.floor(diff / 3600000) + " jam lalu"
  if (diff < 7 * 86400000) return Math.floor(diff / 86400000) + " hari lalu"
  return new Date(t).toLocaleDateString("id-ID", { day: "numeric", month: "short" })
}

export function hashHue(s: string): number {
  let h = 7
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h) % 360
}

export function avatarBg(s: string | null | undefined): string {
  if (!s) return "hsl(0, 50%, 42%)"
  return `hsl(${hashHue(s)} 50% 42%)`
}

export function initials(s: string | null | undefined): string {
  if (!s) return "?"
  return s[0].toUpperCase()
}

export function parseMentions(text: string): string[] {
  const ids: string[] = []
  const re = /@([a-z0-9_]{3,20})/g
  let m
  while ((m = re.exec(text))) ids.push(m[1])
  return ids
}

export function renderText(text: string): string {
  const esc = String(text ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]!))
  return esc.replace(/@([a-z0-9_]{3,20})/g, '<span class="nb-mention">@$1</span>')
}
