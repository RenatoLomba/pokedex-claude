import { Pokedex } from "@/components/Pokedex";

export default function Home() {
  return (
    <main className="mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-500">
          National Pokédex
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Gotta browse ’em all</h1>
        <p className="max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
          Every Pokémon and alternate form, with official artwork. Data is cached on our server and refreshed hourly.
        </p>
      </header>
      <Pokedex />
    </main>
  );
}
