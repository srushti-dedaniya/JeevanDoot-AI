import { Router } from 'express';
import { appointmentController } from '../controllers/appointment.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ROLES } from '../models/User.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  authorize(ROLES.ADMIN, ROLES.DOCTOR, ROLES.PATIENT, ROLES.GOVERNMENT),
  appointmentController.getAppointments
);

router.get(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.DOCTOR, ROLES.PATIENT),
  appointmentController.getAppointmentById
);

router.post(
  '/',
  authorize(ROLES.PATIENT, ROLES.DOCTOR, ROLES.ADMIN),
  appointmentController.createAppointment
);

router.put(
  '/:id',
  authorize(ROLES.PATIENT, ROLES.DOCTOR, ROLES.ADMIN),
  appointmentController.updateAppointment
);

router.post(
  '/:id/cancel',
  authorize(ROLES.PATIENT, ROLES.DOCTOR, ROLES.ADMIN),
  appointmentController.cancelAppointment
);

router.delete('/:id', authorize(ROLES.ADMIN), appointmentController.deleteAppointment);

router.get(
  '/availability',
  authorize(ROLES.PATIENT, ROLES.DOCTOR, ROLES.ADMIN, ROLES.GOVERNMENT),
  appointmentController.getAppointmentAvailability
);

export default router;
