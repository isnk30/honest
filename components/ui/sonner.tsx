"use client"

import { Toaster as SonnerToaster } from "sonner"

export function Toaster(props: React.ComponentProps<typeof SonnerToaster>) {
  return <SonnerToaster toastOptions={{ style: { borderRadius: 0, background: "#000", color: "#fff", border: "none" } }} {...props} />
}
