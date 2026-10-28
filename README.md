# Courtyard Pulse

The repository's supported app is the native Expo application in [`mobile/`](./mobile). It tracks the 41 rooms shown on the fifth-floor Courtyard Residence plan:

- `5210`–`5232`
- `5251`–`5268`

Statuses and conversation notes are stored in SQLite on the device. The app does not require Safari, a local web server, a QR code, a shared Wi-Fi network, or an internet connection after it has loaded.

The current app also supports:

- One-tap visits, undo for status changes, and a next-room workflow.
- Persistent follow-up flags and Normal/Soon/Urgent room priorities.
- Last-visited timestamps and CSV export for backup or handoff.
- Bulk updates for the currently visible rooms.
- A confirmed new-session reset and animated floor-completion feedback.

## Test on an iPhone with Expo Go

1. Install **Expo Go** from the iPhone App Store.
2. In a terminal:

   ```bash
   cd "/Users/daiwikmarrott/Desktop/SFU/Projects/room_tracker/Room_tracker/mobile"
   npm install
   npx expo start --tunnel --clear
   ```

3. Open the printed `exp://` link in Expo Go. You can use Expo's development QR code or choose Expo Go's **Enter URL manually** option and paste the `exp://` URL.
4. Keep Metro running while testing. The first load needs internet access for the tunnel; room data and notes then remain local to the phone.

If Expo Go reports `Cannot find native module 'ExpoAsset'`, update Expo Go, stop Metro with `Control+C`, and rerun the command above. The project includes the SDK-compatible `expo-asset` dependency and the `--clear` flag removes stale Metro bundles.

The header's **Export** action creates a CSV room log containing each room's status, follow-up flag, and conversation notes, then opens the native share sheet for backup or handoff.

## Validate the native app

```bash
cd mobile
npm run test
npx tsc --noEmit
npx expo export --platform ios
```

`npm run test` runs the Vitest suite in `mobile/src/trackerLogic.test.ts`. The tests cover room filtering, progress counting, CSV escaping/export shape, visit timestamps, priority ordering, bulk status updates, session reset behavior, and completion detection.

For a standalone development build installed on a connected iPhone, use Xcode and Apple signing:

```bash
npx expo run:ios --device
```

## Data and privacy

The mobile app creates `courtyard-room-tracker.db` in the app's private SQLite storage. Notes are not uploaded anywhere. The app migrates existing databases when new room fields are introduced. Deleting the app deletes its local database. Use the in-app export action to keep a backup of important records.

The supplied source plan is stored at [`mobile/assets/courtyard-floor-plan.pdf`](./mobile/assets/courtyard-floor-plan.pdf). It is reference material; the room seed is kept in [`mobile/App.tsx`](./mobile/App.tsx) so the displayed list is explicit and reviewable.

## Project structure

```text
mobile/App.tsx          Native UI, room list, statuses, notes, SQLite
mobile/app.json         Expo app identity and native configuration
mobile/package.json     Expo dependencies and scripts
mobile/assets/          App icons and supplied floor-plan reference
```

## Development checks

Before pushing app changes:

```bash
cd mobile
npm run test
npm run check
npm run build:ios
```

Keep native behavior local-first: status, note, follow-up, priority, and visit data should remain in SQLite unless the user explicitly chooses the CSV export action.
