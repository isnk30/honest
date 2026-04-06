"use client"

import { useTheme } from "next-themes"

export function useThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  function toggle() {
    const style = document.createElement("style")
    style.textContent = `*, *::before, *::after {
      transition: color 200ms ease, background-color 200ms ease, border-color 200ms ease !important;
    }`
    document.head.appendChild(style)
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
    setTimeout(() => document.head.removeChild(style), 300)
  }

  return { resolvedTheme, toggle }
}
