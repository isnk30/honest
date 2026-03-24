"use client"

import { useRef, useState } from "react"
import { Topbar } from "@/components/topbar"
import { Sidebar } from "@/components/sidebar"
import { DocumentEditor, type DocumentEditorHandle } from "@/components/document-editor"

export default function Home() {
  const [docName, setDocName] = useState("")
  const editorRef = useRef<DocumentEditorHandle>(null)

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background font-sans">
      <div className="shrink-0">
        <Topbar docName={docName} onDocNameChange={setDocName} />
      </div>
      <div className="relative flex flex-1 overflow-hidden">
        <Sidebar
          onInsertImage={(src, range) => editorRef.current?.insertImage(src, range)}
        />
        <main className="flex flex-1 justify-center overflow-y-auto px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <DocumentEditor ref={editorRef} title={docName} onTitleChange={setDocName} />
        </main>
      </div>
    </div>
  )
}
