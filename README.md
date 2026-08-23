# Split App

A receipt-splitting app built with Expo and React Native. Scan a receipt (or enter it manually), assign items to people, and split the bill — with support for one-off tabs, multi-day trips, and recurring shared homes.

## Features

- **Tabs** — scan a receipt with AI-powered OCR (Claude Haiku) or enter it manually, assign items to people, and split the total with proportional tax/tip
- **Trips** — track shared expenses across a trip, grouped by day, with running totals and settle-up ("who owes who")
- **Homes** — track recurring monthly costs with housemates
- Friends and groups for quickly adding people to a split without retyping names
- Multi-payer support, partial payments, and per-person settle-up tracking

## Getting started

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npx expo start
```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

Receipt scanning requires an [Anthropic API key](https://console.anthropic.com), set from the app's Settings screen.

## Tech stack

- [Expo](https://expo.dev) (SDK 56) + [Expo Router](https://docs.expo.dev/router/introduction) for file-based navigation
- React Native with TypeScript
- [Zustand](https://github.com/pmndrs/zustand) for state management, persisted to `AsyncStorage`
- Claude Haiku for receipt OCR, called directly via the Anthropic Messages API

## Development

```bash
npx expo start --web    # web only
npm run android         # Android emulator
npm run ios             # iOS simulator (macOS only)
npm run lint            # expo lint
npx tsc --noEmit        # type-check
```

See [CLAUDE.md](./CLAUDE.md) for architecture notes and conventions.
