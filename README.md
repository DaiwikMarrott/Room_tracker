# Courtyard Pulse

The repository's supported app is the native Expo application in [`mobile/`](./mobile). It tracks the 41 rooms shown on the fifth-floor Courtyard Residence plan:

- `5210`–`5232`
- `5251`–`5268`

Statuses and conversation notes are stored in SQLite on the device. The app does not require Safari, a local web server, a QR code, a shared Wi-Fi network, or an internet connection after it has loaded.

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

## Validate the native app

```bash
cd mobile
npx tsc --noEmit
npx expo export --platform ios
```

For a standalone development build installed on a connected iPhone, use Xcode and Apple signing:

```bash
npx expo run:ios --device
```

## Data and privacy

The mobile app creates `courtyard-room-tracker.db` in the app's private SQLite storage. Notes are not uploaded anywhere. Deleting the app deletes its local database, so add an export/backup feature before relying on this as the only copy of important records.

The supplied source plan is stored at [`mobile/assets/courtyard-floor-plan.pdf`](./mobile/assets/courtyard-floor-plan.pdf). It is reference material; the room seed is kept in [`mobile/App.tsx`](./mobile/App.tsx) so the displayed list is explicit and reviewable.

## Project structure

```text
mobile/App.tsx          Native UI, room list, statuses, notes, SQLite
mobile/app.json         Expo app identity and native configuration
mobile/package.json     Expo dependencies and scripts
mobile/assets/          App icons and supplied floor-plan reference
```

## 15-commit development plan

The repository currently has no commits. The intended history is fifteen small, independently pushed phases:

1. `chore: scaffold expo mobile app`
2. `feat: add floor room seed`
3. `feat: add sqlite persistence`
4. `feat: add room status cards`
5. `feat: add connected and no-answer actions`
6. `feat: add conversation notes`
7. `feat: add progress summary`
8. `feat: add room search`
9. `feat: add status filters`
10. `feat: polish mobile layout`
11. `docs: document expo setup and privacy`
12. `test: validate expo ios bundle`
13. `feat: add local data export`
14. `feat: add optional device backup`
15. `release: publish courtyard room tracker v1`

Before each push:

```bash
cd mobile
npx tsc --noEmit
npx expo export --platform ios
git add .
git commit -m "phase commit message"
git push origin main
```
