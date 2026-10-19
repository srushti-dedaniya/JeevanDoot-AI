/**
 * aiAgentHelpers.test.js — run with `npm run test:ai` (node built-in test runner).
 * Covers intent matching, error classification, response mapping and the
 * no-mock-fallback contract helpers. No DOM, no network, no dependencies.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  INTENTS,
  matchIntent,
  classifyAgentError,
  mapAppointmentsToTasks,
  mapReferralsToTasks,
  formatDue,
} from './aiAgentHelpers.js';

describe('matchIntent', () => {
  it('matches the booking intent', () => {
    assert.equal(matchIntent('Help me book a doctor appointment tomorrow.'), INTENTS.BOOK);
    assert.equal(matchIntent('Schedule a visit'), INTENTS.BOOK);
  });
  it('matches list intents', () => {
    assert.equal(matchIntent('Show my upcoming appointments'), INTENTS.UPCOMING);
    assert.equal(matchIntent('Find pending referrals'), INTENTS.REFERRALS);
    assert.equal(matchIntent("Prepare today's follow-up list"), INTENTS.FOLLOWUPS);
    assert.equal(matchIntent('Explain the services available at a clinic'), INTENTS.SERVICES);
  });
  it('matches the error probe and unknown input', () => {
    assert.equal(matchIntent('trigger error'), INTENTS.ERROR);
    assert.equal(matchIntent('hello there'), INTENTS.UNKNOWN);
    assert.equal(matchIntent(''), INTENTS.UNKNOWN);
  });
});

describe('classifyAgentError', () => {
  it('maps HTTP statuses to UI-safe codes', () => {
    assert.equal(classifyAgentError({ status: 401 }).code, 'auth');
    assert.equal(classifyAgentError({ status: 403 }).code, 'forbidden');
    assert.equal(classifyAgentError({ status: 404 }).code, 'not_found');
    assert.equal(classifyAgentError({ status: 409 }).code, 'conflict');
    assert.equal(classifyAgentError({ status: 400, message: 'Bad date' }).code, 'validation');
    assert.equal(classifyAgentError({ status: 500 }).code, 'server');
  });
  it('detects network failures without a status', () => {
    assert.equal(classifyAgentError(new TypeError('Failed to fetch')).code, 'network');
  });
  it('never leaks the raw error object shape (only code + message)', () => {
    const out = classifyAgentError({ status: 403, token: 'secret', message: 'x' });
    assert.deepEqual(Object.keys(out).sort(), ['code', 'message']);
  });
});

describe('mappers', () => {
  it('maps populated appointments to task rows', () => {
    const rows = mapAppointmentsToTasks([
      { _id: 'a1', purpose: 'general', date: '2026-08-15T00:00:00.000Z', startTime: '10:30', status: 'upcoming', doctor: { name: 'Dr. S', specialization: 'General' } },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, 'a1');
    assert.match(rows[0].title, /Dr\. S/);
    assert.match(rows[0].due, /10:30/);
    assert.equal(rows[0].status, 'Upcoming');
  });
  it('maps empty results to empty rows (honest empty state, no fallback)', () => {
    assert.deepEqual(mapAppointmentsToTasks([]), []);
    assert.deepEqual(mapAppointmentsToTasks(null), []);
    assert.deepEqual(mapReferralsToTasks([]), []);
  });
  it('maps referrals to task rows', () => {
    const rows = mapReferralsToTasks([
      { referralId: 'REF-1', reason: 'Cardiology', destination: 'DCC', status: 'pending', createdAt: '2026-08-01T00:00:00.000Z' },
    ]);
    assert.equal(rows[0].id, 'REF-1');
    assert.match(rows[0].title, /Cardiology/);
  });
  it('formatDue tolerates missing values', () => {
    assert.equal(formatDue(null, null), '');
    assert.equal(formatDue(null, '09:00'), '09:00');
  });
});
