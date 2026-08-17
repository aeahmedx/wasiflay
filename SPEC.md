# Wasif Lay — v1 Specification

Referenced by `CLAUDE.md`. Cite section numbers when assigning work
("implement section 4.2").

Mobile-first. Every screen is designed for a phone held one-handed on
congested cell service. Desktop is a centered max-width column.

---

## 1. Navigation

Bottom tab bar, five items, always visible when authenticated:

`Home` · `Search` · `Create` · `Rooms` · `Profile`

Unauthenticated users can browse Home, Search, and Rooms in read-only
mode. Any write action prompts signup. **Do not gate reading.** A person
who lands on a search result and hits a signup wall leaves.

---

## 2. Auth

### 2.1 Signup
Two options presented side by side, user picks either:
- **Continue with Google**
- **Continue with phone** — OTP, no password

No email/password. No email verification. No forced profile completion.

### 2.2 Profile creation
Immediately after first auth, a single form:
- Display name (required, 2–50 chars)
- City (required, free text with autocomplete on existing values)
- Date of birth (required — age gate)
- Country flag (defaults `SD`)

Insert into `profiles` with `id = auth.uid()`.

**Race condition to handle:** between auth success and profile insert,
`is_active_user()` returns false and every write is rejected. Block the
app on the profile form until the row exists. Do not let a user reach
Home without a profile.

### 2.3 Under-18
If DOB indicates under 18, the database sets `is_minor` and forces
`show_city = false`. Show a brief line: "Your city stays private."
No other flow change.

---

## 3. Home

### 3.1 Search bar
Pinned at top, the visual centerpiece. Placeholder rotates through real
terms: "lawyer", "housing", "mechanic", "passport", "tutor".
Tapping navigates to Search (section 4).

### 3.2 Event banner
Dismissible card linking to Event Info (section 9). Shown when an event
is active.

### 3.3 Feed
Two tabs: **Latest** · **Trending**

- Latest — `posts` ordered by `created_at desc`
- Trending — `posts` ordered by `answer_count + helpful_count` over the
  last 7 days

Filtered by the user's city by default, with a visible "All cities"
toggle. City filter state is React state, not persisted.

### 3.4 Post card
Type badge (Question / Recommendation / Announcement) · title ·
author display name and flag (or "Anonymous") · city · relative time ·
answer count · helpful count.

Entire card is the tap target.

### 3.5 Empty state
"No posts in {city} yet — ask the first question." Button to Create.

---

## 4. Search

### 4.1 Behavior
Single input, debounced 300ms, calls `search_all(q, filter_city)`.
Results stream in without a page reload. No submit button.

### 4.2 Results
Two grouped sections, listings always first:

**People & Businesses** — name · service tag · city ·
"{n} community vouches"
**Discussions** — title · type · city · answer count

### 4.3 Zero results
Never a blank screen. Show:
"No results for '{query}' yet."
Two buttons: **Ask the community** (prefills a post) and
**Add a listing** (prefills the listing form with the query as service tag).

This converts a dead end into content. It is the most important empty
state in the app.

---

## 5. Posts

### 5.1 Create post
Fields: type selector (Question default) · title · body · city
(prefilled from profile) · **Post anonymously** toggle.

Anonymous is prominent, not buried. It is what makes sensitive
questions — immigration, legal, money — possible at all.

### 5.2 Post detail
Post body, then answers ordered by `helpful_count desc, created_at asc`.

Each answer: author (or "Anonymous") · body · relative time ·
**Helpful** button with count · Report.

Helpful votes are toggles — insert on tap, delete on second tap.
Optimistic UI. A user cannot vote on their own content.

### 5.3 Answer composer
Pinned at the bottom of post detail. Always visible, never behind a tap.
Answering is the behavior the entire product depends on; it gets the
lowest-friction placement on the screen.

---

## 6. Rooms (live layer)

### 6.1 Room list
Cards for each open room: name · live presence count · last message
preview. Closed rooms are hidden, not greyed out.

Two permanent rooms ship at launch: **General** and **Football**.
Event rooms are opened and closed by schedule.

### 6.2 Room view
- Messages ascending, newest at bottom, auto-scroll when already at bottom
- Presence count in the header — "412 here now"
- Composer with text and image attach
- Tap-to-react before typing; one-tap participation matters more than
  composition
