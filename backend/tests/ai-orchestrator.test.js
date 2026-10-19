/**
 * AI orchestrator unit tests — run with `npm test` (node built-in runner).
 * Covers DB-free modules: intent classification, entity extraction, provider
 * schema validation, proposal liveness rules, run transitions, tool-registry
 * allow-list and argument validation, prompt-injection resistance.
 * Persistence is covered separately in ai-persistence.test.js (needs MongoDB).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  INTENTS,
  classify,
  extractDate,
  extractTime,
  extractDoctorName,
} from '../services/ai/intent.js';
import { getProvider, validateClassification } from '../services/ai/provider.js';
import { isProposalLive } from '../services/ai/proposals.js';
import { canTransitionRun } from '../services/ai/agentRuns.js';
import { callTool, isToolAllowedForRole, TOOL_NAMES } from '../services/ai/tools.js';

const NOW = new Date('2026-10-13T10:00:00');

describe('intent classification', () => {
  it('recognizes every supported intent', () => {
    assert.equal(classify('Show my next appointments.').intent, INTENTS.UPCOMING_APPOINTMENTS);
    assert.equal(classify('Do I have any appointments this week?').intent, INTENTS.UPCOMING_APPOINTMENTS);
    assert.equal(classify('I need a doctor tomorrow afternoon.').intent, INTENTS.BOOK_APPOINTMENT);
    assert.equal(classify('Find available doctors.').intent, INTENTS.DOCTOR_DIRECTORY);
    assert.equal(classify('Show my pending referrals.').intent, INTENTS.REFERRALS);
    assert.equal(classify('Which follow-ups are coming up?').intent, INTENTS.FOLLOW_UPS);
    assert.equal(classify('What services does the clinic offer?').intent, INTENTS.CLINIC_INFORMATION);
    assert.equal(classify('Can you book that slot for me?').intent, INTENTS.BOOK_APPOINTMENT);
    assert.equal(classify('Reschedule my appointment on Friday.').intent, INTENTS.RESCHEDULE_APPOINTMENT);
    assert.equal(classify('Move my visit to 2026-11-02.').intent, INTENTS.RESCHEDULE_APPOINTMENT);
    assert.equal(classify('Cancel my appointment tomorrow.').intent, INTENTS.CANCEL_APPOINTMENT);
    assert.equal(classify('I want to call off my booking.').intent, INTENTS.CANCEL_APPOINTMENT);
  });
  it('tolerates spelling/case variations and unknown requests', () => {
    assert.equal(classify('SHOW MY APPOINTMENTS').intent, INTENTS.UPCOMING_APPOINTMENTS);
    assert.equal(classify('do u have my referal?').intent, INTENTS.UNKNOWN_OR_UNSUPPORTED);
    assert.equal(classify('').intent, INTENTS.UNKNOWN_OR_UNSUPPORTED);
    assert.equal(classify('tell me a joke').intent, INTENTS.UNKNOWN_OR_UNSUPPORTED);
  });
  it('extracts dates without inventing them', () => {
    assert.equal(extractDate('need a doctor tomorrow', NOW).date, '2026-10-14');
    assert.equal(extractDate('visit on friday', NOW).date, '2026-10-16');
    assert.equal(extractDate('on 2026-11-02 please', NOW).date, '2026-11-02');
    assert.deepEqual(extractDate('need a doctor', NOW), {});
  });
  it('extracts explicit times and day-part hints', () => {
    assert.equal(extractTime('at 10:30 please').startTime, '10:30');
    assert.equal(extractTime('tomorrow afternoon').dayPart, 'afternoon');
    assert.equal(extractTime('at 2:30 pm').startTime, '14:30');
    assert.deepEqual(extractTime('soon').dayPart ? { dayPart: 'x' } : {}, {});
  });
  it('extracts doctor-name hints conservatively', () => {
    assert.equal(extractDoctorName('book with dr sharma tomorrow').doctorName, 'sharma');
    assert.deepEqual(extractDoctorName('book an appointment'), {});
  });
});

describe('provider abstraction', () => {
  it('defaults to the explicitly-labelled local provider', () => {
    const provider = getProvider();
    assert.equal(provider.name, 'local-deterministic');
    assert.equal(provider.aiGenerated, false);
  });
  it('local classification validates and labels output', async () => {
    const out = await getProvider().classify({ message: 'Show my next appointments.', history: [] });
    assert.equal(out.intent, INTENTS.UPCOMING_APPOINTMENTS);
    assert.equal(out.provider, 'local-deterministic');
  });
  it('rejects malformed model output', () => {
    assert.throws(() => validateClassification(null), /not an object/);
    assert.throws(() => validateClassification({ intent: 'DROP_TABLE', entities: {} }), /unknown intent/);
    assert.throws(() => validateClassification({ intent: INTENTS.BOOK_APPOINTMENT, entities: 'x' }), /entities/);
    assert.throws(() => validateClassification({ intent: INTENTS.BOOK_APPOINTMENT, confidence: 9 }), /confidence/);
  });
});

describe('proposal liveness + run transitions (DB-free rules)', () => {
  it('classifies live, used and expired proposals', () => {
    const live = { status: 'pending', expiresAt: new Date(Date.now() + 60_000) };
    assert.equal(isProposalLive(live), true);
    assert.equal(isProposalLive({ ...live, status: 'confirmed' }), false);
    assert.equal(isProposalLive({ ...live, expiresAt: new Date(Date.now() - 1000) }), false);
    assert.equal(isProposalLive(null), false);
    // Application-level expiry is authoritative even if TTL cleanup lags.
    assert.equal(isProposalLive({ status: 'pending', expiresAt: new Date(Date.now() - 1) }), false);
  });
  it('allows only valid run transitions', () => {
    assert.equal(canTransitionRun('started', 'awaiting_confirmation'), true);
    assert.equal(canTransitionRun('awaiting_confirmation', 'running'), true);
    assert.equal(canTransitionRun('running', 'completed'), true);
    assert.equal(canTransitionRun('started', 'completed'), true);
    assert.equal(canTransitionRun('completed', 'running'), false);
    assert.equal(canTransitionRun('failed', 'started'), false);
    assert.equal(canTransitionRun('expired', 'completed'), false);
    assert.equal(canTransitionRun('bogus', 'completed'), false);
  });
});

describe('tool registry allow-list', () => {
  it('exposes exactly the approved tools', () => {
    assert.deepEqual([...TOOL_NAMES].sort(), [
      'getAppointmentAvailability',
      'listAuthorizedFollowUps',
      'listAuthorizedReferrals',
      'listDoctors',
      'listUpcomingAppointments',
    ].sort());
  });
  it('enforces role permissions without a database', () => {
    assert.equal(isToolAllowedForRole('listUpcomingAppointments', 'patient'), true);
    assert.equal(isToolAllowedForRole('listUpcomingAppointments', 'ngo'), false);
    assert.equal(isToolAllowedForRole('listAuthorizedReferrals', 'ngo'), false);
    assert.equal(isToolAllowedForRole('listDoctors', 'ngo'), true);
  });
  it('rejects unknown tools (prompt injection cannot add tools)', async () => {
    await assert.rejects(
      callTool('db.patients.find', { role: 'admin', _id: 'u' }, {}),
      /Unknown tool/
    );
    await assert.rejects(
      callTool('listUpcomingAppointments; DROP TABLE', { role: 'admin', _id: 'u' }, {}),
      /Unknown tool/
    );
  });
  it('rejects disallowed roles before touching arguments', async () => {
    await assert.rejects(
      callTool('listUpcomingAppointments', { role: 'ngo', _id: 'u' }, {}),
      /not permitted/
    );
  });
  it('validates tool arguments strictly', async () => {
    const user = { role: 'patient', _id: 'u' };
    await assert.rejects(
      callTool('getAppointmentAvailability', user, { doctorId: '{$ne:null}', date: '2026-10-20' }),
      /Invalid doctor/
    );
    await assert.rejects(
      callTool('getAppointmentAvailability', user, { doctorId: '6a7611aad85fccadbd376cab', date: 'yesterday' }),
      /YYYY-MM-DD/
    );
  });
  it('ignores prompt-injected extra arguments', async () => {
    // Extra keys are never passed through: only schema fields are forwarded.
    // Role check happens first, so an ngo caller fails even with valid args.
    await assert.rejects(
      callTool('getAppointmentAvailability', { role: 'ngo', _id: 'u' }, {
        doctorId: '6a7611aad85fccadbd376cab',
        date: '2026-10-20',
        patient: 'someone-elses-id',
        __proto__: { polluted: true },
      }),
      /not permitted/
    );
    assert.equal({}.polluted, undefined);
  });
});
