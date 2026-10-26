import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Generate chat id from two user IDs (sorted to keep consistent)
export function chatIdOf(a: string, b: string): string {
  return [a, b].sort().join("_")
}

// Normalize username
export function normalizeUsername(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "")
}

// Validate username: 3-20 chars, lowercase letters, digits, underscore
export function isValidUsername(s: string): boolean {
  return /^[a-z0-9_]{3,20}$/.test(s)
}

// Escape HTML
export function escapeHtml(s: string | null | undefined): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]!))
}

// Format time HH:mm
export function fmtTime(d: Date | number | string): string {
  const date = new Date(d)
  return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
}

// Format date for day separator
export function fmtDay(d: Date | number | string): string {
  const date = new Date(d)
  return date.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })
}

// Generate deterministic hue from string (for avatar color)
export function hashHue(s: string): number {
  let h = 7
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h) % 360
}

// Avatar background from string
export function avatarBg(s: string | null | undefined): string {
  if (!s) return "hsl(0, 50%, 42%)"
  return `hsl(${hashHue(s)} 50% 42%)`
}

// Avatar initials
export function initials(s: string | null | undefined): string {
  if (!s) return "?"
  return s[0].toUpperCase()
}

// Check if user is online (last seen < 60s ago)
export function isOnline(lastSeen: Date | number | null | undefined): boolean {
  if (!lastSeen) return false
  const t = new Date(lastSeen).getTime()
  return Date.now() - t < 60000
}

// Build mention markup from text + mentioned user IDs (simple @username pattern)
export function parseMentions(text: string): string[] {
  const ids: string[] = []
  const re = /@([a-z0-9_]{3,20})/g
  let m
  while ((m = re.exec(text))) ids.push(m[1])
  return ids
}

// Reactions JSON helpers
export function parseReactions(json: string | null | undefined): Record<string, string[]> {
  if (!json) return {}
  try {
    const r = JSON.parse(json)
    return typeof r === "object" && r ? r : {}
  } catch {
    return {}
  }
}

export function stringifyReactions(r: Record<string, string[]>): string {
  return JSON.stringify(r)
}

// Generate invite code
export function genInviteCode(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

// Slug for channel
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30)
}

// Format seconds as mm:ss
export function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

// Get client IP from request headers
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0].trim()
  return req.headers.get("x-real-ip") || "unknown"
}
