# App Review notes template

Replace every bracketed value in App Store Connect. Never commit reviewer passwords.

## Contact

- Support: `nextdoorlearn@gmail.com`
- Support URL: `https://www.nextdoorlearn.com/support`
- Privacy policy: `https://www.nextdoorlearn.com/privacy`
- Privacy choices and deletion: `https://www.nextdoorlearn.com/delete-account`

## Reviewer access

Student account:

- Email: `[ACTIVE REVIEW STUDENT EMAIL]`
- Password: `[PASSWORD]`

Tutor account:

- Email: `[ACTIVE REVIEW TUTOR EMAIL]`
- Password: `[PASSWORD]`

Both accounts must be email-verified, active, populated with realistic sample data, and connected to each other. Keep the production API awake and verify the credentials immediately before submission.

The production build was created with `[EAS BUILD ID]` using Xcode `[VERSION]` and the iOS `[VERSION]` SDK. Confirm these values meet Apple's upload requirements before replacing this note in App Store Connect.

## Features to review

1. Sign in as the student to review intake, tutor discovery, connection requests, messages, scheduling, goals, reporting, blocking, notification preferences, and account deletion.
2. Sign in as the tutor to review requests, availability, student progress, sessions, messaging, earnings, and payout status.
3. Reporting is available from tutor profiles and the conversation safety menu. Blocking immediately removes matching and communication. Reports notify the moderation team at the configured administrator address.
4. Account deletion is in **More > Account settings > Delete account** and removes the account and associated data after password confirmation.

## Payments

NextDoorLearn uses Stripe for real-time, one-to-one tutoring sessions between a student and tutor. These person-to-person services qualify for external payment processing under App Review Guideline 3.1.3(d). The app does not sell digital content, group classes, subscriptions, boosts, or other in-app digital goods.

For review, use a free session unless Stripe live processing has been fully enabled. If paid-session review is needed, provide a scheduled test session and any permitted Stripe test instructions in App Review notes.

## Safety and minors

NextDoorLearn is not submitted to the Kids Category. Accounts are limited to ages 13 and older; users ages 13–17 must confirm parent or guardian permission. Tutor applicants must be adults and require administrator approval. User content is screened for high-confidence unsafe material before posting, and users can report and block others. Public tutor pages exclude private contact information.

## Login services

The app uses first-party email and password authentication only. It does not offer Google, Facebook, or another third-party social login, so Guideline 4.8 does not require Sign in with Apple for this version.

## Encryption

The app uses standard HTTPS/TLS and declares `ITSAppUsesNonExemptEncryption` as `false`. Confirm the export-compliance answer in App Store Connect for every submitted build.
