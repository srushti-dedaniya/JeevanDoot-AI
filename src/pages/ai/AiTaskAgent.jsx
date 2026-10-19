import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../../components/layout/DashboardLayout';
import PatientSidebar from '../../components/layout/PatientSidebar';
import NotificationBell from '../../components/layout/NotificationBell';
import ProfileMenu from '../../components/layout/ProfileMenu';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import AgentActionCard from '../../components/ai/AgentActionCard';
import AgentActivityPanel from '../../components/ai/AgentActivityPanel';
import AgentWorkflowProgress from '../../components/ai/AgentWorkflowProgress';
import { NGO_NAV } from '../ngo/ngoNav';
import { GOVERNMENT_NAV } from '../government/governmentNav';
import { useAuth } from '../../hooks/useAuth';
import { useNetworkStatus, useRetry } from '../../hooks/useNetworkStatus';
import { useReducedMotion } from '../../hooks/useAccessibility';
import { cx } from '../../utils/helpers';
import {
  DEMO_REFERENCE_PREFIX,
  getActivityState,
  getDemoReply,
  getSuggestionsForRole,
} from '../../services/aiAgentMock';
import {
  INTENTS,
  classifyAgentError,
  matchIntent,
} from '../../services/aiAgentHelpers';
import {
  confirmAgentProposal,
  getAiMode,
  sendAgentChat,
} from '../../services/aiAgentService';

/**
 * AiTaskAgent — JeevanDoot AI Healthcare Task Agent.
 *
 * Dual mode (selected by VITE_ENABLE_MOCK_API, default real):
 *  - demo: deterministic simulated replies from aiAgentMock.js (labelled Demo).
 *  - real: live backend data via aiAgentService.js (labelled Live). Real mode
 *    never falls back to mock data — failures surface as honest errors.
 * Uses the existing DashboardLayout shell + shared Card/Button/Badge components.
 */

const DOCTOR_NAV = [
  { labelKey: 'dashboard', to: '/doctor/dashboard', icon: 'dashboard', end: true },
  { labelKey: 'patientQueue', to: '/doctor/queue', icon: 'groups' },
  { labelKey: 'liveConsultation', to: '/doctor/consultation', icon: 'call' },
  { labelKey: 'consultationHistory', to: '/doctor/consultation-history', icon: 'video_library' },
  { labelKey: 'performanceAnalytics', to: '/doctor/performance', icon: 'query_stats' },
  { labelKey: 'aiAssistant', to: '/doctor/ai-assistant', icon: 'smart_toy' },
];

const ADMIN_NAV = [
  { labelKey: 'dashboard', to: '/admin/dashboard', icon: 'dashboard', end: true },
  { labelKey: 'diseaseSurveillance', to: '/admin/surveillance', icon: 'public_health' },
  { labelKey: 'caseAnalytics', to: '/admin/case-analytics', icon: 'analytics' },
  { labelKey: 'auditLog', to: '/admin/audit-log', icon: 'verified_user' },
  { labelKey: 'reportGeneration', to: '/admin/reports', icon: 'summarize' },
  { labelKey: 'doctorManagement', to: '/admin/doctors', icon: 'medical_services' },
  { labelKey: 'configuration', to: '/admin/settings', icon: 'settings' },
  { labelKey: 'aiAssistant', to: '/admin/ai-assistant', icon: 'smart_toy' },
  { labelKey: 'agentAudit', to: '/admin/agent-audit', icon: 'monitor_heart' },
];

const withAiNav = (nav, to) => [...nav.items, { labelKey: 'aiAssistant', to, icon: 'smart_toy' }];

const STAGE_FOR_CARD = { awaiting: 'confirmation', in_progress: 'confirmation', completed: 'done' };

