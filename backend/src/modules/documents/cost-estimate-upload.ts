import multer from 'multer';
import type { RequestHandler } from 'express';
import path from 'node:path';
import { AppError } from '../../utils/app-error';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (path.extname(file.originalname).toLowerCase() !== '.xlsx') {
      callback(new AppError(400, 'INVALID_COST_ESTIMATE', 'Import only supports .xlsx files. Download and use the provided template.'));
      return;
    }
    callback(null, true);
  },
});

export const uploadCostEstimateWorkbook: RequestHandler = (req, res, next) => {
  upload.single('file')(req, res, (error?: unknown) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === 'LIMIT_FILE_SIZE';
      next(new AppError(
        tooLarge ? 413 : 400,
        'COST_ESTIMATE_UPLOAD_FAILED',
        tooLarge
          ? 'The Excel file exceeds the 5 MiB import limit.'
          : 'Upload one Excel file using the "file" field.',
      ));
      return;
    }

    next(error);
  });
};
