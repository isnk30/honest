"use client"

import { forwardRef, memo, useImperativeHandle, useRef, useState, useEffect, useLayoutEffect } from "react"
import { ExternalLink, Pencil, Unlink } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"

const IMAGE_STYLES = `
  .img-wrapper {
    display: inline-block;
    position: relative;
    line-height: 0;
    cursor: default;
    margin: 2px 8px 2px 0;
  }
  .img-wrapper img {
    display: block;
    max-width: 100%;
    height: auto;
    border-radius: 6px;
    outline: 2px solid transparent;
    outline-offset: 1px;
    transition: outline-color 0.15s ease, box-shadow 0.2s ease, transform 0.2s ease;
  }
  .img-wrapper:hover img,
  .img-wrapper.img-selected img {
    outline-color: #ff598b;
  }
  .img-wrapper.img-selected img {
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.08);
    transform: translateY(-1px);
  }
  .img-handle {
    position: absolute;
    width: 14px;
    height: 14px;
    background: transparent;
    border: 2.5px solid #ff598b;
    display: none;
    z-index: 10;
  }
  .img-wrapper.img-selected .img-handle { display: block; }
  .img-handle-nw {
    top: -8px; left: -8px;
    border-right: none; border-bottom: none;
    border-top-left-radius: 14px;
    cursor: nw-resize;
  }
  .img-handle-ne {
    top: -8px; right: -8px;
    border-left: none; border-bottom: none;
    border-top-right-radius: 14px;
    cursor: ne-resize;
  }
  .img-handle-se {
    bottom: -8px; right: -8px;
    border-left: none; border-top: none;
    border-bottom-right-radius: 14px;
    cursor: se-resize;
  }
  .img-handle-sw {
    bottom: -8px; left: -8px;
    border-right: none; border-top: none;
    border-bottom-left-radius: 14px;
    cursor: sw-resize;
  }
  .img-handle-n  { top: -4px;             left: calc(50% - 4px); cursor: n-resize; }
  .img-handle-s  { bottom: -4px;          left: calc(50% - 4px); cursor: s-resize; }
  .img-handle-e  { top: calc(50% - 4px);  right: -4px;           cursor: e-resize; }
  .img-handle-w  { top: calc(50% - 4px);  left: -4px;            cursor: w-resize; }
`

const HANDLES = ["nw", "ne", "se", "sw"]

function buildImageWrapper(src: string): HTMLElement {
  const wrapper = document.createElement("span")
  wrapper.setAttribute("contenteditable", "false")
  wrapper.className = "img-wrapper"

  const img = document.createElement("img")
  img.src = src
  img.style.width = "400px"
  wrapper.appendChild(img)

  HANDLES.forEach((pos) => {
    const handle = document.createElement("span")
    handle.className = `img-handle img-handle-${pos}`
    handle.dataset.handle = pos
    wrapper.appendChild(handle)
  })

  return wrapper
}

export interface DocumentEditorHandle {
  insertImage: (src: string, savedRange: Range | null) => void
  getContent: () => string
  setContent: (html: string) => void
}

interface DocumentEditorProps {
  title: string
  onTitleChange: (title: string) => void
  onContentChange?: (html: string) => void
}

interface LinkTooltipState {
  anchor: HTMLAnchorElement
  x: number
  y: number
  editMode: boolean
  editUrl: string
  editText: string
}

