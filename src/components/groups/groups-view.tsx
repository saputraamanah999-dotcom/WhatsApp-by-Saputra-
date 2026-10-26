"use client"

import { useEffect, useState, useCallback } from "react"
import { Avatar } from "@/components/ui/avatar-nb"
import { api } from "@/lib/api"
import type { Group } from "@/lib/types"
import { toast } from "sonner"

interface GroupsViewProps {
  onOpenGroup: (gid: string) => void
}

export function GroupsView({ onOpenGroup }: GroupsViewProps) {
  const [groups, setGroups] = useState<Group[]>([])
  const [joined, setJoined] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [newVisibility, setNewVisibility] = useState<"public" | "private">("public")
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api<{ groups: Group[] }>("/api/firebase/groups")
      setGroups(r.groups)
      // For joined — need a way to know which groups I'm in. For now we just show all public groups.
    } catch (e: any) {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const create = async () => {
    if (!newName.trim() || creating) return
    setCreating(true)
    try {
      const r = await api<{ group: Group }>("/api/firebase/groups", {
        method: "POST",
        json: { name: newName, description: newDesc, visibility: newVisibility, joinPolicy: "open" },
      })
      toast.success("Grup dibuat!")
      setNewName("")
      setNewDesc("")
      setShowCreate(false)
      load()
      onOpenGroup(r.group.id)
    } catch (e: any) {
      toast.error("Gagal: " + e.message)
    } finally {
      setCreating(false)
    }
  }

  const join = async (gid: string) => {
    try {
      await api("/api/firebase/groups/members", { method: "POST", json: { groupId: gid } })
      toast.success("Bergabung dengan grup!")
      onOpenGroup(gid)
    } catch (e: any) {
      toast.error("Gagal: " + e.message)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-card">
      <header className="flex items-center gap-2 p-3 border-b-[2.5px] border-border" style={{ background: "var(--color-nb-cyan)" }}>
        <Avatar name="👥" size={42} />
        <div className="flex-1">
          <div className="font-bold text-base">Grup</div>
          <div className="text-xs text-muted-foreground">{groups.length} grup publik</div>
        </div>
        <button className="nb-btn nb-btn-accent text-sm py-2" onClick={() => setShowCreate(true)}>
          + Buat Grup
        </button>
      </header>

      <div className="flex-1 overflow-y-auto nb-scroll">
        {loading ? (
          <div className="text-center text-muted-foreground py-6 text-sm">Memuat…</div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center gap-2 p-6">
            <div className="text-4xl">👥</div>
            <div className="font-bold">Belum ada grup publik</div>
            <div className="text-xs">Jadilah yang pertama membuat grup!</div>
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.id} className="p-3 border-b-2 border-border hover:bg-muted transition-colors flex items-center gap-3">
              <Avatar name={g.name} src={g.photoURL || null} size={48} />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate">{g.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {g.memberCount} anggota · {g.visibility === "public" ? "🌐 Publik" : "🔒 Privat"}
                </div>
                {g.description && <div className="text-xs mt-1 truncate">{g.description}</div>}
              </div>
              <button className="nb-btn nb-btn-green text-sm py-1.5" onClick={() => join(g.id)}>
                Gabung
              </button>
            </div>
          ))
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 nb-fade" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setShowCreate(false)}>
          <div className="nb-card-lg p-6 w-full max-w-md nb-rise flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">Buat Grup Baru</h2>
            <label className="text-xs font-bold">Nama Grup</label>
            <input className="nb-input" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={50} placeholder="contoh: Grup Kuliah" />
            <label className="text-xs font-bold">Deskripsi</label>
            <textarea className="nb-input" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} maxLength={500} rows={3} placeholder="Tentang grup ini…" />
            <label className="text-xs font-bold">Visibilitas</label>
            <div className="flex gap-2">
              <button
                className="nb-btn flex-1"
                style={{ background: newVisibility === "public" ? "var(--secondary)" : "var(--muted)" }}
                onClick={() => setNewVisibility("public")}
              >
                🌐 Publik
              </button>
              <button
                className="nb-btn flex-1"
                style={{ background: newVisibility === "private" ? "var(--secondary)" : "var(--muted)" }}
                onClick={() => setNewVisibility("private")}
              >
                🔒 Privat
              </button>
            </div>
            <div className="flex gap-2 mt-2">
              <button className="nb-btn flex-1" onClick={() => setShowCreate(false)}>Batal</button>
              <button className="nb-btn nb-btn-primary flex-1" onClick={create} disabled={creating || !newName.trim()}>
                {creating ? "Membuat…" : "Buat"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
