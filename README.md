# honest

A private, distraction-free notebook for freewriting, journaling, note-taking, and anything else you'd want to keep to yourself. No accounts, no sync, no cloud — just you and the page.

## What it's for

honest is built for the kind of writing that benefits from privacy and focus: morning pages, daily journals, brain dumps, long-form notes, ideas you're not ready to share. The interface stays out of your way so you can stay in the writing.

## Features

- **Rich text editing** — Bold, italic, underline, and highlight text with a floating toolbar that appears when you need it
- **Image support** — Insert images directly into your documents; resize them with drag handles, reposition them inline, and delete them with a keypress
- **Document naming** — Rename your document inline with a single click; no modals, no friction
- **Command palette** — Hit `⌘K` (or `Ctrl+K`) to quickly navigate, search, and run document actions without leaving the keyboard
- **Star/favorite** — Mark documents you want to return to
- **Dark mode** — Full light and dark theme support, follows your system preference
- **Minimal UI** — Clean topbar, floating sidebar, and a wide open writing area with nothing between you and the blank page

## Stack

- [Next.js 16](https://nextjs.org/) (App Router, React 19, Turbopack)
- [Tailwind CSS v4](https://tailwindcss.com/) with OKLCH design tokens
- [shadcn/ui](https://ui.shadcn.com/) component primitives
- [next-themes](https://github.com/pacocoursey/next-themes) for theming

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
