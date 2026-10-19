import { useState } from 'react';
import Badge from '../common/Badge';
import Button from '../common/Button';
import { ACTION_STATUS_META } from '../../services/aiAgentMock';
import { getBookedSlots } from '../../services/aiAgentService';
import { cx } from '../../utils/helpers';

/**
 * AgentActionCard — reusable action card for JeevanDoot AI.
 * Supports UI states: suggested / awaiting / in_progress / completed / failed / needs_info.
 *
 * Two sources (same visuals, honest labels):
 *  - demo (default): local simulated state, nothing written anywhere.
 *  - real (card.source === 'real'): live backend data; Confirm calls the real
 *    booking endpoint via the parent and succeeds only on backend 201.
 */
export default function AgentActionCard({ card, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draftDate, setDraftDate] = useState(card.date || '');
  const [draftSlot, setDraftSlot] = useState(card.slot || '');
  const [draftDoctorId, setDraftDoctorId] = useState(card.doctorId || '');
  const [checkingSlots, setCheckingSlots] = useState(false);
  const [slotCheckError, setSlotCheckError] = useState('');
  const [note, setNote] = useState('');
  const [noteSaved, setNoteSaved] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [doneIds, setDoneIds] = useState([]);
  const [lastChecked, setLastChecked] = useState(null);

  if (!card) return null;

  const meta = ACTION_STATUS_META[card.status] || ACTION_STATUS_META.suggested;
  const isReal = card.source === 'real';

  const update = (patch) => onChange?.({ ...card, ...patch });

  const statusBadge = (
    <Badge variant={meta.badge} icon={meta.icon}>
      {meta.label}
    </Badge>
  );

  /* ---------------- Appointment card ---------------- */
  if (card.type === 'appointment') {
    const doctors = card.doctors || [];
    const selectedDoctor = doctors.find((d) => d.id === (draftDoctorId || card.doctorId));

    const startEdit = () => {
      setDraftDate(card.date || '');
      setDraftSlot(card.slot || '');
      setDraftDoctorId(card.doctorId || '');
      setSlotCheckError('');
      setEditing(true);
    };

    const saveEdit = () => {
      const patch = { date: draftDate || card.date, slot: draftSlot || card.slot, status: 'awaiting' };
      if (isReal) {
        const doc = doctors.find((d) => d.id === draftDoctorId);
        patch.doctorId = draftDoctorId;
        patch.doctor = doc ? `${doc.name} (${doc.specialization})` : card.doctor;
      }
      update(patch);
      setEditing(false);
    };

    const checkAvailability = async () => {
      const doctorId = draftDoctorId || card.doctorId;
      const date = draftDate || card.date;
      if (!doctorId || !date) {
        setSlotCheckError('Pick a doctor and date first.');
        return;
      }
      setCheckingSlots(true);
      setSlotCheckError('');
      try {
        const booked = await getBookedSlots(doctorId, date);
        onChange?.({ ...card, bookedSlots: booked, date, doctorId });
      } catch {
        setSlotCheckError('Could not check availability. Please try again.');
      } finally {
        setCheckingSlots(false);
      }
    };

    const bookedSlots = card.bookedSlots || [];
    const readyToConfirm =
      card.date && card.slot && (!isReal || (card.doctorId && !bookedSlots.includes(card.slot)));

    return (
      <div className="mt-3 rounded-xl border border-outline-variant/40 bg-surface-container-low overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 pt-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">event_available</span>
            <p className="font-bold text-on-surface text-body-md">Book a doctor appointment</p>
          </div>
          {statusBadge}
        </div>

        <dl className="px-4 py-3 space-y-2 text-body-sm">
          <div className="flex gap-2">
            <dt className="w-32 shrink-0 text-on-surface-variant">Clinic / doctor</dt>
            <dd className="font-semibold text-on-surface">
              {isReal ? (card.doctor || 'Not selected yet') : `${card.doctor} · ${card.clinic}`}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-32 shrink-0 text-on-surface-variant">Date</dt>
            <dd className="font-semibold text-on-surface">{card.date || '—'}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-32 shrink-0 text-on-surface-variant">Time slot</dt>
            <dd className="font-semibold text-on-surface">{card.slot || '—'}</dd>
          </div>
          {card.reference && (
            <div className="flex gap-2">
              <dt className="w-32 shrink-0 text-on-surface-variant">Reference</dt>
              <dd className="font-semibold text-on-surface">{card.reference}</dd>
            </div>
          )}
          {isReal && bookedSlots.length > 0 && (
            <div className="flex gap-2">
              <dt className="w-32 shrink-0 text-on-surface-variant">Already booked</dt>
              <dd className="font-semibold text-on-surface">{bookedSlots.join(', ')}</dd>
            </div>
          )}
        </dl>

        {(editing || (isReal && card.status === 'needs_info')) ? (
          <div className="px-4 pb-4 space-y-3">
            {isReal && (
              <label className="block text-label-lg font-semibold text-on-surface">
                Doctor (live directory)
                <select
                  value={draftDoctorId || card.doctorId || ''}
                  onChange={(e) => setDraftDoctorId(e.target.value)}
                  className="mt-1 w-full h-12 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md px-3 focus:outline-none"
                >
                  <option value="">Select a doctor…</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} — {d.specialization}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="block text-label-lg font-semibold text-on-surface">
              Appointment date
              <input
                type={isReal ? 'date' : 'text'}
                value={draftDate}
                onChange={(e) => setDraftDate(e.target.value)}
                className="mt-1 w-full h-12 bg-surface-container-lowest border border-outline-variant rounded-lg custom-input text-body-md px-4 focus:outline-none"
              />
            </label>
            <label className="block text-label-lg font-semibold text-on-surface">
              Available time slot
              <select
                value={draftSlot}
                onChange={(e) => setDraftSlot(e.target.value)}
                className="mt-1 w-full h-12 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md px-3 focus:outline-none"
              >
                <option value="">Select a time…</option>
                {(card.slots || []).map((s) => (
                  <option key={s} value={s}>{s}{bookedSlots.includes(s) ? ' (booked)' : ''}</option>
                ))}
              </select>
            </label>
            {isReal && (
              <div>
                <Button size="sm" variant="ghost" onClick={checkAvailability} disabled={checkingSlots} loading={checkingSlots} icon="event_available">
                  Check live availability
                </Button>
                {slotCheckError && <p className="text-sm text-error mt-1">{slotCheckError}</p>}
                {selectedDoctor && <p className="text-label-md text-on-surface-variant mt-1">Checking against {selectedDoctor.name}’s live bookings.</p>}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={saveEdit} icon="check" disabled={isReal && (!draftDoctorId || !draftDate || !draftSlot)}>Save details</Button>
              {!isReal || editing ? (
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              ) : null}
            </div>
          </div>
        ) : card.status === 'completed' ? (
          <div className="mx-4 mb-4 rounded-lg bg-success-container text-on-success-container px-4 py-3 text-body-sm font-semibold">
            {isReal
              ? `Booking confirmed by the backend. Reference: ${card.reference || card.appointmentId}.`
              : 'Demo booking completed — no real appointment was created.'}
          </div>
        ) : card.status === 'failed' ? (
          <div className="mx-4 mb-4 rounded-lg bg-error-container text-on-error-container px-4 py-3 text-body-sm font-semibold">
            {isReal
              ? (card.backendError || 'Booking failed. Nothing was created — please review and try again.')
              : 'Demo booking cancelled — no changes were made.'}
          </div>
        ) : card.status === 'in_progress' ? (
          <div className="mx-4 mb-4 flex items-center gap-3 text-body-sm text-on-surface-variant">
            <span className="w-5 h-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" aria-hidden="true" />
            {isReal ? 'Creating your appointment in the backend…' : 'Confirming your demo booking…'}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 px-4 pb-4">
            <Button size="sm" onClick={() => onChange?.({ ...card, status: 'in_progress' })} icon="check_circle" disabled={!readyToConfirm}>
              Confirm appointment
            </Button>
            <Button size="sm" variant="outline" onClick={startEdit} icon="edit">
              Edit details
            </Button>
            <Button size="sm" variant="ghost" onClick={() => update({ status: 'failed', backendError: isReal ? 'Booking discarded before confirmation — nothing was created.' : undefined })}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    );
  }

  /* ---------------- Reschedule card (live, proposal-bound) ---------------- */
  if (card.type === 'reschedule') {
    const existing = card.existing || {};
    const needsDetails = card.status === 'needs_info' || editing;
    const ready = card.date && card.slot;

    const saveRescheduleEdit = () => {
      update({ date: draftDate || card.date, slot: draftSlot || card.slot, status: 'awaiting' });
      setEditing(false);
    };

    return (
      <div className="mt-3 rounded-xl border border-outline-variant/40 bg-surface-container-low overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 pt-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">event_repeat</span>
            <p className="font-bold text-on-surface text-body-md">Reschedule appointment</p>
          </div>
          {statusBadge}
        </div>

        <dl className="px-4 py-3 space-y-2 text-body-sm">
          <div className="flex gap-2">
            <dt className="w-32 shrink-0 text-on-surface-variant">Current</dt>
            <dd className="font-semibold text-on-surface">{existing.date} at {existing.startTime}{existing.doctor ? ` · ${existing.doctor}` : ''}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-32 shrink-0 text-on-surface-variant">Proposed</dt>
            <dd className="font-semibold text-on-surface">{card.date || '—'} at {card.slot || '—'}</dd>
          </div>
          {card.reference && (
            <div className="flex gap-2">
              <dt className="w-32 shrink-0 text-on-surface-variant">Reference</dt>
              <dd className="font-semibold text-on-surface">{card.reference}</dd>
            </div>
          )}
        </dl>

        {needsDetails ? (
          <div className="px-4 pb-4 space-y-3">
            <label className="block text-label-lg font-semibold text-on-surface">
              New date
              <input
                type="date"
                value={draftDate}
                onChange={(e) => setDraftDate(e.target.value)}
                className="mt-1 w-full h-12 bg-surface-container-lowest border border-outline-variant rounded-lg custom-input text-body-md px-4 focus:outline-none"
              />
            </label>
            <label className="block text-label-lg font-semibold text-on-surface">
              New time slot
              <select
                value={draftSlot}
                onChange={(e) => setDraftSlot(e.target.value)}
                className="mt-1 w-full h-12 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md px-3 focus:outline-none"
              >
                <option value="">Select a time…</option>
                {(card.slots || []).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={saveRescheduleEdit} icon="check" disabled={!draftDate || !draftSlot}>Save details</Button>
              {editing && <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>}
            </div>
          </div>
        ) : card.status === 'completed' ? (
          <div className="mx-4 mb-4 rounded-lg bg-success-container text-on-success-container px-4 py-3 text-body-sm font-semibold">
            Rescheduled by the backend. Reference: {card.reference || card.appointmentId}.
          </div>
        ) : card.status === 'failed' ? (
          <div className="mx-4 mb-4 rounded-lg bg-error-container text-on-error-container px-4 py-3 text-body-sm font-semibold">
            {card.backendError || 'Reschedule discarded — nothing was changed.'}
          </div>
        ) : card.status === 'in_progress' ? (
          <div className="mx-4 mb-4 flex items-center gap-3 text-body-sm text-on-surface-variant">
            <span className="w-5 h-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" aria-hidden="true" />
            Rescheduling your appointment in the backend…
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 px-4 pb-4">
            <Button size="sm" onClick={() => onChange?.({ ...card, status: 'in_progress' })} icon="check_circle" disabled={!ready}>
              Confirm reschedule
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setDraftDate(card.date || ''); setDraftSlot(card.slot || ''); setEditing(true); }} icon="edit">
              Edit details
            </Button>
            <Button size="sm" variant="ghost" onClick={() => update({ status: 'failed', backendError: 'Reschedule discarded before confirmation — nothing was changed.' })}>
              Discard
            </Button>
          </div>
        )}
      </div>
    );
  }

  /* ---------------- Cancel card (live, proposal-bound) ---------------- */
  if (card.type === 'cancel') {
    const existing = card.existing || {};
    return (
      <div className="mt-3 rounded-xl border border-outline-variant/40 bg-surface-container-low overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 pt-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">event_busy</span>
            <p className="font-bold text-on-surface text-body-md">Cancel appointment</p>
          </div>
          {statusBadge}
        </div>

        <dl className="px-4 py-3 space-y-2 text-body-sm">
          <div className="flex gap-2">
            <dt className="w-32 shrink-0 text-on-surface-variant">Appointment</dt>
            <dd className="font-semibold text-on-surface">{existing.date} at {existing.startTime}{existing.doctor ? ` · ${existing.doctor}` : ''}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-32 shrink-0 text-on-surface-variant">Status</dt>
            <dd className="font-semibold text-on-surface">{existing.status || 'upcoming'}</dd>
          </div>
          {card.reference && (
            <div className="flex gap-2">
              <dt className="w-32 shrink-0 text-on-surface-variant">Reference</dt>
              <dd className="font-semibold text-on-surface">{card.reference}</dd>
            </div>
          )}
        </dl>

        {card.status === 'completed' ? (
          <div className="mx-4 mb-4 rounded-lg bg-success-container text-on-success-container px-4 py-3 text-body-sm font-semibold">
            Cancelled by the backend. Reference: {card.reference || card.appointmentId}.
          </div>
        ) : card.status === 'failed' ? (
          <div className="mx-4 mb-4 rounded-lg bg-error-container text-on-error-container px-4 py-3 text-body-sm font-semibold">
            {card.backendError || 'Cancellation discarded — nothing was changed.'}
          </div>
        ) : card.status === 'in_progress' ? (
          <div className="mx-4 mb-4 flex items-center gap-3 text-body-sm text-on-surface-variant">
            <span className="w-5 h-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" aria-hidden="true" />
            Cancelling your appointment in the backend…
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 px-4 pb-4">
            <Button size="sm" variant="danger" onClick={() => onChange?.({ ...card, status: 'in_progress' })} icon="check_circle">
              Confirm cancellation
            </Button>
            <Button size="sm" variant="ghost" onClick={() => update({ status: 'failed', backendError: 'Cancellation discarded — the appointment is unchanged.' })}>
              Keep appointment
            </Button>
          </div>
        )}
      </div>
    );
  }

  /* ---------------- Referral / follow-up list card ---------------- */
  const items = card.items || [];
  const allDone = card.checkable && items.length > 0 && doneIds.length === items.length;

  const toggleDone = (id) =>
    setDoneIds((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));

  return (
    <div className="mt-3 rounded-xl border border-outline-variant/40 bg-surface-container-low overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">
            {card.title?.toLowerCase().includes('referral') ? 'share' : 'checklist'}
          </span>
          <p className="font-bold text-on-surface text-body-md">{card.title || 'Tasks (demo)'}</p>
        </div>
        {statusBadge}
      </div>

      <ul className="px-4 py-3 space-y-2">
        {items.map((item) => {
          const checked = doneIds.includes(item.id);
          return (
            <li
              key={item.id}
              className={cx(
                'flex items-start gap-3 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-2.5',
                checked && 'opacity-60'
              )}
            >
              {card.checkable ? (
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleDone(item.id)}
                  aria-label={`Mark ${item.title} done${isReal ? ' (local only, not saved)' : ' (demo)'}`}
                  className="mt-1 h-5 w-5 accent-primary rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              ) : (
                <span className="material-symbols-outlined text-on-surface-variant mt-0.5">description</span>
              )}
              <div className="min-w-0 flex-1">
                <p className={cx('font-semibold text-on-surface text-body-sm', checked && 'line-through')}>
                  {item.title}
                </p>
                <p className="text-label-md text-on-surface-variant truncate">{item.detail || item.destination}</p>
                <p className="text-label-md text-on-surface-variant">{item.due} · {item.id}</p>
              </div>
              {item.status && (
                <Badge variant={item.status === 'Accepted' ? 'success' : item.status.startsWith('Needs') ? 'warning' : 'neutral'}>
                  {item.status}
                </Badge>
              )}
            </li>
          );
        })}
      </ul>

      {card.checkable && (
        <div className="px-4 pb-3 text-label-lg text-on-surface-variant font-semibold">
          {doneIds.length} of {items.length} done{isReal ? ' (ticks are local only, not saved)' : ' (demo)'}
          {allDone && ' — list complete. Nothing was saved.'}
        </div>
      )}

      {isReal ? (
        <div className="mx-4 mb-4 rounded-lg bg-surface-container px-4 py-2 text-label-md text-on-surface-variant">
          Live records from the backend. Ticks and notes are not available for live lists in this phase — use the relevant dashboard pages to act on these records.
        </div>
      ) : (
      <>
      {noteSaved && (
        <div className="mx-4 mb-3 rounded-lg bg-success-container text-on-success-container px-4 py-2 text-body-sm font-semibold">
          Demo note saved: “{noteSaved}” — not sent anywhere.
        </div>
      )}

      {noteOpen ? (
        <div className="px-4 pb-4 space-y-2">
          <label className="block text-label-lg font-semibold text-on-surface" htmlFor={`demo-note-${card.title}`}>
            Add a demo note
          </label>
          <textarea
            id={`demo-note-${card.title}`}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Type a sample note…"
            className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg custom-input text-body-md p-3 focus:outline-none"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={!note.trim()}
              onClick={() => { setNoteSaved(note.trim()); setNote(''); setNoteOpen(false); update({ status: 'awaiting' }); }}
              icon="check"
            >
              Save note
            </Button>
            <Button size="sm" variant="outline" onClick={() => setNoteOpen(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 px-4 pb-4">
          <Button size="sm" variant="outline" onClick={() => setNoteOpen(true)} icon="edit_note">
            Add demo note
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { update({ status: 'in_progress' }); setTimeout(() => { setLastChecked(new Date().toLocaleTimeString()); onChange?.({ ...card, status: 'suggested' }); }, 800); }}
            icon="refresh"
          >
            Refresh demo statuses
          </Button>
          {lastChecked && (
            <span className="text-label-md text-on-surface-variant">Last demo check: {lastChecked}</span>
          )}
        </div>
      )}
      </>
      )}
    </div>
  );
}
