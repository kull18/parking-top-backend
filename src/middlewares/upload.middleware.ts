import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { sendError } from '@/utils/response';

const storage = multer.memoryStorage();

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes JPG, PNG o WEBP'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 10
  }
});

export const handleUploadError = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return sendError(res, 'FILE_TOO_LARGE', 'La imagen no puede superar 5MB', 400);
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return sendError(res, 'TOO_MANY_FILES', 'Máximo 10 imágenes permitidas', 400);
    }
  }
  if (err?.message === 'Solo se permiten imágenes JPG, PNG o WEBP') {
    return sendError(res, 'INVALID_FILE_TYPE', err.message, 400);
  }
  next(err);
};