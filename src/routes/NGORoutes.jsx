import { Route, Routes } from 'react-router-dom';
import NGODashboard from '../pages/ngo/NGODashboard';
import HealthCamps from '../pages/ngo/HealthCamps';
import Donations from '../pages/ngo/Donations';
import ImpactReports from '../pages/ngo/ImpactReports';
import AiTaskAgent from '../pages/ai/AiTaskAgent';
import NotFound from '../pages/errors/404';

export default function NGORoutes() {
  return (
    <Routes>
      <Route path="dashboard" element={<NGODashboard />} />
      <Route path="camps" element={<HealthCamps />} />
      <Route path="donations" element={<Donations />} />
      <Route path="reports" element={<ImpactReports />} />
      <Route path="ai-assistant" element={<AiTaskAgent />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
