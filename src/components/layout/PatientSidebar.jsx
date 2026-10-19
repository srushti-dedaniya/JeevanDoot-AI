import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Sidebar from './Sidebar';
import { useAuth } from '../../hooks/useAuth';

const PATIENT_MENU = [
  { labelKey: 'dashboard', to: '/patient/dashboard', icon: 'dashboard', end: true },
  { labelKey: 'medicalRecords', to: '/patient/records', icon: 'folder_shared' },
  { labelKey: 'prescriptions', to: '/patient/prescriptions', icon: 'medication' },
  { labelKey: 'appointments', to: '/patient/appointments', icon: 'event' },
  { labelKey: 'bookAppointment', to: '/patient/book-appointment', icon: 'event_available' },
  { labelKey: 'consultationHistory', to: '/patient/consultation-history', icon: 'history' },
  { labelKey: 'reports', to: '/patient/reports', icon: 'description' },
  { labelKey: 'healthMonitoring', to: '/patient/monitoring', icon: 'monitor_heart' },
  { labelKey: 'aiAssistant', to: '/patient/ai-assistant', icon: 'smart_toy' },
  { labelKey: 'notifications', to: '/patient/notifications', icon: 'notifications' },
  { labelKey: 'profile', to: '/patient/profile', icon: 'person' },
  { labelKey: 'settings', to: '/patient/settings', icon: 'settings' },
];

export default function PatientSidebar({ brand }) {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/patient/login', { replace: true });
  };

  const footer = (
    <button
      type="button"
      onClick={handleLogout}
      className="flex w-full items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:bg-error-container hover:text-error transition-colors duration-200 ease-in-out"
    >
      <span className="material-symbols-outlined">logout</span>
      <span className="font-body text-body-md">{t('common.logout')}</span>
    </button>
  );

  const items = PATIENT_MENU.map((item) => ({ ...item, label: t(`nav.${item.labelKey}`) }));

  return <Sidebar brand={brand} items={items} footer={footer} />;
}
