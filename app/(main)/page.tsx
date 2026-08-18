import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profiles.server";
import {
    getAuthorsFor,
    getLatestPosts,
    getTrendingPosts,
} from "@/lib/queries/posts";
import { PostCard } from "@/components/posts/post-card";

type Search = { tab?: string; all?: string };

export default async function HomePage({
                                           searchParams,
                                       }: {
    searchParams: Promise<Search>;
}) {
    const { tab, all } = await searchParams;
    const trending = tab === "trending";
    const allCities = all === "1";

    const supabase = await createClient();
    const profile = await getCurrentProfile();

    const city = allCities ? null : profile?.city ?? null;
    const posts = trending
        ? await getTrendingPosts(supabase, city)
        : await getLatestPosts(supabase, city);
    const authors = await getAuthorsFor(supabase, posts);

    const tabHref = (t: string) =>
        `/?tab=${t}${allCities ? "&all=1" : ""}`;

    return (
        <main className="min-h-dvh bg-stone-50 pb-24">
            <div className="max-w-md mx-auto px-4 pt-6">
                <div className="flex items-baseline justify-between mb-5">
                    <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
                        Wasif Lay
                    </h1>
                    {profile ? (
                        <Link
                            href="/rooms"
                            className="text-sm text-emerald-800 underline underline-offset-4"
                        >
                            Rooms
                        </Link>
                    ) : (
                        <Link
                            href="/signup"
                            className="text-sm text-emerald-800 underline underline-offset-4"
                        >
                            Sign in
                        </Link>
                    )}
                </div>

                {/* SPEC 3.1 — search is the centrepiece. */}
                <Link
                    href="/search"
                    className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3.5 py-3 text-stone-500 mb-5"
                >
                    <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" aria-hidden>
                        <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
                        <path
                            d="m13.5 13.5 3 3"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                        />
                    </svg>
                    Search lawyer, housing, mechanic…
                </Link>

                <div className="flex items-center justify-between mb-4">
                    <div className="flex gap-1">
                        {[
                            { key: "latest", label: "Latest" },
                            { key: "trending", label: "Trending" },
                        ].map((t) => {
                            const active = (t.key === "trending") === trending;
                            return (
                                <Link
                                    key={t.key}
                                    href={tabHref(t.key)}
                                    className={`rounded-full px-3.5 py-1.5 text-sm ${
                                        active
                                            ? "bg-stone-900 text-white"
                                            : "text-stone-600 hover:bg-stone-200"
                                    }`}
                                >
                                    {t.label}
                                </Link>
                            );
                        })}
                    </div>

                    {profile?.city && (
                        <Link
                            href={`/?tab=${trending ? "trending" : "latest"}${
                                allCities ? "" : "&all=1"
                            }`}
                            className="text-sm text-stone-600 underline underline-offset-4"
                        >
                            {allCities ? "All cities" : profile.city}
                        </Link>
                    )}
                </div>

                {posts.length === 0 ? (
                    <div className="rounded-lg border border-stone-200 bg-white px-4 py-8 text-center">
                        <p className="text-stone-600 mb-4">
                            {city
                                ? `No posts in ${city} yet.`
                                : "No posts yet."}
                        </p>
                        <Link
                            href="/create"
                            className="inline-block rounded-lg bg-emerald-800 px-4 py-2.5 font-medium text-white"
                        >
                            Ask the first question
                        </Link>
                    </div>
                ) : (
                    <ul className="space-y-2">
                        {posts.map((post) => (
                            <li key={post.id}>
                                <PostCard post={post} author={authors[post.author_id]} />
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {profile && (
                <Link
                    href="/create"
                    className="fixed bottom-6 right-6 rounded-full bg-emerald-800 px-5 py-3.5 font-medium text-white shadow-lg"
                >
                    Post
                </Link>
            )}
        </main>
    );
}