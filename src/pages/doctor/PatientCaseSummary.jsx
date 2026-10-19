import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../../components/layout/DashboardLayout';
import NotificationBell from '../../components/layout/NotificationBell';
import ProfileMenu from '../../components/layout/ProfileMenu';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import { patientService } from '../../services/patientService';
import { RISK_STYLES } from '../../utils/constants';

const SIDEBAR = {
  items: [
    { labelKey: 'dashboard', to: '/doctor/dashboard', icon: 'dashboard', end: true },
    { labelKey: 'patientQueue', to: '/doctor/queue', icon: 'groups' },
    { labelKey: 'liveConsultation', to: '/doctor/consultation', icon: 'call' },
    { labelKey: 'consultationHistory', to: '/doctor/consultation-history', icon: 'video_library' },
    { labelKey: 'performanceAnalytics', to: '/doctor/performance', icon: 'query_stats' },
    { labelKey: 'aiAssistant', to: '/doctor/ai-assistant', icon: 'smart_toy' },
  ],
};

function VitalCard({ label, value, unit, icon, numeric = false }) {
  const displayValue = (() => {
    if (value === null || value === undefined || value === '') return '—';
    if (numeric) {
      const num = Number(value);
      return Number.isFinite(num) ? String(num) : '—';
    }
    return String(value);
  })();

  return (
    <div className="bg-surface-container-low rounded-lg p-4 flex items-center gap-3 min-w-0">
      <span className="material-symbols-outlined text-primary shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-label-md text-on-surface-variant truncate">{label}</p>
        <p className="font-headline font-bold text-on-surface truncate">
          {displayValue} <span className="text-sm font-normal text-on-surface-variant whitespace-nowrap">{unit}</span>
        </p>
      </div>
    </div>
  );
}

export default function PatientCaseSummary() {
  const { id } = useParams();
  const { t } = useTranslation();
  const sidebarItems = SIDEBAR.items.map((item) => ({ ...item, label: t(`nav.${item.labelKey}`) }));
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const data = await patientService.getById(id);
      setPatient(data);
      setLoading(false);
    };
    load();
  }, [id]);

  const headerRight = (
    <>
      <NotificationBell />
      <ProfileMenu />
    </>
  );

  return (
    <DashboardLayout sidebarProps={{ items: sidebarItems }} headerProps={{ title: t('case.title'), subtitle: id ? t('case.patientId', { id }) : t('case.selectPatient'), right: headerRight }}>
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        </div>
      ) : !patient ? (
        <Card className="p-10 text-center">
          <p className="text-on-surface-variant">{t('case.notFound')}</p>
          <Link to="/doctor/queue">
            <Button className="mt-4">{t('case.backToQueue')}</Button>
          </Link>
        </Card>
      ) : (
        <>
          <Card className="mb-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 rounded-full bg-primary text-on-primary flex items-center justify-center font-headline text-2xl font-bold">
                  {patient.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div>
                  <h3 className="font-headline text-headline-md font-bold text-on-surface">{patient.name}</h3>
                  <p className="text-on-surface-variant">
                    {patient.id} · {patient.age} {t('case.yrs')} · {patient.gender} · {patient.village}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={RISK_STYLES[patient.risk] ? patient.risk === 'Critical' ? 'critical' : patient.risk === 'Moderate' ? 'warning' : 'success' : 'neutral'} uppercase>
                  {t('case.riskBadge', { risk: patient.risk })}
                </Badge>
                <Link to="/doctor/prescription">
                  <Button icon="edit_note">{t('case.writePrescription')}</Button>
                </Link>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <Card title={t('case.chiefComplaint')} icon="description" className="lg:col-span-1">
              <p className="text-body-lg text-on-surface">{patient.complaint}</p>
              <div className="mt-4 space-y-2">
                {(patient.summary ?? []).map((line, i) => (
                  <p key={i} className="flex items-start gap-2 text-on-surface-variant">
                    <span className="material-symbols-outlined text-sm text-primary mt-0.5">check_circle</span>
                    {line}
                  </p>
                ))}
              </div>
            </Card>

            <Card title={t('case.vitalSigns')} icon="favorite" className="lg:col-span-1">
              <div className="grid grid-cols-2 gap-3">
                <VitalCard label={t('case.bloodPressure')} value={patient.vitals?.bp} unit="mmHg" icon="blood_pressure" />
                <VitalCard label={t('case.temperature')} value={patient.vitals?.temp} unit="°F" icon="device_thermostat" />
                <VitalCard label={t('case.pulse')} value={patient.vitals?.pulse} unit="bpm" icon="pulse_rounded" numeric />
                <VitalCard label={t('case.weight')} value={patient.vitals?.weight} unit="kg" icon="monitor_weight" />
              </div>
            </Card>

            <Card title={t('case.recommendation')} icon="medical_services" className="lg:col-span-1">
              <div className="bg-primary-container rounded-lg p-4">
                <p className="text-sm text-on-primary-container">
                  {t('case.recommendationText')}
                </p>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <Link to="/doctor/referral">
                  <Button variant="secondary" fullWidth icon="emergency_home">{t('case.referToSpecialist')}</Button>
                </Link>
                <Link to="/doctor/followup">
                  <Button variant="outline" fullWidth icon="event_available">{t('case.scheduleFollowUp')}</Button>
                </Link>
                <Link to="/doctor/consultation">
                  <Button variant="tertiary" fullWidth icon="call">{t('case.startVirtualConsultation')}</Button>
                </Link>
              </div>
            </Card>
          </div>

          <Card title={t('case.medicalHistory')} icon="history">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { titleKey: 'diagnosis', title: t('case.diagnosis'), items: ['Hypertension (Stage 1)', 'GERD'], icon: 'diagnosis' },
                { titleKey: 'medications', title: t('case.medications'), items: ['Amlodipine 5mg', 'Omeprazole 20mg'], icon: 'medication' },
                { titleKey: 'allergies', title: t('case.allergies'), items: ['Penicillin'], icon: 'warning' },
              ].map((section) => (
                <div key={section.titleKey} className="bg-surface-container-low rounded-lg p-4">
                  <p className="flex items-center gap-2 font-bold text-on-surface mb-3">
                    <span className="material-symbols-outlined text-primary text-lg">{section.icon}</span>
                    {section.title}
                  </p>
                  <ul className="space-y-1 text-on-surface-variant">
                    {section.items.map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-primary" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </DashboardLayout>
  );
}
