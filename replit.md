# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### etunes (mobile, Expo)

Android-first mobile music player. Path: `artifacts/etunes`.

- **Online streaming** via the user's Cloudflare worker at `https://musicapi.cocspedsafliz.workers.dev` (search + 15 streams/day quota). The worker `/download` endpoint is buggy — `lib/api.ts:resolveStream()` calls it for usage tracking and falls back to `https://spotify.elfar.my.id/api/spotify` for the actual stream URL.
- **Local playback** via `expo-media-library` (Android scan) and `expo-document-picker` (manual file pick).
- **Background audio + lock-screen controls** via `expo-audio` v55: `setAudioModeAsync({ shouldPlayInBackground: true, interruptionMode: "doNotMix" })` plus `player.setActiveForLockScreen()` per track.
- **Auto-advance** handled in `PlayerContext` via the `playbackStatusUpdate` listener (`didJustFinish`).
- **Theme**: dark with purple→pink gradient. Constants in `constants/colors.ts`.
- **State**: three context providers in `contexts/` — `AuthContext` (API key + profile + usage), `PlayerContext` (single global `AudioPlayer` via `createAudioPlayer`), `LibraryContext` (local tracks + playlists). Persisted via `AsyncStorage` keys `@etunes/api_key`, `@etunes/playlists`, `@etunes/recent`, `@etunes/search_history`.
- **Routes**: `(tabs)/{index,library,playlists,settings}` + `auth` (modal, gates everything via `(tabs)/_layout` redirect) + `player` (modal) + `playlist/[id]`.
- **Android permissions / plugins** configured in `app.json`: `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `POST_NOTIFICATIONS`, `READ_MEDIA_AUDIO`; plus `expo-audio` and `expo-media-library` plugins.
