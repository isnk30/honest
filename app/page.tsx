"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { format, isToday, isYesterday } from "date-fns"
import { Folder, Plus, User, Search } from "lucide-react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { FileText } from "lucide-react"

type Doc = {
  id: string
  title: string
  updated_at: string
  folder_id: string | null
}

type FolderItem = {
  id: string
  name: string
  created_at: string
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  if (isToday(date)) return "Today"
  if (isYesterday(date)) return "Yesterday"
  return format(date, "MMM d")
}

function DocCard({ doc, onClick }: { doc: Doc; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-xl border border-border bg-background overflow-hidden hover:border-foreground/20 hover:shadow-sm transition-all group"
    >
      <div className="bg-muted/40 p-5 h-[128px] flex flex-col gap-2.5">
        <div className="h-1.5 rounded-full bg-foreground/10 w-2/3" />
        <div className="h-1.5 rounded-full bg-foreground/8 w-full" />
        <div className="h-1.5 rounded-full bg-foreground/8 w-5/6" />
        <div className="h-1.5 rounded-full bg-foreground/6 w-3/4" />
        <div className="h-1.5 rounded-full bg-foreground/5 w-1/2" />
      </div>
      <div className="px-4 py-3 border-t border-border">
        <p className="text-sm font-medium text-foreground truncate">{doc.title || "Untitled"}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{formatDate(doc.updated_at)}</p>
      </div>
    </div>
  )
}

function NewDocCard({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border-2 border-dashed border-border hover:border-foreground/25 hover:bg-muted/20 transition-all flex flex-col items-center justify-center gap-2 h-[195px] w-full text-muted-foreground hover:text-foreground/50 cursor-pointer"
    >
      <Plus className="h-4 w-4" />
      <span className="text-sm">{label}</span>
    </button>
  )
}

