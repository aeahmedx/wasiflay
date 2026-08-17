import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listRooms } from "@/lib/queries/messages";

export default async function RoomsPage() {
    const supabase = await createClient();
    const rooms = await listRooms(supabase);

    return (
        <main className="min-h-dvh bg-stone-50 px-4 py-6">
            <div className="max-w-md mx-auto">
                <h1 className="text-2xl font-semibold tracking-tight text-stone-900 mb-1">
                    Rooms
                </h1>
                <p className="text-stone-600 mb-6">Live conversation, right now.</p>

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