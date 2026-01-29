import express from 'express';
import { uploadVideo } from '../middleware/upload.js';
import { requireRole } from '../middleware/auth.js';
import {
  uploadVideoController,
  getAllVideosController,
  getVideoController,
  streamVideoController,
  updateVideoController,
  deleteVideoController,
  rejectVideoController,
  overrideVideoSafetyController
} from '../controllers/videoController.js';

const router = express.Router();

router.post('/upload', requireRole(['editor', 'admin']), uploadVideo, uploadVideoController);
router.get('/', getAllVideosController);
router.get('/:id', getVideoController);
router.get('/:id/stream', streamVideoController);
router.put('/:id', requireRole(['editor', 'admin']), updateVideoController);
router.put('/:id/override-safety', requireRole(['admin']), overrideVideoSafetyController);
router.delete('/:id', requireRole(['editor']), deleteVideoController);
router.put('/:id/reject', requireRole(['admin']), rejectVideoController);

export default router;