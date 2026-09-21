# Mobile release checklist

The codebase is prepared for iOS and Android builds with Expo Application Services. The remaining steps require the product owner's Apple, Google, and Expo accounts.

## One-time owner setup

1. The Expo owner is configured as `peternjo`. Confirm that account with `npx expo whoami`.
2. From `mobile/`, run `npx eas-cli@latest init`. This is the remaining EAS link step: it creates or links the remote project, adds the generated project ID to `app.json`, and enables production push-token registration.
3. Enroll in the Apple Developer Program and create the App Store Connect app for bundle ID `com.peternjoroge.nextdoorlearn`.
4. Create a Google Play Console developer account and app with package `com.peternjoroge.nextdoorlearn`.
5. Create dedicated student and tutor reviewer accounts in production. Put credentials only in App Store Connect and Play Console review notes, never in git.
6. Confirm the production privacy, support, terms, and account-deletion URLs are live.

## Test releases

1. Run `npm run lint`, `npm run typecheck`, and `npm run export:web`.
2. Run `npm run build:preview` and install the internal iOS/Android builds on physical devices.
3. Test registration, login persistence, intake, tutor discovery, connection requests, messaging, scheduling, profile photo upload, notifications, reporting/blocking, and account deletion.
4. Open a message and session push notification and confirm each one deep-links to the correct record.
5. Capture current iPhone and Android screenshots from the signed preview builds.

## Production submission

1. Run `npm run build:production`.
2. Complete privacy/data-safety questionnaires truthfully from the app's real behavior.
3. Add store copy and screenshots, reviewer credentials, support URL, privacy URL, and account-deletion URL.
4. Run `npm run submit:production` after the listings are complete.

Do not submit until email delivery, push credentials, production monitoring, and both reviewer accounts have been verified on physical devices. Profile images are persistent in Neon for the initial release; move them to object storage as usage grows.
