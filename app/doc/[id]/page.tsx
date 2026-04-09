"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Topbar } from "@/components/topbar"
import { Sidebar } from "@/components/sidebar"
import { FolderSidebar } from "@/components/folder-sidebar"
import { DocumentEditor, type DocumentEditorHandle } from "@/components/document-editor"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { AnimatePresence } from "motion/react"
import { docCache } from "@/lib/doc-cache"
import { userCache } from "@/lib/user-cache"
import { cn } from "@/lib/utils"

export default function DocPage() {
  const params = useParams()
  const router = useRouter()
  const docId = params.id as string

  const [docName, setDocName] = useState(() => docCache.get(docId)?.title ?? "")
  const [folderName, setFolderName] = useState<string | undefined>(() => docCache.get(docId)?.folder_name ?? undefined)
  const [folderId, setFolderId] = useState<string | null>(() => docCache.get(docId)?.folder_id ?? null)
  const [folderSidebarOpen, setFolderSidebarOpen] = useState(false)
  const [userAvatar, setUserAvatar] = useState<string | undefined>(() => userCache.get()?.avatarUrl)
  const [pinned, setPinned] = useState(false)
  const [visible, setVisible] = useState(false)
  const [fadingOut, setFadingOut] = useState(false)
  const editorRef = useRef<DocumentEditorHandle>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const docNameRef = useRef("")
  const [editorView, setEditorView] = useState<import("prosemirror-view").EditorView | null>(null)

  useEffect(() => { docNameRef.current = docName }, [docName])

  useEffect(() => {
    const cached = docCache.get(docId)
    if (cached) {
      setDocName(cached.title)
      editorRef.current?.setContent(cached.content)
      if (cached.folder_id) setFolderId(cached.folder_id)
    }
    requestAnimationFrame(() => setVisible(true))

    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const avatarUrl = user.user_metadata?.avatar_url
      const name = ((user.user_metadata?.full_name as string) ?? "").split(" ")[0]
      userCache.set({ avatarUrl, name })
      setUserAvatar(avatarUrl)

      const { data } = await supabase
        .from("documents")
        .select("*, folders(name)")
        .eq("id", docId)
        .single()

      if (!data) { router.push("/"); return }

      setDocName(data.title)
      setPinned(data.pinned ?? false)
      if (!cached) editorRef.current?.setContent(data.content)

      if (data.folder_id) {
        setFolderId(data.folder_id)
        const folder = data.folders as { name: string } | null
        if (folder) setFolderName(folder.name)
      }
    }
    load()
  }, [docId, router])

  const saveNow = useCallback(async (title: string, content: string, silent = false) => {
    const supabase = createClient()
    // Try to parse JSON content — if the column is jsonb, Supabase needs an object, not a string
    let contentValue: string | Record<string, unknown> = content
    if (content.trim().startsWith("{")) {
      try { contentValue = JSON.parse(content) } catch { /* keep as string */ }
    }
    const { error } = await supabase
      .from("documents")
      .update({ title, content: contentValue, updated_at: new Date().toISOString() })
      .eq("id", docId)
    if (!silent) {
      if (error) toast.error("Failed to save")
      else toast.success("Saved")
    }
  }, [docId])

  const scheduleAutoSave = useCallback((title: string, content: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => saveNow(title, content, true), 1500)
  }, [saveNow])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        saveNow(docNameRef.current, editorRef.current?.getContent() ?? "")
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [saveNow])

  const navigateHome = useCallback(async () => {
    setFadingOut(true)
    await new Promise(r => setTimeout(r, 200))
    router.push("/")
  }, [router])

  const deleteDoc = useCallback(async () => {
    const supabase = createClient()
    await supabase.from("documents").update({ deleted_at: new Date().toISOString() }).eq("id", docId)
    navigateHome()
  }, [docId, navigateHome])

  const createDoc = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from("documents")
      .insert({ user_id: user.id, title: "", content: "", folder_id: null })
      .select()
      .single()
    if (data) router.push(`/doc/${data.id}`)
  }, [router])

  const togglePin = useCallback(async () => {
    const next = !pinned
    setPinned(next)
    const supabase = createClient()
    await supabase.from("documents").update({ pinned: next }).eq("id", docId)
  }, [pinned, docId])

  const handleTitleChange = useCallback((name: string) => {
    setDocName(name)
    scheduleAutoSave(name, editorRef.current?.getContent() ?? "")
  }, [scheduleAutoSave])

  const handleContentChange = useCallback((json: string) => {
    scheduleAutoSave(docNameRef.current, json)
  }, [scheduleAutoSave])

  // Expose editor view for sidebar
  useEffect(() => {
    const interval = setInterval(() => {
      const view = editorRef.current?.getView?.()
      if (view && view !== editorView) setEditorView(view)
    }, 100)
    return () => clearInterval(interval)
  }, [editorView])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background font-sans">
      <div className="shrink-0">
        <Topbar
          docName={docName}
          onDocNameChange={handleTitleChange}
          userAvatar={userAvatar}
          folderName={folderName}
          onFolderClick={() => setFolderSidebarOpen(prev => !prev)}
          onDelete={deleteDoc}
          onHomeClick={navigateHome}
          onNewPage={createDoc}
          pinned={pinned}
          onPinToggle={togglePin}
        />
      </div>
      <div className={cn("flex flex-col flex-1 overflow-hidden transition-opacity duration-200", fadingOut ? "opacity-0" : visible ? "opacity-100" : "opacity-0")}>
        <AnimatePresence>
          {folderSidebarOpen && folderId && (
            <FolderSidebar folderId={folderId} currentDocId={docId} />
          )}
        </AnimatePresence>

        <div className="relative flex flex-1 overflow-hidden">
          <Sidebar onInsertImage={(src) => editorRef.current?.insertImage(src)} editorView={editorView} />
          <main className="flex flex-1 justify-center overflow-y-auto px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <DocumentEditor
              ref={editorRef}
              title={docName}
              onTitleChange={handleTitleChange}
              onContentChange={handleContentChange}
            />
          </main>
        </div>
      </div>
    </div>
  )
}
