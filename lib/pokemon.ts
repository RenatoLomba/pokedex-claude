/**
 * Server-only BFF data layer: fetches the full Pokémon list from PokéAPI,
 * transforms it, and keeps it in an in-memory stale-while-revalidate cache.
 */
import type { Pokemon } from "./types";

/** How long cached data counts as fresh. After this it is served stale while a background refresh runs. */
export const REVALIDATE_SECONDS = 3600;

/** Abort a PokéAPI request that takes longer than this. */
const FETCH_TIMEOUT_MS = 10_000;

/** After a failed refresh, wait this long before trying PokéAPI again (avoids hammering it on every request). */
const RETRY_AFTER_FAILURE_MS = 60_000;

/** Shorter cool-down when there is no data at all, so a cold start recovers quickly. */
const COLD_RETRY_AFTER_FAILURE_MS = 10_000;

const LIST_URL = "https://pokeapi.co/api/v2/pokemon?limit=100000&offset=0";
const SPRITE_BASE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

type ListResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: { name: string; url: string }[];
};

type CacheEntry = { data: Pokemon[]; fetchedAt: number };

type CacheState = {
  entry?: CacheEntry;
  inflight?: Promise<CacheEntry | undefined>;
  lastFailureAt?: number;
};

// Kept on globalThis so the cache survives dev hot-reloads and is shared by every route in the process.
const globalForCache = globalThis as typeof globalThis & { __pokemonCache?: CacheState };
const state: CacheState = (globalForCache.__pokemonCache ??= {});

export function toPokemon(entry: { name: string; url: string }): Pokemon | null {
  const id = entry.url.split("/").filter(Boolean).pop();
  if (!id || !/^\d+$/.test(id)) return null;
  return {
    id: Number(id),
    name: entry.name,
    icon: `${SPRITE_BASE}/${id}.png`, // small 96x96 sprite
    image: `${SPRITE_BASE}/other/official-artwork/${id}.png`, // 475x475 official artwork
  };
}

async function fetchFromPokeAPI(): Promise<Pokemon[]> {
  const res = await fetch(LIST_URL, {
    cache: "no-store", // this module owns caching; don't double-cache in Next's data cache
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`PokéAPI responded with HTTP ${res.status}`);

  const json = (await res.json()) as ListResponse;
  if (!Array.isArray(json?.results)) throw new Error("PokéAPI response had no results array");

  const list = json.results.map(toPokemon).filter((p): p is Pokemon => p !== null);
  if (list.length === 0) throw new Error("PokéAPI returned an empty list");
  return list;
}

/** Start a refresh, or join the one already running, so concurrent requests trigger only one PokéAPI call. */
function refresh(): Promise<CacheEntry | undefined> {
  state.inflight ??= fetchFromPokeAPI()
    .then((data) => {
      state.entry = { data, fetchedAt: Date.now() };
      state.lastFailureAt = undefined;
      console.info(`[pokemon-cache] refreshed: ${data.length} Pokémon`);
      return state.entry;
    })
    .catch((err: unknown) => {
      // Keep serving the last good data; only log.
      state.lastFailureAt = Date.now();
      console.error(
        `[pokemon-cache] refresh failed${state.entry ? ", serving last good data" : ", no cached data yet"}:`,
        err instanceof Error ? err.message : err,
      );
      return state.entry;
    })
    .finally(() => {
      state.inflight = undefined;
    });
  return state.inflight;
}

export type CacheStatus = "HIT" | "STALE" | "MISS";

export async function getPokemonList(): Promise<{
  data: Pokemon[] | null;
  status: CacheStatus;
  fetchedAt: number | null;
}> {
  const entry = state.entry;

  // Cold start: nothing cached yet, so the first request has to wait.
  if (!entry) {
    const recentlyFailed =
      state.lastFailureAt !== undefined && Date.now() - state.lastFailureAt < COLD_RETRY_AFTER_FAILURE_MS;
    const fresh = recentlyFailed && !state.inflight ? undefined : await refresh();
    return { data: fresh?.data ?? null, status: "MISS", fetchedAt: fresh?.fetchedAt ?? null };
  }

  const ageMs = Date.now() - entry.fetchedAt;
  if (ageMs < REVALIDATE_SECONDS * 1000) {
    return { data: entry.data, status: "HIT", fetchedAt: entry.fetchedAt };
  }

  // Stale: answer now with what we have, refresh in the background.
  const canRetry =
    state.lastFailureAt === undefined || Date.now() - state.lastFailureAt >= RETRY_AFTER_FAILURE_MS;
  if (canRetry) void refresh();
  return { data: entry.data, status: "STALE", fetchedAt: entry.fetchedAt };
}
