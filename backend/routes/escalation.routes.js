import { Router } from 'express';
import { escalationController } from '../controllers/escalation.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ROLES } from '../models/User.js';

const router = Router();

router.use(authenticate);

// List escalations - patients see their own, doctors see their patients', admins see all
router.get(
  '/',
  authorize(ROLES.PATIENT, ROLES.DOCTOR, ROLES.ADMIN),
  escalationController.listEscalations
);

// Generate escalations from continuity insights
router.post(
  '/generate-from-continuity',
  authorize(ROLES.DOCTOR, ROLES.ADMIN),
  escalationController.generateFromContinuity
);

// Create a new escalation
router.post(
  '/',
  authorize(ROLES.DOCTOR, ROLES.ADMIN),
  escalationController.createEscalation
);

// Get a specific escalation
router.get(
  '/:id',
  authorize(ROLES.PATIENT, ROLES.DOCTOR, ROLES.ADMIN),
  escalationController.getEscalation
);

// Acknowledge an escalation
router.post(
  '/:id/acknowledge',
  authorize(ROLES.DOCTOR, ROLES.ADMIN),
  escalationController.acknowledgeEscalation
);

// Start progress on an escalation
router.post(
  '/:id/progress',
  authorize(ROLES.DOCTOR, ROLES.ADMIN),
  escalationController.startProgress
);

// Resolve an escalation
router.post(
  '/:id/resolve',
  authorize(ROLES.DOCTOR, ROLES.ADMIN),
  escalationController.resolveEscalation
);

// Dismiss an escalation
router.post(
  '/:id/dismiss',
  authorize(ROLES.DOCTOR, ROLES.ADMIN),
  escalationController.dismissEscalation
);

export default router;