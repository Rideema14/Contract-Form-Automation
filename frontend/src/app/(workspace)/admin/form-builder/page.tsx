"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { apiErrorMessage } from "@/lib/api-client";
import { getFormSchemaDraft, publishFormSchema, saveFormSchemaDraft } from "@/services/contracts";
import type { FormFieldType, FormSchemaDefinition, FormSchemaField, FormSchemaSection, FormSchemaVersion } from "@/types/contracts";

const fieldTypes: { value: FormFieldType; label: string }[] = [
  { value: "SHORT_TEXT", label: "Short Text" },
  { value: "LONG_TEXT", label: "Long Text" },
  { value: "NUMBER", label: "Number" },
  { value: "EMAIL", label: "Email" },
  { value: "DATE", label: "Date" },
  { value: "DROPDOWN", label: "Dropdown" },
  { value: "MULTI_SELECT", label: "Multi-select" },
  { value: "RADIO", label: "Radio" },
  { value: "CHECKBOX", label: "Checkbox" },
];

const choiceTypes: FormFieldType[] = ["DROPDOWN", "MULTI_SELECT", "RADIO"];

function isChoiceType(type: FormFieldType) {
  return choiceTypes.includes(type);
}

function newField(sortOrder: number): FormSchemaField {
  return {
    id: crypto.randomUUID(),
    label: "New field",
    type: "SHORT_TEXT",
    placeholder: null,
    helpText: null,
    required: false,
    defaultValue: "",
    options: [],
    sortOrder,
  };
}

function normalizeOrder(sections: FormSchemaSection[]): FormSchemaSection[] {
  return sections.map((section, sortOrder) => ({
    ...section,
    sortOrder,
    fields: section.fields.map((field, fieldSortOrder) => ({ ...field, sortOrder: fieldSortOrder })),
  }));
}

