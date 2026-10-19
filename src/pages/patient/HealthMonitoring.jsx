import { useTranslation } from 'react-i18next';
import DashboardLayout from '../../components/layout/DashboardLayout';
import PatientSidebar from '../../components/layout/PatientSidebar';
import Card from '../../components/common/Card';
import KPIWidget from '../../components/charts/KPIWidget';
import LineChart from '../../components/charts/LineChart';

const LABELS = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];

const BP_SYSTOLIC = [150, 146, 142, 140, 138, 135];
const BP_DIASTOLIC = [95, 92, 90, 88, 86, 84];
const HEART_RATE = [82, 80, 84, 79, 78, 76];
const BLOOD_SUGAR = [128, 124, 121, 120, 118, 118];
const WEIGHT = [60, 59.5, 59, 58.5, 58, 58];
const BMI = [23.0, 22.8, 22.6, 22.4, 22.1, 22.1];

const CHART_COLORS = {
  primary: '#1B5E4F',
  secondary: '#C8B900',
  tertiary: '#E8734A',
};

function MetricRow({ items }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item.label}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-low border border-outline-variant"
        >
          <span className="w-3 h-3 rounded-full" style={{ background: item.color }} />
          <span className="text-label-sm text-on-surface-variant">{item.label}</span>
          <span className="font-bold text-on-surface">{item.value}</span>
        </span>
      ))}
    </div>
  );
}

export default function HealthMonitoring() {
  const { t } = useTranslation();
  const month = 'Aug';

  return (
    <DashboardLayout
      sidebar={<PatientSidebar />}
      headerProps={{ title: t('patient.monitoring.title'), subtitle: t('patient.monitoring.subtitle') }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
        <KPIWidget
          label={t('patient.monitoring.bloodPressure')}
          value="135/84"
          unit="mmHg"
          icon="blood_pressure"
          color="error"
          trend={-3}
          sublabel={t('patient.monitoring.latestReading', { month })}
        />
        <KPIWidget
          label={t('patient.monitoring.heartRate')}
          value="76"
          unit="bpm"
          icon="monitor_heart"
          color="primary"
          trend={-2}
          sublabel={t('patient.monitoring.resting', { month })}
        />
        <KPIWidget
          label={t('patient.monitoring.bloodSugar')}
          value="118"
          unit="mg/dL"
          icon="water_drop"
          color="secondary"
          trend={-4}
          sublabel={t('patient.monitoring.fasting', { month })}
        />
        <KPIWidget
          label={t('patient.monitoring.weight')}
          value="58"
          unit="kg"
          icon="monitor_weight"
          color="tertiary"
          trend={-2}
          sublabel={t('patient.monitoring.weightSince', { value: '2', month: 'Mar' })}
        />
        <KPIWidget
          label={t('patient.monitoring.bmi')}
          value="22.1"
          icon="monitoring"
          color="primary"
          trend={-2}
          sublabel={t('patient.monitoring.bmiRange')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title={t('patient.monitoring.bloodPressure')}
          subtitle={t('patient.monitoring.monthlyTrendUnit', { unit: 'mmHg' })}
          className="lg:col-span-2"
          headerRight={
            <MetricRow
              items={[
                { label: t('patient.monitoring.systolic'), value: '135 mmHg', color: CHART_COLORS.primary },
                { label: t('patient.monitoring.diastolic'), value: '84 mmHg', color: CHART_COLORS.tertiary },
              ]}
            />
          }
        >
          <LineChart
            labels={LABELS}
            datasets={[
              { label: t('patient.monitoring.systolic'), data: BP_SYSTOLIC, borderColor: CHART_COLORS.primary, backgroundColor: 'rgba(27, 94, 79, 0.08)' },
              { label: t('patient.monitoring.diastolic'), data: BP_DIASTOLIC, borderColor: CHART_COLORS.tertiary, backgroundColor: 'rgba(232, 115, 74, 0.08)' },
            ]}
            height={300}
            options={{
              plugins: {
                legend: { display: true, labels: { usePointStyle: true, boxWidth: 8, color: undefined } },
              },
            }}
          />
        </Card>

        <Card title={t('patient.monitoring.heartRate')} subtitle={t('patient.monitoring.monthlyAverage', { unit: 'bpm' })}>
          <LineChart labels={LABELS} data={HEART_RATE} height={260} />
        </Card>

        <Card title={t('patient.monitoring.bloodSugar')} subtitle={t('patient.monitoring.fastingGlucose', { unit: 'mg/dL' })}>
          <LineChart labels={LABELS} data={BLOOD_SUGAR} height={260} />
        </Card>

        <Card title={t('patient.monitoring.weight')} subtitle={t('patient.monitoring.monthlyTrendUnit', { unit: 'kg' })}>
          <LineChart labels={LABELS} data={WEIGHT} height={260} />
        </Card>

        <Card title={t('patient.monitoring.bmi')} subtitle={t('patient.monitoring.monthlyTrend')}>
          <LineChart labels={LABELS} data={BMI} height={260} />
        </Card>
      </div>
    </DashboardLayout>
  );
}
