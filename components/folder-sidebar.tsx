"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { motion } from "motion/react"
import { format, isToday, isYesterday } from "date-fns"
import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"

type Doc = {
  id: string
  title: string
  updated_at: string
}

interface FolderSidebarProps {
  folderId: string
  currentDocId: string
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  if (isToday(date)) return "Today"
  if (isYesterday(date)) return "Yesterday"
  return format(date, "MMMM do")
}

export function FolderSidebar({ folderId, currentDocId }: FolderSidebarProps) {
  const router = useRouter()
  const [docs, setDocs] = useState<Doc[]>([])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from("documents")
        .select("id, title, updated_at")
        .eq("folder_id", folderId)
        .order("updated_at", { ascending: false })
      setDocs(data ?? [])
    }
    load()
  }, [folderId])

  async function createDoc() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from("documents")
      .insert({ user_id: user.id, title: "", content: "", folder_id: folderId })
      .select()
      .single()
    if (data) router.push(`/doc/${data.id}`)
  }

  return (
    <motion.aside
      initial={{ x: "-110%" }}
      animate={{ x: 0 }}
      exit={{ x: "-110%" }}
      transition={{ type: "spring", stiffness: 400, damping: 40 }}
      className="fixed left-3 top-14 bottom-3 w-44 rounded-xl border border-border bg-background shadow-sm flex flex-col z-40 overflow-hidden"
    >
      <div className="overflow-y-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {docs.map(doc => (
          <button
            key={doc.id}
            onClick={() => router.push(`/doc/${doc.id}`)}
            className={cn(
              "w-full text-left px-3 py-2.5 mx-2 rounded-lg transition-colors hover:bg-muted/50",
              doc.id === currentDocId && "bg-muted/40"
            )}
            style={{ width: "calc(100% - 1rem)" }}
          >
            <p className="text-sm font-medium text-foreground truncate">{doc.title || "Untitled"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{formatDate(doc.updated_at)}</p>
          </button>
        ))}

        <div className="px-2 pt-1">
          <button
            onClick={createDoc}
            className="w-full flex items-center justify-center h-10 rounded-lg border-2 border-dashed border-border hover:border-foreground/25 hover:bg-muted/20 transition-all text-muted-foreground hover:text-foreground/50 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.aside>
  )
}
