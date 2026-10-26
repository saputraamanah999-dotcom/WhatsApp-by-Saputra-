"use client"

import { cn } from "@/lib/utils"
import { avatarBg, initials } from "@/lib/api"

interface AvatarProps {
  name?: string | null
  src?: string | null
  size?: number
  online?: boolean
  verified?: boolean
  onClick?: () => void
  className?: string
}

export function Avatar({ name, src, size = 44, online, verified, onClick, className }: AvatarProps) {
  const s = { width: size, height: size, fontSize: size * 0.42, background: avatarBg(name) }
  return (
    <div
      className={cn("nb-ava", online && "nb-ava-on", onClick && "cursor-pointer", className)}
      style={s}
      onClick={onClick}
      title={name || ""}
    >
      {src ? (
         
        <img src={src} alt={name || ""} className="w-full h-full object-cover rounded-full" />
      ) : (
        <span>{initials(name)}</span>
      )}
      {verified && (
        <svg
          viewBox="0 0 24 24"
          className="absolute -right-1 -bottom-1"
          style={{ width: size * 0.36, height: size * 0.36 }}
        >
          <rect x="3" y="3" width="18" height="18" rx="5" fill="#1d9bf0" stroke="#111" strokeWidth="2" />
          <path d="M8 12.4l2.8 2.8 5.4-5.6" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  )
}
