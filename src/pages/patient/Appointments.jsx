import { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../../components/layout/DashboardLayout';
import PatientSidebar from '../../components/layout/PatientSidebar';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import { formatDate, formatTime } from '../../utils/formatDate';
import { cx } from '../../utils/helpers';

const STATUS_BADGE = {
  Upcoming: 'primary',
  Completed: 'success',
  Cancelled: 'error',
};

const STATUS_LABEL_KEY = {
  Upcoming: 'statusUpcoming',
  Completed: 'statusCompleted',
  Cancelled: 'statusCancelled',
};

const SECTION_META = {
  Upcoming: { icon: 'upcoming', color: 'text-primary', chip: 'bg-primary-fixed text-on-primary-fixed-variant' },
  Completed: { icon: 'task_alt', color: 'text-primary', chip: 'bg-primary-fixed text-on-primary-fixed-variant' },
  Cancelled: { icon: 'event_busy', color: 'text-error', chip: 'bg-error-container text-on-error-container' },
};

const DUMMY_APPOINTMENTS = [
  {
    id: 'APT-1058',
    doctor: 'Dr. Rajesh Kumar',
    specialization: 'General Physician',
    hospital: 'Amroli Primary Health Centre',
    date: '2026-08-15',
    time: '10:30',
    purpose: 'Follow-up: Hypertension checkup',
    notes: 'Bring recent BP readings.',
    status: 'Upcoming',
  },
  {
    id: 'APT-1041',
    doctor: 'Dr. Sunita Patel',
    specialization: 'Endocrinologist',
    hospital: 'District Health Centre, Palia',
    date: '2026-08-02',
    time: '11:00',
    purpose: 'Diabetes review & HbA1c',
    notes: 'Fasting blood sugar report needed.',
    status: 'Upcoming',
  },
  {
    id: 'APT-0997',
    doctor: 'Dr. Rajesh Kumar',
    specialization: 'General Physician',
    hospital: 'Amroli Primary Health Centre',
    date: '2026-07-18',
    time: '09:30',
    purpose: 'Seasonal vaccination',
    notes: '',
    status: 'Completed',
  },
  {
    id: 'APT-0983',
    doctor: 'Dr. Anil Mehta',
    specialization: 'Cardiologist',
    hospital: 'District Cardiology Center',
    date: '2026-07-02',
    time: '14:00',
    purpose: 'ECG & cardiac consultation',
    notes: '',
    status: 'Completed',
  },
  {
    id: 'APT-0960',
    doctor: 'Dr. Rajesh Kumar',
    specialization: 'General Physician',
    hospital: 'Amroli Primary Health Centre',
    date: '2026-06-20',
    time: '16:00',
    purpose: 'General checkup',
    notes: '',
    status: 'Cancelled',
  },
];

const SECTION_ORDER = ['Upcoming', 'Completed', 'Cancelled'];

function SectionHeader({ status, appointments }) {
  const { t } = useTranslation();
  const meta = SECTION_META[status];
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className={cx('material-symbols-outlined', meta.color)}>{meta.icon}</span>
      <h2 className="font-headline text-headline-sm font-bold text-on-surface">
        {t(`patient.appointments.${STATUS_LABEL_KEY[status]}`)}
      </h2>
      <span className={cx('px-2.5 py-0.5 rounded-full text-label-md font-bold', meta.chip)}>
        {appointments.length}
      </span>
    </div>
  );
}

