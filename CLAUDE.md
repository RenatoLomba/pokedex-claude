# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- AUTO-MANAGED: project-description -->
## Overview

**Pokédex**: a single-page web app that shows one card per Pokémon (every entry PokéAPI lists, alternate forms included), each with its name, a sprite icon and official artwork.

- **Stack**: Next.js App Router, React, Tailwind CSS (CSS-first config), TypeScript throughout.
- **Backend-for-frontend (BFF)**: a Next.js route handler (`GET /api/pokemon`) is the only thing the browser calls. It fetches PokéAPI on the server, transforms the list and serves it from an in-memory stale-while-revalidate cache.
- **Frontend**: client-side search (name or `#number`), infinite scroll, lazy images with missing-image placeholders, dark mode that follows the system with a manual Light / System / Dark toggle, and loading, empty and error states.
- No database or extra services. The cache lives per server process and resets on restart.

<!-- END AUTO-MANAGED -->

<!-- AUTO-MANAGED: build-commands -->
## Build & Development Commands

Requires Node.js 20.9+.

```bash
npm install
npm run dev      # dev server at http://localhost:3000
npm run build    # production build (also runs the TypeScript type check)
npm start        # serve the production build
```

- There is **no test runner and no lint script**. Use `npm run build` to type-check changes.
- `.claude/launch.json` defines the dev server for the in-app browser preview.
- Check the BFF by hand with `curl -i http://localhost:3000/api/pokemon` and look at the `X-Cache` (`HIT` / `STALE` / `MISS`) and `X-Cache-Fetched-At` headers.

<!-- END AUTO-MANAGED -->

<!-- AUTO-MANAGED: architecture -->
## Architecture

```
app/
  layout.tsx            Root layout: Inter font (next/font), metadata, themeColor viewport, inline theme script
  page.tsx              Server component: page header + <Pokedex />
  globals.css           Tailwind import, custom dark variant, @theme tokens (brand colors, font), card-in animation
  api/pokemon/route.ts  BFF endpoint (force-dynamic), sets cache headers, 503 on cold failure
components/
  Pokedex.tsx           "use client": fetch, search, infinite scroll, loading/error/empty states
  PokemonCard.tsx       "use client": memoized card + SafeImage (img with fallback)
  ThemeToggle.tsx       "use client": Light / System / Dark switch, saved in localStorage
lib/
  pokemon.ts            Server-only data layer: PokéAPI fetch, transform, SWR cache
  theme.ts              Theme type, storage key, pre-paint THEME_INIT_SCRIPT (shared by layout and toggle)
  format.ts             formatName ("mr-mime" -> "Mr Mime"), formatId (25 -> "#0025")
  types.ts              Pokemon = { id, name, icon, image }
```

### Data flow

```
Browser ──► GET /api/pokemon (app/api/pokemon/route.ts)
                 │
                 ▼
        getPokemonList() (lib/pokemon.ts) ── cache on globalThis.__pokemonCache
                 │ only when empty or stale
                 ▼
        GET https://pokeapi.co/api/v2/pokemon?limit=100000&offset=0
```

- **Transform** (`toPokemon`): takes the numeric ID from the end of each result `url` and builds `icon` (`…/sprites/pokemon/{id}.png`) and `image` (`…/sprites/pokemon/other/official-artwork/{id}.png`) on `raw.githubusercontent.com/PokeAPI/sprites`. There are no per-Pokémon API calls.
- **Cache states**:
  - `MISS`: nothing cached yet, so the request waits for PokéAPI.
  - `HIT`: data is younger than `REVALIDATE_SECONDS`.
  - `STALE`: older data is served right away and one background `refresh()` starts.
- **Single-flight**: `state.inflight ??= …` means concurrent requests share one PokéAPI call.
- **Failure handling**:
  - Fetch errors, bad payloads and timeouts (`AbortSignal.timeout`) are logged with the `[pokemon-cache]` prefix, and the last good data keeps being served.
  - A failed refresh sets a retry cool-down: a longer one when there is cached data, a shorter one on a cold start.
  - The route returns 503 with `Retry-After` only when no good data has ever been fetched.
- **HTTP caching**: the route sets `Cache-Control: public, s-maxage=REVALIDATE_SECONDS, stale-while-revalidate=REVALIDATE_SECONDS` so a CDN can apply the same window.
- **Client**:
  - `Pokedex` loads the full list in one request and filters it in memory using `useDeferredValue`.
  - It renders `PAGE_SIZE` cards at a time, and an `IntersectionObserver` sentinel adds more. A "Load more" button is the keyboard fallback.

<!-- END AUTO-MANAGED -->

<!-- AUTO-MANAGED: conventions -->
## Code Conventions

- **Language**: TypeScript in strict mode, `allowJs: false`. Import project files with the `@/*` alias (maps to the repo root), e.g. `@/lib/pokemon`. Sibling components use relative imports (`./PokemonCard`).
- **Type-only imports**: use `import type { … }`.
- **Formatting**:
  - 2-space indentation, double quotes, semicolons, trailing commas in multi-line literals and calls.
  - Long lines (about 120 characters) are accepted.
- **Naming**:
  - PascalCase for components, component files and types (`PokemonCard.tsx`, `LoadState`).
  - camelCase for functions and variables.
  - SCREAMING_SNAKE_CASE for module-level constants (`REVALIDATE_SECONDS`, `PAGE_SIZE`, `FETCH_TIMEOUT_MS`).
  - Constants that hold durations carry their unit as a suffix (`_MS`, `_SECONDS`), and numeric separators are used for readability (`10_000`).
