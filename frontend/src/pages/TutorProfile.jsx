import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bookmark,
  CalendarDays,
  Flag,
  GraduationCap,
  Languages,
  MapPin,
  MessageCircle,
  Star,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import AppShell, { Avatar, EmptyState, ErrorState, LoadingState } from '../components/AppShell';
import ReportUserModal from '../components/ReportUserModal';
import { parseList } from '../utils/format';

const dayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TutorProfile = () => {
  const { tutorId } = useParams();
  const { user } = useAuth();
  const [tutor, setTutor] = useState(null);
  const [favorite, setFavorite] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [reportUser, setReportUser] = useState(null);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTutor = async () => {
      try {
        const token = localStorage.getItem('token');
        const [profileResponse, favoritesResponse] = await Promise.all([
          api.getTutorProfile(tutorId, token),
          user?.role === 'student' ? api.getFavorites(token) : Promise.resolve([]),
        ]);

        if (profileResponse.error) {
          setError(profileResponse.error);
        } else {
          setTutor(profileResponse);
        }

        if (Array.isArray(favoritesResponse)) {
          setFavorite(favoritesResponse.some((item) => Number(item.id) === Number(tutorId)));
        }
      } catch {
        setError('Tutor profile could not be loaded.');
      } finally {
        setLoading(false);
      }
    };

    fetchTutor();
  }, [tutorId, user?.role]);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 3600);
  };

  const handleRequestConnection = async () => {
    const token = localStorage.getItem('token');
    const response = await api.sendConnectionRequest(tutor.id, token);
    if (response.error) {
      showToast(response.error);
    } else {
      setRequestSent(true);
      showToast('Request sent. The tutor will see it in their queue.');
    }
  };

  const handleToggleFavorite = async () => {
    const token = localStorage.getItem('token');
    const response = favorite
      ? await api.removeFavorite(tutor.id, token)
      : await api.addFavorite(tutor.id, token);

    if (response.error) {
      showToast(response.error);
    } else {
      setFavorite((current) => !current);
      showToast(favorite ? 'Removed from saved tutors.' : 'Saved to your tutor shortlist.');
    }
  };

  if (loading) return <LoadingState label="Opening tutor profile..." />;
  if (error) return <ErrorState message={error} action={<Link className="btn btn-primary" to="/tutors">Back to tutors</Link>} />;

  const subjects = parseList(tutor.subjects);
  const languages = parseList(tutor.languages);
  const certifications = parseList(tutor.certifications);
  const availability = Array.isArray(tutor.availability) ? tutor.availability : [];
  const rating = Number(tutor.averageRating || 0);

  return (
    <AppShell>
      <main className="page">
        <Link className="btn btn-ghost btn-sm" to="/tutors" style={{ width: 'fit-content' }}>
          <ArrowLeft size={16} />
          Back to tutors
        </Link>

        {toast ? <div className="alert" style={{ marginTop: 16 }}>{toast}</div> : null}

        <section className="profile-hero">
          <div className="profile-hero-main">
            <Avatar name={tutor.name} src={tutor.avatar_url} size={86} />
            <div>
              <span className="eyebrow">
                <GraduationCap size={15} />
                Tutor profile
              </span>
              <h1>{tutor.name}</h1>
              <p>{tutor.bio || tutor.teaching_style || 'A NextDoorLearn tutor ready to help students make progress.'}</p>
              <div className="chip-row">
                <span className="badge badge-warning">
                  <Star size={14} />
                  {rating ? rating.toFixed(1) : 'New'} rating
                </span>
                <span className="badge">
                  {Number(tutor.hourly_rate || 0) === 0 ? 'Free' : `$${tutor.hourly_rate}/hr`}
                </span>
                {tutor.location ? (
                  <span className="badge">
                    <MapPin size={14} />
                    {tutor.location}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <aside className="card card-pad profile-action-panel">
            {user?.role === 'student' ? (
              <>
                <button
                  className={`btn ${requestSent ? 'btn-ghost' : 'btn-primary'} w-full`}
                  type="button"
                  onClick={handleRequestConnection}
                  disabled={requestSent}
                >
                  <MessageCircle size={18} />
                  {requestSent ? 'Request sent' : 'Request help'}
                </button>
                <button className={`btn ${favorite ? 'btn-secondary' : 'btn-ghost'} w-full`} type="button" onClick={handleToggleFavorite}>
                  <Bookmark size={18} />
                  {favorite ? 'Saved tutor' : 'Save tutor'}
                </button>
              </>
            ) : null}
            <button className="btn btn-ghost w-full" type="button" onClick={() => setReportUser({ id: tutor.id, name: tutor.name })}>
              <Flag size={18} />
              Report profile
            </button>
          </aside>
        </section>

        <section className="section grid grid-3">
          <article className="card card-pad">
            <h2>Subjects</h2>
            <div className="chip-row" style={{ marginTop: 14 }}>
              {subjects.length ? subjects.map((subject) => (
                <span className="badge badge-primary" key={subject}>{subject}</span>
              )) : <span className="badge">Subjects coming soon</span>}
            </div>
          </article>

          <article className="card card-pad">
            <h2>Teaching style</h2>
            <p className="page-copy">{tutor.teaching_style || 'This tutor has not added a teaching style yet.'}</p>
          </article>

          <article className="card card-pad">
            <h2>Languages</h2>
            <div className="chip-row" style={{ marginTop: 14 }}>
              {languages.length ? languages.map((language) => (
                <span className="badge" key={language}>
                  <Languages size={14} />
                  {language}
                </span>
              )) : <span className="badge">Not listed yet</span>}
            </div>
          </article>
        </section>

        <section className="section grid grid-2">
          <article className="card card-pad">
            <div className="section-head compact">
              <div>
                <h2>Availability</h2>
                <p>Recurring windows this tutor has shared.</p>
              </div>
              <CalendarDays size={22} />
            </div>
            {availability.length ? (
              <div className="list">
                {availability.slice(0, 6).map((slot) => (
                  <div className="list-item" key={slot.id || `${slot.dayOfWeek}-${slot.startTime}`}>
                    <strong>{dayLabels[Number(slot.dayOfWeek)] || 'Available'}</strong>
                    <span className="muted">{slot.startTime} - {slot.endTime}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={CalendarDays} title="No availability listed">
                Message this tutor after connecting to coordinate a time.
              </EmptyState>
            )}
          </article>

          <article className="card card-pad">
            <h2>Background</h2>
            <p className="page-copy">{tutor.education || 'Education details have not been added yet.'}</p>
            {certifications.length ? (
              <div className="chip-row" style={{ marginTop: 16 }}>
                {certifications.map((certification) => (
                  <span className="badge badge-blue" key={certification}>{certification}</span>
                ))}
              </div>
            ) : null}
          </article>
        </section>

        <section className="section">
          <div className="section-head">
            <div>
              <h2>Reviews</h2>
              <p>{tutor.totalReviews || 0} student review{Number(tutor.totalReviews) === 1 ? '' : 's'}</p>
            </div>
          </div>
          {tutor.reviews?.length ? (
            <div className="grid grid-2">
              {tutor.reviews.map((review) => (
                <article className="card card-pad" key={review.id}>
                  <div className="item-main">
                    <Avatar name={review.student_name} src={review.student_avatar} />
                    <div>
                      <h3>{review.student_name}</h3>
                      <span className="badge badge-warning">
                        <Star size={14} />
                        {review.rating}
                      </span>
                    </div>
                  </div>
                  <p className="page-copy">{review.comment || 'No written comment.'}</p>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState icon={Star} title="No reviews yet">
              Reviews will appear here after connected students share feedback.
            </EmptyState>
          )}
        </section>
      </main>

      {reportUser ? (
        <ReportUserModal
          user={reportUser}
          onClose={() => setReportUser(null)}
          onSubmitted={showToast}
        />
      ) : null}
    </AppShell>
  );
};

export default TutorProfile;