export default function Appointments() {
  const { t } = useTranslation();
  const [appointments, setAppointments] = useState(DUMMY_APPOINTMENTS);
  const [viewTarget, setViewTarget] = useState(null);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [form, setForm] = useState({ date: '', time: '' });

  const openReschedule = (apt) => {
    setRescheduleTarget(apt);
    setForm({ date: apt.date, time: apt.time });
  };

  const confirmReschedule = () => {
    if (!form.date || !form.time) {
      toast.error(t('patient.appointments.pickDateTime'));
      return;
    }
    setAppointments((prev) =>
      prev.map((apt) => (apt.id === rescheduleTarget.id ? { ...apt, date: form.date, time: form.time } : apt))
    );
    setRescheduleTarget(null);
    toast.success(t('patient.appointments.rescheduled'));
  };

  const confirmCancel = () => {
    setAppointments((prev) =>
      prev.map((apt) => (apt.id === cancelTarget.id ? { ...apt, status: 'Cancelled' } : apt))
    );
    setCancelTarget(null);
    toast.success(t('patient.appointments.cancelled'));
  };

  const sections = SECTION_ORDER.map((status) => ({
    status,
    list: appointments.filter((apt) => apt.status === status),
  }));

  const badge = (status) => (
    <Badge variant={STATUS_BADGE[status]}>{t(`patient.appointments.${STATUS_LABEL_KEY[status]}`)}</Badge>
  );

  const dateTime = (apt) => formatDate(`${apt.date}T${apt.time}:00`, 'EEE, MMM d, yyyy');

  return (
    <DashboardLayout
      sidebar={<PatientSidebar />}
      headerProps={{ title: t('patient.appointments.title'), subtitle: t('patient.appointments.subtitle') }}
    >
      <div className="space-y-10">
        {sections.map(({ status, list }) => (
          <section key={status}>
            <SectionHeader status={status} appointments={list} />
            {list.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-on-surface-variant">
                  {t('patient.appointments.noAppointments', {
                    status: t(`patient.appointments.${STATUS_LABEL_KEY[status]}`),
                  })}
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {list.map((apt) => (
                  <Card key={apt.id}>
                    <div className="flex flex-col lg:flex-row justify-between gap-6">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="font-headline text-headline-md font-bold text-on-surface">{apt.doctor}</h3>
                          {badge(apt.status)}
                        </div>
                        <p className="text-on-surface-variant mt-0.5">
                          {apt.specialization} · {apt.hospital}
                        </p>

                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="bg-surface-container-low rounded-lg p-4">
                            <p className="text-label-md text-on-surface-variant">{t('common.date')}</p>
                            <p className="font-bold text-on-surface flex items-center gap-1.5 mt-1">
                              <span className="material-symbols-outlined text-primary text-lg">calendar_month</span>
                              {formatDate(`${apt.date}T00:00:00`, 'EEE, MMM d, yyyy')}
                            </p>
                          </div>
                          <div className="bg-surface-container-low rounded-lg p-4">
                            <p className="text-label-md text-on-surface-variant">{t('common.time')}</p>
                            <p className="font-bold text-on-surface flex items-center gap-1.5 mt-1">
                              <span className="material-symbols-outlined text-primary text-lg">schedule</span>
                              {formatTime(`${apt.date}T${apt.time}:00`, 'h:mm a')}
                            </p>
                          </div>
                          <div className="bg-surface-container-low rounded-lg p-4 sm:col-span-1">
                            <p className="text-label-md text-on-surface-variant">{t('patient.appointments.purpose')}</p>
                            <p className="font-bold text-on-surface flex items-center gap-1.5 mt-1">
                              <span className="material-symbols-outlined text-primary text-lg">medical_services</span>
                              {apt.purpose}
                            </p>
                          </div>
                        </div>

                        {apt.notes && (
                          <p className="mt-3 text-label-md text-on-surface-variant flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-primary text-lg">sticky_note_2</span>
                            {apt.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-row lg:flex-col justify-end gap-3 lg:w-64 shrink-0">
                        <Button variant="outline" icon="visibility" fullWidth onClick={() => setViewTarget(apt)}>
                          {t('common.view')}
                        </Button>
                        {status === 'Upcoming' && (
                          <>
                            <Button variant="secondary" icon="event_repeat" fullWidth onClick={() => openReschedule(apt)}>
                              {t('patient.appointments.reschedule')}
                            </Button>
                            <Button variant="danger" icon="event_busy" fullWidth onClick={() => setCancelTarget(apt)}>
                              {t('patient.appointments.cancelAppointment')}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      <Modal
        open={Boolean(viewTarget)}
        onClose={() => setViewTarget(null)}
        title={
          viewTarget
            ? t('patient.appointments.appointmentTitle', { id: viewTarget.id })
            : t('patient.appointments.appointment')
        }
        icon="event"
        size="lg"
      >
        {viewTarget && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-surface-container-low rounded-lg p-4">
              <div>
                <p className="font-headline text-title-md font-bold text-on-surface">{viewTarget.doctor}</p>
                <p className="text-on-surface-variant">{viewTarget.specialization} · {viewTarget.hospital}</p>
              </div>
              {badge(viewTarget.status)}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-surface-container-low rounded-lg p-4">
                <p className="text-label-md text-on-surface-variant">{t('common.date')}</p>
                <p className="font-bold text-on-surface">{dateTime(viewTarget)}</p>
              </div>
              <div className="bg-surface-container-low rounded-lg p-4">
                <p className="text-label-md text-on-surface-variant">{t('common.time')}</p>
                <p className="font-bold text-on-surface">{formatTime(`${viewTarget.date}T${viewTarget.time}:00`, 'h:mm a')}</p>
              </div>
              <div className="bg-surface-container-low rounded-lg p-4 sm:col-span-2">
                <p className="text-label-md text-on-surface-variant">{t('patient.appointments.purpose')}</p>
                <p className="font-bold text-on-surface">{viewTarget.purpose}</p>
              </div>
              {viewTarget.notes && (
                <div className="bg-surface-container-low rounded-lg p-4 sm:col-span-2">
                  <p className="text-label-md text-on-surface-variant">{t('common.notes')}</p>
                  <p className="font-bold text-on-surface">{viewTarget.notes}</p>
                </div>
              )}
            </div>

            {viewTarget.status === 'Upcoming' && (
              <div className="flex flex-col sm:flex-row justify-end gap-3">
                <Button variant="secondary" icon="event_repeat" onClick={() => { setViewTarget(null); openReschedule(viewTarget); }}>
                  {t('patient.appointments.reschedule')}
                </Button>
                <Button variant="danger" icon="event_busy" onClick={() => { setViewTarget(null); setCancelTarget(viewTarget); }}>
                  {t('patient.appointments.cancelAppointment')}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(rescheduleTarget)}
        onClose={() => setRescheduleTarget(null)}
        title={
          rescheduleTarget
            ? t('patient.appointments.rescheduleTitle', { id: rescheduleTarget.id })
            : t('patient.appointments.reschedule')
        }
        icon="event_repeat"
        footer={
          <>
            <Button variant="outline" onClick={() => setRescheduleTarget(null)}>{t('common.cancel')}</Button>
            <Button icon="check" onClick={confirmReschedule}>{t('patient.appointments.confirmReschedule')}</Button>
          </>
        }
      >
        {rescheduleTarget && (
          <div className="space-y-5">
            <div className="bg-surface-container-low rounded-lg p-4">
              <p className="font-bold text-on-surface">{rescheduleTarget.doctor}</p>
              <p className="text-label-md text-on-surface-variant mt-0.5">{rescheduleTarget.purpose}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-label-lg font-semibold text-on-surface mb-2">{t('common.date')}</label>
                <input
                  type="date"
                  value={form.date}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full h-14 bg-surface-container-low border border-outline-variant rounded-lg px-4 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-label-lg font-semibold text-on-surface mb-2">{t('common.time')}</label>
                <input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                  className="w-full h-14 bg-surface-container-low border border-outline-variant rounded-lg px-4 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title={t('patient.appointments.cancelAppointment')}
        icon="event_busy"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>{t('patient.appointments.noKeepIt')}</Button>
            <Button variant="danger" icon="event_busy" onClick={confirmCancel}>{t('patient.appointments.yesCancel')}</Button>
          </>
        }
      >
        {cancelTarget && (
          <div className="space-y-3">
            <p className="text-body-md text-on-surface">
              {t('patient.appointments.cancelConfirm', {
                doctor: cancelTarget.doctor,
                date: formatDate(`${cancelTarget.date}T00:00:00`, 'EEE, MMM d, yyyy'),
                time: formatTime(`${cancelTarget.date}T${cancelTarget.time}:00`, 'h:mm a'),
              })}
            </p>
            <p className="text-label-md text-on-surface-variant">{t('patient.appointments.cannotUndo')}</p>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}
