#!/usr/bin/env bash
# Prints a fingerprint of every file that has had multiple versions this
# session. Run from the project root and paste the whole output back.

echo "=== WASIF LAY: what am I actually running? ==="
echo

mark () {  # file, label, pattern
  if [ ! -f "$1" ]; then
    printf '  %-34s MISSING\n' "$2"
  elif grep -q "$3" "$1" 2>/dev/null; then
    printf '  %-34s yes\n' "$2"
  else
    printf '  %-34s no\n' "$2"
  fi
}

echo "-- tournament block generation --"
mark "components/matches/tournament-block.tsx" "block: nextSlot (newest)"      "nextSlot"
mark "components/matches/tournament-block.tsx" "block: recent"                 "recent: Match\[\]"
mark "components/matches/tournament-block.tsx" "block: upcoming (older)"       "upcoming: Match\[\]"
mark "components/matches/now-block.tsx"        "now-block: getNextSlot"        "getNextSlot"
mark "components/matches/now-block.tsx"        "now-block: getRecentResults"   "getRecentResults"
mark "lib/queries/predictions.ts"              "queries: getNextSlot"          "getNextSlot"
mark "lib/queries/predictions.ts"              "queries: countUpcoming"        "countUpcoming"
mark "lib/queries/predictions.ts"              "queries: setRoomChat"          "setRoomChat"
echo

echo "-- gate --"
mark "components/gate/gate-view.tsx"       "gate: countdown above welcome"  "Everything opens in"
mark "components/gate/gate-view.tsx"       "gate: mounts install card"      "GateInstall"
mark "components/gate/gate-view.tsx"       "gate: takes match list"         "GateMatch\[\]"
mark "components/gate/gate-install.tsx"    "install: always visible"        "if (installed) return null"
mark "components/gate/gate-match-list.tsx" "match list: slot rail"          "meridiem"
mark "app/gate/page.tsx"                   "gate page: fetches matches"     "getGateMatches"
mark "lib/queries/gate.ts"                 "gate queries: GateMatch"        "GateMatch"
echo

echo "-- rooms --"
mark "components/rooms/room-view.tsx"      "room-view: uses room gate"      "room-gate"
mark "components/rooms/room-view.tsx"      "room-view: goal via send"       "onGoalAction"
mark "components/rooms/room-view.tsx"      "room-view: OLD banner import"   "match-room-banner"
mark "components/rooms/room-gate.tsx"      "room gate exists"               "RoomGate"
mark "components/rooms/chat-state-watch.tsx" "chat state watch exists"      "ChatStateWatch"
echo

echo "-- share / og --"
mark "lib/og.ts"                           "lib/og.ts exists"               "OG_IMAGE"
mark "app/layout.tsx"                      "layout imports OG_IMAGE"        "lib/og"
mark "app/gate/page.tsx"                   "gate page has og image"         "images: \[OG_IMAGE\]"
mark "app/rules/page.tsx"                  "rules page has og image"        "images: \[OG_IMAGE\]"
echo

echo "-- pages --"
mark "app/(main)/page.tsx"                 "home mounts NowBlock"           "NowBlock"
mark "app/(main)/page.tsx"                 "home: one feed flag"            "REGIONS_ENABLED"
mark "app/(main)/profile/[id]/page.tsx"    "profile has picks tab"          "PickList"
mark "app/(main)/layout.tsx"               "gate enforced in layout"        "shouldShowGate"
mark "app/(main)/layout.tsx"               "onboarding tour mounted"        "OnboardingTour"
mark "app/(auth)/onboarding/page.tsx"      "city example = New York"        "New York City"
echo

echo "-- observability --"
mark "instrumentation-client.ts"           "sentry client"                  "Sentry.init"
mark "components/analytics/posthog-provider.tsx" "posthog provider"         "PostHogProvider"
mark "next.config.ts"                      "sentry wrapper"                 "withSentryConfig"
mark "next.config.ts"                      "deprecated option removed"      "disableLogger"
echo

echo "-- files that should NOT exist --"
for f in components/matches/tournament-hero.tsx \
         components/rooms/match-room-banner.tsx \
         components/matches/match-now.tsx \
         components/matches/result-block.tsx \
         components/notifications/sms-opt-in-card.tsx \
         app/opengraph-image.tsx app/opengraph-image.ts; do
  [ -f "$f" ] && printf '  STILL THERE: %s\n' "$f"
done
echo "  (nothing listed above = clean)"
echo

echo "=== end ==="
