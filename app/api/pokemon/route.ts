import { NextResponse } from "next/server";
import { getPokemonList, REVALIDATE_SECONDS } from "@/lib/pokemon";

// The handler reads the in-memory cache on every request; the cache decides when to call PokéAPI.
export const dynamic = "force-dynamic";

export async function GET() {
  const { data, status, fetchedAt } = await getPokemonList();

  if (!data) {
    // Only happens when PokéAPI has never answered successfully since the server started.
    return NextResponse.json(
      { error: "Pokémon data is not available yet. Please try again shortly." },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "10" } },
    );
  }

  return NextResponse.json(data, {
    headers: {
      "X-Cache": status,
      "X-Cache-Fetched-At": new Date(fetchedAt!).toISOString(),
      // Lets a CDN in front of the app apply the same 1-hour SWR window.
      "Cache-Control": `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=${REVALIDATE_SECONDS}`,
    },
  });
}