export default function Home() {
  const router = useRouter()
  const [docs, setDocs] = useState<Doc[]>([])
  const [folders, setFolders] = useState<FolderItem[]>([])
  const [userAvatar, setUserAvatar] = useState<string | undefined>()
  const [userName, setUserName] = useState("")
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [commandOpen, setCommandOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setCommandOpen(prev => !prev)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setUserAvatar(user.user_metadata?.avatar_url)
    const firstName = ((user.user_metadata?.full_name as string) ?? "").split(" ")[0]
    setUserName(firstName)

    const [{ data: docsData }, { data: foldersData }] = await Promise.all([
      supabase.from("documents").select("id, title, updated_at, folder_id").order("updated_at", { ascending: false }),
      supabase.from("folders").select("*").order("created_at", { ascending: true }),
    ])
    setDocs(docsData ?? [])
    setFolders(foldersData ?? [])
    setLoading(false)
  }

  async function createDoc(folderId: string | null = null) {
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

  async function createFolder() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from("folders")
      .insert({ user_id: user.id, name: "Untitled Folder" })
      .select()
      .single()
    if (data) {
      setFolders(prev => [...prev, data])
      setRenamingFolderId(data.id)
      setRenameValue("Untitled Folder")
    }
  }

  async function commitFolderRename(id: string) {
    const name = renameValue.trim() || "Untitled Folder"
    const supabase = createClient()
    await supabase.from("folders").update({ name }).eq("id", id)
    setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f))
    setRenamingFolderId(null)
  }

  const now = new Date()
  const hour = now.getHours()
  const timeOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"
  const dateStr = format(now, "EEEE, MMMM d · h:mm") + (hour < 12 ? "AM" : "PM")
  const unfiledDocs = useMemo(() => docs.filter(d => !d.folder_id), [docs])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background font-sans">
      {/* Header */}
      <header className="relative flex h-12 w-full shrink-0 items-center px-4 bg-background">
        <img
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/hoenst%20logo-gpNSSpWBxxqq17ZGgKgLhGcM8BfrOo.png"
          alt="Honest"
          className="h-6 w-6 object-contain dark:invert"
        />
        <div className="flex-1" />

        {/* Centered search trigger */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <button
            onClick={() => setCommandOpen(true)}
            className="group pointer-events-auto flex h-7 w-fit cursor-pointer items-center gap-2 rounded-md px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/60"
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span>Search</span>
            <span className="w-2 transition-all duration-200 group-hover:w-8" />
            <kbd className="hidden items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] sm:flex">
              <span className="text-[13px]">⌘</span><span>K</span>
            </kbd>
          </button>
        </div>

        <Avatar className="h-7 w-7 cursor-pointer transition-opacity hover:opacity-70">
          <AvatarImage src={userAvatar} alt="Profile" />
          <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
            <User className="h-3.5 w-3.5" />
          </AvatarFallback>
        </Avatar>
      </header>

      {/* Command palette */}
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen} title="Search" description="Search documents">
        <CommandInput placeholder="Search documents…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Documents">
            {docs.map(doc => (
              <CommandItem
                key={doc.id}
                onSelect={() => { router.push(`/doc/${doc.id}`); setCommandOpen(false) }}
              >
                <FileText />
                <span>{doc.title || "Untitled"}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-8 py-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="max-w-5xl mx-auto">

          {/* Greeting */}
          <div className="mb-10">
            <p className="text-sm text-muted-foreground mb-1">{dateStr}</p>
            <h1 className="text-2xl font-semibold text-foreground">
              Good {timeOfDay}{userName ? `, ${userName}` : ""}.
            </h1>
          </div>

          {/* Actions row */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <button
                onClick={() => createDoc()}
                className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:opacity-80 transition-opacity cursor-pointer"
              >
                New Page <span>+</span>
              </button>
              <button
                onClick={createFolder}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                New Folder <span className="text-muted-foreground">+</span>
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              {docs.length} {docs.length === 1 ? "page" : "pages"}
            </p>
          </div>

          {/* Unfiled docs */}
          {loading ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(185px,1fr))] gap-4 mb-10">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border overflow-hidden animate-pulse">
                  <div className="bg-muted/40 h-[128px]" />
                  <div className="px-4 py-3 border-t border-border">
                    <div className="h-3 rounded-full bg-muted w-2/3 mb-2" />
                    <div className="h-2.5 rounded-full bg-muted/60 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(185px,1fr))] gap-4 mb-10">
              {unfiledDocs.map(doc => (
                <DocCard key={doc.id} doc={doc} onClick={() => router.push(`/doc/${doc.id}`)} />
              ))}
              <NewDocCard label="New Unfiled Doc" onClick={() => createDoc()} />
            </div>
          )}

          {/* Folder sections */}
          {!loading && folders.map(folder => {
            const folderDocs = docs.filter(d => d.folder_id === folder.id)
            return (
              <div key={folder.id} className="mb-10">
                <div className="flex items-center gap-1.5 mb-4">
                  <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                  {renamingFolderId === folder.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onBlur={() => commitFolderRename(folder.id)}
                      onKeyDown={e => {
                        if (e.key === "Enter") commitFolderRename(folder.id)
                        if (e.key === "Escape") setRenamingFolderId(null)
                      }}
                      className="text-sm font-medium bg-transparent outline-none border-b border-foreground/30 focus:border-foreground transition-colors"
                    />
                  ) : (
                    <button
                      onClick={() => { setRenamingFolderId(folder.id); setRenameValue(folder.name) }}
                      className="text-sm font-medium hover:opacity-60 transition-opacity cursor-pointer"
                    >
                      {folder.name}
                    </button>
                  )}
                  <span className="text-sm text-muted-foreground">
                    · {folderDocs.length} {folderDocs.length === 1 ? "page" : "pages"}
                  </span>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(185px,1fr))] gap-4">
                  {folderDocs.map(doc => (
                    <DocCard key={doc.id} doc={doc} onClick={() => router.push(`/doc/${doc.id}`)} />
                  ))}
                  <NewDocCard label={`New in ${folder.name}`} onClick={() => createDoc(folder.id)} />
                </div>
              </div>
            )
          })}

        </div>
      </main>
    </div>
  )
}
