# Mobile release and App Review checklist

The codebase is prepared for iOS and Android builds with Expo Application Services. The remaining steps require the product owner's Apple, Google, and Expo accounts.

## One-time owner setup

1. The Expo owner is configured as `peternjo`. Confirm that account with `npx expo whoami`.
2. From `mobile/`, run `npx eas-cli@latest init`. This is the remaining EAS link step: it creates or links the remote project, adds the generated project ID to `app.json`, and enables production push-token registration.
3. Enroll in the Apple Developer Program and create the App Store Connect app for bundle ID `com.peternjoroge.nextdoorlearn`.
4. Create a Google Play Console developer account and app with package `com.peternjoroge.nextdoorlearn`.
5. Create dedicated student and tutor reviewer accounts in production. Put credentials only in App Store Connect and Play Console review notes, never in git.
6. Confirm the production privacy, support, terms, and account-deletion URLs are live.
7. Add Stripe live keys and the signed production webhook only after the test-mode payment release gate in `PAYMENT_OPERATIONS.md` passes.

## Test releases

1. Run `npm run lint`, `npm run typecheck`, and `npm run export:web`.
2. Run `npm run build:preview` and install the internal iOS/Android builds on physical devices.
3. Test registration, login persistence, intake, tutor discovery, connection requests, messaging, scheduling, a free session, tutor payout onboarding, a paid session, cancellation/refund, profile photo upload, notifications, reporting/blocking, and account deletion.
4. Open a message and session push notification and confirm each one deep-links to the correct record.
5. Capture current iPhone and Android screenshots from the signed preview builds.

## Production submission

1. Run `npm run build:production`.
2. Complete privacy/data-safety questionnaires truthfully from the app's real behavior.
3. Add store copy and screenshots, reviewer credentials, support URL, privacy URL, and account-deletion URL.
4. Run `npm run submit:production` after the listings are complete.

## Apple review gates

- Build the submitted binary with Xcode 26 or later and the iOS 26 SDK or later. Apple has required this for uploads since April 28, 2026; confirm the EAS production build image satisfies the current requirement before every submission.
- Use `store/app-privacy.md` to complete and publish App Privacy answers. Reconcile the final binary's Xcode privacy report first.
- Use `store/app-review-notes.md` for reviewer credentials, navigation, payment explanation, safety controls, and deletion instructions.
- Complete Apple's current age-rating questionnaire, including messaging, user-generated content, and tutoring interactions. NextDoorLearn should not be submitted to the Kids Category; its current minimum account age is 13.
- Upload final screenshots from the exact build for every required iPhone and iPad display size. Screenshots and copy must describe the shipped features accurately.
- Confirm `nextdoorlearn@gmail.com`, the support URL, privacy URL, and deletion URL are reachable without a reviewer account.
- Keep both reviewer accounts active and the production backend awake throughout review.
- Test content filtering, reports, blocks, account deletion, photo permission, push permission, payment errors, and offline errors on a physical iPhone and iPad.
- Do not add Google or another social login without adding an equivalent privacy-preserving login option that satisfies Guideline 4.8.
- Do not add group classes, digital subscriptions, paid boosts, or digital content to Stripe checkout without a new App Store payment review; the current Stripe exception is limited to real-time one-to-one tutoring.

Do not submit until email delivery, push credentials, Stripe test-mode payment/refund verification, production monitoring, and both reviewer accounts have been verified on physical devices. Profile images are persistent in Neon for the initial release; move them to object storage as usage grows.
