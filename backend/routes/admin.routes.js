import { Router } from 'express';
import { adminController } from '../controllers/admin.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ROLES } from '../models/User.js';

const router = Router();

router.use(authenticate, authorize(ROLES.ADMIN));

router.get('/dashboard', adminController.getDashboard);
router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUserById);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);
router.get('/audit', adminController.getAuditLog);
router.get('/surveillance', adminController.getSurveillance);

export default router;
