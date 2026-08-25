/**
 * How a prediction outcome looks, in one place.
 *
 * The profile list and the matches list show the same information and
 * were styled separately, which is how two lists of the same thing end
 * up looking like two different products. Shared here so they can't
 * drift.
 */

export const TIER_LABEL: Record<string, string> = {
  exact: "Exact",
  margin: "Margin",
  winner: "Winner",
  goals: "Goals",
  none: "Missed",
};

export const TIER_STYLE: Record<string, string> = {
  // Brand yellow is reserved for an exact call and for an action you can
  // still take. Everywhere else it would stop meaning anything.
  exact: "bg-amber-400 text-on-brand",
  margin: "bg-emerald-800 text-stone-0",
  winner: "bg-emerald-800 text-stone-0",
  goals: "bg-stone-200 text-stone-700",
  none: "bg-stone-100 text-stone-500",
};

/**
 * The colour rail down the left edge of a row. Lets someone scan a list
 * without reading it — which is what people actually do.
 */
export function railClass(opts: {
  finished: boolean;
  live?: boolean;
  open?: boolean;
  tier?: string | null;
  points?: number | null;
}): string {
  if (opts.finished) {
    if (opts.tier === "exact") return "bg-amber-400";
    if ((opts.points ?? 0) > 0) return "bg-emerald-800";
    return "bg-stone-200";
  }
  if (opts.live) return "bg-emerald-800";
  if (opts.open) return "bg-amber-400";
  return "bg-stone-300";
}
