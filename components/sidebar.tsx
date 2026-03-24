"use client"

import { useRef } from "react"
import { Bold, Italic, Underline, Highlighter, ImageIcon, Link } from "lucide-react"

const formatTools = [
  { icon: Bold,        label: "Bold",      command: "bold",        arg: undefined },
  { icon: Italic,      label: "Italic",    command: "italic",      arg: undefined },
  { icon: Underline,   label: "Underline", command: "underline",   arg: undefined },
  { icon: Highlighter, label: "Highlight", command: "hiliteColor", arg: "yellow"  },
]

interface SidebarProps {
  onInsertImage: (src: string, savedRange: Range | null) => void
}

export function Sidebar({ onInsertImage }: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const savedRangeRef = useRef<Range | null>(null)

  function applyFormat(command: string, arg?: string) {
    if (command === "hiliteColor") {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return
      const node = sel.getRangeAt(0).commonAncestorContainer
      const el = node.nodeType === 3 ? node.parentElement : (node as HTMLElement)
      const bg = el ? window.getComputedStyle(el).backgroundColor : ""
      const isHighlighted = bg === "rgb(255, 255, 0)"
      document.execCommand("hiliteColor", false, isHighlighted ? "transparent" : "yellow")
    } else {
      document.execCommand(command, false, arg)
    }
  }

  function handleImageInsert(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      onInsertImage(ev.target?.result as string, savedRangeRef.current)
      savedRangeRef.current = null
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const btnClass = "flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"

  return (
    <aside className="fixed left-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 rounded-lg border border-border bg-background p-0.5 shadow-md animate-in zoom-in-75 fade-in duration-200 delay-150 origin-left fill-mode-both">
      {formatTools.map(({ icon: Icon, label, command, arg }) => (
        <button
          key={label}
          title={label}
          onMouseDown={(e) => {
            e.preventDefault()
            applyFormat(command, arg)
          }}
          className={btnClass}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}

      <div className="my-0.5 w-5 border-t border-border" />

      {/* Image */}
      <button
        title="Insert image"
        onMouseDown={() => {
          const sel = window.getSelection()
          if (sel && sel.rangeCount > 0) {
            savedRangeRef.current = sel.getRangeAt(0).cloneRange()
          }
        }}
        onClick={() => fileInputRef.current?.click()}
        className={btnClass}
      >
        <ImageIcon className="h-4 w-4" />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageInsert}
      />

      {/* Link (not yet functional) */}
      <button title="Insert link" className={btnClass}>
        <Link className="h-4 w-4" />
      </button>
    </aside>
  )
}
