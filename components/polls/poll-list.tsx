import { createClient } from "@/lib/supabase/server";
import { getOpenPolls } from "@/lib/queries/polls";
import { PollCard } from "@/components/polls/poll-card";

/**
 * Open polls, above the feed.
 *
 * Renders nothing when there are none — and a poll with no options is
 * not returned by open_polls(), so both seeded polls stay invisible
 * until candidates are added.
 */
export async function PollList({ signedIn }: { signedIn: boolean }) {
  const supabase = await createClient();
  const polls = await getOpenPolls(supabase);

  if (polls.length === 0) return null;

  return (
    <div className="mb-5 space-y-3">
      {polls.map((poll) => (
        <PollCard key={poll.id} poll={poll} signedIn={signedIn} />
      ))}
    </div>
  );
}