export const DocumentEditor = memo(forwardRef<DocumentEditorHandle, DocumentEditorProps>(
  ({ title, onTitleChange, onContentChange }, ref) => {
    const [body, setBody] = useState("")
    const bodyRef = useRef<HTMLDivElement>(null)
    const titleRef = useRef<HTMLDivElement>(null)

    const [linkTooltip, setLinkTooltip] = useState<LinkTooltipState | null>(null)
    const tooltipHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const linkTooltipRef = useRef<HTMLDivElement>(null)
    const tooltipViewRef = useRef<HTMLDivElement>(null)
    const tooltipEditRef = useRef<HTMLDivElement>(null)
    const tooltipUrlInputRef = useRef<HTMLInputElement>(null)
    const [tooltipHeight, setTooltipHeight] = useState(0)

    useLayoutEffect(() => {
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
      if (!linkTooltip) return
      const { anchor, editUrl, editText } = linkTooltip
      const raw = editUrl.trim()
      if (raw) {
        const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
        anchor.href = url
        anchor.target = "_blank"
        anchor.rel = "noopener noreferrer"
      }
      if (editText.trim()) anchor.textContent = editText
      setLinkTooltip(null)
    }

    function removeTooltipLink() {
      if (!linkTooltip) return
      const { anchor } = linkTooltip
      const parent = anchor.parentNode
      if (parent) {
        while (anchor.firstChild) parent.insertBefore(anchor.firstChild, anchor)
        parent.removeChild(anchor)
      }
      setLinkTooltip(null)
    }

    function refreshBody() {
      const editor = bodyRef.current
      if (!editor) return
      const html = editor.innerHTML.trim()
      setBody(html === "" || html === "<br>" ? "" : "_")
      onContentChange?.(html)
    }

    useImperativeHandle(ref, () => ({
      getContent() {
        return bodyRef.current?.innerHTML ?? ""
      },
      setContent(html: string) {
        if (!bodyRef.current) return
        bodyRef.current.innerHTML = html
        const trimmed = html.trim()
        setBody(trimmed === "" || trimmed === "<br>" ? "" : "_")
      },
      insertImage(src: string, savedRange: Range | null) {
        const editor = bodyRef.current
        if (!editor) return

        editor.focus()

        const sel = window.getSelection()
        if (sel) {
          sel.removeAllRanges()
          const validRange = savedRange && editor.contains(savedRange.commonAncestorContainer)
            ? savedRange
            : null
          if (validRange) {
            sel.addRange(validRange)
          } else {
            const range = document.createRange()
            range.selectNodeContents(editor)
            range.collapse(false)
            sel.addRange(range)
          }
        }

        const wrapper = buildImageWrapper(src)
        const range = sel?.getRangeAt(0)
        if (range) {
          range.deleteContents()
          range.insertNode(wrapper)
          range.setStartAfter(wrapper)
          range.collapse(true)
          sel?.removeAllRanges()
          sel?.addRange(range)
        }

        refreshBody()
      },
    }))

    // Sync title from topbar rename
    useEffect(() => {
      const el = titleRef.current
      if (el && el.textContent !== title) el.textContent = title
    }, [title])

    // Global Cmd+A → select all in body (or title if focused)
    useEffect(() => {
      function onSelectAll(e: KeyboardEvent) {
        if (e.key !== "a" || (!e.metaKey && !e.ctrlKey)) return
        e.preventDefault()
        const target = document.activeElement
        const el = (target === titleRef.current ? titleRef.current : bodyRef.current)
        if (!el) return
        const range = document.createRange()
        range.selectNodeContents(el)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
        el.focus()
      }
      document.addEventListener("keydown", onSelectAll)
      return () => document.removeEventListener("keydown", onSelectAll)
    }, [])

    // Image selection + resize, link click + hover
    useEffect(() => {
      const editor = bodyRef.current
      if (!editor) return

      function onEditorClick(e: MouseEvent) {
        const target = e.target as HTMLElement

        // Navigate links
        const anchor = target.closest("a[href]") as HTMLAnchorElement | null
        if (anchor) {
          e.preventDefault()
          window.open(anchor.href, "_blank", "noopener,noreferrer")
          return
        }

        // Image selection
        document.querySelectorAll(".img-wrapper.img-selected").forEach((w) =>
          w.classList.remove("img-selected")
        )
        const wrapper = target.closest(".img-wrapper")
        if (wrapper) {
          wrapper.classList.add("img-selected")
          editor.focus()
        }
      }
      editor.addEventListener("click", onEditorClick)

      // Click outside editor: deselect images
      function onDocClick(e: MouseEvent) {
        if (!editor.contains(e.target as Node)) {
          document.querySelectorAll(".img-wrapper.img-selected").forEach((w) =>
            w.classList.remove("img-selected")
          )
        }
      }
      document.addEventListener("click", onDocClick)

      // Backspace/Delete: remove selected image
      function onKeyDown(e: KeyboardEvent) {
        const selected = editor.querySelector(".img-wrapper.img-selected")
        if (!selected) return
        if (e.key === "Escape") {
          selected.classList.remove("img-selected")
        } else if (e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault()
          e.stopPropagation()
          selected.remove()
          refreshBody()
        }
      }
      editor.addEventListener("keydown", onKeyDown, true)
      document.addEventListener("keydown", onKeyDown)

      // Link hover tooltip
      function onLinkMouseOver(e: MouseEvent) {
        const a = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null
        if (!a) return
        cancelHide()
        const rect = a.getBoundingClientRect()
        setLinkTooltip(prev => {
          if (prev?.anchor === a && prev.editMode) return prev
          return {
            anchor: a,
            x: rect.left + rect.width / 2,
            y: rect.top,
            editMode: false,
            editUrl: a.getAttribute("href") ?? "",
            editText: a.textContent ?? "",
          }
        })
      }
      function onLinkMouseOut(e: MouseEvent) {
        if ((e.target as HTMLElement).closest("a[href]")) scheduleHide()
      }
      editor.addEventListener("mouseover", onLinkMouseOver)
      editor.addEventListener("mouseout", onLinkMouseOut)

      // Resize on handle drag
      let resizeState: {
        img: HTMLImageElement
        handle: string
        startX: number
        startWidth: number
      } | null = null

      function onMouseDown(e: MouseEvent) {
        const handle = (e.target as HTMLElement).closest(".img-handle") as HTMLElement | null
        if (!handle) return
        e.preventDefault()
        const wrapper = handle.closest(".img-wrapper")
        const img = wrapper?.querySelector("img") as HTMLImageElement | null
        if (!img) return
        resizeState = {
          img,
          handle: handle.dataset.handle ?? "",
          startX: e.clientX,
          startWidth: img.offsetWidth,
        }
      }

      function onMouseMove(e: MouseEvent) {
        if (!resizeState) return
        const dx = e.clientX - resizeState.startX
        const { img, handle, startWidth } = resizeState
        const isLeft = handle.includes("w")
        const newWidth = Math.max(80, isLeft ? startWidth - dx : startWidth + dx)
        img.style.width = `${newWidth}px`
      }

      function onMouseUp() {
        resizeState = null
      }

      document.addEventListener("mousedown", onMouseDown)
      document.addEventListener("mousemove", onMouseMove)
      document.addEventListener("mouseup", onMouseUp)

      return () => {
        editor.removeEventListener("click", onEditorClick)
        document.removeEventListener("click", onDocClick)
        editor.removeEventListener("keydown", onKeyDown, true)
        document.removeEventListener("keydown", onKeyDown)
        editor.removeEventListener("mouseover", onLinkMouseOver)
        editor.removeEventListener("mouseout", onLinkMouseOut)
        document.removeEventListener("mousedown", onMouseDown)
        document.removeEventListener("mousemove", onMouseMove)
        document.removeEventListener("mouseup", onMouseUp)
      }
    }, [])

    return (
      <div className="w-full max-w-3xl py-16">
        <style>{IMAGE_STYLES}</style>

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
                bodyRef.current?.focus()
              }
              if ((e.metaKey || e.ctrlKey) && ["b", "i", "u"].includes(e.key.toLowerCase())) {
                e.preventDefault()
              }
            }}
            className="w-full overflow-hidden whitespace-nowrap text-4xl font-bold text-foreground outline-none focus:outline-none"
          />
        </div>

        {/* Body */}
        <div className="relative">
          {!body && (
            <span
              className="pointer-events-none absolute left-0 top-0 text-sm text-muted-foreground/40 select-none"
              aria-hidden
            >
              Write here...
            </span>
          )}
          <div
            ref={bodyRef}
            contentEditable
            suppressContentEditableWarning
            spellCheck
            onInput={refreshBody}
            className="w-full text-sm leading-relaxed text-foreground outline-none focus:outline-none"
          />
        </div>

        {/* Link hover tooltip */}
        <AnimatePresence>
        {linkTooltip && (
          <motion.div
            ref={linkTooltipRef}
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
            {/* Height-animated container */}
            <motion.div
              initial={false}
              animate={{ height: tooltipHeight }}
              transition={{ type: "spring", stiffness: 600, damping: 40 }}
              className="relative min-w-40 max-w-64"
            >
              {/* View panel — always in DOM, fades out when edit is active */}
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
                  onClick={() => window.open(linkTooltip.anchor.href, "_blank", "noopener,noreferrer")}
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

              {/* Edit panel — always in DOM, fades in when edit is active */}
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
    )
  }
))

DocumentEditor.displayName = "DocumentEditor"
