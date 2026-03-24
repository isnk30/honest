# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (Next.js with Turbopack)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

> Note: `pnpm` is not available in this environment; use `npm`.

## Architecture

This is a **Next.js 16 app** (v16.2, React 19) using the App Router. It's a document editor UI — single-page, no sub-routes.

### Key conventions

- **Path alias:** `@/` maps to the project root (e.g. `@/components/ui/button`, `@/lib/utils`, `@/hooks/use-mobile`)
- **Styling:** Tailwind CSS v4 via `@tailwindcss/postcss`. Design tokens are CSS variables in OKLCH color space defined in `app/globals.css`. Use `cn()` from `@/lib/utils` to merge Tailwind classes. `tw-animate-css` provides animation utilities.
- **UI components:** shadcn/ui ("new-york" style, neutral base). Pre-built primitives live in `components/ui/`. Add new shadcn components via `npx shadcn@latest add <component>`.
- **Variants:** Use `class-variance-authority` (CVA) for component variants — see `components/ui/button.tsx` for the pattern.
- **Icons:** `lucide-react`
- **Theme:** `next-themes` via `components/theme-provider.tsx`; light/dark tokens defined in `app/globals.css`
- **Forms:** `react-hook-form` + `zod` (resolvers via `@hookform/resolvers`)
- **Notifications:** `sonner` for toasts
- **Charts:** `recharts`
- **Dates:** `date-fns`

### Structure

- `app/` — Next.js App Router pages and root layout (Geist fonts, Vercel Analytics)
- `app/globals.css` — OKLCH design tokens, Tailwind `@theme` mapping, base layer styles
- `components/ui/` — shadcn/ui primitive components (~57 total; do not hand-edit generated files)
- `components/document-editor.tsx` — Rich contenteditable editor; supports image insert, resize (8 handles), delete; exports `DocumentEditorHandle` with `insertImage()`
- `components/topbar.tsx` — Header with document rename, star/favorite, ⌘K command palette, avatar
- `components/sidebar.tsx` — Floating left toolbar; Bold/Italic/Underline/Highlight/Image/Link actions
- `components/theme-provider.tsx` — `next-themes` wrapper
- `hooks/` — `use-mobile.ts` (768px breakpoint), `use-toast.ts`
- `lib/utils.ts` — `cn()` utility only
- `public/avatar.jpg` — User avatar

### Build notes

`next.config.mjs` has `typescript.ignoreBuildErrors: true` and `images.unoptimized: true` — TypeScript errors won't fail the build.
