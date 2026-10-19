import { Route, Routes } from 'react-router-dom';
import Dashboard from '../pages/patient/Dashboard';
import MedicalRecords from '../pages/patient/MedicalRecords';
import Prescriptions from '../pages/patient/Prescriptions';
import Appointments from '../pages/patient/Appointments';
import BookAppointment from '../pages/patient/BookAppointment';
import ConsultationHistory from '../pages/patient/ConsultationHistory';
import Reports from '../pages/patient/Reports';
import HealthMonitoring from '../pages/patient/HealthMonitoring';
import Notifications from '../pages/patient/Notifications';
import AiTaskAgent from '../pages/ai/AiTaskAgent';
import Profile from '../pages/patient/Profile';
import Settings from '../pages/patient/Settings';
import NotFound from '../pages/errors/404';

export default function PatientRoutes() {
  return (
    <Routes>
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="records" element={<MedicalRecords />} />
      <Route path="prescriptions" element={<Prescriptions />} />
      <Route path="appointments" element={<Appointments />} />
      <Route path="book-appointment" element={<BookAppointment />} />
      <Route path="consultation-history" element={<ConsultationHistory />} />
      <Route path="reports" element={<Reports />} />
      <Route path="monitoring" element={<HealthMonitoring />} />
      <Route path="notifications" element={<Notifications />} />
      <Route path="profile" element={<Profile />} />
      <Route path="ai-assistant" element={<AiTaskAgent />} />
      <Route path="settings" element={<Settings />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
