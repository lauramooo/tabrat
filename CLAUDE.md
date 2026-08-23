# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical: Expo v56 docs

**Always read the versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code that touches Expo APIs.** The SDK has changed significantly — do not rely on training data for Expo API shapes.

Key v56 breaking changes to keep in mind:
- `expo-file-system` uses a new class-based API (`new File(uri).base64()`) — the old string-based methods are deprecated
- `expo-router` no longer supports importing from `@react-navigation/*` — all navigation imports must come from `expo-router`

## Commands

```bash
npx expo start          # start dev server (scan QR with Expo Go or press w for web)
npx expo start --web    # start web only
npm run android         # Android emulator
npm run ios             # iOS simulator (macOS only)
npm run lint            # expo lint
npx tsc --noEmit        # type-check — a stable set of ~12 pre-existing errors is expected (module-resolution/implicit-any quirks in a few files); treat any NEW error as a real regression
```

There is no test suite configured in this project.

## Architecture

This is a receipt-splitting app with three parallel expense contexts, all sharing the same underlying split/calculation engine:

- **Tabs** — a one-off bill split (`upload.tsx` → `review.tsx` → `people.tsx` → `assign.tsx` → `summary.tsx`), optionally scanned via AI OCR
- **Trips** — a short-term, day-by-day group of expenses (`trip/new.tsx`, `trip/[id].tsx`, `trip/expenses.tsx`, `trip/expense.tsx`, `trip/manual-entry.tsx`)
- **Homes** — a recurring, monthly-cycle group of expenses for housemates (`home/new.tsx`, `home/[id].tsx`, `home/expenses.tsx`)

**Trips and Homes are intentionally different temporal models** — trips are day-view/date-range based, homes are recurring-monthly-cycle based. Don't conflate or merge them; a feature built for one doesn't automatically belong on the other.

The bottom tab bar (`app/(tabs)/_layout.tsx`) has four tabs — Feed (`index.tsx`), Trips (`trips.tsx`), Homes (`homes.tsx`), Account (`me.tsx`) — plus a center FAB that opens a sheet to start a new tab/trip/home. `friends.tsx`, `groups.tsx`, and `settings.tsx` are pushed from the Account tab.

**State** lives in a single Zustand store (`src/store/useSplitStore.ts`, ~700 lines) — no prop drilling. It holds the in-progress tab-being-built (items, people, tax/tip, extra charges) *and* the persisted collections (`history`, `trips`, `homes`, `groups`, `friends`, category lists, `defaultCurrency`). Persistence is via `zustand/middleware`'s `persist` + AsyncStorage under the key `split-history`, with an explicit `partialize` allow-list — new persisted fields must be added there or they won't survive a reload. `reset()` clears the in-progress-tab state (called on "Done" / "New Split"); it does not touch the persisted collections.

**Types** (`src/types/index.ts`) define `Trip`, `Home`, `Group`, `Person`, `SplitRecord` (a saved tab/trip-expense/home-expense — the one record shape all three contexts save into `history`), plus `Payer`/`PaymentStatus` for multi-payer and settle-up tracking. `SplitRecord.tripId`/`homeId` link an expense back to its trip or home; unset means it's a standalone tab.

**Receipt parsing** (`src/utils/receiptParser.ts`) sends the image as base64 to Claude Haiku via the Anthropic Messages API directly with `fetch` (model: `claude-haiku-4-5-20251001`). No Anthropic SDK — raw fetch to avoid React Native compatibility issues.

**Split calculation** (`src/utils/calculator.ts`): items can be assigned to multiple people and are split equally among assignees. Tax and tip are distributed proportionally by each person's share of the pre-tax subtotal.

**API key** is stored via `expo-secure-store` (native) or `localStorage` (web), abstracted in `src/app/settings.tsx` via exported `getApiKey`/`saveApiKey` (plus generic `getStorageItem`/`setStorageItem` used for profile username/photo, reused by `(tabs)/me.tsx`). The upload screen calls `getApiKey()` before every API call and redirects to `/settings` if missing.

