import { Route, Routes } from 'react-router-dom';
import DoctorDashboard from '../pages/doctor/DoctorDashboard';
import PatientQueue from '../pages/doctor/PatientQueue';
import PatientCaseSummary from '../pages/doctor/PatientCaseSummary';
import PrescriptionWriting from '../pages/doctor/PrescriptionWriting';
import PatientReferral from '../pages/doctor/PatientReferral';
import FollowUpScheduling from '../pages/doctor/FollowUpScheduling';
import DoctorPerformance from '../pages/doctor/DoctorPerformance';
import LiveConsultation from '../pages/doctor/LiveConsultation';
import ConsultationHistory from '../pages/doctor/ConsultationHistory';
import AiTaskAgent from '../pages/ai/AiTaskAgent';
import NotFound from '../pages/errors/404';

export default function DoctorRoutes() {
  return (
    <Routes>
      <Route path="dashboard" element={<DoctorDashboard />} />
      <Route path="queue" element={<PatientQueue />} />
      <Route path="case/:id" element={<PatientCaseSummary />} />
      <Route path="prescription" element={<PrescriptionWriting />} />
      <Route path="referral" element={<PatientReferral />} />
      <Route path="followup" element={<FollowUpScheduling />} />
      <Route path="performance" element={<DoctorPerformance />} />
      <Route path="consultation" element={<LiveConsultation />} />
      <Route path="consultation-history" element={<ConsultationHistory />} />
      <Route path="ai-assistant" element={<AiTaskAgent />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
