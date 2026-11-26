"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  DynamicValue,
  DynamicValues,
  FormSchemaDefinition,
  FormSchemaField,
} from "@/types/contracts";

export function defaultDynamicValues(definition: FormSchemaDefinition): DynamicValues {
  return Object.fromEntries(
    definition.sections.flatMap((section) =>
      section.fields.map((field) => [
        field.id,
        field.defaultValue ?? (field.type === "CHECKBOX" ? false : field.type === "MULTI_SELECT" ? [] : ""),
      ]),
    ),
  );
}

export function validateDynamicValues(
  definition: FormSchemaDefinition | undefined,
  values: DynamicValues,
): Record<string, string> {
  if (!definition) return {};
  const errors: Record<string, string> = {};
  for (const section of definition.sections) {
    for (const field of section.fields) {
      const value = values[field.id];
      const empty = value == null
        || (typeof value === "string" && !value.trim())
        || (Array.isArray(value) && value.length === 0)
        || (field.type === "CHECKBOX" && value === false);
      if (field.required && empty) {
        errors[field.id] = `${field.label} is required.`;
      } else if (!empty && field.type === "EMAIL" && (
        typeof value !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      )) {
        errors[field.id] = `${field.label} must be a valid email address.`;
      } else if (!empty && field.type === "NUMBER" && (
        typeof value !== "string" || !/^-?\d+(?:\.\d+)?$/.test(value)
      )) {
        errors[field.id] = `${field.label} must be a valid number.`;
      } else if (!empty && field.type === "DATE" && (
        typeof value !== "string"
        || !/^\d{4}-\d{2}-\d{2}$/.test(value)
        || Number.isNaN(Date.parse(`${value}T00:00:00Z`))
        || new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value
      )) {
        errors[field.id] = `${field.label} must be a valid date.`;
      } else if (!empty && field.type === "SHORT_TEXT" && typeof value === "string" && value.length > 500) {
        errors[field.id] = `${field.label} must be 500 characters or fewer.`;
      }
    }
  }
  return errors;
}

function formattedValue(field: FormSchemaField, value: DynamicValue): string {
  if (field.type === "CHECKBOX") return value === true ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  return typeof value === "string" && value.trim() ? value : "—";
}

export function DynamicFormSections({
  definition,
  values,
  onChange,
  errors = {},
  readOnly = false,
}: {
  definition: FormSchemaDefinition | undefined;
  values: DynamicValues;
  onChange?: (fieldId: string, value: DynamicValue) => void;
  errors?: Record<string, string>;
  readOnly?: boolean;
}) {
  if (!definition?.sections.length) return null;

  return (
    <>
      {definition.sections.map((section) => (
        <Card key={section.id}>
          <CardHeader>
            <CardTitle>{section.title}</CardTitle>
            {section.description && <p className="text-sm text-muted-foreground">{section.description}</p>}
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {section.fields.map((field) => {
              const value = values[field.id] ?? (field.type === "CHECKBOX" ? false : field.type === "MULTI_SELECT" ? [] : "");
              const error = errors[field.id];
              const id = `dynamic-${field.id}`;
              const help = field.helpText && <p className="text-sm text-muted-foreground">{field.helpText}</p>;
              if (readOnly) {
                return (
                  <div key={field.id} className={field.type === "LONG_TEXT" ? "md:col-span-2" : ""}>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{field.label}</p>
                    <p className="mt-1 whitespace-pre-wrap break-words">{formattedValue(field, value)}</p>
                  </div>
                );
              }

              return (
                <div key={field.id} className={`space-y-2 ${field.type === "LONG_TEXT" ? "md:col-span-2" : ""}`}>
                  <Label htmlFor={id}>{field.label}{field.required ? " *" : ""}</Label>
                  {field.type === "LONG_TEXT" ? (
                    <Textarea
                      id={id}
                      placeholder={field.placeholder ?? ""}
                      value={typeof value === "string" ? value : ""}
                      maxLength={10000}
                      onChange={(event) => onChange?.(field.id, event.target.value)}
                      aria-invalid={Boolean(error)}
                    />
                  ) : field.type === "DROPDOWN" ? (
                    <select
                      id={id}
                      className="h-9 w-full rounded-lg border bg-background px-2 text-sm"
                      value={typeof value === "string" ? value : ""}
                      onChange={(event) => onChange?.(field.id, event.target.value)}
                      aria-invalid={Boolean(error)}
                    >
                      <option value="">{field.placeholder || "Select an option"}</option>
                      {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  ) : field.type === "MULTI_SELECT" ? (
                    <select
                      id={id}
                      className="min-h-24 w-full rounded-lg border bg-background px-2 py-1 text-sm"
                      value={Array.isArray(value) ? value : []}
                      onChange={(event) => onChange?.(field.id, Array.from(event.currentTarget.selectedOptions, (option) => option.value))}
                      multiple
                      aria-invalid={Boolean(error)}
                    >
                      {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  ) : field.type === "RADIO" ? (
                    <div className="space-y-2" role="radiogroup" aria-labelledby={`${id}-label`}>
                      <span id={`${id}-label`} className="sr-only">{field.label}</span>
                      {field.options.map((option) => (
                        <Label key={option} className="flex items-center gap-2 font-normal">
                          <input
                            type="radio"
                            name={id}
                            value={option}
                            checked={value === option}
                            onChange={() => onChange?.(field.id, option)}
                          />
                          {option}
                        </Label>
                      ))}
                    </div>
                  ) : field.type === "CHECKBOX" ? (
                    <Label className="flex items-center gap-2 font-normal">
                      <input
                        id={id}
                        type="checkbox"
                        checked={value === true}
                        onChange={(event) => onChange?.(field.id, event.target.checked)}
                      />
                      {field.placeholder || field.label}
                    </Label>
                  ) : (
                    <Input
                      id={id}
                      type={field.type === "NUMBER" ? "number" : field.type === "EMAIL" ? "email" : field.type === "DATE" ? "date" : "text"}
                      step={field.type === "NUMBER" ? "any" : undefined}
                      placeholder={field.placeholder ?? ""}
                      value={typeof value === "string" ? value : ""}
                      maxLength={field.type === "SHORT_TEXT" ? 500 : undefined}
                      onChange={(event) => onChange?.(field.id, event.target.value)}
                      aria-invalid={Boolean(error)}
                    />
                  )}
                  {help}
                  {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </>
  );
}
