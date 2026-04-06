"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { Bold, Italic, Underline, Highlighter, ImageIcon, Link, Timer, Play, Pause, RotateCcw, X } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { cn } from "@/lib/utils"

const formatTools = [
  { icon: Bold,        label: "Bold",      command: "bold",        arg: undefined },
  { icon: Italic,      label: "Italic",    command: "italic",      arg: undefined },
  { icon: Underline,   label: "Underline", command: "underline",   arg: undefined },
  { icon: Highlighter, label: "Highlight", command: "hiliteColor", arg: "yellow"  },
]

interface SidebarProps {
  onInsertImage: (src: string, savedRange: Range | null) => void
}

const TIMER_PRESETS = [5, 10, 15, 20]

function getHighlightColor() {
  return document.documentElement.classList.contains("dark") ? "#1e3a8a" : "yellow"
}

export function Sidebar({ onInsertImage }: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const savedRangeRef = useRef<Range | null>(null)
  const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({})

  // Link state
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")
  const linkInputRef = useRef<HTMLInputElement>(null)
  const savedLinkRangeRef = useRef<Range | null>(null)

  function getLinkAtCursor(): HTMLAnchorElement | null {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return null
    let node: Node | null = sel.anchorNode
    while (node && node !== document.body) {
      if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === "A") {
        return node as HTMLAnchorElement
      }
      node = node.parentNode
    }
    return null
  }

  function openLinkPopover() {
    setTimerOpen(false)
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      savedLinkRangeRef.current = sel.getRangeAt(0).cloneRange()
    }
    const existing = getLinkAtCursor()
    setLinkUrl(existing ? (existing.getAttribute("href") ?? "") : "")
    setLinkOpen(true)
    setTimeout(() => linkInputRef.current?.focus(), 50)
  }

  function applyLink() {
    const raw = linkUrl.trim()
    if (!raw) return
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    const sel = window.getSelection()
    if (sel && savedLinkRangeRef.current) {
      sel.removeAllRanges()
      sel.addRange(savedLinkRangeRef.current)
    }
    document.execCommand("createLink", false, url)
    document.querySelectorAll("a[href]").forEach((a) => {
      ;(a as HTMLAnchorElement).target = "_blank"
      ;(a as HTMLAnchorElement).rel = "noopener noreferrer"
    })
    setLinkOpen(false)
    setLinkUrl("")
  }

  function removeLink() {
    const sel = window.getSelection()
    if (sel && savedLinkRangeRef.current) {
      sel.removeAllRanges()
      sel.addRange(savedLinkRangeRef.current)
    }
    document.execCommand("unlink", false)
    setLinkOpen(false)
    setLinkUrl("")
  }

  // Timer state
  const [timerOpen, setTimerOpen] = useState(false)
  const [timerMinutes, setTimerMinutes] = useState(5)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function isHighlighted(): boolean {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return false
    let node: Node | null = sel.anchorNode
    while (node && node !== document.body) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const bg = (node as HTMLElement).style.backgroundColor
        if (bg === "yellow" || bg === "rgb(255, 255, 0)" || bg === "rgb(30, 64, 175)") return true
      }
      node = node.parentNode
    }
    return false
  }

  function selectionInTitle(): boolean {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return false
    let node: Node | null = sel.anchorNode
    while (node && node !== document.body) {
      if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).dataset.noFormat !== undefined) return true
      node = node.parentNode
    }
    return false
  }

  const checkActiveFormats = useCallback(() => {
    const active = document.activeElement
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
      setActiveFormats({})
      return
    }
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || selectionInTitle()) {
      setActiveFormats({})
      return
    }
    setActiveFormats({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      hiliteColor: isHighlighted(),
    })
  }, [])

  useEffect(() => {
    document.addEventListener("selectionchange", checkActiveFormats)
    return () => document.removeEventListener("selectionchange", checkActiveFormats)
  }, [checkActiveFormats])

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s === null || s <= 1) {
          setRunning(false)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [running])

  function startTimer() {
    setSecondsLeft(timerMinutes * 60)
    setRunning(true)
  }

  function togglePause() {
    setRunning((r) => !r)
  }

  function resetTimer() {
    setRunning(false)
    setSecondsLeft(null)
  }

  function formatTime(secs: number) {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`
  }

  function formatTimeCompact(secs: number) {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return m > 0 ? `${m}m` : `${s}s`
  }

  function applyFormat(command: string, arg?: string) {
    if (selectionInTitle()) return
    if (command === "hiliteColor") {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return
      document.execCommand("hiliteColor", false, isHighlighted() ? "transparent" : getHighlightColor())
    } else {
      document.execCommand(command, false, arg)
    }
    checkActiveFormats()
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

  const btnClass = "flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"

  return (
    <aside className="fixed left-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 border border-border bg-background p-0.5 shadow-md animate-in zoom-in-75 fade-in duration-200 delay-150 origin-left fill-mode-both">
      {formatTools.map(({ icon: Icon, label, command, arg }) => {
        const isActive = activeFormats[command] ?? false
        return (
          <button
            key={label}
            title={label}
            onMouseDown={(e) => {
              e.preventDefault()
              applyFormat(command, arg)
            }}
            className={cn(
              btnClass,
              isActive && "bg-muted text-foreground"
            )}
          >
            <Icon className={cn("h-4 w-4", isActive && "stroke-[2.5]")} />
          </button>
        )
      })}

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

      {/* Link */}
      <div className="relative">
        <button
          title="Insert link"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => linkOpen ? setLinkOpen(false) : openLinkPopover()}
          className={cn(btnClass, linkOpen && "bg-muted text-foreground")}
        >
          <Link className="h-4 w-4" />
        </button>

        <AnimatePresence>
          {linkOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
              transition={{ type: "spring", duration: 0.2, bounce: 0 }}
              style={{ originX: 0, originY: 0.5 }}
              className="absolute left-full bottom-[-47px] ml-2 w-56 border border-border bg-background shadow-lg p-3 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">Link</span>
                <button
                  onClick={() => setLinkOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                ref={linkInputRef}
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); applyLink() }
                  if (e.key === "Escape") setLinkOpen(false)
                }}
                placeholder="https://"
                className="w-full border border-border bg-muted px-2 py-1.5 text-xs outline-none focus:border-foreground transition-colors"
              />
              <div className="flex gap-1.5">
                <button
                  onClick={applyLink}
                  className="flex-1 bg-foreground py-1.5 text-xs font-medium text-background hover:opacity-90 transition-opacity"
                >
                  Apply
                </button>
                {getLinkAtCursor() && (
                  <button
                    onClick={removeLink}
                    className="flex-1 bg-muted py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="my-0.5 w-5 border-t border-border" />

      {/* Timer */}
      <div className="relative">
        <button
          title="Freewrite timer"
          onClick={() => { setTimerOpen((o) => !o); setLinkOpen(false) }}
          className={cn(
            "flex items-center justify-center transition-colors hover:bg-muted hover:text-foreground active:scale-95",
            secondsLeft !== null
              ? cn("h-8 w-8", secondsLeft === 0 ? "text-red-500" : "text-foreground", timerOpen && "bg-muted")
              : cn("h-8 w-8 text-muted-foreground", timerOpen && "bg-muted text-foreground")
          )}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={secondsLeft !== null ? "countdown" : "icon"}
              initial={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
              transition={{ type: "spring", duration: 0.3, bounce: 0 }}
              className="flex items-center justify-center"
            >
              {secondsLeft !== null
                ? <span className="text-xs font-normal tabular-nums">{formatTimeCompact(secondsLeft)}</span>
                : <Timer className="h-4 w-4" />
              }
            </motion.div>
          </AnimatePresence>
        </button>

        <AnimatePresence>
        {timerOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
            transition={{ type: "spring", duration: 0.2, bounce: 0 }}
            style={{ originX: 0, originY: 1 }}
            className="absolute left-full -bottom-0.5 ml-2 w-44 border border-border bg-background shadow-lg p-3 flex flex-col gap-2 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">Timer</span>
              <button
                onClick={() => setTimerOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="relative h-[94px]">
            <AnimatePresence mode="wait" initial={false}>
              {secondsLeft === null ? (
                <motion.div
                  key="setup"
                  initial={{ opacity: 0, y: 6, scale: 0.97, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -6, scale: 0.97, filter: "blur(4px)" }}
                  transition={{ type: "spring", duration: 0.2, bounce: 0 }}
                  className="absolute inset-0 flex flex-col gap-2"
                >
                  {/* Preset options */}
                  <div className="grid grid-cols-4 gap-1">
                    {TIMER_PRESETS.map((m) => (
                      <button
                        key={m}
                        onClick={() => setTimerMinutes(m)}
                        className={cn(
                          "py-1 text-xs font-medium transition-colors",
                          timerMinutes === m
                            ? "bg-foreground text-background"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>

                  {/* Custom adjust */}
                  <div className="flex items-center justify-between gap-1">
                    <button
                      onClick={() => setTimerMinutes((m) => Math.max(1, m - 1))}
                      className="flex h-6 w-6 items-center justify-center bg-muted text-muted-foreground hover:text-foreground transition-colors text-sm leading-none"
                    >
                      −
                    </button>
                    <div className="flex items-baseline gap-0.5">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={timerMinutes}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10)
                          if (!isNaN(val)) setTimerMinutes(Math.min(60, Math.max(1, val)))
                        }}
                        onFocus={(e) => e.target.select()}
                        className="w-7 text-center text-sm font-semibold tabular-nums bg-transparent border-b border-border focus:border-foreground outline-none transition-colors"
                      />
                      <span className="text-sm font-semibold text-muted-foreground">m</span>
                    </div>
                    <button
                      onClick={() => setTimerMinutes((m) => Math.min(60, m + 1))}
                      className="flex h-6 w-6 items-center justify-center bg-muted text-muted-foreground hover:text-foreground transition-colors text-sm leading-none"
                    >
                      +
                    </button>
                  </div>

                  {/* Start */}
                  <button
                    onClick={startTimer}
                    className="flex items-center justify-center gap-1.5 bg-foreground py-1.5 text-xs font-medium text-background hover:opacity-90 transition-opacity"
                  >
                    Start
                    <Play className="h-3 w-3 fill-current" />
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="running"
                  initial={{ opacity: 0, y: 6, scale: 0.97, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -6, scale: 0.97, filter: "blur(4px)" }}
                  transition={{ type: "spring", duration: 0.2, bounce: 0 }}
                  className="absolute inset-0 flex flex-col gap-2"
                >
                  {/* Countdown display */}
                  <div className={cn(
                    "text-center text-xl font-bold tabular-nums",
                    secondsLeft === 0 && "text-red-500"
                  )}>
                    {formatTime(secondsLeft)}
                  </div>

                  {secondsLeft === 0 ? (
                    <p className="text-center text-xs text-muted-foreground">Time&apos;s up!</p>
                  ) : (
                    <button
                      onClick={togglePause}
                      className="flex items-center justify-center gap-1.5 bg-foreground py-1.5 text-xs font-medium text-background hover:opacity-90 transition-opacity"
                    >
                      {running
                        ? <><Pause className="h-3 w-3 fill-current" /> Pause</>
                        : <><Play className="h-3 w-3 fill-current" /> Resume</>
                      }
                    </button>
                  )}

                  {/* Reset */}
                  <button
                    onClick={resetTimer}
                    className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </aside>
  )
}
