/**
 * Shared AI utilities to break circular dependencies.
 */

export const snapshotMatches = (proposal, appointment) => {
  const snap = proposal.snapshot || {};
  const current = {
    status: appointment.status,
    date: appointment.date ? new Date(appointment.date).toISOString() : '',
    startTime: appointment.startTime || '',
  };
  return (
    (snap.status || '') === current.status &&
    String(snap.date ? new Date(snap.date).toISOString() : '') === current.date &&
    (snap.startTime || '') === current.startTime
  );
};

export const formatDate = (isoString) => {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatDateTime = (isoString) => {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};