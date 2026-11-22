import { afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from './lib/prisma';
import {
  dynamicValuesSchema,
  formSchemaDefinitionSchema,
} from './schemas/form-builder.schema';
import {
  normalizeDynamicValues,
  publishFormSchema,
  validateDynamicSubmission,
} from './services/form-builder.service';

const sectionId = '550e8400-e29b-41d4-a716-446655440001';
const textFieldId = '550e8400-e29b-41d4-a716-446655440002';
const emailFieldId = '550e8400-e29b-41d4-a716-446655440003';
const choiceFieldId = '550e8400-e29b-41d4-a716-446655440004';

const definition = {
  sections: [{
    id: sectionId,
    title: 'Supplier details',
    description: null,
    sortOrder: 0,
    fields: [
      {
        id: textFieldId,
        label: 'Contact name',
        type: 'SHORT_TEXT',
        placeholder: null,
        helpText: null,
        required: true,
        defaultValue: 'Default contact',
        options: [],
        sortOrder: 0,
      },
      {
        id: emailFieldId,
        label: 'Email',
        type: 'EMAIL',
        placeholder: null,
        helpText: null,
        required: true,
        defaultValue: null,
        options: [],
        sortOrder: 1,
      },
      {
        id: choiceFieldId,
        label: 'Supplier type',
        type: 'MULTI_SELECT',
        placeholder: null,
        helpText: null,
        required: false,
        defaultValue: ['Local'],
        options: ['Local', 'International'],
        sortOrder: 2,
      },
    ],
  }],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('form builder schemas and dynamic values', () => {
  it('accepts supported field metadata and rejects duplicate IDs or missing choice options', () => {
    expect(formSchemaDefinitionSchema.safeParse(definition).success).toBe(true);
    expect(formSchemaDefinitionSchema.safeParse({
      sections: [{
        ...definition.sections[0],
        fields: [{
          ...definition.sections[0].fields[0],
        }, {
          ...definition.sections[0].fields[1],
          id: textFieldId,
        }],
      }],
    }).success).toBe(false);
    expect(formSchemaDefinitionSchema.safeParse({
      sections: [{
        ...definition.sections[0],
        fields: [{ ...definition.sections[0].fields[2], options: [] }],
      }],
    }).success).toBe(false);
  });

  it('applies defaults, rejects values from other versions, and validates required values on submission', () => {
    const parsedDefinition = formSchemaDefinitionSchema.parse(definition);
    const defaults = normalizeDynamicValues(parsedDefinition, {});
    expect(defaults).toEqual({
      [textFieldId]: 'Default contact',
      [emailFieldId]: '',
      [choiceFieldId]: ['Local'],
    });

    expect(dynamicValuesSchema.safeParse({ [textFieldId]: ['not-text'] }).success).toBe(true);
    expect(() => normalizeDynamicValues(parsedDefinition, { [textFieldId]: ['not-text'] }))
      .toThrow(/invalid type/);
    expect(() => normalizeDynamicValues(parsedDefinition, {
      '550e8400-e29b-41d4-a716-446655440099': 'stale field',
    })).toThrow(/does not belong to this form version/);
    expect(validateDynamicSubmission(parsedDefinition, {
      ...defaults,
      [emailFieldId]: 'invalid',
    })).toEqual([{ path: emailFieldId, message: 'Email must be a valid email address.' }]);
    expect(validateDynamicSubmission(parsedDefinition, {
      ...defaults,
      [textFieldId]: '   ',
      [emailFieldId]: 'person@example.test',
    })).toEqual([{ path: textFieldId, message: 'Contact name is required.' }]);
  });

  it('publishes an immutable next version from the saved draft', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'schema-v8',
      version: 8,
      definition,
      publishedAt: new Date('2026-11-23T00:00:00Z'),
    });
    const upsert = vi.fn().mockResolvedValue({});
    const tx = {
      formSchemaVersion: {
        findFirst: vi.fn().mockResolvedValue({ id: 'schema-v7', version: 7, definition }),
        create,
      },
      formSchemaDraft: {
        findUnique: vi.fn().mockResolvedValue({ id: 'active', definition }),
        upsert,
      },
    };
    vi.spyOn(prisma, '$transaction').mockImplementation(
      async (callback) => callback(tx as never) as never,
    );

    const published = await publishFormSchema();

    expect(published.version).toBe(8);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: { version: 8, definition },
    }));
    expect(upsert).toHaveBeenCalled();
    expect(tx.formSchemaVersion).not.toHaveProperty('update');
    expect(tx.formSchemaVersion).not.toHaveProperty('delete');
  });
});
