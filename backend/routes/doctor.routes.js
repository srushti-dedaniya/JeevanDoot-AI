import { Router } from 'express';
import { doctorController } from '../controllers/doctor.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ROLES } from '../models/User.js';

const router = Router();

router.use(authenticate);

router.get(
  '/dashboard',
  authorize(ROLES.DOCTOR),
  doctorController.getDashboard
);

// The doctor's own profile lives at /doctors/me for convenience.
router.get('/me', authorize(ROLES.DOCTOR), doctorController.getMyProfile);

router.get(
  '/',
  authorize(ROLES.ADMIN, ROLES.DOCTOR, ROLES.PATIENT, ROLES.NGO, ROLES.GOVERNMENT),
  doctorController.getDoctors
);

router.post(
  '/',
  authorize(ROLES.ADMIN, ROLES.DOCTOR),
  doctorController.createDoctor
);

router.get('/:id', doctorController.getDoctorById);

router.put(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.DOCTOR),
  doctorController.updateDoctor
);

router.post(
  '/:id/toggle-status',
  authorize(ROLES.DOCTOR, ROLES.ADMIN),
  doctorController.toggleDoctorStatus
);

router.delete('/:id', authorize(ROLES.ADMIN), doctorController.deleteDoctor);

export default router;
