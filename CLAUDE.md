# Wasif Lay — Project Instructions

Read this file fully before writing code. It is the source of truth.
Feature detail lives in `SPEC.md`. Reference it by section number.

---

## 1. What this is

Wasif Lay is a community coordination platform for the Sudanese diaspora.
It turns scattered WhatsApp conversations into a searchable, permanent,
trusted knowledge layer — and pairs it with live chat rooms that give
people a reason to open the app in the first place.

The name renders exactly as **Wasif Lay** everywhere in the UI. Never
"WASIF Lay", "Wasi Lay", or "WasifLay". Code namespace is `wasiflay`.

**The two-surface rule — the single most important architectural constraint:**

| Surface       | Content            | Lifetime     | Searchable |
|---------------|--------------------|--------------|------------|
| **Live**      | rooms, messages    | ephemeral    | no         |
| **Community** | posts, listings    | permanent    | yes        |

These never share a feed. Live chat is high-volume and disposable;
posts and listings are low-volume and permanent. Mixing them buries the
knowledge layer under banter within hours and falsifies the entire product
premise. One identity spans both — same profile, same name, same counts.

---

## 2. Stack — locked, do not propose alternatives

- **Next.js 15**, App Router, TypeScript, Server Components by default
- **Tailwind CSS** — core utility classes only
- **Supabase** — Postgres, Auth, Realtime, Storage
- **Vercel** — hosting, auto-deploy from `main`
- **Sentry** — error tracking
- **PostHog** — product analytics

No Redux, no tRPC, no ORM, no component library. Supabase client directly.

---

## 3. Database contract

Migration `supabase/migrations/0001_init.sql` is authoritative. Do not
alter the schema inline — write a new numbered migration file.

### Tables
`profiles` · `posts` · `answers` · `votes` · `listings` · `vouches` ·
`rooms` · `messages` · `reports` · `notifications`

### Non-negotiable rules

**Join to `public_profiles`, NEVER to `profiles`.**
The base table has column-level grants that hide `city`,
`date_of_birth`, `is_minor`, and `is_banned` from clients. The
`public_profiles` view is the only correct source for display data.
It automatically nulls `city` for under-18 accounts. A query selecting
`city` from `profiles` will fail or return null — that is intentional.

**Moderation and role changes go through RPCs, never UPDATE.**
Clients cannot write `is_removed`, `is_banned`, or `role`. Use:
- `mod_remove(target_type, id)` / `mod_restore(target_type, id)`
- `mod_set_ban(user_id, boolean)`
- `mod_resolve_report(report_id, status)`
- `admin_set_role(user_id, role)`

**Counts are trigger-owned.** Never write `answer_count`,
`helpful_count`, `contribution_count`, or `vouch_count` from the client.
They are recomputed by database triggers and clients have no grant on them.

**Search is one RPC.** `search_all(q, filter_city)` returns a unified
result set with listings ranked above posts. Do not write ad-hoc search
queries. Do not use `ilike` scans for the search bar.

**Nothing is hard-deleted.** Moderation sets `is_removed = true`.
Staff can still read removed rows; everyone else cannot.

**Rate limits live in the database.** 5 messages / 10s, 3 posts / 60s.
They raise `P0001` with a message starting `RATE_LIMIT:`. Catch this
specific error and show a friendly "slow down" toast — do not surface
the raw error.

---

## 4. Hard rules for all generated code

**Storage**
- NEVER use `localStorage` or `sessionStorage`. Not supported.
- Client state is React state. Persistent state is Supabase.

**Every network call** has three states: loading, error, retry.
No exceptions. A bare `await` with no error path is a bug.

**Every list** has an explicit empty state with a call to action.
Never render a blank div. "No listings yet — be the first to add one."

**Every major surface** is wrapped in an error boundary. A crash in the
chat room shows "Chat is having trouble — tap to reload". It never
white-screens the app.

**Optimistic UI on message send.** Render immediately with a pending
state, reconcile when the insert returns, mark failed on error.

**Text is RTL-safe.** Content is mixed Arabic/English. Use
`dir="auto"` on every element rendering user-generated text.

**Timestamps** are `timestamptz`, stored UTC, rendered in local time.

**Assume slow 3G on a cheap Android.** No blocking requests above the
fold. Images compressed client-side before upload, max 1600px.
First contentful paint under 2 seconds on throttled 3G.

**Never fabricate data.** No placeholder users, no lorem ipsum, no
fake seed content in code. Empty states instead.

---

## 5. Privacy and safety — non-negotiable

- **Age gate at signup.** `date_of_birth` is required. Under-18 accounts
  never expose city publicly; the database enforces this via trigger.
- **No direct messages in v1.** Do not build them. Do not suggest them.
- **Anonymous posting** is a first-class feature. `posts.is_anonymous`
  and `answers.is_anonymous` hide the display name in the UI while the
  real account persists underneath for moderation.
- **Listings are community-submitted and unverified.** Every listing
  surface must show that. Never imply endorsement or vetting.
- **Report button on every piece of user content** — posts, answers,
  messages, listings, profiles.

---

## 6. Working style

- Build one vertical slice per session. Not "build auth" — "phone OTP
  signup that creates a profile row and redirects to home, including the
  invalid-code error state."
- Prefer editing existing files over creating new ones.
- No new dependencies without asking first.
- When the spec is ambiguous, ask one question rather than guessing.
- Do not write documentation files unless asked.

---

## 7. Directory layout

```
app/
  (auth)/          signup, verify
  (main)/          home, search, create, rooms, profile
  event/           static tournament info
  mod/             moderation panel
components/
  ui/              primitives
  posts/  rooms/  listings/
lib/
  supabase/        client.ts, server.ts, middleware.ts
  queries/         one typed module per entity
  types.ts         generated from schema
supabase/
  migrations/
```

All database access goes through `lib/queries/*`. No inline Supabase
calls in components.

---

## 8. Build order

Realtime chat is built and load-tested FIRST. It is the only component
that can fail publicly and simultaneously in front of thousands of people.
Everything else is CRUD.

1. Realtime chat + polling fallback + 2000-connection load test
2. Auth + profiles
3. Posts + answers + votes
4. Search
5. Notifications
6. Rooms system (presence, photos, save-to-community)
7. Event info pages
8. Moderation panel
9. Listings
10. Instrumentation + hardening

---

## 9. Current phase

**Phase: 1 — Realtime chat.** Nothing else is in scope yet.
Update this line as phases complete.
