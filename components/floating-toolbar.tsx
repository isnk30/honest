"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Bold, Italic, Underline, Highlighter, Link, X } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { cn } from "@/lib/utils"
import type { EditorView } from "prosemirror-view"
import {
  schema,
  isMarkActive,
  toggleMarkCommand,
  toggleHighlight,
  applyLink,
  getLinkAtSelection,
} from "@/lib/prosemirror"

interface ToolbarState {
  x: number
  y: number
}

interface FloatingToolbarProps {
  editorView: EditorView | null
}

export function FloatingToolbar({ editorView }: FloatingToolbarProps) {
  const [toolbar, setToolbar] = useState<ToolbarState | null>(null)
  const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({})
  const [linkMode, setLinkMode] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")
  const linkInputRef = useRef<HTMLInputElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const mouseDownInToolbar = useRef(false)

  const updateToolbar = useCallback(() => {
    if (!editorView) return

    const { state } = editorView
    const { from, to, empty } = state.selection

    if (empty) {
      setToolbar(null)
      setLinkMode(false)
      return
    }

    // Don't show over title (contenteditable with data-no-format)
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      let node: Node | null = sel.anchorNode
      while (node && node !== document.body) {
        if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).dataset.noFormat !== undefined) {
          setToolbar(null)
          return
        }
        node = node.parentNode
      }
    }

    // Get bounding rect of the selection
    if (!sel || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    if (!rect.width && !rect.height) return

    setToolbar({
      x: rect.left + rect.width / 2,
      y: rect.top,
    })

    setActiveFormats({
      bold: isMarkActive(state, schema.marks.bold),
      italic: isMarkActive(state, schema.marks.italic),
      underline: isMarkActive(state, schema.marks.underline),
      highlight: isMarkActive(state, schema.marks.highlight),
      link: isMarkActive(state, schema.marks.link),
    })
  }, [editorView])

  useEffect(() => {
    document.addEventListener("selectionchange", updateToolbar)
    return () => document.removeEventListener("selectionchange", updateToolbar)
  }, [updateToolbar])

  // Hide on scroll
  useEffect(() => {
    const onScroll = () => { if (toolbar) setToolbar(null) }
    window.addEventListener("scroll", onScroll, true)
    return () => window.removeEventListener("scroll", onScroll, true)
  }, [toolbar])

  useEffect(() => {
    if (linkMode) setTimeout(() => linkInputRef.current?.focus(), 50)
  }, [linkMode])

  function handleFormat(format: string) {
    if (!editorView) return
    switch (format) {
      case "bold":      toggleMarkCommand(editorView, schema.marks.bold); break
      case "italic":    toggleMarkCommand(editorView, schema.marks.italic); break
      case "underline": toggleMarkCommand(editorView, schema.marks.underline); break
      case "highlight": toggleHighlight(editorView); break
      case "link": {
        const existing = getLinkAtSelection(editorView.state)
        setLinkUrl(existing?.href ?? "")
        setLinkMode(true)
        return
      }
    }
    updateToolbar()
  }

  function handleApplyLink() {
    if (!editorView || !linkUrl.trim()) return
    applyLink(editorView, linkUrl.trim())
    setLinkMode(false)
    setLinkUrl("")
    setToolbar(null)
  }

  const buttons = [
    { icon: Bold,        format: "bold",      label: "Bold" },
    { icon: Italic,      format: "italic",    label: "Italic" },
    { icon: Underline,   format: "underline", label: "Underline" },
    { icon: Highlighter, format: "highlight", label: "Highlight" },
    { icon: Link,        format: "link",      label: "Link" },
  ]

  const btnClass = "flex h-7 w-7 items-center justify-center text-white/60 transition-colors hover:text-white active:scale-95"

  return (
    <AnimatePresence>
      {toolbar && (
        <motion.div
          ref={toolbarRef}
          initial={{ opacity: 0, scale: 0.9, filter: "blur(4px)", y: 4 }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)", y: 0 }}
          exit={{ opacity: 0, scale: 0.9, filter: "blur(4px)", y: 4 }}
          transition={{ type: "spring", duration: 0.15, bounce: 0 }}
          onMouseDown={() => { mouseDownInToolbar.current = true }}
          onMouseUp={() => { mouseDownInToolbar.current = false }}
          style={{
            position: "fixed",
            left: toolbar.x,
            top: toolbar.y - 8,
            translateX: "-50%",
            translateY: "-100%",
            transformOrigin: "bottom center",
            zIndex: 60,
          }}
          className="overflow-hidden border border-white/10 bg-black shadow-lg"
        >
          <AnimatePresence mode="wait" initial={false}>
            {!linkMode ? (
              <motion.div
                key="buttons"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.1 }}
                className="flex items-center px-1"
              >
                {buttons.map(({ icon: Icon, format, label }, i) => (
                  <button
                    key={format}
                    title={label}
                    onMouseDown={(e) => { e.preventDefault(); handleFormat(format) }}
                    className={cn(
                      btnClass,
                      activeFormats[format] && "text-white",
                      i < buttons.length - 1 && "border-r border-white/10",
                    )}
                  >
                    <Icon className={cn("h-3.5 w-3.5", activeFormats[format] && "stroke-[2.5]")} />
                  </button>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="link"
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
                transition={{ duration: 0.1 }}
                className="flex items-center gap-1 px-2 py-1.5"
              >
                <input
                  ref={linkInputRef}
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); handleApplyLink() }
                    if (e.key === "Escape") { setLinkMode(false) }
                  }}
                  placeholder="https://"
                  className="w-44 bg-transparent text-xs text-white placeholder:text-white/30 outline-none"
                />
                <button
                  onMouseDown={(e) => { e.preventDefault(); handleApplyLink() }}
                  className="text-xs text-white/60 hover:text-white transition-colors px-1"
                >
                  Apply
                </button>
                <button
                  onMouseDown={(e) => { e.preventDefault(); setLinkMode(false) }}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
