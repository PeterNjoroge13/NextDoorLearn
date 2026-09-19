const POLICY_VERSION = '2026-09-19';
const STUDENT_AGE_GROUPS = new Set(['13-17', '18+']);

const booleanValue = (value) => value === true || value === 'true';

const validateStudentConsent = (body = {}) => {
  const ageGroup = String(body.ageGroup || '').trim();
  if (!STUDENT_AGE_GROUPS.has(ageGroup)) {
    return { error: 'NextDoorLearn accounts are currently available only to people age 13 or older' };
  }
  if (!booleanValue(body.termsAccepted) || !booleanValue(body.privacyAccepted)) {
    return { error: 'You must accept the Terms of Service and acknowledge the Privacy Policy' };
  }
  if (!booleanValue(body.safetyAccepted)) {
    return { error: 'You must agree to follow the Community and Safety Guidelines' };
  }
  if (ageGroup === '13-17' && !booleanValue(body.guardianConsent)) {
    return { error: 'A parent or guardian must give permission for students under 18 to use NextDoorLearn' };
  }
  return { ageGroup, guardianConsent: ageGroup === '13-17' };
};

const validateTutorConsent = (body = {}) => {
  if (!booleanValue(body.isAdult)) {
    return { error: 'Tutors must confirm that they are at least 18 years old' };
  }
  if (!booleanValue(body.termsAccepted) || !booleanValue(body.privacyAccepted)) {
    return { error: 'You must accept the Terms of Service and acknowledge the Privacy Policy' };
  }
  if (!booleanValue(body.safetyAccepted)) {
    return { error: 'You must agree to the Tutor Code of Conduct and Safety Guidelines' };
  }
  return { isAdult: true };
};

const recordUserPolicyAcceptances = async (transaction, userId, details = {}) => {
  const source = String(details.source || 'web').slice(0, 40);
  const userAgent = String(details.userAgent || '').slice(0, 500) || null;
  const policies = ['terms', 'privacy', 'community_safety'];
  if (details.guardianConsent) policies.push('guardian_permission');
  for (const policyType of policies) {
    await transaction.prepare(`
      INSERT INTO policy_acceptances (user_id, policy_type, policy_version, source, user_agent)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, policyType, POLICY_VERSION, source, userAgent);
  }
};

module.exports = {
  POLICY_VERSION,
  booleanValue,
  recordUserPolicyAcceptances,
  validateStudentConsent,
  validateTutorConsent
};
