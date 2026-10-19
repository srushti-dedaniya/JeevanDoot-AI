import { Route, Routes } from 'react-router-dom';
import GovernmentDashboard from '../pages/government/GovernmentDashboard';
import HealthSchemes from '../pages/government/HealthSchemes';
import PublicQueries from '../pages/government/PublicQueries';
import AiTaskAgent from '../pages/ai/AiTaskAgent';
import NotFound from '../pages/errors/404';

export default function GovernmentRoutes() {
  return (
    <Routes>
      <Route path="dashboard" element={<GovernmentDashboard />} />
      <Route path="schemes" element={<HealthSchemes />} />
      <Route path="queries" element={<PublicQueries />} />
      <Route path="ai-assistant" element={<AiTaskAgent />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