- **Exports**: named exports for components and utilities (`export function Pokedex`). Default exports are used only where Next.js requires them (`page.tsx`, `layout.tsx`, `next.config.ts`).
- **Components**:
  - Function components only. Add `"use client"` only to interactive files under `components/`.
  - `app/page.tsx` and `app/layout.tsx` stay server components.
  - Small helper components (`LoadingGrid`, `StatusPanel`, `SafeImage`) live in the same file as their only consumer.
- **Types**: use `type` aliases, not `interface`. Model UI state as discriminated unions (`{ kind: "loading" } | { kind: "error"; … } | { kind: "ready"; … }`).
- **Comments**: `/** … */` JSDoc on exported functions and tunable constants explains *why*. Inline `//` comments cover non-obvious decisions.
- **Styling**:
  - Use Tailwind utility classes inline. Design tokens are defined in `@theme` in `app/globals.css` (`brand-500`, `brand-600`, `--font-sans`).
  - Pair every color with a `dark:` variant on the zinc palette.
  - Use arbitrary properties for one-off CSS (`[content-visibility:auto]`).
- **Accessibility**:
  - `sr-only` labels, `aria-live="polite"` for counts and loading, `aria-hidden` on decorative SVGs, `focus-visible` outlines.
  - Alt text follows "Official artwork of X" and "X sprite icon".

<!-- END AUTO-MANAGED -->

<!-- AUTO-MANAGED: patterns -->
## Detected Patterns

- **globalThis singleton**: module state that has to survive dev hot reloads is stored on `globalThis` with a typed cast (`globalThis as typeof globalThis & { __pokemonCache?: CacheState }`) and initialized with `??=`.
- **Single tunable constant**: `REVALIDATE_SECONDS` in `lib/pokemon.ts` is the one source for the freshness window. The route imports it for its `Cache-Control` header. Don't hard-code `3600` anywhere else.
- **Own the cache explicitly**:
  - The PokéAPI `fetch` uses `cache: "no-store"` so Next's data cache doesn't cache it a second time.
  - The route uses `export const dynamic = "force-dynamic"` so it runs on every request.
- **Defensive parsing**: external JSON is cast and then validated (`Array.isArray(json?.results)`, numeric-ID regex). Invalid entries are dropped with a type-guard `filter((p): p is Pokemon => p !== null)`.
- **Error narrowing**: `err instanceof Error ? err.message : …` in every `catch` block. `catch` variables are typed `unknown`.
- **Fire-and-forget**: deliberately un-awaited promises are prefixed with `void` (`void refresh()`, `void fetchList()`).
- **Theming**:
  - `dark:` is a custom variant in `globals.css`: it matches `<html data-theme="dark">`, or the OS dark preference when `data-theme` isn't `light`. No attribute means "system", so dark mode works before and without JS.
  - `THEME_INIT_SCRIPT` runs in `<head>` and sets `data-theme` from localStorage before first paint; `<html>` has `suppressHydrationWarning` for that reason.
  - `ThemeToggle` reads the choice with `useSyncExternalStore` (server snapshot is `"system"`) and re-applies it in `useLayoutEffect` because the dev Strict Mode remount strips `<html>` attributes.
  - The `themeColor` viewport meta still follows the OS preference, not the manual choice.
- **Images**:
  - Plain `<img>`, not `next/image`; the code carries an eslint-disable comment for this. Images load straight from the sprite CDN.
  - Each image has fixed `width`/`height`, `loading="lazy"` except the first `EAGER_COUNT`, `decoding="async"`, and a `loading | loaded | failed` state machine with an SVG placeholder on error.
- **Rendering performance**:
  - `memo` on `PokemonCard`.
  - `content-visibility: auto` with `contain-intrinsic-size` on cards.
  - Staggered `animate-card-in` using `animationDelay`, capped with `index % 24`.
  - `prefers-reduced-motion` turns animations off globally.
- **Forms**: Pokémon with `id >= 10000` are alternate forms. They get a "Form" badge, and their artwork is often missing.

<!-- END AUTO-MANAGED -->

<!-- AUTO-MANAGED: git-insights -->
## Git Insights

- **Next.js on purpose**: route handlers give a BFF in the same project and process as the UI, so there's nothing extra to deploy and the cache sits next to the endpoint that serves it.
- **Infinite scroll over virtualization**: rendering cards incrementally with `content-visibility: auto` is enough at this list size, and it keeps native scrolling, find-in-page and accessibility working.
- **One list request**: the browser never calls pokeapi.co. All data comes from `/api/pokemon` in one response, and images are built from IDs.
- `.claude/`, `.next/`, `next-env.d.ts` and `*.tsbuildinfo` are gitignored.
- Commit messages: imperative summary line, a blank line, then a bullet-list body describing behavior.

<!-- END AUTO-MANAGED -->

<!-- AUTO-MANAGED: best-practices -->
## Best Practices

- **Read the bundled docs first**: this Next.js version has breaking changes. Check `node_modules/next/dist/docs/` before using any Next.js API and follow deprecation notices (see AGENTS.md).
- **Keep the BFF boundary**: new data needs go through a route handler under `app/api/` backed by a server-only module in `lib/`. Client components must never fetch third-party APIs directly.
- **Keep caching in one place**: change freshness only through `REVALIDATE_SECONDS`, and keep the route's headers derived from it.
- **Keep failures non-fatal**: a failed upstream refresh must log and keep serving the last good data, never throw to the client while data exists.
- **Verify in the browser**: after UI changes, run the dev server and check light and dark mode, the error state (with its retry button) and missing-image placeholders.
- **Keep this file current**: update this file when commands, architecture or conventions change. Keep it specific and leave out version numbers and counts.

<!-- END AUTO-MANAGED -->

<!-- MANUAL -->
## Custom Notes

Add project-specific notes here. This section is never auto-modified.

@AGENTS.md

<!-- END MANUAL -->
