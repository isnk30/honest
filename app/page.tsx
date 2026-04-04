"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { format, isToday, isYesterday } from "date-fns"
import { Folder, Plus, User, Search, MoreHorizontal, Trash2, Pin } from "lucide-react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FileText, File, FilePlusCorner } from "lucide-react"
import { toast } from "sonner"
import { ActionButton } from "@/components/action-button"
import { docCache } from "@/lib/doc-cache"
import { homeCache } from "@/lib/home-cache"
import { userCache } from "@/lib/user-cache"
import { cn } from "@/lib/utils"

type Doc = {
  id: string
  title: string
  updated_at: string
  folder_id: string | null
  pinned?: boolean
}

type SearchResult = Doc & { content: string }

function getSnippet(content: string, query: string): string | null {
  const plain = content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  const idx = plain.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return null
  const start = Math.max(0, idx - 15)
  const snippet = (start > 0 ? "…" : "") + plain.slice(start, idx + query.length + 15).trimEnd()
  return snippet.length < plain.length ? snippet + "…" : snippet
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

function DocCard({ doc, onClick, onDelete }: { doc: Doc; onClick: () => void; onDelete: () => void }) {
  return (
    <div
      onClick={onClick}
      className="cursor-pointer border border-border bg-[#FCFCFC] dark:bg-card overflow-hidden hover:border-foreground/20 hover:shadow-sm transition-all group relative flex flex-col justify-between py-4 px-[18px] h-[184px]"
    >
      <div className="flex flex-col gap-[5px]">
        <div className="flex items-center gap-1.5">
          <p className="text-[13px] font-medium text-foreground truncate leading-[18px]">{doc.title || "Untitled"}</p>
          {doc.pinned && <Pin className="h-3 w-3 shrink-0 fill-rose-500 text-rose-500" />}
        </div>
        <div className="h-[5px] rounded-sm bg-[#E4E4E4] dark:bg-foreground/10 w-3/5" />
        <div className="h-[5px] rounded-sm bg-[#EEEEEE] dark:bg-foreground/8 w-full" />
        <div className="h-[5px] rounded-sm bg-[#EEEEEE] dark:bg-foreground/8 w-[70%]" />
        <div className="h-[5px] rounded-sm bg-[#EEEEEE] dark:bg-foreground/8 w-[92%]" />
        <div className="h-[5px] rounded-sm bg-[#F2F2F2] dark:bg-foreground/6 w-[55%]" />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-foreground/40 leading-[14px]">{formatDate(doc.updated_at)}</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={e => e.stopPropagation()}
              className="flex h-6 w-6 shrink-0 items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted transition-all cursor-pointer rounded"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem
              onClick={e => { e.stopPropagation(); onDelete() }}
              className="text-destructive focus:text-destructive"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

function NewDocCard({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="border border-dashed border-[#D9D9D9] dark:border-border hover:border-foreground/25 hover:bg-muted/20 transition-all flex flex-col justify-between h-[184px] w-full py-4 px-[18px] opacity-60 hover:opacity-80 text-foreground cursor-pointer"
    >
      <span className="text-[13px] font-medium text-left leading-[18px]">{label}</span>
      <div className="flex justify-end">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
          <line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </button>
  )
}

export default function Home() {
  const router = useRouter()
  const [docs, setDocs] = useState<Doc[]>(() => homeCache.get()?.docs ?? [])
  const [folders, setFolders] = useState<FolderItem[]>(() => homeCache.get()?.folders ?? [])
  const [userAvatar, setUserAvatar] = useState<string | undefined>(() => userCache.get()?.avatarUrl)
  const [userName, setUserName] = useState(() => userCache.get()?.name ?? "")
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [commandOpen, setCommandOpen] = useState(false)
  const [fadingOut, setFadingOut] = useState(false)
  const [revealed, setReveal] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(() => homeCache.get() === null)

  useEffect(() => { load() }, [])
  // If cache exists, reveal immediately; otherwise reveal fires in load() after fetch
  useEffect(() => { if (!loading) requestAnimationFrame(() => setReveal(true)) }, [])

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); setSearching(false); return }
    setSearching(true)
    const timer = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("documents")
        .select("id, title, updated_at, folder_id, content")
        .textSearch("fts", searchQuery, { type: "websearch", config: "english" })
        .is("deleted_at", null)
        .limit(10)
      setSearchResults(data ?? [])
      setSearching(false)
    }, 200)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setCommandOpen(prev => !prev)
      }
      if (e.key === "0" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        createDoc()
      }
    }
    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [])

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const avatarUrl = user.user_metadata?.avatar_url
    const name = ((user.user_metadata?.full_name as string) ?? "").split(" ")[0]
    userCache.set({ avatarUrl, name })
    setUserAvatar(avatarUrl)
    setUserName(name)

    const [{ data: docsData }, { data: foldersData }] = await Promise.all([
      supabase.from("documents").select("id, title, updated_at, folder_id, pinned").is("deleted_at", null).order("updated_at", { ascending: false }),
      supabase.from("folders").select("*").order("created_at", { ascending: true }),
    ])
    const docs = docsData ?? []
    const folders = foldersData ?? []
    homeCache.set({ docs, folders })
    setDocs(docs)
    setFolders(folders)
    setLoading(false)
    setReveal(true)
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
    if (data) {
      setFadingOut(true)
      await new Promise(r => setTimeout(r, 200))
      router.push(`/doc/${data.id}`)
    }
  }

  async function deleteDoc(id: string) {
    const supabase = createClient()
    await supabase.from("documents").update({ deleted_at: new Date().toISOString() }).eq("id", id)
    setDocs(prev => prev.filter(d => d.id !== id))
    toast.success("Moved to trash")
  }

  async function openDoc(id: string) {
    let toastId: string | number | undefined
    const toastTimer = setTimeout(() => { toastId = toast.loading("Opening…") }, 1000)
    const supabase = createClient()
    const { data } = await supabase
      .from("documents")
      .select("title, content, folder_id, folders(name)")
      .eq("id", id)
      .single()
    clearTimeout(toastTimer)
    if (toastId !== undefined) toast.dismiss(toastId)
    if (data) {
      const folder = data.folders as { name: string } | null
      docCache.set(id, { title: data.title, content: data.content, folder_id: data.folder_id, folder_name: folder?.name })
    }
    setFadingOut(true)
    await new Promise(r => setTimeout(r, 200))
    router.push(`/doc/${id}`)
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

  async function deleteFolder(id: string) {
    const supabase = createClient()
    await supabase.from("documents").update({ folder_id: null }).eq("folder_id", id)
    await supabase.from("folders").delete().eq("id", id)
    setDocs(prev => prev.map(d => d.folder_id === id ? { ...d, folder_id: null } : d))
    setFolders(prev => prev.filter(f => f.id !== id))
    toast.success("Folder deleted")
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
  const dateStr = format(now, "EEEE, MMMM d ・h:mm") + (hour < 12 ? "AM" : "PM")
  const unfiledDocs = useMemo(() => {
    const unfiled = docs.filter(d => !d.folder_id)
    return [...unfiled.filter(d => d.pinned), ...unfiled.filter(d => !d.pinned)]
  }, [docs])

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
            className="group pointer-events-auto flex h-7 w-fit cursor-pointer items-center gap-2 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/60"
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span>Search</span>
            <span className="w-2 transition-all duration-200 group-hover:w-8" />
            <kbd className="hidden items-center gap-0.5 font-mono text-[10px] sm:flex">
              <span className="text-[13px]">⌘</span><span>K</span>
            </kbd>
          </button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Avatar className="h-7 w-7 cursor-pointer transition-opacity hover:opacity-70">
              <AvatarImage src={userAvatar} alt="Profile" referrerPolicy="no-referrer" />
              <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
                <User className="h-3.5 w-3.5" />
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onClick={() => router.push("/trash")}>
              Trash
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Command palette */}
      <CommandDialog
        open={commandOpen}
        onOpenChange={(open) => { setCommandOpen(open); if (!open) { setSearchQuery(""); setSearching(false) } }}
        title="Search"
        description="Search documents"
        shouldFilter={false}
      >
        <CommandInput placeholder="Search documents…" onValueChange={setSearchQuery} />
        <CommandList>
          {searchQuery ? (
            searching ? (
              <CommandEmpty>Searching…</CommandEmpty>
            ) : searchResults.length === 0 ? (
              <CommandEmpty>No results found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {searchResults.map(doc => {
                  const titleMatches = doc.title?.toLowerCase().includes(searchQuery.toLowerCase())
                  const snippet = !titleMatches ? getSnippet(doc.content ?? "", searchQuery) : null
                  return (
                    <CommandItem
                      key={doc.id}
                      value={doc.id}
                      onSelect={() => { setCommandOpen(false); openDoc(doc.id) }}
                      className="flex items-start gap-2"
                    >
                      <File className="h-4 w-4 shrink-0 mt-0.5" />
                      <div className="flex flex-col gap-0.5">
                      <span>{doc.title || "Untitled"}</span>
                      {snippet && (
                        <span className="text-xs text-muted-foreground line-clamp-1">{snippet}</span>
                      )}
                      </div>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )
          ) : (
            <>
              <CommandGroup heading="Recent">
                {docs.slice(0, 3).map((doc, i) => (
                  <CommandItem
                    key={doc.id}
                    value={doc.id}
                    onSelect={() => { setCommandOpen(false); openDoc(doc.id) }}
                    className="animate-in fade-in slide-in-from-top-1 fill-mode-both"
                    style={{ animationDelay: `${i * 40}ms`, animationDuration: "200ms" }}
                  >
                    <File className="h-4 w-4 shrink-0" />
                    <span>{doc.title || "Untitled"}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading="Commands">
                <CommandItem
                  value="new-page"
                  onSelect={() => { createDoc(); setCommandOpen(false) }}
                  className="animate-in fade-in slide-in-from-top-1 fill-mode-both"
                  style={{ animationDelay: `${3 * 40}ms`, animationDuration: "200ms" }}
                >
                  <FilePlusCorner className="h-4 w-4 shrink-0" />
                  <span>New Page</span>
                  <CommandShortcut>⌘0</CommandShortcut>
                </CommandItem>
                <CommandItem
                  value="see-trash"
                  onSelect={() => { router.push("/trash"); setCommandOpen(false) }}
                  className="animate-in fade-in slide-in-from-top-1 fill-mode-both"
                  style={{ animationDelay: `${4 * 40}ms`, animationDuration: "200ms" }}
                >
                  <Trash2 className="h-4 w-4 shrink-0" />
                  <span>See Trash</span>
                </CommandItem>
              </CommandGroup>
            </>

          )}
        </CommandList>
      </CommandDialog>

      {/* Content */}
      <main className={cn("flex-1 overflow-y-auto px-8 py-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", fadingOut && "opacity-0 transition-opacity duration-200")}>
        <div className="max-w-[1240px] mx-auto">

          {/* Greeting */}
          <div className="mb-8" style={revealed ? { animation: "page-enter 0.7s cubic-bezier(0.25, 1, 0.5, 1) 0ms both" } : { opacity: 0 }}>
            <p className="text-sm text-[#AAAAAA] dark:text-muted-foreground mb-0.5">{dateStr}</p>
            <h1 className="text-[26px] font-semibold tracking-[0.01em] text-foreground leading-8">
              Good {timeOfDay}{userName ? `, ${userName}` : ""}.
            </h1>
          </div>

          {/* Actions row */}
          <div className="flex items-center justify-between mb-6" style={revealed ? { animation: "page-enter 0.7s cubic-bezier(0.25, 1, 0.5, 1) 140ms both" } : { opacity: 0 }}>
            <div className="flex items-center gap-2">
              <ActionButton onClick={() => createDoc()}>
                New Page <Plus className="h-3 w-3 opacity-90" />
              </ActionButton>
              <ActionButton variant="secondary" onClick={createFolder}>
                New Folder <Plus className="h-3 w-3" />
              </ActionButton>
            </div>
            <p className="text-xs text-foreground opacity-30">
              {docs.length} {docs.length === 1 ? "page" : "pages"}
            </p>
          </div>

          {/* Unfiled docs */}
          <div style={revealed ? { animation: "page-enter 0.7s cubic-bezier(0.25, 1, 0.5, 1) 280ms both" } : { opacity: 0 }}>
            {loading ? null : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(185px,1fr))] gap-4 mb-10">
                {unfiledDocs.map(doc => (
                  <DocCard key={doc.id} doc={doc} onClick={() => openDoc(doc.id)} onDelete={() => deleteDoc(doc.id)} />
                ))}
                <NewDocCard label="New page" onClick={() => createDoc()} />
              </div>
            )}
          </div>

          {/* Folder sections */}
          {!loading && folders.map((folder, fi) => {
            const folderDocs = docs.filter(d => d.folder_id === folder.id)
            return (
              <div key={folder.id} className="mb-10" style={revealed ? { animation: `page-enter 0.7s cubic-bezier(0.25, 1, 0.5, 1) ${420 + fi * 140}ms both` } : { opacity: 0 }}>
                <div className="flex items-center gap-2 mb-3.5">
                  <Folder className="h-3.5 w-3.5 text-[#888888] dark:text-muted-foreground shrink-0" />
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
                      className="text-[13px] font-medium bg-transparent outline-none border-b border-foreground/30 focus:border-foreground transition-colors text-[#555555] dark:text-foreground"
                    />
                  ) : (
                    <button
                      onClick={() => { setRenamingFolderId(folder.id); setRenameValue(folder.name) }}
                      className="text-[13px] font-medium text-[#555555] dark:text-foreground hover:opacity-60 transition-opacity cursor-pointer"
                    >
                      {folder.name}
                    </button>
                  )}
                  <span className="text-xs text-foreground opacity-30">
                    · {folderDocs.length} {folderDocs.length === 1 ? "page" : "pages"}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex h-4 w-4 items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer ml-0.5">
                        <MoreHorizontal className="h-3 w-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-36">
                      <DropdownMenuItem
                        onClick={() => deleteFolder(folder.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(185px,1fr))] gap-4">
                  {folderDocs.map(doc => (
                    <DocCard key={doc.id} doc={doc} onClick={() => openDoc(doc.id)} onDelete={() => deleteDoc(doc.id)} />
                  ))}
                  <NewDocCard label={`New page in ${folder.name}`} onClick={() => createDoc(folder.id)} />
                </div>
              </div>
            )
          })}

        </div>
      </main>
    </div>
  )
}
