import { Router } from 'express';
import { body, query } from 'express-validator';
import { chat, confirm, peek, getWorkflowPlan, cancelWorkflow, status, listMyRuns, getRun, listAllRuns } from '../controllers/ai.controller.js';
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
  chat
);

router.post(
  '/confirm',
  aiConfirmLimiter,
  [body('proposalId').isString().isLength({ min: 1, max: 64 })],
  validate,
  confirm
);

router.get('/proposal/:id', aiChatLimiter, peek);

router.get('/workflow/:id', aiChatLimiter, getWorkflowPlan);
router.post('/workflow/cancel', aiChatLimiter, cancelWorkflow);

router.get('/status', status);

router.get(
  '/runs',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isString(),
    query('intent').optional().isString(),
  ],
  validate,
  listMyRuns
);

router.get('/runs/:id', getRun);

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
  listAllRuns
);

export default router;
