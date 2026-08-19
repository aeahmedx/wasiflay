import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listRooms } from "@/lib/queries/messages";
import { getCurrentProfile } from "@/lib/queries/profiles.server";
import { BackLink } from "@/components/back-link";

export default async function RoomsPage() {
  const supabase = await createClient();
  const [rooms, profile] = await Promise.all([
    listRooms(supabase),
    getCurrentProfile(),
  ]);

  return (
    <main className="min-h-dvh bg-stone-50 px-4 py-6">
      <div className="max-w-md mx-auto">
        <BackLink />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900 mb-1">
          Rooms
        </h1>
        <p className="text-stone-600 mb-6">Live conversation, right now.</p>

        {/*
          Readable signed out. Someone who lands here from a shared link
          should see the conversation first and be asked to sign in when
          they want to join it — not before.
        */}
        {!profile && (
          <div className="mb-5 rounded-lg border border-stone-200 bg-white px-4 py-4">
            <p className="text-stone-700">
              You can read along without an account. Sign in to join in.
            </p>
            <Link
              href="/signup?next=%2Frooms"
              className="mt-3 inline-block rounded-lg bg-emerald-800 px-4 py-2.5 font-medium text-white"
            >
              Sign in
            </Link>
          </div>
        )}

        {rooms.length === 0 ? (
          <p className="text-stone-500">
            No rooms are open. Check back during an event.
          </p>
        ) : (
          <ul className="space-y-2">
            {rooms.map((room) => (
              <li key={room.id}>
                <Link
                  href={`/rooms/${room.slug}`}
                  className="block rounded-lg border border-stone-200 bg-white px-4 py-4 hover:border-stone-300"
                >
                  <span className="font-medium text-stone-900">
                    {room.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
