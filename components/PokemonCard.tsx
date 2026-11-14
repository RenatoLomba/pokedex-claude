"use client";

import { memo, useState } from "react";
import { formatId, formatName } from "@/lib/format";
import type { Pokemon } from "@/lib/types";

type SafeImageProps = {
  src: string;
  alt: string;
  size: number;
  className?: string;
  eager?: boolean;
  /** Stretch to fill the parent (the artwork) instead of rendering at `size` px (the icon). */
  fill?: boolean;
};

/** An <img> with fixed dimensions, lazy loading, a fade-in and a placeholder if the file is missing. */
function SafeImage({ src, alt, size, className = "", eager = false, fill = false }: SafeImageProps) {
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");

  if (state === "failed") {
    return (
      <div
        role="img"
        aria-label={`${alt} (image unavailable)`}
        style={fill ? undefined : { width: size, height: size }}
        className={`relative grid place-items-center ${fill ? "h-full w-full" : ""}`}
      >
        <svg viewBox="0 0 24 24" className="h-1/2 w-1/2 text-zinc-300 dark:text-zinc-700" aria-hidden="true">
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M2 12h7m6 0h7" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
    );
  }

  return (
    // Plain <img>: the browser loads straight from the sprite CDN, no image-optimizer round trip per card.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onLoad={() => setState("loaded")}
      onError={() => setState("failed")}
      className={`transition-opacity duration-500 ${state === "loaded" ? "opacity-100" : "opacity-0"} ${className}`}
    />
  );
}

export const PokemonCard = memo(function PokemonCard({
  pokemon,
  index,
  eager,
}: {
  pokemon: Pokemon;
  index: number;
  eager: boolean;
}) {
  const name = formatName(pokemon.name);
  const isForm = pokemon.id >= 10000;

  return (
    <li
      className="animate-card-in [content-visibility:auto] [contain-intrinsic-size:auto_320px]"
      style={{ animationDelay: `${(index % 24) * 20}ms` }}
    >
      <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm ring-brand-500/0 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:ring-2 hover:ring-brand-500/40 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
        <div className="relative aspect-square bg-gradient-to-br from-zinc-100 to-zinc-50 dark:from-zinc-800/70 dark:to-zinc-900">
          {/* Soft disc behind the artwork */}
          <div
            aria-hidden="true"
            className="absolute inset-[18%] rounded-full bg-white/70 blur-2xl transition duration-500 group-hover:scale-110 dark:bg-white/5"
          />
          <SafeImage
            src={pokemon.image}
            alt={`Official artwork of ${name}`}
            size={475}
            eager={eager}
            fill
            className="relative h-full w-full object-contain p-4 drop-shadow-md transition-transform duration-500 group-hover:scale-105"
          />
          <span className="absolute left-3 top-3 rounded-full bg-white/80 px-2.5 py-1 font-mono text-xs font-semibold text-zinc-700 backdrop-blur dark:bg-zinc-950/70 dark:text-zinc-300">
            {formatId(pokemon.id)}
          </span>
          {isForm && (
            <span className="absolute right-3 top-3 rounded-full bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white">
              Form
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-zinc-100 px-3 py-3 dark:border-zinc-800">
          <div className="shrink-0 rounded-xl bg-zinc-100 dark:bg-zinc-800">
            <SafeImage
              src={pokemon.icon}
              alt={`${name} sprite icon`}
              size={48}
              className="[image-rendering:pixelated]"
            />
          </div>
          <h2 className="min-w-0 truncate text-base font-semibold tracking-tight" title={name}>
            {name}
          </h2>
        </div>
      </article>
    </li>
  );
});
