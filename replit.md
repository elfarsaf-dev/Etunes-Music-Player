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

#### etunes — feature additions (April 2026)

- **Themes**: 7 themes (Midnight default, Sunshine, Forest Clean, Obsidian, Indigo Dream, Peach Aesthetic, Cyberpunk Neon). Source: `lib/themes.ts`. Selection persisted via `@etunes/theme` and applied through `contexts/ThemeContext.tsx` + `hooks/useColors.ts`. Theme picker lives in the Settings tab as a horizontal swatch carousel.
- **Offline downloads**: `expo-file-system`'s `File.downloadFileAsync` saves resolved stream URLs into `Paths.document/downloads/`. Persisted in `@etunes/downloads` (uri/size) and `@etunes/downloads/meta` (track metadata). `LibraryContext.resolveTrack()` injects `localUri` and `usePlayResolved` (in `hooks/usePlayResolved.ts`) wraps `playQueue`/`playTrack` so PlayerContext skips the network when the file exists locally. Download / remove button lives in the player screen.
- **Discover home sections**: `New Releases` (`q=terbaru 2026`) and `Most Popular` (`q=paling populer`) fetched via React Query (30 min staleTime) and rendered as horizontal carousels on `app/(tabs)/index.tsx`. A `Top Artists` row is derived from those results — circular avatars that link to the artist screen.
- **Artist screen**: `app/artist/[name].tsx` searches the worker for the artist name, shows a circular avatar from the first track's thumbnail, and lists all matching songs with Play / Shuffle buttons. Artist names in `SongRow` are tappable for online tracks.
- **Smoother navigation**: Player screen modal has `gestureEnabled` + `gestureDirection: "vertical"` so swipe-down dismisses it. Artist screen pushes with `slide_from_right`.

#### etunes — EAS Build setup

- `artifacts/etunes/eas.json` defines 3 profiles: `development` (APK + dev client), `preview` (APK, internal distribution), `production` (AAB, autoIncrement). Submit profile targets Play Store internal track.
- Convenience scripts in `package.json`: `build:apk`, `build:android`, `build:dev`, `submit:android`, `eas:init`, `eas:login`, `eas:whoami`.
- Setup guide: `artifacts/etunes/EAS_BUILD.md`. User runs `eas init` locally to attach `extra.eas.projectId` + `owner` to `app.json` (not committed yet — must be done from local machine with `eas login`).
