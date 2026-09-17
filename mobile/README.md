# NextDoorLearn Mobile

The native iOS and Android companion to NextDoorLearn. It shares the production API with the web app while providing role-specific student and tutor navigation, secure sessions, push registration, deep links, and native profile-photo selection.

## Run on a phone

1. Install Expo Go from the iOS App Store or Google Play.
2. Put the computer and phone on the same Wi-Fi network.
3. From this directory, run `npm install` and `npm start`.
4. Scan the QR code with the phone camera on iOS or the Expo Go scanner on Android.

The checked-in default connects to the production Render API. Override it for a local backend:

```bash
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_LAN_IP:3001/api npm start
```

Do not use `localhost` in that override when testing on a physical phone; it would refer to the phone itself.

## Run on a computer

```bash
npm run web
```

The web preview is useful for fast responsive checks. Native behavior such as secure storage, notifications, and image picking should also be checked in Expo Go or an installable preview build.

## Quality checks

```bash
npm run lint
npm run typecheck
npm run export:web
npx expo-doctor
```

## Installable preview builds

After authenticating the Expo CLI and linking the project once:

```bash
npx eas-cli login
npx eas-cli init
npm run build:preview
```

The preview profile creates internally distributed builds that can be installed before store review. iOS device builds require an Apple Developer account and registered signing credentials. Android previews can be distributed as installable APKs through EAS.

## Production release

Use `npm run build:production` and `npm run submit:production` after completing the account-owned setup in [STORE_SUBMISSION.md](./STORE_SUBMISSION.md). Store listing copy is maintained in [store/metadata.md](./store/metadata.md).
