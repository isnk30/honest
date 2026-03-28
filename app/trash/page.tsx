"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { format, isToday, isYesterday } from "date-fns"
import { Trash2, RotateCcw, User, ArrowLeft } from "lucide-react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal } from "lucide-react"
import { toast } from "sonner"

type Doc = {
  id: string
  title: string
  deleted_at: string
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  if (isToday(date)) return "Today"
  if (isYesterday(date)) return "Yesterday"
  return format(date, "MMM d")
}

export default function TrashPage() {
  const router = useRouter()
  const [docs, setDocs] = useState<Doc[]>([])
  const [userAvatar, setUserAvatar] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setUserAvatar(user.user_metadata?.avatar_url)

    const { data } = await supabase
      .from("documents")
      .select("id, title, deleted_at")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })

    setDocs(data ?? [])
    setLoading(false)
  }

  async function restoreDoc(id: string) {
    const supabase = createClient()
    await supabase.from("documents").update({ deleted_at: null }).eq("id", id)
    setDocs(prev => prev.filter(d => d.id !== id))
    toast.success("Restored")
  }

  async function deleteForever(id: string) {
    const supabase = createClient()
    await supabase.from("documents").delete().eq("id", id)
    setDocs(prev => prev.filter(d => d.id !== id))
    toast.success("Deleted permanently")
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background font-sans">
      <header className="relative flex h-12 w-full shrink-0 items-center px-4 bg-background">
        <img
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/hoenst%20logo-gpNSSpWBxxqq17ZGgKgLhGcM8BfrOo.png"
          alt="Honest"
          className="h-6 w-6 object-contain dark:invert"
        />
        <div className="flex-1" />
        <Avatar className="h-7 w-7 cursor-pointer transition-opacity hover:opacity-70">
          <AvatarImage src={userAvatar} alt="Profile" />
          <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
            <User className="h-3.5 w-3.5" />
          </AvatarFallback>
        </Avatar>
      </header>

      <main className="flex-1 overflow-y-auto px-8 py-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <div className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-foreground" />
              <h1 className="text-2xl font-semibold text-foreground">Trash</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Pages deleted in the last 30 days.</p>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 rounded-xl border border-border bg-muted/20 animate-pulse" />
              ))}
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
              <Trash2 className="h-8 w-8 mb-3 opacity-30" />
              <p className="text-sm">Trash is empty</p>
            </div>
          ) : (
            <div className="space-y-1">
              {docs.map(doc => (
                <div
                  key={doc.id}
                  className="group flex items-center justify-between rounded-xl border border-border px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{doc.title || "Untitled"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Deleted {formatDate(doc.deleted_at)}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        onClick={e => e.stopPropagation()}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted transition-all cursor-pointer"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => restoreDoc(doc.id)}>
                        <RotateCcw className="h-3.5 w-3.5" />
                        Restore
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => deleteForever(doc.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete forever
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
