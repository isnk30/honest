"use client"

import { forwardRef, memo, useImperativeHandle, useRef, useState, useEffect, useCallback } from "react"
import { EditorView } from "prosemirror-view"
import { EditorState } from "prosemirror-state"
import {
  schema,
  createEditorState,
  serializeToJSON,
  insertImage as pmInsertImage,
  isMarkActive,
  getLinkAtSelection,
} from "@/lib/prosemirror"
import { ExternalLink, Pencil, Unlink } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"

export interface DocumentEditorHandle {
  insertImage: (src: string) => void
  getContent: () => string
  setContent: (content: string) => void
  getView: () => EditorView | null
}

interface DocumentEditorProps {
  title: string
  onTitleChange: (title: string) => void
  onContentChange?: (json: string) => void
}

interface LinkTooltipState {
  href: string
  x: number
  y: number
  from: number
  to: number
  editMode: boolean
  editUrl: string
  editText: string
}

export const DocumentEditor = memo(forwardRef<DocumentEditorHandle, DocumentEditorProps>(
  ({ title, onTitleChange, onContentChange }, ref) => {
    const [hasContent, setHasContent] = useState(false)
    const editorContainerRef = useRef<HTMLDivElement>(null)
    const viewRef = useRef<EditorView | null>(null)
    const titleRef = useRef<HTMLDivElement>(null)
    const onContentChangeRef = useRef(onContentChange)
    onContentChangeRef.current = onContentChange

    const [linkTooltip, setLinkTooltip] = useState<LinkTooltipState | null>(null)
    const tooltipHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const tooltipViewRef = useRef<HTMLDivElement>(null)
    const tooltipEditRef = useRef<HTMLDivElement>(null)
    const tooltipUrlInputRef = useRef<HTMLInputElement>(null)
    const [tooltipHeight, setTooltipHeight] = useState(0)

    useEffect(() => {
      const el = linkTooltip?.editMode ? tooltipEditRef.current : tooltipViewRef.current
      if (el) setTooltipHeight(el.scrollHeight)
    }, [linkTooltip?.editMode, !!linkTooltip])

    useEffect(() => {
      if (linkTooltip?.editMode) tooltipUrlInputRef.current?.focus()
    }, [linkTooltip?.editMode])

    function scheduleHide() {
      tooltipHideTimer.current = setTimeout(() => setLinkTooltip(null), 200)
    }
    function cancelHide() {
      if (tooltipHideTimer.current) clearTimeout(tooltipHideTimer.current)
    }

    function applyTooltipEdit() {
      if (!linkTooltip || !viewRef.current) return
      const view = viewRef.current
      const { from, to, editUrl, editText } = linkTooltip
      const raw = editUrl.trim()
      if (!raw) return

      const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
      const mark = schema.marks.link.create({ href: url, target: "_blank", rel: "noopener noreferrer" })
      let tr = view.state.tr
      if (editText.trim()) {
        tr = tr.replaceWith(from, to, schema.text(editText.trim(), [mark]))
      } else {
        tr = tr.addMark(from, to, mark)
      }
      view.dispatch(tr)
      setLinkTooltip(null)
    }

    function removeTooltipLink() {
      if (!linkTooltip || !viewRef.current) return
      const view = viewRef.current
      const { from, to } = linkTooltip
      view.dispatch(view.state.tr.removeMark(from, to, schema.marks.link))
      setLinkTooltip(null)
    }

    const checkContent = useCallback(() => {
      const view = viewRef.current
      if (!view) return
      const doc = view.state.doc
      const empty = doc.childCount === 1 && doc.firstChild?.isTextblock && doc.firstChild.content.size === 0
      setHasContent(!empty)
    }, [])

    // Initialize ProseMirror
    useEffect(() => {
      if (!editorContainerRef.current) return

      const state = createEditorState(null, () => {
        checkContent()
        if (onContentChangeRef.current && viewRef.current) {
          onContentChangeRef.current(serializeToJSON(viewRef.current.state))
        }
      })

      const view = new EditorView(editorContainerRef.current, {
        state,
        attributes: { class: "outline-none" },
        handleClickOn(view, pos, node, nodePos, event, direct) {
          // Handle link clicks
          const resolved = view.state.doc.resolve(pos)
          const linkMark = resolved.marks().find((m) => m.type === schema.marks.link)
          if (linkMark && event.metaKey) {
            window.open(linkMark.attrs.href, "_blank", "noopener,noreferrer")
            return true
          }
          return false
        },
        handleDOMEvents: {
          mouseover(view, event) {
            const target = event.target as HTMLElement
            const anchor = target.closest("a") as HTMLAnchorElement | null
            if (!anchor) return false
            cancelHide()
            const rect = anchor.getBoundingClientRect()
            const pos = view.posAtDOM(anchor, 0)
            const $pos = view.state.doc.resolve(pos)
            const linkMark = $pos.marks().find((m) => m.type === schema.marks.link)
            if (!linkMark) return false

            // Find the full extent of this link mark
            let from = pos, to = pos
            const parent = $pos.parent
            const parentStart = $pos.start()
            parent.forEach((child, offset) => {
              const childFrom = parentStart + offset
              const childTo = childFrom + child.nodeSize
              if (child.marks.some((m) => m.type === schema.marks.link && m.attrs.href === linkMark.attrs.href)) {
                if (childFrom <= pos && childTo >= pos) {
                  from = childFrom
                  to = childTo
                }
              }
            })

            setLinkTooltip(prev => {
              if (prev?.from === from && prev.editMode) return prev
              return {
                href: linkMark.attrs.href,
                x: rect.left + rect.width / 2,
                y: rect.top,
                from,
                to,
                editMode: false,
                editUrl: linkMark.attrs.href,
                editText: anchor.textContent ?? "",
              }
            })
            return false
          },
          mouseout(view, event) {
            if ((event.target as HTMLElement).closest("a")) scheduleHide()
            return false
          },
        },
      })

      viewRef.current = view
      checkContent()

      return () => {
        view.destroy()
        viewRef.current = null
      }
    }, [])

    useImperativeHandle(ref, () => ({
      getContent() {
        if (!viewRef.current) return ""
        return serializeToJSON(viewRef.current.state)
      },
      setContent(content: string) {
        if (!viewRef.current) return
        const newState = createEditorState(content, () => {
          checkContent()
          if (onContentChangeRef.current && viewRef.current) {
            onContentChangeRef.current(serializeToJSON(viewRef.current.state))
          }
        })
        viewRef.current.updateState(newState)
        checkContent()
      },
      insertImage(src: string) {
        if (!viewRef.current) return
        pmInsertImage(viewRef.current, src)
        checkContent()
      },
      getView() {
        return viewRef.current
      },
    }))

    // Sync title from topbar rename
    useEffect(() => {
      const el = titleRef.current
      if (el && el.textContent !== title) el.textContent = title
    }, [title])

    return (
      <div className="w-full max-w-3xl py-10">
      <div className="bg-background border border-border shadow-sm px-16 py-14 min-h-[calc(100vh-120px)]">
        {/* Title */}
        <div className="relative mb-6">
          {!title && (
            <span
              className="pointer-events-none absolute left-0 top-0 text-4xl font-bold text-muted-foreground/40 select-none"
              aria-hidden
            >
              Untitled
            </span>
          )}
          <div
            ref={titleRef}
            contentEditable
            suppressContentEditableWarning
            data-no-format
            onInput={(e) => onTitleChange(e.currentTarget.textContent ?? "")}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                viewRef.current?.focus()
              }
              if ((e.metaKey || e.ctrlKey) && ["b", "i", "u"].includes(e.key.toLowerCase())) {
                e.preventDefault()
              }
            }}
            className="w-full overflow-hidden whitespace-nowrap text-4xl font-bold text-foreground outline-none focus:outline-none"
          />
        </div>

        {/* Body — ProseMirror mounts here */}
        <div className="relative">
          {!hasContent && (
            <span
              className="pointer-events-none absolute left-0 top-0 text-sm text-muted-foreground/40 select-none z-10"
              aria-hidden
            >
              Write here...
            </span>
          )}
          <div
            ref={editorContainerRef}
            className="prosemirror-editor w-full text-sm leading-relaxed text-foreground"
          />
        </div>

        {/* Link hover tooltip */}
        <AnimatePresence>
        {linkTooltip && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.85, filter: "blur(4px)" }}
            transition={{ type: "spring", duration: 0.15, bounce: 0 }}
            onMouseEnter={cancelHide}
            onMouseLeave={scheduleHide}
            style={{
              position: "fixed",
              left: linkTooltip.x,
              top: linkTooltip.y - 8,
              translateX: "-50%",
              translateY: "-100%",
              transformOrigin: "bottom center",
              zIndex: 50,
            }}
            className="overflow-hidden border border-white/10 bg-black shadow-md text-xs"
          >
            <motion.div
              initial={false}
              animate={{ height: tooltipHeight }}
              transition={{ type: "spring", stiffness: 600, damping: 40 }}
              className="relative min-w-40 max-w-64"
            >
              {/* View panel */}
              <motion.div
                ref={tooltipViewRef}
                animate={{ opacity: linkTooltip.editMode ? 0 : 1, scale: linkTooltip.editMode ? 0.95 : 1, filter: linkTooltip.editMode ? "blur(4px)" : "blur(0px)", pointerEvents: linkTooltip.editMode ? "none" : "auto" }}
                transition={{ duration: 0.15 }}
                className="absolute inset-x-0 bottom-0 flex items-center gap-1 px-2 py-1.5"
              >
                <span className="flex-1 truncate text-white/60">
                  {linkTooltip.editUrl.replace(/^https?:\/\//, "")}
                </span>
                <button
                  title="Open link"
                  onClick={() => window.open(linkTooltip.href, "_blank", "noopener,noreferrer")}
                  className="shrink-0 cursor-pointer p-0.5 text-white/60 hover:text-white transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                </button>
                <button
                  title="Edit"
                  onClick={() => setLinkTooltip(t => t ? { ...t, editMode: true } : t)}
                  className="shrink-0 cursor-pointer p-0.5 text-white/60 hover:text-white transition-colors"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  title="Remove link"
                  onClick={removeTooltipLink}
                  className="shrink-0 cursor-pointer p-0.5 text-white/60 hover:text-white transition-colors"
                >
                  <Unlink className="h-3 w-3" />
                </button>
              </motion.div>

              {/* Edit panel */}
              <motion.div
                ref={tooltipEditRef}
                initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                animate={{ opacity: linkTooltip.editMode ? 1 : 0, scale: linkTooltip.editMode ? 1 : 0.95, filter: linkTooltip.editMode ? "blur(0px)" : "blur(4px)", pointerEvents: linkTooltip.editMode ? "auto" : "none" }}
                transition={{ duration: 0.15 }}
                className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 px-2 py-1.5"
              >
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-white/40">URL</span>
                  <input
                    ref={tooltipUrlInputRef}
                    type="url"
                    value={linkTooltip.editUrl}
                    onChange={(e) => setLinkTooltip(t => t ? { ...t, editUrl: e.target.value } : t)}
                    onKeyDown={(e) => { if (e.key === "Enter") applyTooltipEdit(); if (e.key === "Escape") setLinkTooltip(null) }}
                    placeholder="https://"
                    className="w-full border border-white/20 bg-white/10 px-2 py-1 text-xs text-white placeholder:text-white/40 outline-none focus:border-white/50 transition-colors"
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-white/40">Text</span>
                  <input
                    type="text"
                    value={linkTooltip.editText}
                    onChange={(e) => setLinkTooltip(t => t ? { ...t, editText: e.target.value } : t)}
                    onKeyDown={(e) => { if (e.key === "Enter") applyTooltipEdit(); if (e.key === "Escape") setLinkTooltip(null) }}
                    placeholder="Link text"
                    className="w-full border border-white/20 bg-white/10 px-2 py-1 text-xs text-white placeholder:text-white/40 outline-none focus:border-white/50 transition-colors"
                  />
                </label>
                <div className="flex gap-1">
                  <button
                    onClick={applyTooltipEdit}
                    className="flex-1 cursor-pointer bg-white py-1 text-xs font-medium text-black hover:opacity-90 transition-opacity"
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => setLinkTooltip(t => t ? { ...t, editMode: false } : t)}
                    className="flex-1 cursor-pointer bg-white/10 py-1 text-xs text-white/60 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
      </div>
    )
  }
))

DocumentEditor.displayName = "DocumentEditor"
