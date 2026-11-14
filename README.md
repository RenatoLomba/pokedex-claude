# Pokédex

A modern Pokédex: one card per Pokémon (≈1,300+, alternate forms included) with name, sprite icon and official artwork.

**Stack:** Next.js 16 (App Router) + React 19 + Tailwind CSS 4, all TypeScript. I picked Next.js because its route handlers give you a backend-for-frontend in the same project and process as the UI. There's nothing extra to deploy, and the in-memory cache lives right next to the endpoint that serves it.

## Run it

Requires Node.js 20.9+.

```bash
npm install
npm run dev        # http://localhost:3000
```

Production:

```bash
npm run build
npm start
```

The BFF endpoint is `GET /api/pokemon`. It returns `[{ id, name, icon, image }, …]`.

## How the BFF cache works

```
Browser ──► /api/pokemon (app/api/pokemon/route.ts)
                 │
                 ▼
        getPokemonList()  (lib/pokemon.ts) ── in-memory cache on globalThis
                 │  only when empty or stale
                 ▼
        GET https://pokeapi.co/api/v2/pokemon?limit=100000&offset=0
```

- The browser only talks to `/api/pokemon`; it never calls pokeapi.co. Images load from the PokeAPI sprites repo on `raw.githubusercontent.com`, using URLs built from each entry's ID. There are no per-Pokémon API calls.
- **Transform:** the server takes the ID from the end of each `url` and builds `icon` (`…/sprites/pokemon/{id}.png`) and `image` (`…/sprites/pokemon/other/official-artwork/{id}.png`).
- **Stale-while-revalidate, 1 hour:** `REVALIDATE_SECONDS = 3600` is defined at the top of [`lib/pokemon.ts`](lib/pokemon.ts). It's the only place to change it. The route reuses it for its `Cache-Control` header.
  - Data younger than 3600 s is served straight from memory (`X-Cache: HIT`).
  - Older data is still served right away (`X-Cache: STALE`), and one background refresh starts. Concurrent requests share that refresh, so it's a single PokéAPI call.
  - Only the very first request after the server starts waits for PokéAPI (`X-Cache: MISS`).
- **Failure handling:** if PokéAPI errors, returns bad data, or takes more than 10 s (`AbortSignal.timeout`), the error is logged (`[pokemon-cache] refresh failed…`) and the last good list keeps being served. The next retry waits 60 s, so the server doesn't hammer PokéAPI. The endpoint returns an error (503) only if it has never had good data since startup. The UI then shows an error state with a retry button.
- The cache is per server process and resets on restart. No database or extra services are needed. It also sets `Cache-Control: public, s-maxage=3600, stale-while-revalidate=3600`, so a CDN in front of the app can apply the same window.

## Frontend notes

- **Infinite scroll:** the full list (~100 KB gzipped) arrives in one BFF call. Cards render 48 at a time, and an `IntersectionObserver` adds more as you approach the bottom (there's also a "Load more" button for keyboard users). The first render stays small, and search across all Pokémon (name or `#number`) is instant on the client. Plain infinite scroll was chosen over virtualization because 1,300 cards is manageable with `content-visibility: auto`, and it keeps native scrolling, find-in-page and accessibility intact.
- **Images:** native `<img>` with fixed `width`/`height` and an `aspect-square` frame, so there's no layout shift. Images use `loading="lazy"` except the first 8. They fade in on load, and a placeholder appears if a file is missing (common for forms with IDs ≥ 10000).
- **Style:** responsive grid (2 to 5 columns), Inter type scale, hover lift and artwork zoom, staggered entrance animation (turned off under `prefers-reduced-motion`), and dark mode that follows the system setting. Alt text is "Official artwork of X" and "X sprite icon".

## Files

| Path | Role |
| --- | --- |
| `lib/pokemon.ts` | PokéAPI fetch, transform, SWR cache (`REVALIDATE_SECONDS`) |
| `app/api/pokemon/route.ts` | BFF endpoint |
| `components/Pokedex.tsx` | Data loading, search, infinite scroll, loading/empty/error states |
| `components/PokemonCard.tsx` | Card and image-with-fallback |
| `lib/format.ts` | `"mr-mime"` → `"Mr Mime"`, `25` → `#0025` |
