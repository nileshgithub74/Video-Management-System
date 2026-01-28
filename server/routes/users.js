import express from 'express';
import { requireRole } from '../middleware/auth.js';
import {
  getAllUsersController,
  updateUserRoleController,
  deactivateUserController
} from '../controllers/userController.js';

const router = express.Router();

router.get('/', requireRole(['admin']), getAllUsersController);
router.put('/:id/role', requireRole(['admin']), updateUserRoleController);
router.put('/:id/deactivate', requireRole(['admin']), deactivateUserController);

export default router;