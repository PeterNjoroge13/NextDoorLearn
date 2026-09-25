import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, FileText, HeartHandshake, Mail, Scale, Shield, UserX } from 'lucide-react';

const POLICY_VERSION = '2026-09-21';
const EFFECTIVE_DATE = 'September 21, 2026';

const content = {
  '/privacy': {
    eyebrow: 'Privacy', icon: Shield, title: 'Privacy Policy',
    intro: 'This policy explains what NextDoorLearn collects, why it is needed, when it is shared, and the choices available to students, tutors, and families.',
    sections: [
      { title: 'Information we collect', body: 'We collect account and profile details, age group, guardian information voluntarily added to a student profile, tutor application materials, profile photos, learning preferences, availability, connection requests, messages, session details, reviews, reports, device tokens, and policy acceptances. We also process limited technical and security information needed to operate and protect the service.' },
      { title: 'How information is used', body: 'We use information to authenticate accounts, review tutor applications, recommend matches, enable communication and scheduling, create meeting and calendar events, deliver service emails and notifications, provide support, investigate safety reports, prevent abuse, and improve reliability.' },
      { title: 'Who receives information', body: 'Relevant profile and session information is shared with matched students or tutors. Approved service providers may process data for hosting, database storage, payment processing and tutor payouts, email delivery, video meetings, calendar sync, mobile notifications, and security. NextDoorLearn does not sell personal information or use it for targeted advertising.' },
      { title: 'Payment information', body: 'Stripe processes payment methods, identity verification, connected payout accounts, refunds, and related financial information under its own privacy policy. NextDoorLearn receives transaction identifiers, amounts, statuses, limited error details, and payout-readiness information, but does not receive or store complete card or bank-account numbers.' },
      { title: 'Messages, reports, and safety records', body: 'Messages are visible to their participants. Reports are restricted to authorized moderation access. When safety, fraud, legal, or platform-enforcement needs require it, limited records may be preserved after account deletion.' },
      { title: 'Children and teenagers', body: 'NextDoorLearn does not currently permit accounts for children under 13. Students ages 13–17 must confirm parent or guardian permission. Guardians should supervise online and in-person tutoring arrangements and contact NextDoorLearn if they believe a child under 13 submitted personal information.' },
      { title: 'Retention and deletion', body: 'We retain active-account information while it is needed to provide the service. Users can delete their account from settings. Account deletion removes core profile and activity data, subject to limited retention for safety investigations, fraud prevention, backups, legal obligations, and enforcement records.' },
      { title: 'Security', body: 'NextDoorLearn uses access controls, encrypted transport, password hashing, session revocation, rate limits, restricted provider credentials, and audit records. No internet service can guarantee absolute security. Never send passwords, financial account details, government identifiers, or other unnecessary sensitive information in messages.' },
      { title: 'Your choices', body: 'Users can update profile information, disconnect calendar access, disable notifications, block other users, submit reports, and delete their account. Questions about access, correction, deletion, consent, or privacy can be sent to nextdoorlearn@gmail.com or through the Support page.' },
      { title: 'Policy changes', body: 'Material changes will be identified by a new effective date or policy version. When appropriate, users may be asked to review and accept the updated policy.' },
    ],
  },
  '/terms': {
    eyebrow: 'Terms', icon: Scale, title: 'Terms of Service',
    intro: 'These terms govern access to NextDoorLearn and establish the rules students, tutors, guardians, and visitors must follow.',
    sections: [
      { title: 'Eligibility and accounts', body: 'Student accounts are limited to people age 13 or older. Users ages 13–17 must have parent or guardian permission. Tutor applicants must be at least 18. You must provide accurate information, protect your credentials, and notify NextDoorLearn if you believe your account is compromised.' },
      { title: 'What NextDoorLearn provides', body: 'NextDoorLearn provides tools for tutor discovery, matching, messaging, scheduling, learning progress, and related communications. It does not guarantee a match, academic result, session availability, uninterrupted service, or the conduct of another user.' },
      { title: 'Tutor relationship and review', body: 'Tutors are independent users, not employees or agents of NextDoorLearn. Application approval is not a guarantee of credentials, licensure, background checks, or suitability unless a specific verified badge expressly says otherwise. Guardians and students remain responsible for evaluating fit and supervising arrangements.' },
      { title: 'Fees and payments', body: 'Tutors may volunteer or list a rate up to $25 per hour. For paid sessions, NextDoorLearn calculates the total from the tutor rate saved when the session is booked and the scheduled duration. Stripe processes the payment and routes the tutor share to a verified connected payout account. NextDoorLearn may introduce a clearly disclosed platform fee in the future; no undisclosed fee will be added to an existing booking.' },
      { title: 'Sessions, cancellations, and refunds', body: 'Users should keep availability accurate, attend confirmed sessions, and communicate promptly about changes. A session request is not final until confirmed when confirmation is required. Cancelling a paid session triggers a full refund through the original payment method; bank processing times may delay when funds appear. A paid session may move to a new time without changing duration. Payment disputes, suspected fraud, duplicate charges, or failed refunds should be reported through Support.' },
      { title: 'Acceptable use', body: 'Do not harass, discriminate, threaten, exploit, impersonate, defraud, solicit inappropriate relationships, share explicit content, violate academic-integrity rules, scrape data, probe security, distribute malware, or use the service for anything unrelated to legitimate education and mentoring.' },
      { title: 'Third-party services', body: 'Features may use providers such as Stripe, Zoom, Google Calendar, email delivery, hosting, database, and mobile notification services. Their own terms and privacy practices apply when you choose to use them.' },
      { title: 'Content and privacy', body: 'You retain ownership of content you submit and grant NextDoorLearn permission to host, process, display, and transmit it only as needed to operate, secure, and improve the service. Do not upload content you lack permission to use or another person’s private information.' },
      { title: 'Enforcement and termination', body: 'NextDoorLearn may limit, suspend, or terminate access; remove content; cancel connections or sessions; and preserve relevant records when reasonably needed for safety, legal compliance, fraud prevention, or enforcement of these terms.' },
      { title: 'Disclaimers and responsibility', body: 'The service is provided on an “as available” basis to the extent permitted by law. Users are responsible for their interactions, learning decisions, devices, connectivity, and off-platform conduct. Nothing on NextDoorLearn is emergency, legal, medical, or financial advice.' },
      { title: 'Changes and contact', body: 'These terms may change as the service develops. Continued use after notice of an update may constitute acceptance where permitted; material changes may require fresh consent. Questions can be submitted through the Support page.' },
    ],
  },
  '/guidelines': {
    eyebrow: 'Safety', icon: HeartHandshake, title: 'Community and Safety Guidelines',
    intro: 'Learning works best when every interaction is respectful, observable, age-appropriate, and centered on education.',
    sections: [
      { title: 'Keep every interaction educational', body: 'Use messages, calls, and sessions for tutoring, mentoring, planning, and constructive academic support. Sexual, romantic, exploitative, threatening, discriminatory, or otherwise inappropriate conduct is prohibited.' },
      { title: 'Safety for students under 18', body: 'A parent or guardian should know when and where sessions occur. Use platform scheduling and approved meeting links. In-person sessions should occur in an appropriate public, school, library, or guardian-supervised setting, never an isolated private setting.' },
      { title: 'Protect personal information', body: 'Do not request or share passwords, financial credentials, government identifiers, private school records, precise live location, or unnecessary contact details. Keep communication on the platform whenever practical.' },
      { title: 'Video-session conduct', body: 'Use a neutral and appropriate environment, appropriate clothing and language, and only the approved participants. Do not record, photograph, transcribe, or distribute a session without the informed permission of every participant and, for a minor, their guardian.' },
      { title: 'Academic integrity', body: 'Tutors may explain concepts, review work, and help students practice. Do not complete graded work, exams, interviews, or identity-verification tasks on someone else’s behalf.' },
      { title: 'Money and solicitation', body: 'Be transparent about volunteer status or rates. Do not pressure users into purchases, loans, gifts, investments, unrelated services, or moving communication off-platform. Report suspicious payment requests.' },
      { title: 'Block and report', body: 'Use blocking to immediately stop matching and communication. Submit a report with concise facts when conduct may violate these rules. Reports are reviewed privately, and retaliation against a reporter is prohibited.' },
      { title: 'Urgent danger', body: 'NextDoorLearn is not an emergency service. If someone may be in immediate danger, contact 911 or the appropriate local emergency service, then preserve relevant information and report the account when safe to do so.' },
      { title: 'Tutor expectations', body: 'Tutors must represent experience honestly, stay within their competence, maintain clear boundaries, avoid favoritism or coercion, honor guardian expectations, and promptly disclose anything that may make a session unsafe or inappropriate.' },
      { title: 'Consequences', body: 'Violations may result in warnings, content removal, cancelled sessions, restricted messaging, suspension, permanent removal, preservation of evidence, or referral to appropriate authorities when required.' },
    ],
  },
  '/support': {
    eyebrow: 'Support', icon: Mail, title: 'Support',
    intro: 'Use support for account access, privacy requests, tutor applications, scheduling problems, or safety concerns.',
    sections: [
      { title: 'Account and technical help', body: 'Include the email on your account, the page or feature involved, what you expected, and what happened. Never include your password, reset token, or financial information.' },
      { title: 'Safety reports', body: 'Use the in-product report and block controls whenever possible. Include the user, session, approximate date, and relevant facts. For immediate danger, contact emergency services first.' },
      { title: 'Privacy and deletion', body: 'Account deletion is available in account settings. For access, correction, deletion, or guardian privacy questions that cannot be handled in the product, contact the founder through the LinkedIn profile on the welcome page.' },
      { title: 'Service status', body: 'When reporting an outage, include whether you are using the website or mobile app, your device type, and a screenshot that does not expose passwords or private messages.' },
      { title: 'Contact', body: 'Email nextdoorlearn@gmail.com for account, privacy, payment, safety, or technical support. Do not include passwords, reset tokens, or full financial information.' },
    ],
  },
  '/delete-account': {
    eyebrow: 'Account deletion', icon: UserX, title: 'Delete your NextDoorLearn account',
    intro: 'You can permanently delete your account and associated personal data from NextDoorLearn account settings.',
    sections: [
      { title: 'Delete from the mobile app', body: 'Sign in, open More, choose Account settings, and select Permanently delete my account. Enter your current password to confirm.' },
      { title: 'Delete from the website', body: 'Sign in, open your profile, find Account settings, and use the permanent account-deletion control. Your password and an explicit confirmation are required.' },
      { title: 'What is deleted', body: 'Deletion removes the account, profile, connections, messages, sessions, reviews, goals, notifications, saved tutors, device tokens, provider connections, and other data linked to the account.' },
      { title: 'What may be retained', body: 'Limited records may remain when reasonably required for safety investigations, fraud prevention, backup recovery, legal obligations, dispute handling, or enforcement of platform rules. Retained records are restricted from ordinary product use.' },
      { title: 'Before deleting', body: 'Account deletion cannot be undone. Save any session notes or information you need before confirming deletion.' },
    ],
  },
};

