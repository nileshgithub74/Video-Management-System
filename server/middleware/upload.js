import multer from 'multer';
import path from 'path';
import fs from 'fs';

const createUploadDir = () => {
  const uploadDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('Created uploads directory:', uploadDir);
  }
  return uploadDir;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = createUploadDir();
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname);
    console.log('Saving file as:', filename);
    cb(null, filename);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = process.env.ALLOWED_VIDEO_TYPES?.split(',') || ['video/mp4'];
  
  console.log('File upload attempt:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  });
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Only video files are allowed.`), false);
  }
};

export const uploadVideo = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 100000000 // 100MB
  },
  fileFilter: fileFilter
}).single('video');