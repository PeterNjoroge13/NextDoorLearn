import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, GraduationCap, Languages, MapPin, Star, Users } from 'lucide-react';
import api from '../services/api';
import { Avatar, EmptyState, ErrorState, LoadingState } from '../components/AppShell';
import { parseList } from '../utils/format';

const PublicTutorProfile = () => {
  const { tutorId } = useParams();
  const [tutor, setTutor] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getPublicTutorProfile(tutorId)
      .then((response) => response.error ? setError(response.error) : setTutor(response))
      .catch(() => setError('This tutor profile could not be loaded.'));
  }, [tutorId]);

  if (error) return <ErrorState title="Profile unavailable" message={error} action={<Link className="btn btn-primary" to="/">Return home</Link>} />;
  if (!tutor) return <LoadingState label="Opening tutor profile..." />;

  const subjects = parseList(tutor.subjects);
  const languages = parseList(tutor.languages);
  const ageGroups = parseList(tutor.age_groups);
  const certifications = parseList(tutor.certifications);

  return (
    <main className="public-profile-page">
      <header className="public-flow-nav">
        <Link className="brand-link" to="/"><span className="brand-mark"><BookOpen size={22} /></span>NextDoorLearn</Link>
        <div className="button-row"><Link className="btn btn-ghost btn-sm" to="/"><ArrowLeft size={16} />Home</Link><Link className="btn btn-primary btn-sm" to="/signup">Join to connect</Link></div>
      </header>
      <section className="public-profile-hero">
        <Avatar name={tutor.name} src={tutor.avatar_url} size={108} />
        <div><span className="eyebrow"><GraduationCap size={15} />Community tutor</span><h1>{tutor.name}</h1><h2>{tutor.headline || 'Helping students learn with confidence'}</h2><p>{tutor.bio || tutor.motivation || 'A NextDoorLearn tutor committed to accessible academic support.'}</p><div className="chip-row"><span className="badge badge-warning"><Star size={14} />{Number(tutor.averageRating) ? Number(tutor.averageRating).toFixed(1) : 'New'} rating</span><span className="badge">{Number(tutor.hourly_rate || 0) === 0 ? 'Volunteer tutor' : `$${tutor.hourly_rate}/hr`}</span>{tutor.service_area ? <span className="badge"><MapPin size={14} />{tutor.service_area}</span> : null}</div></div>
      </section>
      <section className="public-profile-grid">
        <article className="card card-pad"><h2>Subjects</h2><div className="chip-row">{subjects.map((subject) => <span className="badge badge-primary" key={subject}>{subject}</span>)}</div></article>
        <article className="card card-pad"><h2>How I teach</h2><p>{tutor.teaching_style || 'Teaching approach coming soon.'}</p></article>
        <article className="card card-pad"><h2>Students I support</h2><div className="chip-row">{ageGroups.length ? ageGroups.map((group) => <span className="badge" key={group}><Users size={14} />{group}</span>) : <span className="muted">Age groups coming soon.</span>}</div></article>
        <article className="card card-pad"><h2>Languages and format</h2><div className="chip-row">{languages.map((language) => <span className="badge" key={language}><Languages size={14} />{language}</span>)}{tutor.tutoring_mode ? <span className="badge badge-blue">{tutor.tutoring_mode}</span> : null}</div></article>
        <article className="card card-pad public-profile-wide"><h2>Background</h2><p>{tutor.education || 'Background details coming soon.'}</p>{certifications.length ? <div className="chip-row">{certifications.map((cert) => <span className="badge badge-blue" key={cert}>{cert}</span>)}</div> : null}</article>
        <article className="card card-pad public-profile-wide"><h2>Why I tutor</h2><p>{tutor.motivation || 'This tutor is building their story.'}</p></article>
      </section>
      <section className="public-review-section"><div><span className="eyebrow">Student feedback</span><h2>What learning together has felt like.</h2></div>{tutor.reviews?.length ? <div className="grid grid-2">{tutor.reviews.map((review) => <article className="card card-pad" key={review.id}><span className="badge badge-warning"><Star size={14} />{review.rating}</span><p>{review.comment}</p><small className="muted">NextDoorLearn student</small></article>)}</div> : <EmptyState icon={Star} title="No public feedback yet">Reviews will appear after completed tutoring connections.</EmptyState>}</section>
      <section className="public-profile-cta"><div><h2>Want to learn with {tutor.name.split(' ')[0]}?</h2><p>Create a student account to request help through NextDoorLearn's protected connection flow.</p></div><Link className="btn btn-primary" to="/signup">Create a student account</Link></section>
    </main>
  );
};

export default PublicTutorProfile;