- No pagination, no refresh button

### 6.3 Realtime + fallback
Subscribe to the Supabase Realtime channel for `messages` filtered by
`room_id`. **If the channel drops or fails to connect, fall back to
polling every 5 seconds.** The room degrades — it never freezes.
Show a subtle "reconnecting" indicator, never a blocking error.

### 6.4 Rate limit
The database raises `P0001` with `RATE_LIMIT:` on the 6th message in
10 seconds. Catch it, show "Slow down a second", keep the composer
contents. Never lose the user's typed text.

### 6.5 Save to community
Long-press or overflow menu on any message: **Save to community**.
Opens the Create Post or Add Listing form prefilled with the message
body, and writes `messages.saved_post_id` / `saved_listing_id` on success.

Visible to everyone; prominent for moderators. This is the bridge
between the live layer and the permanent layer, and it is the mechanism
by which a weekend of banter becomes a knowledge base.

---

## 7. Listings

### 7.1 Browse
Filter by service tag and city. Card: name · tag · city ·
"{n} community vouches".

### 7.2 Detail
Name · tag · city · description · contact · vouch list with names.

**Required disclosure on every listing surface:**
"Community-submitted. Wasif Lay does not verify credentials."
Not a footnote — visible without scrolling.

### 7.3 Add listing
Name · service tag · city · description · phone · email ·
`search_aliases` (labeled "Other spellings of this name" — this is what
makes Ahmed/Ahmad/Ahmet searchable).

Anyone can submit a listing for anyone. The vouch count is the trust
signal, not the submission.

### 7.4 Vouch
One tap, one per user per listing, with an optional short note.
Vouching for your own submitted listing is not allowed.

---

## 8. Profile

### 8.1 View
Display name · flag · city (from `public_profiles`, auto-null for minors)
· contribution count · helpful count · tabs for Posts and Answers.

Raw counts only. **No leaderboard, no levels, no titles, no badges.**
Gamification gets gamed the moment it means anything, and answer quality
matters more than answer volume.

### 8.2 Edit
Display name · city · flag · show city toggle.
The toggle is hidden for minors — the database overrides it regardless.

---

## 9. Event info

Static, hardcoded, no CMS. Loads instantly with no database call.

Schedule · field map image · parking · prayer space · food and vendors ·
lost and found · organizer contact.

This is the highest-utility lowest-effort surface in the app and people
will open it repeatedly across an event weekend.

---

## 10. Notifications

One event only in v1: **someone answered your question.**

- In-app: badge on Profile tab, list view, tap to the post
- SMS: sent once per notification via Twilio, `sms_sent_at` guards
  against duplicates

Do not notify on activity the user did not participate in. That is how
apps get uninstalled.

---

## 11. Moderation

### 11.1 Report
Available on every post, answer, message, listing, and profile.
Reason field, one tap to submit. Confirmation toast.

### 11.2 Moderator panel (`/mod`)
Visible only when `role` is `moderator` or `admin`.
Open reports queue with target preview and three actions:
**Remove** · **Dismiss** · **Ban user**

All three call RPCs. Never a direct table update.

### 11.3 Community rule
Displayed at signup and linked in the footer:

> Wasif Lay is for coordination, not conflict. Political argument
> threads are removed. This applies to everyone equally.

Enforced identically regardless of who posts.

---

## 12. PWA

Manifest, icons, install prompt. A browser tab gets lost by Tuesday;
an icon on the home screen is the retention mechanism.

The app icon is a road sign — matching the meaning of the name,
"point me in the right direction."

---

## 13. Instrumentation

**Sentry** — every error, alerts to phone.
**PostHog** — four events that matter:
1. signup completed
2. first content action (post, answer, or message)
3. search performed, with zero-result flag
4. day-7 return

Zero-result searches are your content roadmap, handed to you for free.

**`/status`** — an unlinked page showing database connectivity, realtime
connection state, and the last 10 errors. Refresh this during an event
instead of guessing.

---

## 14. Explicitly NOT in v1

Direct messages · credits or points economy · payments · business
accounts · verification badges · AI recommendations · native apps ·
categories or sub-forums · leaderboards · post editing history ·
follower graph

Sub-forums in particular: Reddit had no subreddits at launch. Nine
near-empty rooms feel deader than one half-full one.
