# Split App — Page & Function Map

This is the target IA you spec'd out, mapped against the actual code in `src/app` and `src/store/useSplitStore.ts`. Where a page already exists, the route is noted along with what's built vs. what's new work. Treat this as the source of truth — update it before adding a feature, then build.

## Homepage (`index.tsx` — exists, needs changes)

- Hamburger menu (nav drawer exists today as a bottom sheet/drawer — fine to keep, just needs the new menu items below)
- Main options: **Start a tab**, **Start a trip**, **Join** (new — joins someone else's open tab via a code, see Join flow below)
- Section 1 — most recent open tab or trip (whichever is newer); hidden entirely if none exist
- Groups — existing groups + add new (exists, links to `/groups`)
- Closed — recent closed tabs and trips (today's feed mixes open/closed; needs a status field to split "open" vs "closed" cleanly)

## Menu

- Tabs → `/tabs` (new list page — today there's no dedicated tabs list, just the home feed)
- Trips → `/trips` (exists)
- Friends → `/friends` (new)
- Groups → `/groups` (exists)
- Settings → `/settings` (exists, needs expansion — see below)

## Tabs page (new — `/tabs`)

- Start a tab → Upload flow
- Open tabs (status filter on `history`)
- Closed tabs (status filter on `history`)

*Needs:* a `status: 'open' | 'closed'` field on `SplitRecord` — right now a saved split has no open/closed concept, it's just "saved."

## Trips page (`/trips` — exists, needs status split)

- Start a trip → Start a Trip flow
- Open trips
- Closed trips

*Needs:* same `status` field, this time on `Trip`.

## Friends page (new — `/friends`)

- Invite friend (real invite, see Multi-device section)
- See friends (list of accepted friends — this is new; today "people" are just per-split local names with no persistent friend list)
- Add friend to group

*Needs:* a `friends` concept distinct from one-off "people typed into a split." This is the first place the local-only model and the multi-device model genuinely diverge — local-only has no durable friend list at all.

## Groups page (`/groups` — exists)

- Create group (exists — `addGroup`)
- See/edit groups (exists — `GroupModal`, `updateGroup`)

## Settings page (`/settings` — exists but currently is just an OCR API key screen)

- Username (new)
- Photo (new — avatar)
- Delete account (new — only meaningful once accounts exist)
- Contact / feedback (new)
- *(keep the existing OCR API key field too, just no longer the only thing on this screen)*

## Join flow (new, cross-cutting)

Someone shares a code/link for an open tab → you join it live → you see and assign your own items in real time. This is a live-shared-document feature, not a static import — it requires the Supabase realtime layer from the multi-device plan below. Can't be built meaningfully on AsyncStorage-only.

---

## Start a Tab flow

### Entry (`upload.tsx` — exists)
- Upload, take a pic, or enter manually (all three exist)
- Title and date pinned to the top of every screen in this flow (currently only on Review — needs to persist across Items/Friends/Assign/Split too)
- Tabs-style sub-nav across the flow: **Items / Friends / Assign / Split** (today this is separate full-screen pushes — `review` → `people` → `assign` → `summary`. Worth deciding: keep as separate routes with a shared tab-bar header, or merge into one screen with tab state. Separate routes is less of a rewrite.)

### Items tab (`review.tsx` — exists, mostly matches)
- Line items: name, qty, price — **swipe left/right to edit/delete** (new gesture; currently uses inline buttons/modal, not swipe)
- Tax & tip, collapsible (tax exists as `setTax`; needs a collapsible wrapper)
- Tip: quick-pick percentages + custom $ (exists as a flat `setTip`, needs the quick-pick UI)
- Add charge / add discount (exists — `addExtraCharge`, `addDiscount`)
- Totals: subtotal, tax, tip, extra charges (exists)
- CTA: **Add friends** → Friends tab

### Friends tab (`people.tsx` — exists, close match, just renamed)
- Add from group (exists)
- Enter name (exists — `addPerson`)
- People added + delete (exists — `removePerson`)
- CTA: **Assign items** → Assign tab

### Assign items (`assign.tsx` — exists, needs real additions)
- Assigned-% progress bar (new — quick visual for "how much of the bill is assigned so far")
- Filter by category: drinks / apps / dessert (new — items have no category field today)
- Per line item: total, assignees, "all" quick-select (assignment exists; "all" shortcut is new)
- Who paid — **multiple payers, custom amount each** (today `setPaidBy` is a single person only; this needs `paidBy` to become an array of `{ personId, amount }`)
- CTA: **Split** → Split tab

### Split (`summary.tsx` — exists, needs the most new work)
- Total + payer(s) (exists for single payer, needs multi-payer display)
- Per friend: total owed, collapsible detail, **mark as paid** (new — needs a payment-status field per person per tab, since right now a summary is just computed, not stateful)
- Send to [person] (exists as generic share — needs per-person targeting)
- Mark as paid, with partial-amount support (new)
- **Generate code** with two send modes: *send final bill* (view-only breakdown link) or *send invite to edit* (live join, same mechanism as the homepage Join flow) — new, ties directly into Supabase realtime

---

## Start a Trip flow

### Start a Trip form (`trips.tsx`'s `TripModal` — exists, needs date pickers + member picker)
- Emoji (exists)
- Name (exists)
- Start date — calendar picker (exists as text input today, needs an actual calendar UI)
- End date — calendar picker (same)
- Group or friends (exists as a flat `people?: string[]`, fine as a starting point — will need to become real member rows once Friends/accounts exist)
- CTA: **Start trip**

### Trip page (`trip/[id].tsx` — exists, needs the calendar + chart work already flagged earlier)
- Dates: calendar with highlighted days that have expenses (planned, not built — see "Not yet built" below)
- Pie chart: total spent by category, **group total vs. your share** (new — needs `expenseCategory` aggregation; the field exists on `SplitRecord` already from `expense-entry.tsx`, just isn't visualized anywhere yet)
- Friends list + add (exists in skeletal form via trip's `people`)
- Expenses by date, most recent first (exists as a flat list — needs date grouping/sort, not new data)
- Quick-add expense (exists — `handleAddExpense`)
- Add expense: upload / manual / import tab (all three exist — `trip/expense.tsx`)

### Manually enter (`expense-entry.tsx` — exists, needs currency)
- Title, category, price, **currency** (title/category/price exist; currency field is new — see currency plan below)
- Assign → same Assign tab as the receipt flow
- Split → same Split tab

---

## Cross-cutting data model changes this spec requires

| Change | Why |
|---|---|
| `status: 'open' \| 'closed'` on tabs and trips | Needed for the Tabs page, Trips page, and homepage's open/closed sections — doesn't exist today |
| Item `category` field | Needed for Assign screen's drink/app/dessert filter |
| `paidBy` → array of `{ personId, amount }` | Needed for multiple payers |
| Payment status per person per tab (`paid: boolean`, `amountPaid`) | Needed for "mark as paid" on Split |
| Share/join codes, two modes (view-only vs. editable) | Needed for Join flow + Split's "generate code" |
| `currency` on tabs/trips | Needed for manual entry + multi-currency display |
| Durable `friends` list, separate from per-split "people" | Needed for the Friends page — today people are scoped to a single split, not a persistent relationship |

All of the realtime-feeling features here — Join, live-edit invite codes, friends syncing across devices — depend on the Supabase migration below. They can't be faked convincingly on local AsyncStorage because the whole point is two phones seeing the same tab change live.

## Multi-device accounts — architecture plan (Supabase)

| Layer | Change |
|---|---|
| Auth | Supabase Auth, email magic link (no password to manage on mobile) |
| People | `Person.name` → a `profiles` table (`id`, `display_name`, `avatar`, `payment_handle`, `payment_app`) linked to `auth.users`. Keep support for "placeholder" people who don't have the app yet — most real splits include someone who'll never sign up. |
| Friends | New `friendships` table (`profile_id`, `friend_profile_id`, `status: invited/accepted`) — the durable list the Friends page needs |
| Groups / Trips | `groups` + `group_members`, `trips` + `trip_members`, each member row either a real `profile_id` or a placeholder with `status: invited/joined` |
| Tabs / expenses | `SplitRecord` → `tabs` table (+ `expense_items`, `item_assignments`, `payers`, `payment_status`) with `trip_id` nullable, `currency`, `status` |
| Join / share codes | A `share_links` table: `tab_id`, `mode: view/edit`, `code`, `expires_at` — view mode renders a read-only breakdown, edit mode opens the live realtime tab |
| Sync | Supabase Realtime subscriptions on `tabs`/`trips`/`trip_members` — this is what makes Join and live-edit invites actually work |
| Local store | Zustand stays for in-progress UI state; `history`/`groups`/`trips`/`friends` move from `persist`+AsyncStorage to Supabase via React Query |

Suggested phasing — this spec is now big enough that doing it in order matters:
1. **Auth + own data only.** Sign-in, profile, settings (username/photo/delete account). No sharing yet. Validates the schema.
2. **Status fields + IA shell.** Tabs/Trips list pages with open/closed, Friends page (local-only friend list is fine here, doesn't need realtime yet), category field on items, currency field.
3. **Static sharing.** "Send final bill" view-only codes, multiple payers, mark-as-paid — all stateful but not realtime.
4. **Realtime.** Join flow, "send invite to edit," live-updating trip balances. Hardest and riskiest part — do it last, once the data model from steps 1–3 is stable.

## On your process

You're now at the point where the spec is detailed enough that building straight from this doc, screen by screen, in the phase order above, should mean a lot less backtracking than what you described at the start. The one discipline worth keeping: when you hit a gap mid-build (you will), add the row to this doc first, then code — don't let the code define the structure by accident again.
