"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ChevronRight, Star, MoreHorizontal, Search, UserRoundPlus, User, FileText, FolderOpen, Settings, Trash2, Copy, MoveRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
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

interface TopbarProps {
  docName: string
  onDocNameChange: (name: string) => void
  userAvatar?: string
  folderName?: string
  onFolderClick?: () => void
  onDelete?: () => void
}

export function Topbar({ docName, onDocNameChange, userAvatar, folderName, onFolderClick, onDelete }: TopbarProps) {
  const router = useRouter()
  const [starred, setStarred] = useState(false)
  const [bursting, setBursting] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(docName)
  const [renameHovered, setRenameHovered] = useState(false)
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isRenaming) {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    }
  }, [isRenaming])

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

  return (
    <>
      <header className="relative flex h-12 w-full items-center gap-2 bg-background px-3">
        {/* App icon */}
        <div onClick={() => router.push("/")} className="flex h-7 w-7 shrink-0 items-center justify-center cursor-pointer">
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
                className="rounded px-1 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
              >
                {folderName}
              </button>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" aria-hidden="true" />
            </>
          )}

          {isRenaming ? (
            <span className="relative inline-flex items-center">
              <span aria-hidden="true" className="invisible h-7 whitespace-pre rounded-md px-2 text-sm font-medium">
                {renameValue || "    "}
              </span>
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={handleRenameKeyDown}
                className="absolute inset-0 h-full w-full rounded-md bg-muted px-2 text-sm font-medium text-foreground outline-none"
                aria-label="Rename document"
              />
            </span>
          ) : (
            <button
              onClick={startRenaming}
              onMouseEnter={() => setRenameHovered(true)}
              onMouseLeave={() => setRenameHovered(false)}
              className={cn(
                "h-7 cursor-pointer rounded-md px-2 text-sm font-medium text-foreground outline-none transition-colors duration-150",
                renameHovered ? "bg-muted/60" : "bg-transparent"
              )}
              aria-label="Click to rename document"
            >
              {docName || <span className="text-muted-foreground/50">Untitled</span>}
            </button>
          )}

          {/* Star / favorite */}
          <div className="relative flex h-6 w-6 shrink-0 items-center justify-center">
            <style>{`
              @keyframes burst-out {
                0%   { transform: translate(-50%, -50%) rotate(var(--a)) translateY(0px)   scale(1); opacity: 1; }
                100% { transform: translate(-50%, -50%) rotate(var(--a)) translateY(-20px) scale(0); opacity: 0; }
              }
              @keyframes star-pop {
                0%   { transform: scale(1) rotate(0deg); }
                40%  { transform: scale(1.25) rotate(200deg); }
                70%  { transform: scale(0.95) rotate(340deg); }
                100% { transform: scale(1) rotate(360deg); }
              }
            `}</style>
            {bursting && [0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
              <span
                key={angle}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "#fbbf24",
                  ["--a" as string]: `${angle}deg`,
                  animation: "burst-out 0.45s ease-out forwards",
                  pointerEvents: "none",
                }}
              />
            ))}
            <button
              aria-label={starred ? "Remove from favorites" : "Add to favorites"}
              onClick={() => {
                const next = !starred
                setStarred(next)
                if (next) {
                  setBursting(true)
                  setTimeout(() => setBursting(false), 450)
                }
              }}
              className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-muted active:scale-95"
            >
              <Star
                style={bursting ? { animation: "star-pop 0.35s ease-out forwards" } : undefined}
                className={cn(
                  "h-3.5 w-3.5 transition-colors",
                  starred ? "fill-amber-400 text-amber-400" : "text-muted-foreground",
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

        {/* Share */}
        {/* <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 rounded-md px-2.5 text-sm text-muted-foreground hover:text-foreground active:scale-95"
          aria-label="Share document"
        >
          <UserRoundPlus className="h-3.5 w-3.5" />
          <span>Share</span>
        </Button> */}

        {/* Profile picture */}
        <Avatar className="h-7 w-7 cursor-pointer transition-opacity hover:opacity-50">
          <AvatarImage src={userAvatar ?? "/avatar.jpg"} alt="Profile picture" />
          <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
            <User className="h-3.5 w-3.5" />
          </AvatarFallback>
        </Avatar>
      </header>

      {/* Command palette */}
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen} title="Search" description="Search documents and actions">
        <CommandInput placeholder="Search or type a command…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Documents">
            <CommandItem>
              <FileText />
              <span>Doc Name</span>
            </CommandItem>
            <CommandItem>
              <FileText />
              <span>Untitled</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Actions">
            <CommandItem onSelect={startRenaming}>
              <FileText />
              <span>Rename document</span>
              <CommandShortcut>⌘R</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <Copy />
              <span>Duplicate</span>
            </CommandItem>
            <CommandItem>
              <MoveRight />
              <span>Move to folder</span>
            </CommandItem>
            <CommandItem>
              <FolderOpen />
              <span>Open folder</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Settings">
            <CommandItem>
              <Settings />
              <span>Preferences</span>
              <CommandShortcut>⌘,</CommandShortcut>
            </CommandItem>
            <CommandItem className="text-destructive data-[selected=true]:text-destructive">
              <Trash2 />
              <span>Delete document</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