**Currency is display-only** — `fmt(n, currency)` in `calculator.ts` just prefixes a currency symbol; there is no exchange-rate conversion. Multi-currency trips sum raw numbers under one symbol.

### Shared design system (`src/components/design/`)

The app converged this design language from the Feed tab outward; new screens should build on these rather than styling ad hoc. Barrel-exported from `src/components/design/index.ts`:

- `Card` — plain `View` unless given `onPress` (then a gesture-handler `RectButton`); pass `pressBorderColor` to get a colored stroke on press (use the category/person's light "bg" palette token). This press-highlight-stroke card is the standard shape for every list row app-wide.
- `IconBadge` — circular colored badge wrapping an icon, default size from `Badge.size`.
- The **"Feed-card" list pattern**: each row is its own `<Card onPress pressBorderColor>` containing an `IconBadge` (colored from `AVATAR_PALETTE[index]`) + a bold title / muted subtitle text stack — not one bordered card with divider-separated rows.
- `CircleIconButton` — the single canonical back-chevron/close-X button (black stroke, yellow fill on press). All back/close affordances app-wide must route through this rather than hand-rolled SVG buttons.
- `CenteredModal` / `ConfirmModal` / `DatePickerModal` — modals are always centered with `animationType="fade"`, **never a bottom sheet**.
- `Button`, `Input`, `Dropdown`/`DropdownRow`, `EditableTitle`, `SectionLabel`/`FieldLabel`, `Divider`.
- `RunningTotalsCard`, `SettlementRow`, `ClosedSettlementRow`, `PayModal` — shared between `trip/[id].tsx` and `home/[id].tsx` so the "who owes who" / settle-up UI stays identical across both contexts; a style change to one applies to both automatically.

Design tokens: `src/constants/colors.ts` (`C`, `AVATAR_PALETTE`, `CHIP_PALETTE`, `PERSON_PALETTE`), `src/constants/spacing.ts` (`Spacing`, `Radius`, `Badge`, `InputMetrics`), `src/constants/typography.ts` (`Type`, semantic names). `src/constants/theme.ts` is an unused Expo-template leftover — don't extend it.

**Icons**: `src/components/FigmaIcons.tsx` is the single source of truth for every hand-exported Figma SVG icon (`sizeFor(w,h,size)` scales proportionally). No icon's raw SVG path data should exist duplicated anywhere else — every usage app-wide (including tab bar icons) renders the shared component, so changing an icon in one place updates it everywhere.

**Person avatars**: `Avatar` (`src/components/Avatar.tsx`) is the shared per-person colored-initials circle (colored via `AVATAR_PALETTE[index]`); it auto-detects when `name` matches the device user's own stored name and swaps in their photo if they've set one (via `useMyName()`/`useMyPhoto()` in `src/utils/sortPeople.ts`, reading AsyncStorage/localStorage directly). `ProfileAvatar` (`src/components/ProfileAvatar.tsx`) is the distinct account-page-only avatar — the user's own photo or a neutral gray placeholder, deliberately not palette-colored since there's no trip/home ordering context there. Both fall back to a placeholder on `onError`, since a stale `blob:` URI from `expo-image-picker` (web) goes invalid after reload.

### Header conventions

The root `Stack` (`src/app/_layout.tsx`) defaults every screen to a fully transparent floating header with a `CircleIconButton` back chevron. Screens with real form/card content override this per-screen via their own `<Stack.Screen options={{ headerTransparent: false, headerStyle: { backgroundColor: C.bg } }} />` — do this for any new screen that isn't a thin overlay on scrolling content.

## Key conventions

- All colors come from `src/constants/colors.ts` (`C.bg`, `C.primary`, etc.) — never hardcode hex values
- Path alias `@/` maps to `src/` (configured in `tsconfig.json`)
- `SafeAreaView` from `react-native-safe-area-context` with `edges={['bottom']}` on every screen — the Stack header handles top safe area
- All UI text (titles, alerts, labels) is sentence case, not Title Case
- Grep for an existing style/component/pattern before writing a new one; consolidate near-duplicates you find along the way
