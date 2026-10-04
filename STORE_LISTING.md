# App Store Connect listing — draft content

Fill-in reference for when Apple enrollment clears. Nothing here needs to be exact — edit freely, this just saves writing it from scratch under time pressure.

## Basics

- **App name**: Tab Rat
- **Subtitle** (30 char max): Split bills, trips & rent
- **Category**: Primary — Finance. Secondary — Utilities (or Lifestyle, if Finance feels off for a receipt-splitting app — your call once you see how competitors are categorized)
- **Privacy Policy URL**: https://lauramooo.github.io/tabrat/privacy.html
- **Support URL**: https://lauramooo.github.io/tabrat/support.html

## Description (draft)

```
Tab Rat makes splitting bills, trips, and shared rent painless — no spreadsheets, no math, no awkward "you owe me" texts.

SCAN OR ENTER
Snap a photo of any receipt and let AI read the items, or enter them manually in seconds.

SPLIT YOUR WAY
Assign items to specific people, split evenly, or mix both — tax and tip are distributed proportionally, automatically.

TRIPS
Track shared expenses across a multi-day trip, organized by day, with running totals and a clear "who owes who" breakdown.

HOMES
Keep up with recurring monthly costs — rent, utilities, groceries — with housemates, cycle after cycle.

FRIENDS & GROUPS
Save people once, reuse them everywhere — no retyping names for every new split.

SETTLE UP
See exactly who owes what, mark payments as done, and keep a clean running balance with everyone.

Your data is private to your account — Tab Rat never sells or shares it.
```

(Edit this — I don't know the tone you want yet. Ask me to make it punchier, shorter, more casual, whatever direction you want.)

## Keywords (100 char max, comma-separated, no spaces needed)

```
split bill,receipt scanner,roommate,rent split,trip expenses,bill splitter,tab,settle up,group expenses
```

## App Privacy questionnaire (App Store Connect's data-collection form)

Based on what the app actually does (from the codebase, not guesswork):

| Data type | Collected? | Linked to identity? | Used for tracking? |
|---|---|---|---|
| Email Address | Yes (auth) | Yes | No |
| Photos | Yes (optional — profile photo, receipt images) | Yes | No |
| User Content (app data: trips/expenses/etc.) | Yes | Yes | No |
| Other Data (Anthropic API key) | **No** — stored only on-device, never transmitted to your servers, so this is not "collected" by you | — | — |

No analytics, no advertising identifiers, no location data, no contacts, no tracking across apps/websites (there's no analytics SDK in the codebase at all — confirmed during the earlier security audit).

## Age rating questionnaire

Nothing in the app touches any of Apple's content categories (violence, mature themes, gambling, user-generated content shared publicly, unrestricted web access, etc.) — answer "None" / "No" to everything and it should land on **4+**.

## Screenshots

Can't generate these until there's a real iOS build to screenshot (needs Apple enrollment + either a device or Xcode Simulator on a Mac). Apple's current minimum requirement is the 6.9" display size (iPhone 16 Pro Max resolution, 1320×2868 or 2868×1320). Revisit once a preview/production iOS build exists.
