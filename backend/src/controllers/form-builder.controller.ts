import { NextFunction, Request, Response } from 'express';
import { formSchemaDefinitionSchema } from '../schemas/form-builder.schema';
import * as formBuilderService from '../services/form-builder.service';
import { AppError } from '../utils/app-error';
import { sendSuccess } from '../utils/response';

function parse<T>(result: {
  success: boolean;
  data?: T;
  error?: { issues: unknown[] };
}): T {
  if (!result.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', result.error?.issues ?? []);
  }
  return result.data as T;
}

export async function getPublishedFormSchema(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(req, res, 200, 'Published form configuration retrieved', await formBuilderService.getLatestFormSchema());
  } catch (error) {
    next(error);
  }
}

export async function getFormSchemaDraft(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(req, res, 200, 'Form configuration draft retrieved', await formBuilderService.getFormSchemaDraft());
  } catch (error) {
    next(error);
  }
}

export async function saveFormSchemaDraft(req: Request, res: Response, next: NextFunction) {
  try {
    const definition = parse(formSchemaDefinitionSchema.safeParse(req.body));
    sendSuccess(req, res, 200, 'Form configuration draft saved', await formBuilderService.saveFormSchemaDraft(definition));
  } catch (error) {
    next(error);
  }
}

export async function publishFormSchema(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(req, res, 201, 'Form configuration published', await formBuilderService.publishFormSchema());
  } catch (error) {
    next(error);
  }
}
