import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, FileText, HeartHandshake, Mail, Scale, Shield, UserX } from 'lucide-react';

const content = {
  '/privacy': {
    eyebrow: 'Privacy',
    icon: Shield,
    title: 'Privacy Policy',
    intro:
      'NextDoorLearn collects only the account, profile, messaging, and scheduling information needed to run the tutoring platform.',
    sections: [
      {
        title: 'Information we collect',
        body:
          'We collect account details, profile information, tutor/student preferences, connection requests, messages, session information, reviews, and technical data needed to keep the service reliable and secure.',
      },
      {
        title: 'How we use information',
        body:
          'We use information to authenticate users, match students and tutors, support messaging and scheduling, improve safety, send service notifications, and maintain the platform.',
      },
      {
        title: 'Sharing',
        body:
          'Profile and connection information is shared with relevant students or tutors inside the product. We do not sell personal information.',
      },
      {
        title: 'Data choices',
        body:
          'Users can update profile information and permanently delete their account from account settings. For other data questions, contact the project owner through the support page.',
      },
    ],
  },
  '/terms': {
    eyebrow: 'Terms',
    icon: Scale,
    title: 'Terms of Service',
    intro:
      'These terms set expectations for using NextDoorLearn responsibly during beta and production use.',
    sections: [
      {
        title: 'Use of the platform',
        body:
          'Use NextDoorLearn only for legitimate tutoring, mentoring, learning, and scheduling activity. Do not impersonate others, harass users, or misuse messaging.',
      },
      {
        title: 'Tutors and students',
        body:
          'Tutors are responsible for accurate profiles and appropriate conduct. Students are responsible for respectful communication and attending scheduled sessions.',
      },
      {
        title: 'Beta limitations',
        body:
          'Some features may change during beta. The service may be updated, limited, or temporarily unavailable while the platform matures.',
      },
      {
        title: 'Safety',
        body:
          'Users should report concerning behavior. NextDoorLearn may remove accounts or content that violates community expectations.',
      },
    ],
  },
  '/guidelines': {
    eyebrow: 'Community',
    icon: HeartHandshake,
    title: 'Community Guidelines',
    intro:
      'NextDoorLearn should feel safe, respectful, and focused on learning for both students and tutors.',
    sections: [
      {
        title: 'Be respectful',
        body:
          'Communicate with patience. No harassment, discrimination, intimidation, or inappropriate messages.',
      },
      {
        title: 'Keep learning central',
        body:
          'Use sessions and messages for tutoring, mentoring, homework support, planning, and constructive academic help.',
      },
      {
        title: 'Protect privacy',
        body:
          'Do not share another user’s private information outside the platform. Avoid asking for sensitive information that is not needed for tutoring.',
      },
      {
        title: 'Show up prepared',
        body:
          'Honor scheduled sessions, communicate if plans change, and keep profiles and availability accurate.',
      },
    ],
  },
  '/support': {
    eyebrow: 'Support',
    icon: Mail,
    title: 'Support',
    intro:
      'Need help with an account, safety concern, tutor profile, or deployment question? Start here.',
    sections: [
      {
        title: 'Account help',
        body:
          'For login, profile, or connection issues, include your account email and a short description of what happened.',
      },
      {
        title: 'Safety reports',
        body:
          'For urgent safety or conduct concerns, include the user name, what happened, and any relevant session or message context.',
      },
      {
        title: 'Contact',
        body:
          'During beta, contact founder Peter Njoroge through the LinkedIn profile linked from the NextDoorLearn home page. Do not include passwords or other sensitive information.',
      },
    ],
  },
  '/delete-account': {
    eyebrow: 'Account deletion',
    icon: UserX,
    title: 'Delete your NextDoorLearn account',
    intro:
      'You can permanently delete your account and associated personal data from NextDoorLearn account settings.',
    sections: [
      {
        title: 'Delete from the mobile app',
        body:
          'Sign in, open More, choose Account settings, and select Permanently delete my account. Enter your current password to confirm.',
      },
      {
        title: 'Delete from the web app',
        body:
          'Sign in on the web, open your profile or account settings, and use the account deletion control. If the control is unavailable during beta, use the support page to contact the project owner.',
      },
      {
        title: 'What is deleted',
        body:
          'Deletion removes your account, profile, connections, messages, sessions, reviews, goals, notifications, saved tutors, device tokens, and other data linked to your account. The action cannot be undone.',
      },
      {
        title: 'Safety and legal records',
        body:
          'Limited records may be retained only when required for fraud prevention, safety investigations, legal obligations, or enforcement of platform rules.',
      },
    ],
  },
};

const LegalPage = ({ type }) => {
  const page = content[type] || content['/privacy'];
  const Icon = page.icon;

  return (
    <main className="page">
      <Link to="/login" className="brand-link" style={{ marginBottom: 36 }}>
        <span className="brand-mark">
          <BookOpen size={22} />
        </span>
        <span>NextDoorLearn</span>
      </Link>

      <section className="card card-pad" style={{ maxWidth: 920 }}>
        <span className="eyebrow">
          <Icon size={15} />
          {page.eyebrow}
        </span>
        <h1 className="page-title">{page.title}</h1>
        <p className="page-copy">{page.intro}</p>

        <div className="grid" style={{ marginTop: 28 }}>
          {page.sections.map((section) => (
            <article className="list-item" key={section.title}>
              <div className="item-main">
                <span className="stat-icon">
                  <FileText size={18} />
                </span>
                <div>
                  <h2 style={{ fontSize: '1.05rem' }}>{section.title}</h2>
                  <p className="muted" style={{ marginTop: 6 }}>{section.body}</p>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="button-row" style={{ marginTop: 28 }}>
          <Link className="btn btn-primary" to="/login">Back to sign in</Link>
          <Link className="btn btn-ghost" to="/guidelines">Community guidelines</Link>
        </div>
      </section>
    </main>
  );
};

export default LegalPage;
