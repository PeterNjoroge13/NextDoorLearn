# App Store privacy answers

Use this inventory when completing App Privacy in App Store Connect. Re-audit it whenever the app or an SDK changes. Apple requires disclosures for data collected by NextDoorLearn and its third-party partners.

Privacy policy URL: `https://www.nextdoorlearn.com/privacy`

Privacy choices URL: `https://www.nextdoorlearn.com/delete-account`

## Data linked to the user

Select **App Functionality** as the purpose and **No** for tracking for every item below.

| App Store category | Data type | Why it is collected |
| --- | --- | --- |
| Contact Info | Name | Account, tutor profile, sessions, support |
| Contact Info | Email Address | Authentication, verification, service email, support |
| Contact Info | Phone Number | Optional profile and tutor application contact |
| Contact Info | Physical Address | User-entered city, service area, or location; no device location API |
| Financial Info | Payment Info | Stripe PaymentSheet processes a student's payment method; NextDoorLearn does not store full card or bank numbers |
| Purchases | Purchase History | Session charges, refunds, payment status, tutor earnings |
| Sensitive Info | Sensitive Info | Declared age group, guardian permission, accessibility or support needs |
| User Content | Emails or Text Messages | Student-tutor messaging |
| User Content | Photos or Videos | Profile and tutor application photos |
| User Content | Customer Support | Support requests and safety reports |
| User Content | Other User Content | Profiles, goals, session notes, reviews, applications, availability |
| Identifiers | User ID | Internal account ID used throughout the service |
| Identifiers | Device ID | Push token associated with the signed-in account and device |

## Answer no

- Tracking: **No**. NextDoorLearn has no advertising SDK, data broker, cross-app advertising, or tracking domain.
- Precise Location and Coarse Location: **No**. The app does not request Location Services. A location typed into a profile is disclosed as Contact Info.
- Contacts, Browsing History, Search History, Advertising Data, Health, Fitness, Audio, and Environment Scanning: **No**.
- Product Interaction, Analytics, and Diagnostics: **No** for the current binary because NextDoorLearn does not currently send analytics or crash telemetry. Update this before adding Sentry, Firebase Analytics, or another telemetry SDK.

## Validation before submission

1. Build the exact production binary.
2. Generate the Xcode privacy report or upload to TestFlight.
3. Reconcile Apple warnings and every SDK privacy manifest with this document.
4. Publish the App Privacy answers before submitting the version.

References: [Apple app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy), [Apple privacy manifest files](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files).
