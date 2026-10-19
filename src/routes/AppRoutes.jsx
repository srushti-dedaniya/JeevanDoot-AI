import { Navigate } from 'react-router-dom';
import AdminRoutes from './AdminRoutes';
import DoctorRoutes from './DoctorRoutes';
import PatientRoutes from './PatientRoutes';
import NGORoutes from './NGORoutes';
import GovernmentRoutes from './GovernmentRoutes';
import { ROLES } from '../utils/constants';

export default function AppRoutes({ role }) {
  switch (role) {
    case ROLES.ADMIN:
      return <AdminRoutes />;
    case ROLES.DOCTOR:
      return <DoctorRoutes />;
    case ROLES.PATIENT:
      return <PatientRoutes />;
    case ROLES.NGO:
      return <NGORoutes />;
    case ROLES.GOVERNMENT:
      return <GovernmentRoutes />;
    default:
      return <Navigate to="/unauthorized" replace />;
  }
}
