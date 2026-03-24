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

This is a **Next.js 16 app** using the App Router with a document editor UI as its current focus.

### Key conventions

- **Path alias:** `@/` maps to the project root (e.g. `@/components/ui/button`, `@/lib/utils`, `@/hooks/use-mobile`)
- **Styling:** Tailwind CSS v4 via `@tailwindcss/postcss`. Design tokens are CSS variables in OKLCH color space defined in `styles/globals.css`. Use `cn()` from `@/lib/utils` to merge Tailwind classes.
- **UI components:** shadcn/ui ("new-york" style, neutral base). Pre-built primitives live in `components/ui/`. Add new shadcn components via `npx shadcn@latest add <component>`.
- **Variants:** Use `class-variance-authority` (CVA) for component variants — see `components/ui/button.tsx` for the pattern.
- **Icons:** `lucide-react`
- **Theme:** `next-themes` via `components/theme-provider.tsx`; light/dark tokens defined in `styles/globals.css`

### Structure

- `app/` — Next.js App Router pages and root layout (uses Geist fonts, Vercel Analytics)
- `components/ui/` — shadcn/ui primitive components (do not hand-edit generated files)
- `components/` — application-level components (e.g. `docs-topbar.tsx`)
- `hooks/` — custom React hooks (`use-mobile.ts`, `use-toast.ts`)
- `lib/utils.ts` — `cn()` utility only

### Build notes

`next.config.mjs` has `typescript.ignoreBuildErrors: true` and `images.unoptimized: true` — TypeScript errors won't fail the build.