const LegalPage = ({ type }) => {
  const page = content[type] || content['/privacy'];
  const Icon = page.icon;

  return <main className="page legal-page">
    <Link to="/" className="brand-link" style={{ marginBottom: 36 }}><span className="brand-mark"><BookOpen size={22} /></span><span>NextDoorLearn</span></Link>
    <section className="card card-pad legal-document">
      <span className="eyebrow"><Icon size={15} />{page.eyebrow}</span>
      <h1 className="page-title">{page.title}</h1>
      <p className="page-copy">{page.intro}</p>
      <p className="legal-version">Effective {EFFECTIVE_DATE} · Version {POLICY_VERSION}</p>
      <div className="legal-sections">
        {page.sections.map((section) => <article className="legal-section" key={section.title}><span className="stat-icon"><FileText size={18} /></span><div><h2>{section.title}</h2><p>{section.body}</p></div></article>)}
      </div>
      {type === '/support' ? <a className="btn btn-primary" href="mailto:nextdoorlearn@gmail.com?subject=NextDoorLearn%20support" style={{ width: 'fit-content', marginTop: 24 }}><Mail size={18} />Email support</a> : null}
      <div className="button-row" style={{ marginTop: 28 }}><Link className="btn btn-primary" to="/signup">Create an account</Link><Link className="btn btn-ghost" to="/guidelines">Safety guidelines</Link><Link className="btn btn-ghost" to="/support">Support</Link></div>
    </section>
  </main>;
};

export default LegalPage;
