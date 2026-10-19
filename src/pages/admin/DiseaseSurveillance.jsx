import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import KPIWidget from '../../components/charts/KPIWidget';
import MapView from '../../components/map/MapView';
import VillageClusters from '../../components/map/VillageClusters';
import { mapService } from '../../services/mapService';
import { useNotification } from '../../hooks/useNotification';

const SIDEBAR = {
  items: [
    { label: 'Dashboard', to: '/admin/dashboard', icon: 'dashboard', end: true },
    { label: 'Disease Surveillance', to: '/admin/surveillance', icon: 'public_health' },
    { label: 'Case-Level Analytics', to: '/admin/case-analytics', icon: 'analytics' },
    { label: 'Audit Log', to: '/admin/audit-log', icon: 'verified_user' },
    { label: 'Report Generation', to: '/admin/reports', icon: 'summarize' },
    { label: 'Doctor Management', to: '/admin/doctors', icon: 'medical_services' },
    { label: 'Configuration', to: '/admin/settings', icon: 'settings' },
    { label: 'JeevanDoot AI', to: '/admin/ai-assistant', icon: 'smart_toy' },
    { label: 'Agent Audit', to: '/admin/agent-audit', icon: 'monitor_heart' },
  ],
};

export default function DiseaseSurveillance() {
  const { notify } = useNotification();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const result = await mapService.getSurveillance();
      setData(result);
      setLoading(false);
    };
    load();
  }, []);

  const mapClusters = (data?.regions ?? []).map((r) => ({
    id: r.name,
    label: r.name,
    level: r.stage >= 2 ? 'high' : r.stage === 1 ? 'medium' : 'low',
    cases: r.newCases,
    lat: r.coords[1],
    lng: r.coords[0],
  }));

  const villageClusters = [
    { village: 'Amroli', status: 'Active', cases: 24, population: 3200, lastUpdated: '5 min ago' },
    { village: 'Palia', status: 'Elevated', cases: 11, population: 2100, lastUpdated: '12 min ago' },
    { village: 'Devgram', status: 'Low', cases: 4, population: 1400, lastUpdated: '20 min ago' },
  ];

  return (
    <DashboardLayout
      sidebarProps={SIDEBAR}
      headerProps={{
        title: 'Disease Cluster Surveillance',
        subtitle: 'Real-time outbreak monitoring',
        right: (
          <Button variant="outline" icon="refresh" onClick={() => notify({ type: 'info', message: 'Surveillance data refreshed' })}>
            Refresh Data
          </Button>
        ),
      }}
    >
      {loading || !data ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <KPIWidget label="Total Reported Cases" value={data.totalCases.toLocaleString()} icon="coronavirus" color="error" trend={-3} />
            <KPIWidget label="Active Outbreaks" value={data.activeOutbreaks} icon="public_health" color="primary" trend={2} />
            <KPIWidget label="Facilities Notified" value="18" icon="domain" color="secondary" trend={5} />
            <KPIWidget label="Containment Rate" value="87%" icon="shield" color="tertiary" trend={4} />
          </div>

          <Card
            title="Regional Outbreak Map"
            subtitle="Hover pins for cluster detail"
            headerRight={
              <Badge variant="critical" icon="location_on">12 active clusters</Badge>
            }
          >
            <MapView clusters={mapClusters} title="DISTRICT HEALTH SURVEILLANCE" />
            <div className="flex flex-wrap gap-4 mt-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-success" />
                <span className="text-label-md text-on-surface-variant">Low risk</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-warning" />
                <span className="text-label-md text-on-surface-variant">Elevated</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-error" />
                <span className="text-label-md text-on-surface-variant">Active outbreak</span>
              </div>
            </div>
          </Card>

          <div>
            <h3 className="font-headline text-headline-sm font-bold text-on-surface mb-4">Village Clusters</h3>
            <VillageClusters clusters={villageClusters} />
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
