CREATE TABLE "FormSchemaVersion" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "definition" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormSchemaVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FormSchemaVersion_version_key"
ON "FormSchemaVersion"("version");

CREATE INDEX "FormSchemaVersion_publishedAt_idx"
ON "FormSchemaVersion"("publishedAt");

CREATE TABLE "FormSchemaDraft" (
    "id" TEXT NOT NULL DEFAULT 'active',
    "definition" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormSchemaDraft_pkey" PRIMARY KEY ("id")
);

INSERT INTO "FormSchemaVersion" ("id", "version", "definition")
VALUES ('legacy-v1', 1, '{"sections": []}'::jsonb);

ALTER TABLE "ContractForm"
ADD COLUMN "formSchemaVersionId" TEXT,
ADD COLUMN "dynamicValues" JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE "ContractForm"
SET "formSchemaVersionId" = 'legacy-v1';

ALTER TABLE "ContractForm"
ALTER COLUMN "formSchemaVersionId" SET NOT NULL;

ALTER TABLE "ContractForm"
ADD CONSTRAINT "ContractForm_formSchemaVersionId_fkey"
FOREIGN KEY ("formSchemaVersionId") REFERENCES "FormSchemaVersion"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ContractForm_formSchemaVersionId_idx"
ON "ContractForm"("formSchemaVersionId");