export default function AdminFormBuilderPage() {
  const router = useRouter();
  const { authUser, loading: authLoading } = useAuth();
  const [definition, setDefinition] = useState<FormSchemaDefinition>({ sections: [] });
  const [latest, setLatest] = useState<FormSchemaVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const result = await getFormSchemaDraft();
      setDefinition(result.draft);
      setLatest(result.latest);
    } catch (error) {
      setLoadError(apiErrorMessage(error, "Unable to load the form configuration."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && authUser?.role !== "ADMIN") router.replace("/dashboard");
  }, [authLoading, authUser, router]);

  useEffect(() => {
    if (authUser?.role === "ADMIN") {
      const timeoutId = window.setTimeout(() => void load(), 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [authUser, load]);

  function setSections(update: (sections: FormSchemaSection[]) => FormSchemaSection[]) {
    setDefinition((current) => ({ sections: normalizeOrder(update(current.sections)) }));
  }

  function addSection() {
    setSections((sections) => [...sections, {
      id: crypto.randomUUID(),
      title: "New section",
      description: null,
      sortOrder: sections.length,
      fields: [],
    }]);
  }

  function updateSection(sectionId: string, patch: Partial<FormSchemaSection>) {
    setSections((sections) => sections.map((section) => section.id === sectionId ? { ...section, ...patch } : section));
  }

  function moveSection(index: number, offset: number) {
    setSections((sections) => {
      const target = index + offset;
      if (target < 0 || target >= sections.length) return sections;
      const next = [...sections];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function moveField(sectionId: string, index: number, offset: number) {
    setSections((sections) => sections.map((section) => {
      if (section.id !== sectionId) return section;
      const target = index + offset;
      if (target < 0 || target >= section.fields.length) return section;
      const fields = [...section.fields];
      [fields[index], fields[target]] = [fields[target], fields[index]];
      return { ...section, fields };
    }));
  }

  function updateField(sectionId: string, fieldId: string, patch: Partial<FormSchemaField>) {
    setSections((sections) => sections.map((section) => section.id === sectionId
      ? { ...section, fields: section.fields.map((field) => field.id === fieldId ? { ...field, ...patch } : field) }
      : section));
  }

  async function saveDraft() {
    setSaving(true);
    try {
      await saveFormSchemaDraft(definition);
      toast.success("Form builder draft saved.");
    } catch (error) {
      toast.error(apiErrorMessage(error, "Unable to save the form builder draft."));
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    setSaving(true);
    try {
      await saveFormSchemaDraft(definition);
      const published = await publishFormSchema();
      setLatest(published);
      setDefinition(published.definition);
      toast.success(`Form version ${published.version} published.`);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Unable to publish the form configuration."));
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || authUser?.role !== "ADMIN") {
    return <main className="p-8"><p className="text-muted-foreground">Checking access...</p></main>;
  }

  return (
    <main className="min-h-screen bg-muted/30 p-4 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Contract Form Builder</h1>
            <p className="mt-1 text-muted-foreground">Add custom sections without changing the existing contract form sections.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {latest ? `Latest published version: ${latest.version}` : "No published version is available."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => void saveDraft()} disabled={loading || saving || Boolean(loadError)}>Save draft</Button>
            <Button type="button" onClick={() => void publish()} disabled={loading || saving || Boolean(loadError)}><Send />Publish version</Button>
          </div>
        </header>

        {loading ? <p className="text-muted-foreground">Loading form configuration...</p> : loadError ? (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">
            <p className="text-destructive">{loadError}</p>
            <Button type="button" variant="outline" onClick={() => void load()}>Retry</Button>
          </div>
        ) : (
          <>
            {definition.sections.map((section, sectionIndex) => (
              <Card key={section.id}>
                <CardHeader className="flex-row items-start justify-between gap-3">
                  <CardTitle className="pt-2">Section {sectionIndex + 1}</CardTitle>
                  <div className="flex gap-1">
                    <Button type="button" size="icon" variant="outline" aria-label="Move section up" disabled={sectionIndex === 0} onClick={() => moveSection(sectionIndex, -1)}><ArrowUp /></Button>
                    <Button type="button" size="icon" variant="outline" aria-label="Move section down" disabled={sectionIndex === definition.sections.length - 1} onClick={() => moveSection(sectionIndex, 1)}><ArrowDown /></Button>
                    <Button type="button" size="icon" variant="ghost" aria-label="Delete section" onClick={() => setSections((sections) => sections.filter((item) => item.id !== section.id))}><Trash2 className="text-destructive" /></Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2"><Label htmlFor={`section-title-${section.id}`}>Section title</Label><Input id={`section-title-${section.id}`} value={section.title} onChange={(event) => updateSection(section.id, { title: event.target.value })} /></div>
                    <div className="space-y-2"><Label htmlFor={`section-description-${section.id}`}>Description</Label><Input id={`section-description-${section.id}`} value={section.description ?? ""} onChange={(event) => updateSection(section.id, { description: event.target.value || null })} /></div>
                  </div>

                  {section.fields.map((field, fieldIndex) => (
                    <div key={field.id} className="space-y-4 rounded-lg border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-medium">Field {fieldIndex + 1}</h3>
                        <div className="flex gap-1">
                          <Button type="button" size="icon" variant="outline" aria-label="Move field up" disabled={fieldIndex === 0} onClick={() => moveField(section.id, fieldIndex, -1)}><ArrowUp /></Button>
                          <Button type="button" size="icon" variant="outline" aria-label="Move field down" disabled={fieldIndex === section.fields.length - 1} onClick={() => moveField(section.id, fieldIndex, 1)}><ArrowDown /></Button>
                          <Button type="button" size="icon" variant="ghost" aria-label="Delete field" onClick={() => updateSection(section.id, { fields: section.fields.filter((item) => item.id !== field.id) })}><Trash2 className="text-destructive" /></Button>
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2"><Label htmlFor={`field-label-${field.id}`}>Label</Label><Input id={`field-label-${field.id}`} value={field.label} onChange={(event) => updateField(section.id, field.id, { label: event.target.value })} /></div>
                        <div className="space-y-2">
                          <Label htmlFor={`field-type-${field.id}`}>Field type</Label>
                          <select
                            id={`field-type-${field.id}`}
                            className="h-9 w-full rounded-lg border bg-background px-2 text-sm"
                            value={field.type}
                            onChange={(event) => {
                              const type = event.target.value as FormFieldType;
                              updateField(section.id, field.id, {
                                type,
                                options: isChoiceType(type) ? field.options : [],
                                defaultValue: type === "CHECKBOX" ? false : type === "MULTI_SELECT" ? [] : isChoiceType(type) ? null : "",
                              });
                            }}
                          >
                            {fieldTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2"><Label htmlFor={`field-placeholder-${field.id}`}>Placeholder</Label><Input id={`field-placeholder-${field.id}`} value={field.placeholder ?? ""} onChange={(event) => updateField(section.id, field.id, { placeholder: event.target.value || null })} /></div>
                        <div className="space-y-2"><Label htmlFor={`field-help-${field.id}`}>Help text</Label><Input id={`field-help-${field.id}`} value={field.helpText ?? ""} onChange={(event) => updateField(section.id, field.id, { helpText: event.target.value || null })} /></div>
                        <div className="space-y-2">
                          <Label htmlFor={`field-default-${field.id}`}>Default value</Label>
                          {field.type === "CHECKBOX" ? (
                            <select
                              id={`field-default-${field.id}`}
                              className="h-9 w-full rounded-lg border bg-background px-2 text-sm"
                              value={field.defaultValue === true ? "true" : "false"}
                              onChange={(event) => updateField(section.id, field.id, { defaultValue: event.target.value === "true" })}
                            >
                              <option value="false">Unchecked</option><option value="true">Checked</option>
                            </select>
                          ) : field.type === "MULTI_SELECT" ? (
                            <select
                              id={`field-default-${field.id}`}
                              className="min-h-20 w-full rounded-lg border bg-background px-2 py-1 text-sm"
                              value={Array.isArray(field.defaultValue) ? field.defaultValue : []}
                              onChange={(event) => updateField(section.id, field.id, {
                                defaultValue: Array.from(event.currentTarget.selectedOptions, (option) => option.value),
                              })}
                              multiple
                            >
                              {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                            </select>
                          ) : isChoiceType(field.type) ? (
                            <select
                              id={`field-default-${field.id}`}
                              className="h-9 w-full rounded-lg border bg-background px-2 text-sm"
                              value={typeof field.defaultValue === "string" ? field.defaultValue : ""}
                              onChange={(event) => updateField(section.id, field.id, { defaultValue: event.target.value || null })}
                            >
                              <option value="">No default</option>
                              {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                            </select>
                          ) : (
                            <Input
                              id={`field-default-${field.id}`}
                              type={field.type === "NUMBER" ? "number" : field.type === "DATE" ? "date" : "text"}
                              value={typeof field.defaultValue === "string" ? field.defaultValue : ""}
                              onChange={(event) => updateField(section.id, field.id, { defaultValue: event.target.value })}
                            />
                          )}
                        </div>
                        <label className="flex items-center gap-2 self-end pb-2 text-sm">
                          <input type="checkbox" checked={field.required} onChange={(event) => updateField(section.id, field.id, { required: event.target.checked })} />
                          Required
                        </label>
                      </div>

                      {isChoiceType(field.type) && (
                        <div className="space-y-2">
                          <Label>Options</Label>
                          {field.options.map((option, optionIndex) => (
                            <div key={`${field.id}-option-${optionIndex}`} className="flex gap-2">
                              <Input
                                aria-label={`Option ${optionIndex + 1}`}
                                value={option}
                                onChange={(event) => {
                                  const options = [...field.options];
                                  options[optionIndex] = event.target.value;
                                  updateField(section.id, field.id, { options, defaultValue: null });
                                }}
                              />
                              <Button type="button" size="icon" variant="ghost" aria-label="Remove option" onClick={() => updateField(section.id, field.id, { options: field.options.filter((_, index) => index !== optionIndex), defaultValue: null })}><Trash2 className="text-destructive" /></Button>
                            </div>
                          ))}
                          <Button type="button" size="sm" variant="outline" onClick={() => updateField(section.id, field.id, { options: [...field.options, ""] })}><Plus />Add option</Button>
                        </div>
                      )}
                    </div>
                  ))}

                  <Button type="button" variant="outline" onClick={() => updateSection(section.id, { fields: [...section.fields, newField(section.fields.length)] })}><Plus />Add field</Button>
                </CardContent>
              </Card>
            ))}

            {definition.sections.length === 0 && <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No custom sections yet. The existing contract form sections remain unchanged.</p>}
            <Button type="button" variant="outline" onClick={addSection}><Plus />Add section</Button>
          </>
        )}
      </div>
    </main>
  );
}
