import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  HeartHandshake,
  MapPin,
  MessageCircle,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Landing = () => {
  const { user } = useAuth();

  return (
    <main className="landing-page">
      <header className="landing-nav">
        <Link to="/" className="brand-link" aria-label="NextDoorLearn home">
          <span className="brand-mark">
            <BookOpen size={22} strokeWidth={2.4} />
          </span>
          <span>NextDoorLearn</span>
        </Link>
        <nav className="landing-nav-actions" aria-label="Welcome navigation">
          <a href="#mission">Mission</a>
          <a href="#founder">Founder</a>
          {user ? (
            <Link className="btn btn-primary btn-sm" to="/dashboard">Dashboard</Link>
          ) : (
            <>
              <Link className="btn btn-ghost btn-sm" to="/login">Log in</Link>
              <Link className="btn btn-primary btn-sm" to="/signup">Sign up</Link>
            </>
          )}
        </nav>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-content">
          <span className="eyebrow">
            <HeartHandshake size={15} />
            Community tutoring for every student
          </span>
          <h1>Free and low-cost tutoring, built around students who need it most.</h1>
          <p>
            NextDoorLearn connects underserved and low-income students with tutors,
            mentors, college students, and neighbors willing to volunteer their time
            or offer affordable academic support.
          </p>
          <div className="button-row landing-cta-row">
            <Link className="btn btn-primary" to="/signup">
              Create an account
              <ArrowRight size={18} />
            </Link>
            <Link className="btn btn-ghost" to="/login">Log in</Link>
          </div>
        </div>
      </section>

      <section className="landing-band" id="mission">
        <div className="landing-section-head">
          <span className="eyebrow">
            <Sparkles size={15} />
            Why this matters
          </span>
          <h2>Talent is everywhere. Access to help is not.</h2>
          <p>
            A student should not lose confidence, fall behind, or give up on a path
            simply because private tutoring is too expensive. NextDoorLearn is a
            place where academic support can be easier to find, safer to request,
            and centered on community care.
          </p>
        </div>

        <div className="mission-grid">
          <article>
            <span className="stat-icon"><GraduationCap size={22} /></span>
            <h3>For students</h3>
            <p>Find tutors by subject, request help, message safely, and schedule sessions without cost being the first barrier.</p>
          </article>
          <article>
            <span className="stat-icon"><Users size={22} /></span>
            <h3>For tutors</h3>
            <p>Volunteer or offer low-cost support, manage requests, and help students build confidence one session at a time.</p>
          </article>
          <article>
            <span className="stat-icon"><MapPin size={22} /></span>
            <h3>For communities</h3>
            <p>Turn local knowledge, mentorship, and care into practical academic support for students who are often overlooked.</p>
          </article>
        </div>
      </section>

      <section className="landing-split" id="founder">
        <div className="founder-portrait">
          <img src="/images/peter-njoroge-headshot.jpeg" alt="Peter Njoroge" />
          <div className="founder-portrait-caption">
            <span>Built from lived experience</span>
            <strong>Baltimore to computer science</strong>
          </div>
        </div>
        <div className="founder-copy">
          <span className="eyebrow">
            <BookOpen size={15} />
            Founder note
          </span>
          <h2>Why I am building NextDoorLearn</h2>
          <p>
            My name is{' '}
            <a href="https://www.linkedin.com/in/peter-njoroge13" target="_blank" rel="noreferrer">
              Peter Njoroge
            </a>
            . I am a college student studying computer science, and I know what it
            feels like to hit a class that makes you question whether you belong.
            The right tutor can turn that kind of class from isolating to possible,
            but I have also felt the other side: needing help and not being able to
            access it because tutoring costs too much.
          </p>
          <p>
            I grew up in Baltimore, and I have seen how the education gap shows up
            in real life: in students, families, confidence, and opportunity. I am
            building NextDoorLearn because I want education to be one of the
            foundations of the communities I grew up in. This platform comes from
            needing help myself, seeing how uneven access can be, and believing
            support should feel close, human, and reachable.
          </p>
        </div>
      </section>

      <section className="landing-band landing-final">
        <div>
          <span className="eyebrow">
            <CheckCircle2 size={15} />
            Start here
          </span>
          <h2>Join as a student or tutor.</h2>
          <p>
            Create an account to browse tutors, offer help, send requests, message,
            and turn academic support into something students can actually reach.
          </p>
        </div>
        <div className="button-row">
          <Link className="btn btn-primary" to="/signup">
            Sign up
            <ArrowRight size={18} />
          </Link>
          <Link className="btn btn-ghost" to="/login">
            <MessageCircle size={18} />
            Log in
          </Link>
        </div>
      </section>
    </main>
  );
};

export default Landing;
