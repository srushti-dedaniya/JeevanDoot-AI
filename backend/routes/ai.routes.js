import { Router } from 'express';
import { body, query } from 'express-validator';
import { aiController } from '../controllers/ai.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ROLES } from '../models/User.js';
import { aiChatLimiter, aiConfirmLimiter } from '../middleware/rateLimit.js';
import validate from '../middleware/validate.js';

const router = Router();

router.use(authenticate);

router.post(
  '/chat',
  aiChatLimiter,
  [
    body('message').isString().isLength({ min: 1, max: 2000 }),
    body('history').optional().isArray({ max: 10 }),
  ],
  validate,
  aiController.chat
);

router.post(
  '/confirm',
  aiConfirmLimiter,
  [body('proposalId').isString().isLength({ min: 1, max: 64 })],
  validate,
  aiController.confirm
);

router.get('/proposal/:id', aiChatLimiter, aiController.peek);

router.get('/workflow/:id', aiChatLimiter, aiController.getWorkflowPlan);
router.post('/workflow/cancel', aiChatLimiter, aiController.cancelWorkflow);

router.get('/status', aiController.status);

router.get(
  '/runs',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isString(),
    query('intent').optional().isString(),
  ],
  validate,
  aiController.listMyRuns
);

router.get('/runs/:id', aiController.getRun);

router.get(
  '/admin/runs',
  authorize(ROLES.ADMIN),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isString(),
    query('intent').optional().isString(),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
  ],
  validate,
  aiController.listAllRuns
);

export default router;
