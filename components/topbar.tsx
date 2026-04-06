"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ChevronRight, Pin, MoreHorizontal, Search, User, Trash2, MoveRight, FilePlusCorner, File, Sun, Moon } from "lucide-react"
import { useThemeToggle } from "@/hooks/use-theme-toggle"
import { Button } from "@/components/ui/button"
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

type RecentDoc = { id: string; title: string; updated_at: string }
type SearchResult = RecentDoc & { content: string }

function getSnippet(content: string, query: string): string | null {
  const plain = content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  const idx = plain.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return null
  const start = Math.max(0, idx - 15)
  const snippet = (start > 0 ? "…" : "") + plain.slice(start, idx + query.length + 15).trimEnd()
  return snippet.length < plain.length ? snippet + "…" : snippet
}

interface TopbarProps {
  docName: string
  onDocNameChange: (name: string) => void
  userAvatar?: string
  folderName?: string
  onFolderClick?: () => void
  onDelete?: () => void
  onHomeClick?: () => void
  onNewPage?: () => void
  onMoveToFolder?: () => void
  pinned?: boolean
  onPinToggle?: () => void
}

export function Topbar({ docName, onDocNameChange, userAvatar, folderName, onFolderClick, onDelete, onHomeClick, onNewPage, onMoveToFolder, pinned = false, onPinToggle }: TopbarProps) {
  const router = useRouter()
  const { resolvedTheme, toggle: toggleTheme } = useThemeToggle()
  const [bursting, setBursting] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(docName)
  const [renameHovered, setRenameHovered] = useState(false)
  const [recentDocs, setRecentDocs] = useState<RecentDoc[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isRenaming) {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    }
  }, [isRenaming])

  useEffect(() => {
    async function loadRecent() {
      const supabase = createClient()
      const { data } = await supabase
        .from("documents")
        .select("id, title, updated_at")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(3)
      setRecentDocs(data ?? [])
    }
    loadRecent()
  }, [])

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); setSearching(false); return }
    setSearching(true)
    const timer = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("documents")
        .select("id, title, updated_at, content")
        .textSearch("fts", searchQuery, { type: "websearch", config: "english" })
        .is("deleted_at", null)
        .limit(10)
      setSearchResults(data ?? [])
      setSearching(false)
    }, 200)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // ⌘K / Ctrl+K to open command palette
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setCommandOpen((prev) => !prev)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  function startRenaming() {
    setRenameValue(docName)
    setIsRenaming(true)
  }

  function commitRename() {
    const trimmed = renameValue.trim()
    if (trimmed) onDocNameChange(trimmed)
    setIsRenaming(false)
    setRenameHovered(false)
  }

  function handleRenameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commitRename()
    if (e.key === "Escape") setIsRenaming(false)
  }

  function closeCommand() {
    setCommandOpen(false)
    setSearchQuery("")
    setSearching(false)
  }

  return (
    <>
      <header className="relative flex h-12 w-full items-center gap-2 bg-background px-4">
        {/* App icon */}
        <div onClick={() => onHomeClick ? onHomeClick() : router.push("/")} className="flex h-7 w-7 shrink-0 items-center justify-center cursor-pointer">
          <img
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/hoenst%20logo-gpNSSpWBxxqq17ZGgKgLhGcM8BfrOo.png"
            alt="Honest logo"
            className="h-6 w-6 object-contain dark:invert transition-opacity duration-150 hover:opacity-50"
          />
        </div>

        {/* Breadcrumb: Folder > Doc */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-0 text-sm">
          {folderName && (
            <>
              <button
                onClick={() => onFolderClick ? onFolderClick() : router.push("/")}
                className="px-1 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
              >
                {folderName}
              </button>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" aria-hidden="true" />
            </>
          )}

          {isRenaming ? (
            <span className="relative inline-flex items-center">
              <span aria-hidden="true" className="invisible h-7 whitespace-pre px-2 text-sm font-medium">
                {renameValue || "    "}
              </span>
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={handleRenameKeyDown}
                className="absolute inset-0 h-full w-full bg-muted px-2 text-sm font-medium text-foreground outline-none"
                aria-label="Rename document"
              />
            </span>
          ) : (
            <button
              onClick={startRenaming}
              onMouseEnter={() => setRenameHovered(true)}
              onMouseLeave={() => setRenameHovered(false)}
              className={cn(
                "h-7 cursor-pointer px-2 text-sm font-medium text-foreground outline-none transition-colors duration-150",
                renameHovered ? "bg-muted/60" : "bg-transparent"
              )}
              aria-label="Click to rename document"
            >
              {docName || <span className="text-muted-foreground/50">Untitled</span>}
            </button>
          )}

          {/* Pin / favorite */}
          <div className="relative flex h-6 w-6 shrink-0 items-center justify-center">
            <style>{`
              @keyframes burst-out {
                0%   { transform: translate(-50%, -50%) rotate(var(--a)) translateY(0px)   scale(1); opacity: 1; }
                100% { transform: translate(-50%, -50%) rotate(var(--a)) translateY(-20px) scale(0); opacity: 0; }
              }
              @keyframes pin-pop {
                0%   { transform: scale(1); }
                40%  { transform: scale(1.15); }
                70%  { transform: scale(0.95); }
                100% { transform: scale(1); }
              }
            `}</style>
            {bursting && [0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
              <span
                key={angle}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: "#f43f5e",
                  ["--a" as string]: `${angle}deg`,
                  animation: "burst-out 0.3s ease-out forwards",
                  pointerEvents: "none",
                }}
              />
            ))}
            <button
              aria-label={pinned ? "Unpin" : "Pin"}
              onClick={() => {
                if (!pinned) {
                  setBursting(true)
                  setTimeout(() => setBursting(false), 300)
                }
                onPinToggle?.()
              }}
              className="flex h-6 w-6 items-center justify-center transition-colors hover:bg-muted active:scale-95"
            >
              <Pin
                style={bursting ? { animation: "pin-pop 0.25s ease-out forwards" } : undefined}
                className={cn(
                  "h-3.5 w-3.5 transition-colors",
                  pinned ? "fill-rose-500 text-rose-500" : "text-muted-foreground",
                )}
              />
            </button>
          </div>
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search trigger — absolutely centered */}
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

        {/* More options */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 text-muted-foreground active:scale-95"
              aria-label="More options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
            <DropdownMenuItem>Move to folder</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Profile picture */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Avatar className="h-7 w-7 cursor-pointer transition-opacity hover:opacity-50">
              <AvatarImage src={userAvatar ?? "/avatar.jpg"} alt="Profile picture" referrerPolicy="no-referrer" />
              <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
                <User className="h-3.5 w-3.5" />
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={toggleTheme}>
              {resolvedTheme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              Toggle appearance
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
                      onSelect={() => { closeCommand(); router.push(`/doc/${doc.id}`) }}
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
                {recentDocs.map((doc, i) => (
                  <CommandItem
                    key={doc.id}
                    value={doc.id}
                    onSelect={() => { closeCommand(); router.push(`/doc/${doc.id}`) }}
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
                  onSelect={() => { closeCommand(); onNewPage ? onNewPage() : router.push("/") }}
                  className="animate-in fade-in slide-in-from-top-1 fill-mode-both"
                  style={{ animationDelay: `${3 * 40}ms`, animationDuration: "200ms" }}
                >
                  <FilePlusCorner className="h-4 w-4 shrink-0" />
                  <span>New Page</span>
                  <CommandShortcut>⌘0</CommandShortcut>
                </CommandItem>
                {onMoveToFolder && (
                  <CommandItem
                    value="move-to-folder"
                    onSelect={() => { closeCommand(); onMoveToFolder() }}
                    className="animate-in fade-in slide-in-from-top-1 fill-mode-both"
                    style={{ animationDelay: `${4 * 40}ms`, animationDuration: "200ms" }}
                  >
                    <MoveRight className="h-4 w-4 shrink-0" />
                    <span>Move to Folder</span>
                  </CommandItem>
                )}
                <CommandItem
                  value="see-trash"
                  onSelect={() => { closeCommand(); router.push("/trash") }}
                  className="animate-in fade-in slide-in-from-top-1 fill-mode-both"
                  style={{ animationDelay: `${5 * 40}ms`, animationDuration: "200ms" }}
                >
                  <Trash2 className="h-4 w-4 shrink-0" />
                  <span>See Trash</span>
                </CommandItem>
                <CommandItem
                  value="delete-page"
                  onSelect={() => { closeCommand(); onDelete?.() }}
                  className="animate-in fade-in slide-in-from-top-1 fill-mode-both text-destructive data-[selected=true]:text-destructive"
                  style={{ animationDelay: `${6 * 40}ms`, animationDuration: "200ms" }}
                >
                  <Trash2 className="h-4 w-4 shrink-0" />
                  <span>Delete Page</span>
                </CommandItem>
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}
