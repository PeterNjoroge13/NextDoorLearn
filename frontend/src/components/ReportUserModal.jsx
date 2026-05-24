import React, { useState } from 'react';
import { Flag, X } from 'lucide-react';
import api from '../services/api';

const reasons = [
  'Harassment or bullying',
  'Unsafe or inappropriate conduct',
  'Spam or scam',
  'False profile information',
  'Other concern',
];

const ReportUserModal = ({ user, onClose, onSubmitted }) => {
  const [reason, setReason] = useState(reasons[0]);
  const [details, setDetails] = useState('');
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user?.id) return;

    setSubmitting(true);
    setStatus('');
    try {
      const token = localStorage.getItem('token');
      const response = await api.submitReport(user.id, reason, details.trim(), token);
      if (response.error) {
        setStatus(response.error);
      } else {
        onSubmitted?.('Report submitted. Thanks for helping keep NextDoorLearn safe.');
        onClose();
      }
    } catch {
      setStatus('Report could not be submitted. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="report-title">
        <header className="modal-head">
          <div>
            <span className="eyebrow">
              <Flag size={15} />
              Safety report
            </span>
            <h2 id="report-title" style={{ fontSize: '1.35rem', marginTop: 8 }}>
              Report {user?.name || 'this user'}
            </h2>
          </div>
          <button className="btn btn-ghost btn-sm" type="button" onClick={onClose} aria-label="Close report form">
            <X size={17} />
          </button>
        </header>

        <form className="modal-body form-grid" onSubmit={handleSubmit}>
          {status ? <div className="alert alert-error">{status}</div> : null}

          <div className="field">
            <label htmlFor="report-reason">Reason</label>
            <select id="report-reason" value={reason} onChange={(event) => setReason(event.target.value)}>
              {reasons.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="report-details">Details</label>
            <textarea
              id="report-details"
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={5}
              maxLength={2000}
              placeholder="Share what happened, when it happened, and any context that helps the team review it."
            />
          </div>

          <div className="button-row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
            <button className="btn btn-danger" type="submit" disabled={submitting}>
              <Flag size={18} />
              {submitting ? 'Submitting...' : 'Submit report'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default ReportUserModal;