export default function AiTaskAgent() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const role = user?.role || 'patient';

  const suggestions = useMemo(() => getSuggestionsForRole(role), [role]);
  const mode = getAiMode();
  const isDemo = mode === 'demo';
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [failedText, setFailedText] = useState(null);
  const [failedDetail, setFailedDetail] = useState('');
  const [workflowPlan, setWorkflowPlan] = useState(null);
  const idRef = useRef(0);
  const bottomRef = useRef(null);

  const { isOnline, isSlowConnection } = useNetworkStatus();
  const { execute: sendWithRetry, attempt } = useRetry(sendAgentChat, { retries: 2, backoff: 1500 });
  const prefersReducedMotion = useReducedMotion();

  const nextId = () => {
    idRef.current += 1;
    return `msg-${idRef.current}`;
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  /* ---------- sidebar per role (existing shell, AI entry included) ---------- */
  const renderSidebar = () => {
    if (role === 'patient') return <PatientSidebar />;
    if (role === 'doctor') {
      return { items: DOCTOR_NAV.map((item) => ({ ...item, label: t(`nav.${item.labelKey}`) })) };
    }
    if (role === 'admin') {
      return { items: ADMIN_NAV.map((item) => ({ ...item, label: t(`nav.${item.labelKey}`) })) };
    }
    if (role === 'ngo') {
      return { items: withAiNav(NGO_NAV, '/ngo/ai-assistant').map((item) => ({ ...item, label: t(`nav.${item.labelKey}`) })) };
    }
    return { items: withAiNav(GOVERNMENT_NAV, '/government/ai-assistant').map((item) => ({ ...item, label: t(`nav.${item.labelKey}`) })) };
  };

  const sidebar = renderSidebar();
  const sidebarNode = sidebar?.items ? null : sidebar;
  const sidebarProps = sidebar?.items ? { items: sidebar.items } : undefined;

  /* ---------- conversation logic (demo) ---------- */
  const stage = useMemo(() => {
    if (messages.length === 0) return 'received';
    const lastCard = [...messages].reverse().find((m) => m.card)?.card;
    if (!lastCard) return 'checked';
    return STAGE_FOR_CARD[lastCard.status] || 'confirmation';
  }, [messages]);

  const steps = useMemo(() => {
    const base = getActivityState(stage);
    if (isDemo) return base;
    // Live mode: enrich the "checked" step with real server tool events.
    const lastAssistant = [...messages].reverse().find((m) => m.from === 'assistant' && m.toolCalls);
    const ledger = lastAssistant?.toolCalls || [];
    if (ledger.length === 0) return base;
    const failed = ledger.filter((t) => !t.ok);
    const detail = ledger.map((t) => `${t.tool}: ${t.ok ? 'completed' : 'failed'}`).join(' · ');
    return base.map((s) =>
      s.id === 'checked'
        ? { ...s, state: failed.length ? 'failed' : 'done', detail }
        : s
    );
  }, [stage, messages, isDemo]);
  const summary = useMemo(() => {
    if (messages.length === 0) return isDemo ? 'Waiting for your first demo request.' : 'Waiting for your first request. I will query the live backend.';
    const last = messages[messages.length - 1];
    if (last.card?.status === 'completed') {
      const verb = last.card.type === 'reschedule' ? 'Reschedule' : last.card.type === 'cancel' ? 'Cancellation' : 'Booking';
      return last.card.source === 'real'
        ? `${verb} confirmed by the backend (ref ${last.card.reference}).`
        : 'Demo booking confirmed. No real record was created.';
    }
    if (last.card) return `Action “${last.card.title || 'Book a doctor appointment'}” is ${last.card.status.replace('_', ' ')}.`;
    return isDemo ? 'Demo reply sent. No real AI or backend connected.' : 'Live reply sent from backend data.';
  }, [messages, isDemo]);

  const pushAssistant = (text, card = null, meta = {}) =>
    setMessages((prev) => [...prev, { id: nextId(), from: 'assistant', text, card, ...meta }]);

  const failRequest = (userText, err) => {
    const classified = classifyAgentError(err);
    setFailedText(userText);
    setFailedDetail(classified.message);
  };

  /* ----- real mode: orchestrated backend (POST /ai/chat) ----- */
  const toCard = (action) => {
    if (!action || typeof action !== 'object') return null;
    if (action.kind === 'appointment_proposal') {
      return {
        type: 'appointment',
        source: 'real',
        status: action.status === 'awaiting' ? 'awaiting' : 'needs_info',
        proposalId: action.proposalId || null,
        doctors: action.doctors || [],
        doctorId: action.doctorId || '',
        doctor: action.doctor || '',
        date: action.date || '',
        slot: action.slot || '',
        slots: action.slots || ['09:00', '10:30', '12:00', '16:00'],
        bookedSlots: action.bookedSlots || [],
      };
    }
    if (action.kind === 'appointment_reschedule_proposal') {
      return {
        type: 'reschedule',
        source: 'real',
        status: action.status === 'awaiting' ? 'awaiting' : 'needs_info',
        proposalId: action.proposalId || null,
        existing: action.existing || null,
        date: action.proposed?.date || '',
        slot: action.proposed?.startTime || '',
        slots: action.slots || ['09:00', '10:30', '12:00', '16:00'],
      };
    }
    if (action.kind === 'appointment_cancel_proposal') {
      return {
        type: 'cancel',
        source: 'real',
        status: 'awaiting',
        proposalId: action.proposalId || null,
        existing: action.existing || null,
      };
    }
    if (action.kind === 'task_list') {
      return {
        type: 'tasklist',
        source: 'real',
        status: 'suggested',
        title: action.title || 'Results (live)',
        items: action.items || [],
        checkable: Boolean(action.checkable),
      };
    }
    return null;
  };

const deliverRealReplyCore = async (userText) => {
    if (!isOnline) {
      throw new Error('You are offline. Please check your connection and try again.');
    }

    // Bounded client-side history; the server revalidates and truncates again.
    const history = messages
      .filter((m) => m.text)
      .slice(-6)
      .map((m) => ({ from: m.from, text: m.text }));

    const res = await sendWithRetry(userText, history);
    const card = toCard((res.actions || [])[0]);

    // Update workflow plan if present in response
    if (res.workflowPlan) {
      setWorkflowPlan(res.workflowPlan);
    }

    pushAssistant(res.message || 'I could not process that request.', card, {
      toolCalls: res.toolCalls || [],
      requestId: res.requestId || null,
      intent: res.intent || null,
    });
  };

  const deliverRealReply = async (userText) => {
    // Local error-state probe (UI test hook) — shows an error, never mock data.
    if (matchIntent(userText) === INTENTS.ERROR) {
      setFailedText(userText);
      setFailedDetail('This is the simulated error state — nothing was sent or saved.');
      return;
    }
    try {
      await deliverRealReplyCore(userText);
    } catch (err) {
      failRequest(userText, err);
    }
  };

  const deliverReply = (userText) => {
    setSending(true);
    setFailedText(null);
    setFailedDetail('');
    if (isDemo) {
      // Simulated latency so typing feedback is testable. Deterministic reply.
      setTimeout(() => {
        const reply = getDemoReply(userText);
        setSending(false);
        if (reply.error) {
          setFailedText(userText);
          setFailedDetail('This is the simulated error state — nothing was sent or saved.');
          return;
        }
        pushAssistant(reply.text, reply.card || null);
      }, 900);
      return;
    }
    // Real mode: live backend, honest errors, never mock fallback.
    (async () => {
      try {
        await deliverRealReply(userText);
      } catch (err) {
        failRequest(userText, err);
      } finally {
        setSending(false);
      }
    })();
  };

  const sendText = (raw) => {
    const text = (raw || '').trim();
    if (!text || sending) return;
    setMessages((prev) => [...prev, { id: nextId(), from: 'user', text }]);
    setInput('');
    deliverReply(text);
  };

  const newConversation = () => {
    idRef.current = 0;
    setMessages([]);
    setInput('');
    setFailedText(null);
    setFailedDetail('');
    setSending(false);
  };

  const updateCard = (id, next) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, card: next } : m)));
    if (next.source === 'real') {
      if (next.status === 'in_progress') {
        if (!next.proposalId) {
          // Stale draft (e.g. superseded by a newer proposal card).
          setMessages((prev) =>
            prev.map((m) =>
              m.id === id
                ? { ...m, card: { ...m.card, status: 'failed', backendError: 'That draft was superseded. Please review the latest proposal below — nothing was booked.' } }
                : m
            )
          );
          return;
        }
        // Stage B: server-bound confirmation. Success only on backend booking.
        (async () => {
          try {
            const res = await confirmAgentProposal(next.proposalId);
            const ref = res?.appointment?.id || '';
            setMessages((prev) =>
              prev.map((m) =>
                m.id === id && m.card?.status === 'in_progress'
                  ? { ...m, card: { ...m.card, status: 'completed', appointmentId: ref, reference: ref } }
                  : m
              )
            );
          } catch (err) {
            const classified = classifyAgentError(err);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === id && m.card?.status === 'in_progress'
                  ? { ...m, card: { ...m.card, status: 'failed', backendError: classified.message } }
                  : m
              )
            );
          }
        })();
        return;
      }
      if (next.status === 'awaiting' && !next.proposalId && next.type === 'appointment' && next.doctorId && next.date && next.slot) {
        // User completed a needs_info booking draft in the card: ask the
        // orchestrator to validate and bind it as a server proposal.
        const doc = (next.doctors || []).find((d) => d.id === next.doctorId);
        const followUp = `Book an appointment with ${doc ? doc.name : 'the selected doctor'} on ${next.date} at ${next.slot}`;
        setMessages((prev) => [...prev, { id: nextId(), from: 'user', text: followUp }]);
        setSending(true);
        (async () => {
          try {
            await deliverRealReplyCore(followUp);
          } catch (err) {
            failRequest(followUp, err);
          } finally {
            setSending(false);
          }
        })();
      }
      if (next.status === 'awaiting' && !next.proposalId && next.type === 'reschedule' && next.existing && next.date && next.slot) {
        // User completed a needs_info reschedule draft: same server-bound path.
        const followUp = `Reschedule my appointment on ${next.existing.date} to ${next.date} at ${next.slot}`;
        setMessages((prev) => [...prev, { id: nextId(), from: 'user', text: followUp }]);
        setSending(true);
        (async () => {
          try {
            await deliverRealReplyCore(followUp);
          } catch (err) {
            failRequest(followUp, err);
          } finally {
            setSending(false);
          }
        })();
      }
      return;
    }
    // Simulate the confirm → completed transition on the demo card.
    setTimeout(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id && m.card?.status === 'in_progress'
              ? { ...m, card: { ...m.card, status: 'completed', reference: `${DEMO_REFERENCE_PREFIX}-${String(idRef.current).padStart(4, '0')}` } }
              : m
          )
        );
      }, 1400);
  };

  const onComposerKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendText(input);
    }
  };

  const headerRight = (
    <>
      {isDemo ? (
        <Badge variant="warning" icon="science">Demo Mode · Prototype</Badge>
      ) : (
        <Badge variant="success" icon="cloud_done">Live data · Backend connected</Badge>
      )}
      <div className="hidden sm:block">
        <NotificationBell />
      </div>
      <ProfileMenu />
      <Button variant="outline" size="sm" icon="add" onClick={newConversation}>
        New conversation
      </Button>
    </>
  );

  return (
    <DashboardLayout
      sidebar={sidebarNode}
      sidebarProps={sidebarProps}
      headerProps={{
        title: 'JeevanDoot AI',
        subtitle: 'Your intelligent healthcare coordination assistant.',
        right: headerRight,
      }}
    >
      {!isOnline && (
        <div className="mb-4 rounded-lg bg-error-container text-on-error-container px-4 py-3 flex items-center gap-3" role="alert">
          <span className="material-symbols-outlined">wifi_off</span>
          <span className="font-semibold">You are offline</span>
          <span className="text-body-sm">Changes will sync when connection is restored.</span>
        </div>
      )}
      {isSlowConnection && (
        <div className="mb-4 rounded-lg bg-warning-container text-on-warning-container px-4 py-3 flex items-center gap-3" role="status">
          <span className="material-symbols-outlined">wifi_tethering</span>
          <span className="font-semibold">Slow connection detected</span>
          <span className="text-body-sm">Requests may take longer. Retrying automatically.</span>
          {attempt > 1 && <span className="text-body-sm">(Retry attempt {attempt})</span>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* ---------- Conversation ---------- */}
        <Card
          className="lg:col-span-2"
          title="Healthcare task assistant"
          subtitle={isDemo ? 'Demo — simulated responses, no real AI connected' : 'Live — answers from your backend records'}
          icon="smart_toy"
          headerRight={
            <Badge variant="neutral" icon="info">
              {messages.length === 0 ? 'New session' : `${messages.length} message${messages.length > 1 ? 's' : ''}`}
            </Badge>
          }
        >
          {messages.length === 0 && !sending && (
            <div className="space-y-5">
              <div className="flex items-start gap-3 rounded-xl bg-surface-container px-4 py-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
                  <span className="material-symbols-outlined">smart_toy</span>
                </span>
                <div>
                  <p className="font-bold text-on-surface text-body-md">
                    {isDemo ? 'Welcome to JeevanDoot AI (demo)' : 'Welcome to JeevanDoot AI (live)'}
                  </p>
                  <p className="text-body-sm text-on-surface-variant">
                    {isDemo
                      ? 'I can help coordinate sample healthcare tasks such as booking demo appointments, reviewing sample referrals, and preparing a sample follow-up list. Pick a suggestion below or type your own message.'
                      : 'I can look up your real upcoming appointments, referrals and follow-up bookings, and draft a real appointment booking for patient accounts. Pick a suggestion below or type your own message.'}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-label-lg font-bold text-on-surface-variant uppercase tracking-wide mb-2">
                  Suggested prompts
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => sendText(s)}
                      className="rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2 text-body-sm font-semibold text-primary hover:bg-primary-fixed-dim/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <EmptyState
                icon="forum"
                title="No conversation yet"
                description={isDemo ? 'Start with a suggested prompt above to see a deterministic demo conversation.' : 'Start with a suggested prompt above to query your live records.'}
              />
            </div>
          )}

          {messages.length > 0 && (
            <div
              className="space-y-4 max-h-[55vh] overflow-y-auto pr-1 custom-scrollbar"
              role="log"
              aria-live="polite"
              aria-label="Conversation history"
            >
              {messages.map((m) =>
                m.from === 'user' ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-br-md bg-primary text-on-primary px-4 py-3">
                      <p className="text-body-sm whitespace-pre-wrap">{m.text}</p>
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="flex items-start gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
                      <span className="material-symbols-outlined text-[20px]">smart_toy</span>
                    </span>
                    <div className="max-w-[90%] sm:max-w-[80%] rounded-2xl rounded-tl-md bg-surface-container px-4 py-3">
                      <p className="text-body-sm text-on-surface whitespace-pre-wrap">{m.text}</p>
                      {m.card && <AgentActionCard card={m.card} onChange={(next) => updateCard(m.id, next)} />}
                    </div>
                  </div>
                )
              )}

              {sending && (
                <div className="flex items-start gap-2.5" aria-label="Assistant is typing">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
                    <span className="material-symbols-outlined text-[20px]">smart_toy</span>
                  </span>
                  <div className="rounded-2xl rounded-tl-md bg-surface-container px-4 py-3">
                    <span className="flex items-center gap-1" aria-hidden="true">
                      {prefersReducedMotion ? (
                        <span className="h-2 w-2 rounded-full bg-primary" />
                      ) : (
                        [0, 1, 2].map((d) => (
                          <span
                            key={d}
                            className="h-2 w-2 rounded-full bg-primary animate-bounce"
                            style={{ animationDelay: `${d * 150}ms` }}
                          />
                        ))
                      )}
                    </span>
                    <span className="sr-only">JeevanDoot AI is preparing a response…</span>
                  </div>
                </div>
              )}

              {failedText && !sending && (
                <div className="rounded-xl bg-error-container text-on-error-container px-4 py-3">
                  <p className="font-bold text-body-sm">
                    {isDemo ? 'Demo request could not be completed.' : 'Request could not be completed.'}
                  </p>
                  <p className="text-body-sm">{failedDetail || 'Nothing was sent or saved.'}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      icon="refresh"
                      onClick={() => { setFailedText(null); setFailedDetail(''); deliverReply(failedText); }}
                      className="border-on-error-container text-on-error-container"
                    >
                      Retry{isDemo ? ' demo request' : ' request'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setFailedText(null)}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}

          {/* ---------- Composer ---------- */}
          <div className="mt-4 border-t border-outline-variant/40 pt-4">
            <label htmlFor="ai-composer" className="sr-only">Message JeevanDoot AI{isDemo ? ' (demo)' : ' (live)'}</label>
            <div className={cx('flex items-end gap-2')}>
              <textarea
                id="ai-composer"
                rows={3}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onComposerKeyDown}
                placeholder="Type a healthcare task… (Enter to send, Shift+Enter for a new line)"
                className="flex-1 bg-surface-container-low border border-outline-variant rounded-xl custom-input text-body-md text-on-surface p-3 focus:outline-none placeholder:text-outline/70 resize-none"
              />
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled
                  title="Voice input is a future feature and is disabled in this demo"
                  aria-label="Voice input (coming soon, disabled)"
                  className="flex h-11 w-11 items-center justify-center rounded-lg border border-outline-variant text-outline cursor-not-allowed opacity-60"
                >
                  <span className="material-symbols-outlined">mic</span>
                </button>
                <Button
                  onClick={() => sendText(input)}
                  disabled={!input.trim() || sending}
                  loading={sending}
                  icon="send"
                  aria-label="Send message"
                >
                  Send
                </Button>
              </div>
            </div>
            <p className="mt-2 text-label-md text-on-surface-variant">
              {isDemo
                ? 'Demo assistant — coordinates sample healthcare tasks in this prototype. It does not replace a qualified clinician. No real appointments or records are created. Tip: type “trigger error” to preview the simulated error state.'
                : 'Live assistant — connected to the JeevanDoot backend. Confirming a booking creates a real appointment. It does not replace a qualified clinician. Tip: type “trigger error” to preview the error state.'}
            </p>
          </div>
        </Card>

        {/* ---------- Workflow Progress ---------- */}
        {workflowPlan && (
          <AgentWorkflowProgress workflowPlan={workflowPlan} />
        )}

        {/* ---------- Activity panel ---------- */}
        <AgentActivityPanel steps={steps} summary={summary} mode={isDemo ? 'demo' : 'live'} />
      </div>
    </DashboardLayout>
  );
}
