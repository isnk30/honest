"use client"

import { forwardRef, useImperativeHandle, useRef, useState, useEffect } from "react"

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
}

interface DocumentEditorProps {
  title: string
  onTitleChange: (title: string) => void
}

export const DocumentEditor = forwardRef<DocumentEditorHandle, DocumentEditorProps>(
  ({ title, onTitleChange }, ref) => {
    const [body, setBody] = useState("")
    const bodyRef = useRef<HTMLDivElement>(null)

    function refreshBody() {
      const editor = bodyRef.current
      if (!editor) return
      const html = editor.innerHTML.trim()
      setBody(html === "" || html === "<br>" ? "" : "_")
    }
    const titleRef = useRef<HTMLDivElement>(null)

    useImperativeHandle(ref, () => ({
      insertImage(src: string, savedRange: Range | null) {
        const editor = bodyRef.current
        if (!editor) return

        editor.focus()

        // Restore saved selection or collapse to end
        const sel = window.getSelection()
        if (sel) {
          sel.removeAllRanges()
          // Only use savedRange if it's actually inside the editor
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
          // Move cursor after image
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

    // Image selection + resize
    useEffect(() => {
      const editor = bodyRef.current
      if (!editor) return

      // Click: select/deselect images
      function onEditorClick(e: MouseEvent) {
        const target = e.target as HTMLElement
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

      // Click outside editor: deselect
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
            onInput={(e) => onTitleChange(e.currentTarget.textContent ?? "")}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                bodyRef.current?.focus()
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
      </div>
    )
  }
)

DocumentEditor.displayName = "DocumentEditor"
