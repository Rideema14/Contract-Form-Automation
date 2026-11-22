"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type CompanyDetails = {
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  qualifications: string;
};

export const emptyCompanyDetails: CompanyDetails = {
  companyName: "",
  contactPerson: "",
  email: "",
  phone: "",
  qualifications: "",
};

export function companyContactFields(value: unknown): Omit<CompanyDetails, "companyName"> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { contactPerson: "", email: "", phone: "", qualifications: "" };
  }

  const details = Object.fromEntries(Object.entries(value));
  const read = (key: string) => typeof details[key] === "string" ? details[key] : "";
  return {
    contactPerson: read("contactPerson"),
    email: read("email"),
    phone: read("phone"),
    qualifications: read("qualifications"),
  };
}

type Props = {
  value: CompanyDetails;
  onChange: (value: CompanyDetails) => void;
  idPrefix: string;
  className?: string;
};

export function CompanyDetailsFields({ value, onChange, idPrefix, className }: Props) {
  function update<K extends keyof CompanyDetails>(key: K, fieldValue: CompanyDetails[K]) {
    onChange({ ...value, [key]: fieldValue });
  }

  return (
    <div className={className ?? "grid gap-3 md:grid-cols-2"}>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-company-name`}>Company Name</Label>
        <Input
          id={`${idPrefix}-company-name`}
          value={value.companyName}
          onChange={(event) => update("companyName", event.target.value)}
          required
          maxLength={255}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-contact-person`}>Contact Person</Label>
        <Input
          id={`${idPrefix}-contact-person`}
          value={value.contactPerson}
          onChange={(event) => update("contactPerson", event.target.value)}
          maxLength={255}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-email`}>Email</Label>
        <Input
          id={`${idPrefix}-email`}
          type="email"
          value={value.email}
          onChange={(event) => update("email", event.target.value)}
          maxLength={254}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-phone`}>Phone</Label>
        <Input
          id={`${idPrefix}-phone`}
          type="tel"
          inputMode="tel"
          pattern="\\+?[0-9\\s().-]{7,25}"
          title="Enter a phone number with 7 to 15 digits."
          value={value.phone}
          onChange={(event) => update("phone", event.target.value)}
          maxLength={25}
        />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor={`${idPrefix}-qualifications`}>Qualification / Experience</Label>
        <Textarea
          id={`${idPrefix}-qualifications`}
          value={value.qualifications}
          onChange={(event) => update("qualifications", event.target.value)}
          maxLength={10000}
        />
      </div>
    </div>
  );
}
