import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  registerController,
  loginController,
  roleLoginController,
  getCurrentUserController,
  refreshTokenController
} from '../controllers/authController.js';

const router = express.Router();

router.post('/register', registerController);
router.post('/login', loginController);
router.post('/role-login', roleLoginController);
router.get('/me', authenticateToken, getCurrentUserController);
router.post('/refresh', authenticateToken, refreshTokenController);

router.post('/admin-login', async (req, res) => {
  req.body.requiredRole = 'admin';
  return roleLoginController(req, res);
});

router.post('/editor-login', async (req, res) => {
  req.body.requiredRole = 'editor';
  return roleLoginController(req, res);
});

router.post('/viewer-login', async (req, res) => {
  req.body.requiredRole = 'viewer';
  return roleLoginController(req, res);
});

export default router;