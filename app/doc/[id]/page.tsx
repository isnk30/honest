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

export default function DocPage() {
  const params = useParams()
  const router = useRouter()
  const docId = params.id as string

  const [docName, setDocName] = useState("")
  const [folderName, setFolderName] = useState<string | undefined>()
  const [folderId, setFolderId] = useState<string | null>(null)
  const [folderSidebarOpen, setFolderSidebarOpen] = useState(false)
  const [userAvatar, setUserAvatar] = useState<string | undefined>()
  const editorRef = useRef<DocumentEditorHandle>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const docNameRef = useRef("")

  useEffect(() => { docNameRef.current = docName }, [docName])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setUserAvatar(user.user_metadata?.avatar_url)

      const { data } = await supabase
        .from("documents")
        .select("*, folders(name)")
        .eq("id", docId)
        .single()

      if (!data) { router.push("/"); return }

      setDocName(data.title)
      editorRef.current?.setContent(data.content)

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
    const { error } = await supabase
      .from("documents")
      .update({ title, content, updated_at: new Date().toISOString() })
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

  const handleTitleChange = useCallback((name: string) => {
    setDocName(name)
    scheduleAutoSave(name, editorRef.current?.getContent() ?? "")
  }, [scheduleAutoSave])

  const handleContentChange = useCallback((html: string) => {
    scheduleAutoSave(docNameRef.current, html)
  }, [scheduleAutoSave])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background font-sans">
      <div className="shrink-0">
        <Topbar
          docName={docName}
          onDocNameChange={handleTitleChange}
          userAvatar={userAvatar}
          folderName={folderName}
          onFolderClick={() => setFolderSidebarOpen(prev => !prev)}
        />
      </div>
      <AnimatePresence>
        {folderSidebarOpen && folderId && (
          <FolderSidebar folderId={folderId} currentDocId={docId} />
        )}
      </AnimatePresence>

      <div className="relative flex flex-1 overflow-hidden">
        <Sidebar onInsertImage={(src, range) => editorRef.current?.insertImage(src, range)} />
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
  )
}
