import Link from "next/link";
import { kickoffLabel, ROUND_LABEL, type Match } from "@/lib/queries/predictions";

/**
 * One match in a list. Deliberately dense — the point of a list is
 * scanning, so what matters is the teams, the state, and whether you
 * have a pick on it.
 */
export function MatchRow({ match }: { match: Match }) {
  const finished = match.status === "finished";
  const hasPick = match.my_home !== null;
  const points = match.my_points;

  return (
    <Link
      href={`/matches/${match.id}`}
      className="block rounded-lg border border-stone-200 bg-stone-0 px-4 py-3 hover:border-stone-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-stone-900" dir="auto">
            {match.home_team}
            {finished
              ? ` ${match.home_score}\u2013${match.away_score} `
              : " v "}
            {match.away_team}
          </p>
          <p className="mt-0.5 text-sm text-stone-600">
            {kickoffLabel(match.kicks_off_at)}
            {match.round !== "group" ? ` · ${ROUND_LABEL[match.round]}` : ""}
            {match.prediction_count >= 10
              ? ` · ${match.prediction_count} picks`
              : ""}
          </p>
        </div>

        {finished && hasPick && points !== null ? (
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums ${
              points > 0
                ? "bg-emerald-800 text-stone-0"
                : "bg-stone-100 text-stone-500"
            }`}
          >
            {points > 0 ? `+${points}` : "0"}
          </span>
        ) : hasPick ? (
          <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-sm font-medium tabular-nums text-stone-800">
            {match.my_home}
            {"\u2013"}
            {match.my_away}
          </span>
        ) : match.is_open ? (
          <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-sm font-medium text-amber-900">
            Predict
          </span>
        ) : null}
      </div>
    </Link>
  );
}
