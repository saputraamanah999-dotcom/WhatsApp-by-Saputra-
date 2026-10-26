"use client"

import { useEffect, useState, useCallback } from "react"
import { Avatar } from "@/components/ui/avatar-nb"
import { api, timeAgo } from "@/lib/api"
import type { AdminStats, UserProfile } from "@/lib/types"
import { isOnline } from "@/lib/utils"
import { toast } from "sonner"

interface AdminPanelProps {
  onClose: () => void
}

type Tab = "stats" | "users" | "banner"

export function AdminPanel({ onClose }: AdminPanelProps) {
  const [tab, setTab] = useState<Tab>("stats")
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<UserProfile[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [bannerText, setBannerText] = useState("")
  const [bannerKind, setBannerKind] = useState("info")
  const [bannerActive, setBannerActive] = useState(false)

  const loadStats = useCallback(async () => {
    try {
      const r = await api<AdminStats>("/api/firebase/admin/stats")
      setStats(r)
    } catch (e: any) {
      toast.error("Gagal memuat stats: " + e.message)
    }
  }, [])

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api<{ users: UserProfile[] }>(`/api/admin/users${search ? `?q=${encodeURIComponent(search)}` : ""}`)
      setUsers(r.users)
    } catch (e: any) {
      toast.error("Gagal: " + e.message)
    } finally {
      setLoading(false)
    }
  }, [search])

  const loadBanner = useCallback(async () => {
    try {
      const r = await api<{ banner: any }>("/api/firebase/admin/banner")
      if (r.banner) {
        setBannerText(r.banner.text || "")
        setBannerKind(r.banner.kind || "info")
        setBannerActive(!!r.banner.active)
      }
    } catch {}
  }, [])

  useEffect(() => {
    loadStats()
    loadUsers()
    loadBanner()
  }, [loadStats, loadUsers, loadBanner])

  useEffect(() => {
    if (tab === "users") loadUsers()
  }, [tab, loadUsers])

  const act = async (userId: string, action: string) => {
    if (!confirm(`Yakin ${action} user ini?`)) return
    try {
      await api("/api/firebase/admin/users", { method: "PATCH", json: { userId, action } })
      toast.success("Berhasil")
      loadUsers()
      loadStats()
    } catch (e: any) {
      toast.error("Gagal: " + e.message)
    }
  }

  const sendBanner = async () => {
    try {
      await api("/api/firebase/admin/banner", { method: "POST", json: { text: bannerText, active: bannerActive, kind: bannerKind } })
      // Broadcast via socket
      try {
        const { io } = await import("socket.io-client")
        const sock = io("/?XTransformPort=3003", { transports: ["websocket", "polling"] })
        sock.emit("admin:broadcast", { text: bannerText, kind: bannerKind })
        setTimeout(() => sock.disconnect(), 500)
      } catch {}
      toast.success("Banner diupdate & dikirim!")
    } catch (e: any) {
      toast.error("Gagal: " + e.message)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] bg-background flex flex-col nb-rise">
      <header className="nb-safe-top flex items-center gap-2 p-3 border-b-[2.5px] border-border text-white" style={{ background: "var(--color-nb-pink)", color: "#111" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
        <span className="font-bold text-base flex-1">Panel Admin</span>
        <button className="nb-btn-icon" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </header>

      {/* Tabs */}
      <div className="flex border-b-[2.5px] border-border bg-muted nb-no-scrollbar overflow-x-auto">
        {([
          { k: "stats", label: "📊 Statistik" },
          { k: "users", label: "👥 User" },
          { k: "banner", label: "📢 Banner" },
        ] as { k: Tab; label: string }[]).map((t) => (
          <button
            key={t.k}
            className={`flex-1 min-w-[100px] py-3 px-2 font-bold text-sm whitespace-nowrap border-b-4`}
            style={{
              borderBottomColor: tab === t.k ? "var(--border)" : "transparent",
              background: tab === t.k ? "var(--secondary)" : "transparent",
              color: tab === t.k ? "#111" : undefined,
            }}
            onClick={() => setTab(t.k)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto nb-scroll p-4 max-w-5xl w-full mx-auto">
        {tab === "stats" && (
          <>
            {stats ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Total User" value={stats.totalUsers} color="cyan" />
                <StatCard label="Online" value={stats.onlineUsers} color="green" />
                <StatCard label="Banned" value={stats.bannedUsers} color="red" />
                <StatCard label="Verified" value={stats.verifiedUsers} color="blue" />
                <StatCard label="Baru Hari Ini" value={stats.newUsersToday} color="yellow" />
                <StatCard label="Total Pesan" value={stats.totalMessages} color="cyan" />
                <StatCard label="Pesan Hari Ini" value={stats.messagesToday} color="green" />
                <StatCard label="Total Grup" value={stats.totalGroups} color="blue" />
                <StatCard label="Total Channel" value={stats.totalChannels} color="pink" />
                <StatCard label="Total Story" value={stats.totalStories} color="yellow" />
                <StatCard label="Laporan" value={stats.openReports} color="orange" />
                <StatCard label="Total Panggilan" value={stats.totalCalls} color="red" />
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-6">Memuat…</div>
            )}

            {stats?.messagesPerDay && (
              <div className="mt-6 nb-card p-4">
                <div className="font-bold mb-3">Aktivitas Pesan (7 hari terakhir)</div>
                <div className="flex gap-2 items-end h-40">
                  {stats.messagesPerDay.map((d, i) => {
                    const max = Math.max(...stats.messagesPerDay.map((x) => x.count), 1)
                    const h = (d.count / max) * 100
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="text-xs font-bold">{d.count}</div>
                        <div
                          className="w-full rounded-t"
                          style={{
                            height: `${h}%`,
                            background: "var(--color-nb-pink)",
                            border: "2px solid var(--border)",
                            minHeight: 4,
                          }}
                        />
                        <div className="text-xs text-muted-foreground">{d.day}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {tab === "users" && (
          <>
            <div className="flex gap-2 mb-4">
              <input
                className="nb-input flex-1"
                placeholder="Cari username / email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") loadUsers() }}
              />
              <button className="nb-btn nb-btn-primary" onClick={loadUsers}>Cari</button>
            </div>

            {loading ? (
              <div className="text-center text-muted-foreground py-6">Memuat…</div>
            ) : users.length === 0 ? (
              <div className="text-center text-muted-foreground py-6">Tidak ada user</div>
            ) : (
              <div className="flex flex-col gap-2">
                {users.map((u) => (
                  <div key={u.id} className="nb-card-sm p-3 flex items-center gap-3">
                    <Avatar name={u.username} src={u.photoURL || null} size={40} online={isOnline(u.lastSeen as any)} verified={u.verified} />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">{u.displayName || u.username}</div>
                      <div className="text-xs text-muted-foreground truncate">@{u.username} · {u.email}</div>
                      <div className="text-xs">
                        <span className="nb-chip mr-1" style={{ background: u.banned ? "var(--color-nb-red)" : "var(--color-nb-green)", color: "#111" }}>
                          {u.banned ? "Banned" : "Aktif"}
                        </span>
                        {u.role !== "user" && (
                          <span className="nb-chip" style={{ background: "var(--color-nb-pink)", color: "#111" }}>{u.role}</span>
                        )}
                        <span className="text-muted-foreground ml-1">· {timeAgo(u.lastSeen)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        className="nb-btn text-xs py-1 px-2"
                        style={{ background: u.banned ? "var(--color-nb-green)" : "var(--color-nb-red)", color: "#fff" }}
                        onClick={() => act(u.id, u.banned ? "unban" : "ban")}
                      >
                        {u.banned ? "Unban" : "Ban"}
                      </button>
                      <button
                        className="nb-btn text-xs py-1 px-2"
                        style={{ background: u.verified ? "var(--muted)" : "var(--color-nb-blue)", color: u.verified ? "#111" : "#111" }}
                        onClick={() => act(u.id, u.verified ? "unverify" : "verify")}
                      >
                        {u.verified ? "Unverify" : "Verify"}
                      </button>
                      {u.role !== "superadmin" && (
                        <button
                          className="nb-btn text-xs py-1 px-2"
                          style={{ background: u.role === "user" ? "var(--color-nb-pink)" : "var(--muted)", color: u.role === "user" ? "#111" : "#111" }}
                          onClick={() => act(u.id, u.role === "user" ? "make_admin" : "make_user")}
                        >
                          {u.role === "user" ? "→ Admin" : "→ User"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "banner" && (
          <div className="flex flex-col gap-3">
            <h3 className="font-bold">Banner Pengumuman</h3>
            <p className="text-sm text-muted-foreground">Banner akan tampil di bagian atas aplikasi semua user yang sedang online.</p>
            <textarea
              className="nb-input"
              placeholder="Isi banner…"
              value={bannerText}
              onChange={(e) => setBannerText(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <label className="text-xs font-bold">Jenis</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { k: "info", label: "Info", color: "var(--color-nb-blue)" },
                { k: "warn", label: "Peringatan", color: "var(--color-nb-orange)" },
                { k: "danger", label: "Bahaya", color: "var(--color-nb-red)" },
                { k: "ok", label: "Sukses", color: "var(--color-nb-green)" },
              ].map((b) => (
                <button
                  key={b.k}
                  className="nb-btn text-sm py-2"
                  style={{ background: bannerKind === b.k ? b.color : "var(--muted)", color: "#111" }}
                  onClick={() => setBannerKind(b.k)}
                >
                  {b.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 mt-2">
              <input type="checkbox" checked={bannerActive} onChange={(e) => setBannerActive(e.target.checked)} />
              <span className="text-sm">Aktif</span>
            </label>
            <div className="flex gap-2 mt-2">
              <button className="nb-btn nb-btn-primary flex-1" onClick={sendBanner} disabled={!bannerText.trim()}>
                Kirim & Aktifkan
              </button>
              <button
                className="nb-btn"
                onClick={async () => {
                  setBannerActive(false)
                  await api("/api/firebase/admin/banner", { method: "POST", json: { text: bannerText, active: false, kind: bannerKind } })
                  toast.success("Banner dimatikan")
                }}
              >
                Matikan
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    cyan: "var(--color-nb-cyan)",
    green: "var(--color-nb-green)",
    red: "var(--color-nb-red)",
    blue: "var(--color-nb-blue)",
    pink: "var(--color-nb-pink)",
    yellow: "var(--secondary)",
    orange: "var(--color-nb-orange)",
  }
  return (
    <div className="nb-card-sm p-3 text-center" style={{ background: colorMap[color] || "var(--card)" }}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs">{label}</div>
    </div>
  )
}
