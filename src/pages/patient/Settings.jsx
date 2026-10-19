import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../../components/layout/DashboardLayout';
import PatientSidebar from '../../components/layout/PatientSidebar';
import SettingsPreferences from '../../components/layout/SettingsPreferences';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import { useAuth } from '../../hooks/useAuth';

export default function Settings() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [confirmLogout, setConfirmLogout] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/patient/login', { replace: true });
  };

  return (
    <DashboardLayout
      sidebar={<PatientSidebar />}
      headerProps={{ title: t('settings.settings'), subtitle: t('patient.settings.subtitle') }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card
          title={t('patient.settings.preferences')}
          subtitle={t('patient.settings.preferencesSubtitle')}
          icon="tune"
          className="lg:col-span-2"
        >
          <SettingsPreferences />
        </Card>

        <div className="space-y-6">
          <Card title={t('patient.settings.account')} subtitle={t('patient.settings.sessionManagement')} icon="account_circle">
            <div className="flex items-center gap-3 bg-surface-container-low rounded-lg p-4">
              <span className="material-symbols-outlined text-error shrink-0">logout</span>
              <div className="min-w-0">
                <p className="font-bold text-on-surface text-sm">{t('patient.settings.logOut')}</p>
                <p className="text-label-md text-on-surface-variant">
                  {t('patient.settings.logOutDesc')}
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="danger" icon="logout" onClick={() => setConfirmLogout(true)}>
                {t('common.logout')}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        title={t('common.logout')}
        icon="logout"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmLogout(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" icon="logout" onClick={handleLogout}>
              {t('common.logout')}
            </Button>
          </>
        }
      >
        <p className="text-body-md text-on-surface">
          {t('patient.settings.logoutConfirm')}
        </p>
      </Modal>
    </DashboardLayout>
  );
}
