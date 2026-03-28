"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { Topbar } from "@/components/topbar"
import { Sidebar } from "@/components/sidebar"
import { DocumentEditor, type DocumentEditorHandle } from "@/components/document-editor"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

export default function Home() {
  const [docName, setDocName] = useState("")
  const [userAvatar, setUserAvatar] = useState<string | undefined>()
  const editorRef = useRef<DocumentEditorHandle>(null)
  const docIdRef = useRef<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const docNameRef = useRef("")

  // Keep ref in sync for use inside closures
  useEffect(() => { docNameRef.current = docName }, [docName])

  // Load user + document on mount
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setUserAvatar(user.user_metadata?.avatar_url)

      const { data } = await supabase
        .from("documents")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (data) {
        docIdRef.current = data.id
        setDocName(data.title)
        editorRef.current?.setContent(data.content)
      } else {
        const { data: newDoc } = await supabase
          .from("documents")
          .insert({ user_id: user.id, title: "", content: "" })
          .select()
          .single()
        if (newDoc) docIdRef.current = newDoc.id
      }
    }
    load()
  }, [])

  const saveNow = useCallback(async (title: string, content: string, silent = false) => {
    if (!docIdRef.current) return
    const supabase = createClient()
    const { error } = await supabase
      .from("documents")
      .update({ title, content, updated_at: new Date().toISOString() })
      .eq("id", docIdRef.current)
    if (!silent) {
      if (error) toast.error("Failed to save")
      else toast.success("Saved")
    }
  }, [])

  const scheduleAutoSave = useCallback((title: string, content: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => saveNow(title, content, true), 1500)
  }, [saveNow])

  // Cmd+S manual save
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        const content = editorRef.current?.getContent() ?? ""
        saveNow(docNameRef.current, content)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [saveNow])

  function handleTitleChange(name: string) {
    setDocName(name)
    const content = editorRef.current?.getContent() ?? ""
    scheduleAutoSave(name, content)
  }

  function handleContentChange(html: string) {
    scheduleAutoSave(docNameRef.current, html)
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background font-sans">
      <div className="shrink-0">
        <Topbar
          docName={docName}
          onDocNameChange={handleTitleChange}
          userAvatar={userAvatar}
        />
      </div>
      <div className="relative flex flex-1 overflow-hidden">
        <Sidebar
          onInsertImage={(src, range) => editorRef.current?.insertImage(src, range)}
        />
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
