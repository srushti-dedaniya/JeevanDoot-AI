import { Router } from 'express';
import { reminderController } from '../controllers/reminder.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ROLES } from '../models/User.js';

const router = Router();

router.use(authenticate);

// List reminders - patients see their own, doctors see their patients', admins see all
router.get(
  '/',
  authorize(ROLES.PATIENT, ROLES.DOCTOR, ROLES.ADMIN),
  reminderController.listReminders
);

// Generate reminders from continuity insights
router.post(
  '/generate-from-continuity',
  authorize(ROLES.DOCTOR, ROLES.ADMIN),
  reminderController.generateFromContinuity
);

// Create a new reminder draft
router.post(
  '/',
  authorize(ROLES.DOCTOR, ROLES.ADMIN),
  reminderController.createReminder
);

// Get a specific reminder
router.get(
  '/:id',
  authorize(ROLES.PATIENT, ROLES.DOCTOR, ROLES.ADMIN),
  reminderController.getReminder
);

// Submit reminder for approval
router.post(
  '/:id/submit',
  authorize(ROLES.DOCTOR, ROLES.ADMIN),
  reminderController.submitForApproval
);

// Approve a reminder
router.post(
  '/:id/approve',
  authorize(ROLES.DOCTOR, ROLES.ADMIN),
  reminderController.approveReminder
);

// Send an approved reminder
router.post(
  '/:id/send',
  authorize(ROLES.DOCTOR, ROLES.ADMIN),
  reminderController.sendReminder
);

// Cancel a reminder
router.post(
  '/:id/cancel',
  authorize(ROLES.PATIENT, ROLES.DOCTOR, ROLES.ADMIN),
  reminderController.cancelReminder
);

export default router;