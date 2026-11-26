import { z } from 'zod';

export const formFieldTypes = [
  'SHORT_TEXT',
  'LONG_TEXT',
  'NUMBER',
  'EMAIL',
  'DATE',
  'DROPDOWN',
  'MULTI_SELECT',
  'RADIO',
  'CHECKBOX',
] as const;

const fieldDefaultSchema = z.union([
  z.string().max(10000),
  z.boolean(),
  z.array(z.string().max(255)).max(100),
  z.null(),
]);

const formFieldSchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().min(1).max(255),
  type: z.enum(formFieldTypes),
  placeholder: z.string().max(500).nullable(),
  helpText: z.string().max(2000).nullable(),
  required: z.boolean(),
  defaultValue: fieldDefaultSchema,
  options: z.array(z.string().trim().min(1).max(255)).max(100),
  sortOrder: z.number().int().min(0),
}).strict().superRefine((field, ctx) => {
  if (new Set(field.options).size !== field.options.length) {
    ctx.addIssue({ code: 'custom', path: ['options'], message: 'Options must be unique.' });
  }

  const isChoice = ['DROPDOWN', 'MULTI_SELECT', 'RADIO'].includes(field.type);
  if (isChoice && field.options.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['options'], message: 'Add at least one option.' });
  }
  if (!isChoice && field.options.length > 0) {
    ctx.addIssue({ code: 'custom', path: ['options'], message: 'Options are only supported for choice fields.' });
  }

  const defaultValue = field.defaultValue;
  if (field.type === 'CHECKBOX' && defaultValue !== null && typeof defaultValue !== 'boolean') {
    ctx.addIssue({ code: 'custom', path: ['defaultValue'], message: 'Checkbox defaults must be on or off.' });
  } else if (field.type === 'MULTI_SELECT' && defaultValue !== null && (
    !Array.isArray(defaultValue) || defaultValue.some((value) => !field.options.includes(value))
  )) {
    ctx.addIssue({ code: 'custom', path: ['defaultValue'], message: 'Select defaults must match configured options.' });
  } else if (isChoice && field.type !== 'MULTI_SELECT' && defaultValue !== null && (
    typeof defaultValue !== 'string' || !field.options.includes(defaultValue)
  )) {
    ctx.addIssue({ code: 'custom', path: ['defaultValue'], message: 'Default value must match a configured option.' });
  } else if (field.type === 'NUMBER' && typeof defaultValue === 'string' && defaultValue !== '' && !/^-?\d+(?:\.\d+)?$/.test(defaultValue)) {
    ctx.addIssue({ code: 'custom', path: ['defaultValue'], message: 'Enter a valid number default.' });
  } else if (field.type !== 'CHECKBOX' && field.type !== 'MULTI_SELECT' && !isChoice && defaultValue !== null && typeof defaultValue !== 'string') {
    ctx.addIssue({ code: 'custom', path: ['defaultValue'], message: 'This field requires a text default.' });
  } else if (field.type === 'EMAIL' && typeof defaultValue === 'string' && defaultValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(defaultValue)) {
    ctx.addIssue({ code: 'custom', path: ['defaultValue'], message: 'Enter a valid email default.' });
  } else if (field.type === 'DATE' && typeof defaultValue === 'string' && defaultValue && !validDate(defaultValue)) {
    ctx.addIssue({ code: 'custom', path: ['defaultValue'], message: 'Enter a valid date default.' });
  } else if (field.type === 'SHORT_TEXT' && typeof defaultValue === 'string' && defaultValue.length > 500) {
    ctx.addIssue({ code: 'custom', path: ['defaultValue'], message: 'Short text defaults must be 500 characters or fewer.' });
  }
});

const formSectionSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(255),
  description: z.string().max(2000).nullable(),
  sortOrder: z.number().int().min(0),
  fields: z.array(formFieldSchema).max(100),
}).strict();

export const formSchemaDefinitionSchema = z.object({
  sections: z.array(formSectionSchema).max(50),
}).strict().superRefine((definition, ctx) => {
  const ids = new Set<string>();
  definition.sections.forEach((section, sectionIndex) => {
    if (ids.has(section.id)) {
      ctx.addIssue({ code: 'custom', path: ['sections', sectionIndex, 'id'], message: 'Section IDs must be unique.' });
    }
    ids.add(section.id);
    section.fields.forEach((field, fieldIndex) => {
      if (ids.has(field.id)) {
        ctx.addIssue({ code: 'custom', path: ['sections', sectionIndex, 'fields', fieldIndex, 'id'], message: 'Field IDs must be unique.' });
      }
      ids.add(field.id);
    });
  });
});

export const dynamicValuesSchema = z.record(
  z.string().uuid(),
  z.union([z.string().max(10000), z.boolean(), z.array(z.string().max(255)).max(100), z.null()]),
);

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export type FormSchemaDefinition = z.infer<typeof formSchemaDefinitionSchema>;
export type DynamicValues = z.infer<typeof dynamicValuesSchema>;
