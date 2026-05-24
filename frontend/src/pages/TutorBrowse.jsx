import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, BookOpenCheck, Filter, Flag, GraduationCap, MapPin, MessageCircle, Search, SlidersHorizontal, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import AppShell, { Avatar, EmptyState, ErrorState, LoadingState } from '../components/AppShell';
import ReportUserModal from '../components/ReportUserModal';
import { parseList } from '../utils/format';

const subjectOptions = ['Math', 'Science', 'English', 'History', 'Computer Science', 'Physics', 'Chemistry'];

const TutorBrowse = () => {
  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [requestSent, setRequestSent] = useState({});
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [reportUser, setReportUser] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    subject: '',
    maxRate: '100',
    minRating: '0',
    sortBy: 'rating',
  });
  const { user } = useAuth();

  useEffect(() => {
    const fetchTutors = async () => {
      try {
        const response = await api.getTutors();
        if (response.error) {
          setError(response.error);
        } else {
          setTutors(Array.isArray(response) ? response : []);
        }
        const token = localStorage.getItem('token');
        if (token && user?.role === 'student') {
          const favoritesResponse = await api.getFavorites(token);
          if (!favoritesResponse.error && Array.isArray(favoritesResponse)) {
            setFavoriteIds(new Set(favoritesResponse.map((favorite) => favorite.id)));
          }
        }
      } catch {
        setError('Tutors could not be loaded.');
      } finally {
        setLoading(false);
      }
    };

    fetchTutors();
  }, [user?.role]);

  const filteredTutors = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    const maxRate = Number(filters.maxRate || 100);
    const minRating = Number(filters.minRating || 0);

    return tutors
      .filter((tutor) => {
        const subjects = parseList(tutor.subjects);
        const searchable = [tutor.name, tutor.bio, tutor.teaching_style, ...subjects].join(' ').toLowerCase();
        const hourlyRate = Number(tutor.hourly_rate || 0);
        const rating = Number(tutor.averageRating || tutor.average_rating || 0);
        const matchesSearch = !search || searchable.includes(search);
        const matchesSubject = !filters.subject || subjects.some((subject) => subject.toLowerCase().includes(filters.subject.toLowerCase()));
        const matchesRate = hourlyRate <= maxRate;
        const matchesRating = rating >= minRating;
        return matchesSearch && matchesSubject && matchesRate && matchesRating;
      })
      .sort((a, b) => {
        if (filters.sortBy === 'price') return Number(a.hourly_rate || 0) - Number(b.hourly_rate || 0);
        if (filters.sortBy === 'name') return a.name.localeCompare(b.name);
        return Number(b.averageRating || b.average_rating || 0) - Number(a.averageRating || a.average_rating || 0);
      });
  }, [tutors, filters]);

  const handleRequestConnection = async (tutorId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await api.sendConnectionRequest(tutorId, token);
      if (response.error) {
        setToast(response.error);
      } else {
        setRequestSent((current) => ({ ...current, [tutorId]: true }));
        setToast('Request sent. The tutor will see it in their queue.');
      }
    } catch {
      setToast('Connection request failed. Please try again.');
    } finally {
      setTimeout(() => setToast(''), 4200);
    }
  };

  const handleToggleFavorite = async (tutorId) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const isFavorite = favoriteIds.has(tutorId);
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (isFavorite) next.delete(tutorId);
      else next.add(tutorId);
      return next;
    });

    const response = isFavorite
      ? await api.removeFavorite(tutorId, token)
      : await api.addFavorite(tutorId, token);

    if (response.error) {
      setFavoriteIds((current) => {
        const next = new Set(current);
        if (isFavorite) next.add(tutorId);
        else next.delete(tutorId);
        return next;
      });
      setToast(response.error);
    } else {
      setToast(isFavorite ? 'Removed from saved tutors.' : 'Saved to your tutor shortlist.');
    }
    setTimeout(() => setToast(''), 3200);
  };

  if (loading) return <LoadingState label="Finding tutors..." />;
  if (error) return <ErrorState message={error} />;

  return (
    <AppShell>
      <main className="page">
        <section className="section-head">
          <div>
            <span className="eyebrow">
              <Search size={15} />
              Tutor discovery
            </span>
            <h1 className="page-title">Find someone who teaches the way you learn.</h1>
            <p className="page-copy">
              Search by subject, compare teaching styles, and send a request when a tutor feels like the right fit.
            </p>
          </div>
          <span className="badge badge-primary">
            <BookOpenCheck size={15} />
            {filteredTutors.length} available
          </span>
        </section>

        {toast ? <div className="alert" style={{ marginBottom: 16 }}>{toast}</div> : null}

        <section className="card toolbar" aria-label="Tutor filters">
          <div className="field">
            <label htmlFor="search">
              <Search size={14} /> Search
            </label>
            <input
              id="search"
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Name, subject, or teaching style"
            />
          </div>
          <div className="field">
            <label htmlFor="subject">
              <Filter size={14} /> Subject
            </label>
            <select
              id="subject"
              value={filters.subject}
              onChange={(event) => setFilters((current) => ({ ...current, subject: event.target.value }))}
            >
              <option value="">All subjects</option>
              {subjectOptions.map((subject) => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="maxRate">Max rate</label>
            <select
              id="maxRate"
              value={filters.maxRate}
              onChange={(event) => setFilters((current) => ({ ...current, maxRate: event.target.value }))}
            >
              <option value="25">$25/hr</option>
              <option value="50">$50/hr</option>
              <option value="75">$75/hr</option>
              <option value="100">$100/hr</option>
              <option value="999">Any rate</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="sortBy">
              <SlidersHorizontal size={14} /> Sort
            </label>
            <select
              id="sortBy"
              value={filters.sortBy}
              onChange={(event) => setFilters((current) => ({ ...current, sortBy: event.target.value }))}
            >
              <option value="rating">Highest rated</option>
              <option value="price">Lowest price</option>
              <option value="name">Name</option>
            </select>
          </div>
        </section>

        <section className="section">
          {filteredTutors.length ? (
            <div className="grid grid-3">
              {filteredTutors.map((tutor) => {
                const subjects = parseList(tutor.subjects);
                const rating = Number(tutor.averageRating || tutor.average_rating || 0);
                const requested = requestSent[tutor.id];
                return (
                  <article className="card tutor-card" key={tutor.id}>
                    <div className="tutor-card-head">
                      <div className="item-main">
                        <Avatar name={tutor.name} src={tutor.avatar_url} size={54} />
                        <div>
                          <h3>{tutor.name}</h3>
                          <p className="muted">{tutor.experience_years || 0} years experience</p>
                        </div>
                      </div>
                      <span className="badge badge-warning">
                        <Star size={14} />
                        {rating ? rating.toFixed(1) : 'New'}
                      </span>
                    </div>

                    <p className="muted">
                      {tutor.bio || tutor.teaching_style || 'A NextDoorLearn tutor ready to help students build confidence.'}
                    </p>

                    <div className="chip-row">
                      {subjects.slice(0, 4).map((subject) => (
                        <span className="badge badge-primary" key={subject}>{subject}</span>
                      ))}
                      {subjects.length === 0 ? <span className="badge">Subjects coming soon</span> : null}
                    </div>

                    <div className="list-item" style={{ padding: 12 }}>
                      <span className="muted">
                        <MapPin size={14} /> {tutor.location || 'Remote or local'}
                      </span>
                      <span className="price">{Number(tutor.hourly_rate || 0) === 0 ? 'Free' : `$${tutor.hourly_rate}/hr`}</span>
                    </div>

                    <div className="button-row">
                      <Link className="btn btn-ghost" to={`/tutors/${tutor.id}`}>
                        View profile
                      </Link>
                      <button
                        type="button"
                        className={`btn ${requested ? 'btn-ghost' : 'btn-primary'}`}
                        style={{ flex: '1 1 180px' }}
                        onClick={() => handleRequestConnection(tutor.id)}
                        disabled={requested}
                      >
                        <MessageCircle size={18} />
                        {requested ? 'Request sent' : 'Request help'}
                      </button>
                      {user?.role === 'student' ? (
                        <button
                          type="button"
                          className={`btn ${favoriteIds.has(tutor.id) ? 'btn-secondary' : 'btn-ghost'}`}
                          onClick={() => handleToggleFavorite(tutor.id)}
                        >
                          <Bookmark size={18} />
                          {favoriteIds.has(tutor.id) ? 'Saved' : 'Save'}
                        </button>
                      ) : null}
                      {user ? (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => setReportUser({ id: tutor.id, name: tutor.name })}
                        >
                          <Flag size={18} />
                          Report
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={GraduationCap} title="No tutors match these filters">
              Try widening the subject, rate, or search filters.
            </EmptyState>
          )}
        </section>
      </main>
      {reportUser ? (
        <ReportUserModal
          user={reportUser}
          onClose={() => setReportUser(null)}
          onSubmitted={setToast}
        />
      ) : null}
    </AppShell>
  );
};

export default TutorBrowse;
