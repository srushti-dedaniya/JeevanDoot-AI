import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import SearchBar from '../../components/common/SearchBar';
import KPIWidget from '../../components/charts/KPIWidget';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import { GOVERNMENT_NAV } from './governmentNav';

const STATUS_FILTERS = ['all', 'open', 'answered'];

const QUERY_META = [
  { id: 'Q-2215', scheme: 'PM-JAY', name: 'Ramesh Kumar', village: 'Amroli', status: 'Open' },
  { id: 'Q-2214', scheme: 'PMMVY', name: 'Sunita Devi', village: 'Palia', status: 'Open' },
  { id: 'Q-2213', scheme: 'MI', name: 'Anil Verma', village: 'Devgram', status: 'Answered' },
  { id: 'Q-2212', scheme: 'NPCDCS', name: 'Meera Sharma', village: 'Kanker East', status: 'Answered' },
  { id: 'Q-2211', scheme: 'RBSK', name: 'Laxmi Verma', village: 'Dhamtari Rural', status: 'Open' },
  { id: 'Q-2210', scheme: 'PM-JAY', name: 'Gopal Prasad', village: 'Lormi Block', status: 'Answered' },
];

export default function PublicQueries() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { notify } = useNotification();
  const [queries, setQueries] = useState(() =>
    QUERY_META.map((m) => ({ ...m, userReply: '', repliedBy: '' }))
  );
  const [statusFilter, setStatusFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');

  const sidebarItems = GOVERNMENT_NAV.items.map((item) => ({ ...item, label: t(`nav.${item.labelKey}`) }));

  const rows = queries.map((q) => ({
    ...q,
    schemeName: t(`government.schemes.${q.scheme}.short`),
    date: t(`government.queries.${q.id}.date`),
    question: t(`government.queries.${q.id}.question`),
    reply: q.userReply || t(`government.queries.${q.id}.reply`),
  }));

  const openCount = rows.filter((q) => q.status === 'Open').length;
  const answeredCount = rows.length - openCount;

  const filtered = rows.filter(
    (q) =>
      (statusFilter === 'all' || q.status === statusFilter) &&
      (!query ||
        q.question.toLowerCase().includes(query.toLowerCase()) ||
        q.schemeName.toLowerCase().includes(query.toLowerCase()) ||
        q.name.toLowerCase().includes(query.toLowerCase()))
  );

  const toggleStatus = (id) => {
    const target = queries.find((q) => q.id === id);
    if (!target) return;
    const status = target.status === 'Open' ? 'Answered' : 'Open';
    setQueries((prev) =>
      prev.map((q) => (q.id === id ? { ...q, status } : q))
    );
    notify({ type: 'success', message: t('government.queryMarked', { id, status }) });
  };

  const openReply = (target) => {
    setReplyingTo(target);
    setReplyText(target.reply || '');
  };

  const submitReply = () => {
    if (!replyText.trim()) {
      notify({ type: 'error', message: t('government.replyRequired') });
      return;
    }
    const agent = user?.name ?? 'Government Official';
    setQueries((prev) =>
      prev.map((q) =>
        q.id === replyingTo.id
          ? { ...q, userReply: replyText.trim(), repliedBy: agent, status: 'Answered' }
          : q
      )
    );
    notify({ type: 'success', message: t('government.replySent', { id: replyingTo.id }) });
    setReplyingTo(null);
    setReplyText('');
  };

  return (
    <DashboardLayout
      sidebarProps={{ items: sidebarItems }}
      headerProps={{
        title: t('government.queriesTitle'),
        subtitle: t('government.queriesSubtitle'),
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <KPIWidget label={t('government.totalQueries')} value={String(queries.length)} icon="question_answer" color="primary" sublabel={t('government.acrossAllSchemes')} />
        <KPIWidget label={t('government.open')} value={String(openCount)} icon="markunread_mailbox" color="tertiary" trend={14} />
        <KPIWidget label={t('government.answered')} value={String(answeredCount)} icon="mark_email_read" color="secondary" trend={8} />
      </div>

      <Card
        title={t('government.citizenQuestions')}
        subtitle={t('government.queriesShown', { count: filtered.length })}
        headerRight={
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 bg-surface-container-low border border-outline-variant rounded-lg px-3 text-label-md focus:ring-2 focus:ring-primary"
              aria-label={t('government.statusFilterLabel')}
            >
              {STATUS_FILTERS.map((status) => (
                <option key={status} value={status}>{t(`government.${status === 'all' ? 'allFilter' : status}`)}</option>
              ))}
            </select>
            <SearchBar placeholder={t('government.searchQuestions')} onSearch={setQuery} containerClassName="w-64" />
          </div>
        }
      >
        {filtered.length === 0 ? (
          <p className="text-center text-on-surface-variant py-12">{t('government.noQueriesFound')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-primary text-on-primary">
                  <th className="px-6 py-3 font-headline font-semibold">ID</th>
                  <th className="px-6 py-3 font-headline font-semibold">{t('government.scheme')}</th>
                  <th className="px-6 py-3 font-headline font-semibold">{t('government.question')}</th>
                  <th className="px-6 py-3 font-headline font-semibold">{t('government.askedBy')}</th>
                  <th className="px-6 py-3 font-headline font-semibold">{t('government.date')}</th>
                  <th className="px-6 py-3 font-headline font-semibold">{t('government.status')}</th>
                  <th className="px-6 py-3 font-headline font-semibold">{t('government.action')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((q) => (
                  <tr key={q.id} className="border-b border-outline-variant hover:bg-surface-container-low transition-colors">
                    <td className="px-6 py-4 font-mono font-semibold text-primary">{q.id}</td>
                    <td className="px-6 py-4 text-on-surface-variant whitespace-nowrap">{q.schemeName}</td>
                    <td className="px-6 py-4 text-on-surface max-w-md">
                      {q.question}
                      {q.reply && (
                        <div className="mt-2 bg-primary-fixed/40 border-l-4 border-primary rounded-r-lg p-3">
                          <p className="text-label-md font-bold text-primary">{t('government.officialReply')}</p>
                          <p className="text-body-sm text-on-surface mt-0.5">{q.reply}</p>
                          {q.repliedBy && (
                            <p className="text-label-sm text-on-surface-variant mt-1">— {q.repliedBy}</p>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-on-surface whitespace-nowrap">{q.name}</p>
                      <p className="text-label-sm text-on-surface-variant">{q.village}</p>
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant whitespace-nowrap">{q.date}</td>
                    <td className="px-6 py-4">
                      <Badge variant={q.status === 'Open' ? 'warning' : 'success'} dot>{t(`government.${q.status === 'Open' ? 'open' : 'answered'}`)}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="primary" icon="reply" onClick={() => openReply(q)}>
                          {t('government.reply')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          icon={q.status === 'Open' ? 'mark_email_read' : 'replay'}
                          onClick={() => toggleStatus(q.id)}
                        >
                          {q.status === 'Open' ? t('government.markAnswered') : t('government.reopen')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={Boolean(replyingTo)}
        onClose={() => { setReplyingTo(null); setReplyText(''); }}
        title={replyingTo ? t('government.replyTo', { name: replyingTo.name }) : ''}
        icon="reply"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => { setReplyingTo(null); setReplyText(''); }}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" icon="send" onClick={submitReply}>
              {t('government.sendReply')}
            </Button>
          </>
        }
      >
        {replyingTo && (
          <div className="space-y-5">
            <div className="bg-surface-container-low rounded-lg p-4">
              <p className="text-label-md text-on-surface-variant">{replyingTo.schemeName} · {replyingTo.name}, {replyingTo.village}</p>
              <p className="font-semibold text-on-surface mt-1">{replyingTo.question}</p>
            </div>
            <div>
              <label className="block text-label-lg font-semibold text-on-surface ml-1 mb-2">{t('government.officialReplyLabel')}</label>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={5}
                placeholder={t('government.replyPlaceholder')}
                className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <p className="text-label-sm text-on-surface-variant">
              {t('government.replyingAs', { name: user?.name ?? 'Government Official' })}
            </p>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}
