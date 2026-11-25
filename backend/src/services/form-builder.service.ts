import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import {
  DynamicValues,
  FormSchemaDefinition,
  dynamicValuesSchema,
  formSchemaDefinitionSchema,
} from '../schemas/form-builder.schema';
import { AppError } from '../utils/app-error';
import { recordAuditEvent } from './audit.service';

const draftId = 'active';

function parseDefinition(value: Prisma.JsonValue): FormSchemaDefinition {
  const result = formSchemaDefinitionSchema.safeParse(value);
  if (!result.success) {
    throw new AppError(500, 'INVALID_FORM_SCHEMA', 'The saved form configuration is invalid.');
  }
  return result.data;
}

export function defaultDynamicValues(definition: FormSchemaDefinition): DynamicValues {
  const values: DynamicValues = {};
  for (const section of definition.sections) {
    for (const field of section.fields) {
      values[field.id] = field.defaultValue
        ?? (field.type === 'CHECKBOX' ? false : field.type === 'MULTI_SELECT' ? [] : '');
    }
  }
  return values;
}

export function normalizeDynamicValues(
  definition: FormSchemaDefinition,
  value: unknown,
): DynamicValues {
  const result = dynamicValuesSchema.safeParse(value ?? {});
  if (!result.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Dynamic field values are invalid.', result.error.issues);
  }

  const fields = definition.sections.flatMap((section) => section.fields);
  const fieldsById = new Map(fields.map((field) => [field.id, field]));
  for (const [fieldId, fieldValue] of Object.entries(result.data)) {
    const field = fieldsById.get(fieldId);
    if (!field) {
      throw new AppError(400, 'VALIDATION_ERROR', 'A dynamic field does not belong to this form version.', [
        { path: fieldId, message: 'Unknown field for this form version.' },
      ]);
    }

    const isArray = Array.isArray(fieldValue);
    const isString = typeof fieldValue === 'string';
    const isBoolean = typeof fieldValue === 'boolean';
    const validType = field.type === 'CHECKBOX'
      ? isBoolean
      : field.type === 'MULTI_SELECT'
        ? isArray
        : isString;
    if (!validType) {
      throw new AppError(400, 'VALIDATION_ERROR', 'A dynamic field value has an invalid type.', [
        { path: fieldId, message: 'Value type does not match the configured field.' },
      ]);
    }
    if (isArray && (
      new Set(fieldValue).size !== fieldValue.length
      || fieldValue.some((option) => !field.options.includes(option))
    )) {
      throw new AppError(400, 'VALIDATION_ERROR', 'A dynamic field contains an invalid option.', [
        { path: fieldId, message: 'Select only configured options.' },
      ]);
    }
    if (isString && ['DROPDOWN', 'RADIO'].includes(field.type) && fieldValue && !field.options.includes(fieldValue)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'A dynamic field contains an invalid option.', [
        { path: fieldId, message: 'Select a configured option.' },
      ]);
    }
  }

  return { ...defaultDynamicValues(definition), ...result.data };
}

export function validateDynamicSubmission(
  definition: FormSchemaDefinition,
  values: DynamicValues,
): Array<{ path: string; message: string }> {
  const errors: Array<{ path: string; message: string }> = [];
  for (const section of definition.sections) {
    for (const field of section.fields) {
      const value = values[field.id];
      const empty = value == null
        || (typeof value === 'string' && !value.trim())
        || (Array.isArray(value) && value.length === 0)
        || (field.type === 'CHECKBOX' && value === false);
      if (field.required && empty) {
        errors.push({ path: field.id, message: `${field.label} is required.` });
        continue;
      }
      if (empty) continue;

      if (field.type === 'NUMBER' && (
        typeof value !== 'string'
        || !/^-?\d+(?:\.\d+)?$/.test(value)
        || !Number.isFinite(Number(value))
      )) {
        errors.push({ path: field.id, message: `${field.label} must be a valid number.` });
      } else if (field.type === 'EMAIL' && (
        typeof value !== 'string'
        || !zodEmail(value)
      )) {
        errors.push({ path: field.id, message: `${field.label} must be a valid email address.` });
      } else if (field.type === 'DATE' && (
        typeof value !== 'string'
        || !/^\d{4}-\d{2}-\d{2}$/.test(value)
        || !validDate(value)
      )) {
        errors.push({ path: field.id, message: `${field.label} must be a valid date.` });
      } else if (field.type === 'SHORT_TEXT' && typeof value === 'string' && value.length > 500) {
        errors.push({ path: field.id, message: `${field.label} must be 500 characters or fewer.` });
      }
    }
  }
  return errors;
}

function zodEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function getLatestFormSchema() {
  const version = await prisma.formSchemaVersion.findFirst({ orderBy: { version: 'desc' } });
  if (!version) {
    throw new AppError(503, 'FORM_SCHEMA_UNAVAILABLE', 'No published contract form configuration is available.');
  }
  return { ...version, definition: parseDefinition(version.definition) };
}

export async function getFormSchemaDraft() {
  const [draft, latest] = await Promise.all([
    prisma.formSchemaDraft.findUnique({ where: { id: draftId } }),
    getLatestFormSchema(),
  ]);
  return {
    draft: draft ? parseDefinition(draft.definition) : latest.definition,
    latest,
  };
}

export async function saveFormSchemaDraft(value: unknown, actorId: string) {
  const definition = formSchemaDefinitionSchema.parse(value);
  return prisma.$transaction(async (tx) => {
    const saved = await tx.formSchemaDraft.upsert({
      where: { id: draftId },
      create: { id: draftId, definition: definition as Prisma.InputJsonValue },
      update: { definition: definition as Prisma.InputJsonValue },
    });
    await recordAuditEvent(tx, {
      actorId,
      action: 'FORM_SCHEMA_DRAFT_SAVED',
      entityType: 'FormSchemaDraft',
      entityId: saved.id,
      details: {
        sectionCount: definition.sections.length,
        fieldCount: definition.sections.reduce((count, section) => count + section.fields.length, 0),
      },
    });
    return saved;
  });
}

export async function publishFormSchema(actorId: string) {
  return prisma.$transaction(async (tx) => {
    const latest = await tx.formSchemaVersion.findFirst({ orderBy: { version: 'desc' } });
    if (!latest) {
      throw new AppError(503, 'FORM_SCHEMA_UNAVAILABLE', 'No published contract form configuration is available.');
    }
    const draft = await tx.formSchemaDraft.findUnique({ where: { id: draftId } });
    const definition = parseDefinition(draft?.definition ?? latest.definition);
    const version = await tx.formSchemaVersion.create({
      data: {
        version: latest.version + 1,
        definition: definition as Prisma.InputJsonValue,
      },
    });
    await tx.formSchemaDraft.upsert({
      where: { id: draftId },
      create: { id: draftId, definition: definition as Prisma.InputJsonValue },
      update: { definition: definition as Prisma.InputJsonValue },
    });
    await recordAuditEvent(tx, {
      actorId,
      action: 'FORM_SCHEMA_PUBLISHED',
      entityType: 'FormSchemaVersion',
      entityId: version.id,
      details: { version: version.version },
    });
    return { ...version, definition };
  });
}
