# music-player

Offline music player for the DT G1 watch (Glyphix OS, 466x466 round screen). All on-screen text is Hebrew. The library is prepared on the PC by DT G1 Studio; the app only reads it.

## Pages

- **main** - entry page. Library menu (folders, artists, albums, playlists, recently played, favorites, all songs, search), a mini "now playing" bar with play/pause when a song is loaded, and the empty state when there is no library.
- **player** - now playing: cover (or a placeholder note), title, artist, elapsed / total and a progress bar, previous / play-pause / next, -10 s / +30 s. Scroll down for repeat (off / all / one), shuffle, favorite, volume -/+ (15 steps), add to playlist, queue, go to artist, go to album.
- **browse** - one generic list page for every collection: folder tree (subfolders first, then songs), artists, artist songs, albums (with cover thumbnails), album songs (by track number), playlists (from the library and the user's own), playlist songs, recently played, favorites, all songs, the play queue. Song collections get "play all" and "shuffle"; folders play all songs below them. User playlists have an edit mode (tap a song to remove it, delete the list). Rows are added 30 at a time ("show more"), so long lists stay light.
- **search** - own on-screen keyboard: Hebrew letters with final forms, English letters, digits, space, backspace, clear. Results update on every key and match title, artist, album and folder, case-insensitive, with final Hebrew letters folded. The same page, in "newlist" mode, names a new playlist.
- **addto** - add the current song to a user playlist, or to a new one.

## Library format

Root `internal://mass/music/` (`E:\data\mass\music\` over USB):

- `index.json` - `{"version":1,"generated":"...","tracks":[{"id","file","title","artist","album","folder","track","duration","cover","size"}],"playlists":[{"name","tracks":[id]}]}`. Any string may be empty. `folder` is "/"-separated, relative to the library root ("" is the root).
- `tracks/<id>.mp3` (MP3, 64 kbps) and `covers/<id>.jpg` (about 160x160).

Missing `index.json` shows "אין מוזיקה. העבר שירים מ-DT G1 Studio". A broken one shows a re-sync message.

## Watch-side state

`internal://files/state.json`: favorites, recently played (last 30), user playlists, repeat mode, shuffle, and the resume point (queue, play order, current index, position). It is saved 1.5 s after a change, every 15 s while playing, and immediately on pause and when the app is hidden. Ids that are no longer in the library after a re-sync are skipped everywhere. On launch the last queue is restored without playing; play continues from the saved position.

## Player

One `media.createAudioPlayer()` instance is created in `app.js` (`src/lib/player.js`) and shared by all pages. It is never re-acquired through `@system.audiokit`: on the watch the wrappers from `getPlayers()` report a stale status and `play()` on them starts a second stream. Behaviour verified on the watch by `audio-probe`:

- `src`, `play()`, `pause()`, `stop()`, `status` (`stop` / `play` / `pause`), `position` and `duration` in seconds, events without arguments.
- Seek by assigning `position` while playing. A seek while paused or before the first play is kept and applied on the next `onplay`.
- Playback continues in the background and with the screen off; the JS context is suspended and resumes.
- `media.setVolume(number)` only (the object form mutes the watch), 15 steps.
- `openSystemNotification` is set as a property after creation; `songAttribute` is set on every track change (whether the system UI shows it is not confirmed).

Previous restarts the song when more than 3 s have played. At the end of a song the queue advances by the repeat mode; a song that fails to play is skipped (at most 3 in a row). `onnext` / `onprevious` from the system controls move through the queue.

## Hebrew and RTL

The system font has Hebrew and the text engine applies the Unicode bidi algorithm: the base direction of each text element comes from its first strong character, so Hebrew lines (with numbers, Latin names and separators like " - " or " / ") are ordered right to left. Checked in the emulator with the `dtg1-emu-466x466` profile, by measuring glyph positions.

- The `direction` style is not supported (the compiler drops it).
- `text-align: right` / `left` are applied as end / start of the line, so they flip for RTL text. Right-aligned rows therefore use auto-width text (`max-width` + one-line ellipsis) inside a column with `align-items: flex-end`. Centered text is fine.
- Flex rows are laid out left to right, so the icon of a list row comes after its text in the markup, and Hebrew keyboard rows are reversed in JS.
- With ellipsis, an RTL line is cut at the correct end but the "..." is drawn on the right.
- Mixed lines start with a Hebrew word when the order matters (for example "20 שירים - Queen", "רצועה 3 - Queen").

## Glyphix notes found while building

- A bound inline style (`style="width: {{w}}px"`) is applied on first render only; the progress bar uses `<progress min max value>` instead, which updates (styled with `color` and `background-color`).
- `<image src="{{uri}}">` with an `internal://mass/...` JPEG works and updates when the value changes.
- A `<tag>` written inside a CSS comment breaks the UX parser.
- Router params are not used: the next page takes its view from `src/lib/boot.js`.

## Package

`com.abaye.music`, a free package opened by the `my-apps` launcher. versionCode 400.

## Build

Requires the Glyphix CLI (`gx` v0.11.0, in `dt-g1-research/tools/glyphix-toolchain`) and the `dtg1-c175r` device profile in `%APPDATA%\glyphix\devices`. The `bin` folder of the CLI (`node_modules/@glyphix/cli-win32-x64/bin`) must be on `PATH`, because the build calls `image-forge` by name.

```
gx build -d dtg1-c175r -f
```

The package is written to `.glyphix-work/dist/dtg1-c175r/com.abaye.music/bundle.pkg`.

The icon and the UI glyphs are drawn by `tools/render-icon.ps1`:

```
.\tools\render-icon.ps1 -OutDir (Resolve-Path src\assets)
```

## Emulator

Put a library in `.glyphix-work/image/dtg1-emu-466x466/data/mass/music/` (`index.json`, `tracks/`, `covers/`) and run:

```
gx emulate -d dtg1-emu-466x466 --target=com.abaye.music
```

`dtg1-emu-466x466` is `generic-watch-466x466` with a Hebrew font. The state file lands in `.glyphix-work/image/dtg1-emu-466x466/data/files/com.abaye.music/state.json`.
