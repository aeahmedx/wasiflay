/**
 * Realtime load test.
 *
 *   node scripts/loadtest.mjs
 *   CONCURRENCY=2000 ROOM_SLUG=general node scripts/loadtest.mjs
 *
 * Opens N websocket subscribers to one room, then sends probe messages
 * with the service role key and measures how many subscribers receive
 * each one and how long it took.
 *
 * Reads .env.local. Requires SUPABASE_SERVICE_ROLE_KEY for the writes,
 * so run it locally only — never in CI or from a browser.
 *
 * macOS file-descriptor ceiling: `ulimit -n 10240` before a 2000 run.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// ---- config --------------------------------------------------------
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 500);
const ROOM_SLUG = process.env.ROOM_SLUG ?? "general";
const PROBES = Number(process.env.PROBES ?? 5);
const RAMP_BATCH = 50;
const RAMP_PAUSE_MS = 200;
const SETTLE_MS = 3000;
const PROBE_WAIT_MS = 5000;

// ---- env -----------------------------------------------------------
function loadEnv() {
  const env = {};
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const i = trimmed.indexOf("=");
      if (i === -1) continue;
      env[trimmed.slice(0, i)] = trimmed.slice(i + 1).replace(/^["']|["']$/g, "");
    }
  } catch {
    console.error("Could not read .env.local. Run from the project root.");
    process.exit(1);
  }
  return env;
}

const env = loadEnv();
const URL = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON || !SERVICE) {
  console.error("Missing Supabase env vars in .env.local.");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- run -----------------------------------------------------------
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

const { data: room, error: roomError } = await admin
  .from("rooms")
  .select("id, name, slug")
  .eq("slug", ROOM_SLUG)
  .maybeSingle();

if (roomError) {
  console.error(`\nQuery failed: ${roomError.message}`);
  if (roomError.hint) console.error(`Hint: ${roomError.hint}`);
  if (roomError.code === "42501") {
    console.error("\nservice_role lacks table privileges. Run migration 0002.");
  }
  process.exit(1);
}
if (!room) {
  console.error(`Room "${ROOM_SLUG}" does not exist. Check the rooms table.`);
  process.exit(1);
}

const { data: author, error: authorError } = await admin
  .from("profiles")
  .select("id")
  .limit(1)
  .maybeSingle();

if (authorError) {
  console.error(`\nProfile lookup failed: ${authorError.message}`);
  process.exit(1);
}
if (!author) {
  console.error("No profile exists to author probe messages. Sign up first.");
  process.exit(1);
}

console.log(`\nRoom: ${room.name} (${room.slug})`);
console.log(`Target subscribers: ${CONCURRENCY}\n`);

const clients = [];
const received = new Map(); // probe body -> { count, firstMs, lastMs }
let subscribed = 0;
let failed = 0;

function record(body) {
  const entry = received.get(body);
  if (!entry) return;
  const elapsed = Date.now() - entry.sentAt;
  entry.count += 1;
  if (entry.firstMs === null) entry.firstMs = elapsed;
  entry.lastMs = elapsed;
}

async function openSubscriber(i) {
  const client = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  clients.push(client);

  return new Promise((resolve) => {
    let settled = false;
    const done = (ok) => {
      if (settled) return;
      settled = true;
      ok ? subscribed++ : failed++;
      resolve();
    };

    client
      .channel(`load:${room.id}:${i}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => record(payload.new?.body)
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") done(true);
        else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        )
          done(false);
      });

    setTimeout(() => done(false), 20000);
  });
}

// Ramp up in batches so we're testing the server, not our own event loop.
const started = Date.now();
for (let i = 0; i < CONCURRENCY; i += RAMP_BATCH) {
  const batch = [];
  for (let j = i; j < Math.min(i + RAMP_BATCH, CONCURRENCY); j++) {
    batch.push(openSubscriber(j));
  }
  await Promise.all(batch);
  process.stdout.write(
    `\r  connected ${subscribed}/${CONCURRENCY}  failed ${failed}`
  );
  await sleep(RAMP_PAUSE_MS);
}

console.log(`\n  ramp took ${((Date.now() - started) / 1000).toFixed(1)}s\n`);
await sleep(SETTLE_MS);

if (subscribed === 0) {
  console.error("No subscribers connected. Aborting.");
  process.exit(1);
}

// ---- probes --------------------------------------------------------
console.log("Sending probes…\n");

for (let p = 0; p < PROBES; p++) {
  const body = `loadtest-probe-${Date.now()}-${p}`;
  received.set(body, {
    count: 0,
    firstMs: null,
    lastMs: null,
    sentAt: Date.now(),
  });

  const { error } = await admin
    .from("messages")
    .insert({ room_id: room.id, author_id: author.id, body });

  if (error) {
    console.error(`  probe ${p + 1} insert failed: ${error.message}`);
    continue;
  }

  await sleep(PROBE_WAIT_MS);

  const r = received.get(body);
  const pct = ((r.count / subscribed) * 100).toFixed(1);
  console.log(
    `  probe ${p + 1}: ${r.count}/${subscribed} (${pct}%)  ` +
      `first ${r.firstMs ?? "—"}ms  last ${r.lastMs ?? "—"}ms`
  );
}

// ---- summary -------------------------------------------------------
const totals = [...received.values()];
const avgDelivery =
  totals.reduce((s, r) => s + r.count / subscribed, 0) / totals.length;
const latencies = totals.map((r) => r.lastMs).filter((v) => v !== null);
const worst = latencies.length ? Math.max(...latencies) : null;

console.log(`\n${"─".repeat(46)}`);
console.log(`  subscribers connected  ${subscribed}/${CONCURRENCY}`);
console.log(`  connection failures    ${failed}`);
console.log(`  avg delivery rate      ${(avgDelivery * 100).toFixed(1)}%`);
console.log(`  worst-case latency     ${worst ?? "—"}ms`);
console.log(`${"─".repeat(46)}`);
console.log(
  avgDelivery > 0.95 && (worst ?? 0) < 3000
    ? "\n  PASS — realtime holds at this concurrency.\n"
    : "\n  INVESTIGATE — delivery or latency is below target.\n"
);

// ---- cleanup -------------------------------------------------------
await admin
  .from("messages")
  .delete()
  .eq("room_id", room.id)
  .like("body", "loadtest-probe-%");

for (const c of clients) await c.removeAllChannels();
process.exit(0);
