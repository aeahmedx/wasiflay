"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  COMMON_SEARCHES,
  searchAll,
  type SearchResponse,
} from "@/lib/queries/search";
import type { Region } from "@/lib/queries/regions";
import { regionName } from "@/lib/queries/regions";

const DEBOUNCE_MS = 300;
const EMPTY: SearchResponse = { listings: [], posts: [], total: 0 };

type Status = "idle" | "searching" | "done" | "error";

export function SearchView({
  regions,
  defaultRegion,
}: {
  regions: Region[];
  defaultRegion: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<string | null>(defaultRegion);
  const [results, setResults] = useState<SearchResponse>(EMPTY);
  const [status, setStatus] = useState<Status>("idle");

  // Guards against out-of-order responses: a slow "law" resolving after a
  // fast "lawyer" would otherwise overwrite the newer results.
  const requestId = useRef(0);

  const run = useCallback(
    async (q: string, r: string | null) => {
      const trimmed = q.trim();
      const id = ++requestId.current;

      if (trimmed.length === 0) {
        setResults(EMPTY);
        setStatus("idle");
        return;
      }

      setStatus("searching");
      try {
        const found = await searchAll(supabase, trimmed, r);
        if (id !== requestId.current) return; // superseded
        setResults(found);
        setStatus("done");
      } catch {
        if (id !== requestId.current) return;
        setResults(EMPTY);
        setStatus("error");
      }
    },
    [supabase]
  );

  // Debounced search on query or region change.
  useEffect(() => {
    const timer = setTimeout(() => void run(query, region), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, region, run]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const trimmed = query.trim();
  const showEmptyState = status === "done" && results.total === 0;
  const encoded = encodeURIComponent(trimmed);

  return (
    <main className="min-h-dvh bg-stone-50">
      <div className="max-w-md mx-auto px-4 pt-5 pb-16">
        {/* Search input */}
        <div className="relative">
          <svg
            viewBox="0 0 20 20"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400"
            fill="none"
            aria-hidden
          >
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="m13.5 13.5 3 3"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            dir="auto"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder="What do you need?"
            aria-label="Search"
            className="w-full rounded-lg border border-stone-300 bg-stone-0 py-3 pl-10 pr-10 text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-800"
          />
          {query.length > 0 && (
            <button
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-stone-400 hover:text-stone-700"
            >
              <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" aria-hidden>
                <path
                  d="m4 4 8 8M12 4l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Region scope */}
        <div className="mt-4 flex items-center gap-2">
          <label htmlFor="search-region" className="sr-only">
            Region
          </label>
          <select
            id="search-region"
            value={region ?? "all"}
            onChange={(e) =>
              setRegion(e.target.value === "all" ? null : e.target.value)
            }
            // Native selects carry their own internal padding on top of
            // ours, which pushed the label a hair right of the search
            // field's edge above it.
            style={{ textIndent: "-1px" }}
            className="rounded-full border border-stone-300 bg-stone-0 py-1.5 pl-3 pr-8 text-sm text-stone-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-800"
          >
            <option value="all">All regions</option>
            {regions.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.name}
              </option>
            ))}
          </select>
          {status === "searching" && (
            <span className="text-sm text-stone-500">Searching…</span>
          )}
        </div>

        {/* Idle: suggestion chips */}
        {status === "idle" && (
          <div className="mt-8">
            <p className="text-sm text-stone-500 mb-3">Try</p>
            <div className="flex flex-wrap gap-2">
              {COMMON_SEARCHES.slice(0, 12).map((term) => (
                <button
                  key={term}
                  onClick={() => setQuery(term)}
                  className="rounded-full border border-stone-300 bg-stone-0 px-3.5 py-1.5 text-sm text-stone-700 hover:border-stone-400"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}

        {status === "error" && (
          <div
            role="alert"
            className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            Search isn&apos;t responding. Check your connection and try again.
          </div>
        )}

        {/* Results */}
        {results.listings.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-sm font-medium text-stone-700">
              People &amp; businesses
            </h2>
            <ul className="space-y-2">
              {results.listings.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/listings/${r.id}`}
                    className="block rounded-lg border border-stone-200 bg-stone-0 px-4 py-3.5 hover:border-stone-300"
                  >
                    <p className="font-medium text-stone-900" dir="auto">
                      {r.title}
                    </p>
                    <p className="mt-0.5 text-sm text-stone-600" dir="auto">
                      {r.subtitle}
                      {r.region
                        ? ` · ${regionName(regions, r.region)}`
                        : " · All regions"}
                    </p>
                    <p className="mt-1 text-sm text-stone-500">
                      {r.metric === 0
                        ? "No vouches yet"
                        : `${r.metric} community ${
                            r.metric === 1 ? "vouch" : "vouches"
                          }`}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-stone-500">
              Community-submitted. Wasif Lay does not verify credentials.
            </p>
          </section>
        )}

        {results.posts.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-sm font-medium text-stone-700">
              Discussions
            </h2>
            <ul className="space-y-2">
              {results.posts.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/posts/${r.id}`}
                    className="block rounded-lg border border-stone-200 bg-stone-0 px-4 py-3.5 hover:border-stone-300"
                  >
                    <p className="font-medium leading-snug text-stone-900" dir="auto">
                      {r.title}
                    </p>
                    <p className="mt-1 text-sm text-stone-500 capitalize">
                      {r.subtitle}
                      {r.region
                        ? ` · ${regionName(regions, r.region)}`
                        : " · All regions"}{" "}
                      · {r.metric} {r.metric === 1 ? "answer" : "answers"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/*
          SPEC 4.3 — the most important empty state in the app. Someone at
          a booth types "housing", finds nothing, and either walks away or
          creates the thing they were looking for. Never a blank screen.
        */}
        {showEmptyState && (
          <div className="mt-8 rounded-lg border border-stone-200 bg-stone-0 px-4 py-6">
            <p className="text-stone-800" dir="auto">
              Nothing for “{trimmed}” yet.
            </p>
            <p className="mt-1 text-sm text-stone-600">
              You&apos;d be the first. That&apos;s how this fills up.
            </p>

            <div className="mt-4 flex flex-col gap-2">
              <Link
                href={`/create?q=${encoded}`}
                className="rounded-lg bg-emerald-800 px-4 py-3 text-center font-medium text-stone-0"
              >
                Ask the community
              </Link>
              {/* "Add a listing" belongs here too (SPEC 4.3), but the
                  listings routes don't exist yet. A 404 at the moment
                  someone decides to contribute is worse than one button.
                  Restore it with the listings slice. */}
            </div>

            {region !== null && (
              <button
                onClick={() => setRegion(null)}
                className="mt-4 text-sm text-emerald-800 underline underline-offset-4"
              >
                Search all regions instead
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
