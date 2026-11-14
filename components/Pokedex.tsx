"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { PokemonCard } from "./PokemonCard";
import { formatName } from "@/lib/format";
import type { Pokemon } from "@/lib/types";

/** Cards rendered per "page" of the infinite scroll. */
const PAGE_SIZE = 48;
/** Cards above the fold load their artwork eagerly; the rest are lazy. */
const EAGER_COUNT = 8;

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; pokemon: Pokemon[] };

export function Pokedex() {
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchList = useCallback(async () => {
    setLoad({ kind: "loading" });
    try {
      const res = await fetch("/api/pokemon"); // our BFF — never pokeapi.co directly
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      const pokemon = (await res.json()) as Pokemon[];
      setLoad({ kind: "ready", pokemon });
    } catch (err) {
      setLoad({ kind: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }, []);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const filtered = useMemo(() => {
    if (load.kind !== "ready") return [];
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return load.pokemon;
    const asNumber = q.replace(/^#/, "");
    return load.pokemon.filter(
      (p) =>
        p.name.includes(q.replace(/\s+/g, "-")) ||
        formatName(p.name).toLowerCase().includes(q) ||
        (/^\d+$/.test(asNumber) && String(p.id).startsWith(String(Number(asNumber)))),
    );
  }, [load, deferredQuery]);

  // Reset the window when the filter changes.
  useEffect(() => setVisible(PAGE_SIZE), [deferredQuery]);

  const hasMore = visible < filtered.length;

  // Infinite scroll: when the sentinel nears the viewport, render the next page.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible((v) => Math.min(v + PAGE_SIZE, filtered.length));
        }
      },
      { rootMargin: "1200px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, filtered.length, visible]);

  if (load.kind === "loading") return <LoadingGrid />;

  if (load.kind === "error") {
    return (
      <StatusPanel
        title="We couldn’t load the Pokédex"
        body={load.message}
        action={
          <button
            type="button"
            onClick={() => void fetchList()}
            className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            Try again
          </button>
        }
      />
    );
  }

  if (load.pokemon.length === 0) {
    return <StatusPanel title="No Pokémon yet" body="The server has no data to show right now." />;
  }

  const shown = filtered.slice(0, visible);

  return (
    <section aria-label="Pokémon list">
      <div className="sticky top-0 z-10 -mx-4 mb-6 bg-zinc-50/80 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 dark:bg-zinc-950/80">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block w-full sm:max-w-sm">
            <span className="sr-only">Search Pokémon by name or number</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            >
              <path
                fill="currentColor"
                d="M8.5 3a5.5 5.5 0 0 1 4.38 8.83l3.65 3.64a.75.75 0 1 1-1.06 1.06l-3.64-3.65A5.5 5.5 0 1 1 8.5 3Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"
              />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or #number"
              className="w-full rounded-full border border-zinc-200 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 dark:border-zinc-800 dark:bg-zinc-900"
            />
          </label>
          <p className="text-sm text-zinc-600 dark:text-zinc-400" aria-live="polite">
            Showing <span className="font-semibold text-zinc-900 dark:text-zinc-100">{shown.length}</span> of{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{filtered.length}</span>
          </p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <StatusPanel title="No matches" body={`Nothing matches “${deferredQuery}”.`} />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:gap-5">
          {shown.map((p, i) => (
            <PokemonCard key={p.id} pokemon={p} index={i} eager={i < EAGER_COUNT} />
          ))}
        </ul>
      )}

      {hasMore && (
        <div ref={sentinelRef} className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((v) => Math.min(v + PAGE_SIZE, filtered.length))}
            className="rounded-full border border-zinc-200 bg-white px-5 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:shadow dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
          >
            Load more
          </button>
        </div>
      )}
    </section>
  );
}

function LoadingGrid() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading Pokémon…</span>
      <div className="mb-6 h-11 w-full max-w-sm animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" aria-hidden="true">
        {Array.from({ length: 15 }, (_, i) => (
          <li
            key={i}
            className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="aspect-square animate-pulse bg-zinc-100 dark:bg-zinc-800/70" />
            <div className="flex items-center gap-3 px-3 py-3">
              <div className="h-12 w-12 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
              <div className="h-4 w-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusPanel({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-3xl border border-dashed border-zinc-300 px-6 py-16 text-center dark:border-zinc-700">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{body}</p>
      {action}
    </div>
  );
}
