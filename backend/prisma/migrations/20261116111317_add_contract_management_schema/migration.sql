-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'RETURNED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('WAITING', 'PENDING', 'APPROVED', 'RETURNED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovalDecisionValue" AS ENUM ('APPROVED', 'RETURNED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AttachmentCategory" AS ENUM ('SUPPORTING', 'COST_ESTIMATE_EXCEL', 'GENERATED_PDF');

-- CreateEnum
CREATE TYPE "EvaluationType" AS ENUM ('TECHNICAL', 'COMMERCIAL');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "departmentId" TEXT;

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ContractCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "VendorType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Currency" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendorTypeId" TEXT NOT NULL,
    "contactDetails" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractForm" (
    "id" TEXT NOT NULL,
    "referenceNo" TEXT,
    "title" TEXT,
    "sponsorDepartmentId" TEXT,
    "contractCategoryId" TEXT,
    "scope" TEXT,
    "procurementRationale" TEXT,
    "contractAmount" DECIMAL(19,4),
    "currencyId" TEXT,
    "recommendedVendorId" TEXT,
    "selectionRationale" TEXT,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bidder" (
    "id" TEXT NOT NULL,
    "contractFormId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "Bidder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL,
    "bidderId" TEXT NOT NULL,
    "quotedAmount" DECIMAL(19,4) NOT NULL,
    "currencyId" TEXT,
    "quotationDate" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "contractFormId" TEXT NOT NULL,
    "bidderId" TEXT NOT NULL,
    "type" "EvaluationType" NOT NULL,
    "score" DECIMAL(10,4),
    "remarks" TEXT,
    "evaluatedById" TEXT,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostLine" (
    "id" TEXT NOT NULL,
    "contractFormId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(19,4),
    "unitCost" DECIMAL(19,4),
    "amount" DECIMAL(19,4) NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "CostLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "contractFormId" TEXT NOT NULL,
    "category" "AttachmentCategory" NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "driveFileId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalStep" (
    "id" TEXT NOT NULL,
    "contractFormId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "approverId" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'WAITING',
    "actedAt" TIMESTAMP(3),

    CONSTRAINT "ApprovalStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalDecision" (
    "id" TEXT NOT NULL,
    "approvalStepId" TEXT NOT NULL,
    "contractFormId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "decision" "ApprovalDecisionValue" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "contractFormId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "contractFormId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" TEXT,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ContractCategory_name_key" ON "ContractCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "VendorType_name_key" ON "VendorType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Currency_code_key" ON "Currency"("code");

-- CreateIndex
CREATE INDEX "Vendor_vendorTypeId_idx" ON "Vendor"("vendorTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractForm_referenceNo_key" ON "ContractForm"("referenceNo");

-- CreateIndex
CREATE INDEX "ContractForm_status_createdById_idx" ON "ContractForm"("status", "createdById");

-- CreateIndex
CREATE INDEX "ContractForm_sponsorDepartmentId_idx" ON "ContractForm"("sponsorDepartmentId");

-- CreateIndex
CREATE INDEX "ContractForm_contractCategoryId_idx" ON "ContractForm"("contractCategoryId");

-- CreateIndex
CREATE INDEX "ContractForm_createdAt_idx" ON "ContractForm"("createdAt");

-- CreateIndex
CREATE INDEX "Bidder_vendorId_idx" ON "Bidder"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "Bidder_contractFormId_sortOrder_key" ON "Bidder"("contractFormId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Bidder_id_contractFormId_key" ON "Bidder"("id", "contractFormId");

-- CreateIndex
CREATE INDEX "Quotation_bidderId_idx" ON "Quotation"("bidderId");

-- CreateIndex
CREATE INDEX "Quotation_currencyId_idx" ON "Quotation"("currencyId");

-- CreateIndex
CREATE INDEX "Evaluation_contractFormId_idx" ON "Evaluation"("contractFormId");

-- CreateIndex
CREATE INDEX "Evaluation_bidderId_idx" ON "Evaluation"("bidderId");

-- CreateIndex
CREATE INDEX "Evaluation_evaluatedById_idx" ON "Evaluation"("evaluatedById");

-- CreateIndex
CREATE UNIQUE INDEX "CostLine_contractFormId_sortOrder_key" ON "CostLine"("contractFormId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_driveFileId_key" ON "Attachment"("driveFileId");

-- CreateIndex
CREATE INDEX "Attachment_contractFormId_category_idx" ON "Attachment"("contractFormId", "category");

-- CreateIndex
CREATE INDEX "Attachment_uploadedById_idx" ON "Attachment"("uploadedById");

-- CreateIndex
CREATE INDEX "ApprovalStep_approverId_status_idx" ON "ApprovalStep"("approverId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalStep_contractFormId_level_key" ON "ApprovalStep"("contractFormId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalStep_id_contractFormId_key" ON "ApprovalStep"("id", "contractFormId");

-- CreateIndex
CREATE INDEX "ApprovalDecision_contractFormId_createdAt_idx" ON "ApprovalDecision"("contractFormId", "createdAt");

-- CreateIndex
CREATE INDEX "ApprovalDecision_actorId_idx" ON "ApprovalDecision"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_contractFormId_idx" ON "AuditLog"("contractFormId");

-- CreateIndex
CREATE INDEX "Notification_recipientId_isRead_createdAt_idx" ON "Notification"("recipientId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_contractFormId_idx" ON "Notification"("contractFormId");

-- CreateIndex
CREATE INDEX "User_departmentId_idx" ON "User"("departmentId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_vendorTypeId_fkey" FOREIGN KEY ("vendorTypeId") REFERENCES "VendorType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractForm" ADD CONSTRAINT "ContractForm_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractForm" ADD CONSTRAINT "ContractForm_sponsorDepartmentId_fkey" FOREIGN KEY ("sponsorDepartmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractForm" ADD CONSTRAINT "ContractForm_contractCategoryId_fkey" FOREIGN KEY ("contractCategoryId") REFERENCES "ContractCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractForm" ADD CONSTRAINT "ContractForm_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractForm" ADD CONSTRAINT "ContractForm_recommendedVendorId_fkey" FOREIGN KEY ("recommendedVendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bidder" ADD CONSTRAINT "Bidder_contractFormId_fkey" FOREIGN KEY ("contractFormId") REFERENCES "ContractForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bidder" ADD CONSTRAINT "Bidder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_bidderId_fkey" FOREIGN KEY ("bidderId") REFERENCES "Bidder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_contractFormId_fkey" FOREIGN KEY ("contractFormId") REFERENCES "ContractForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_bidderId_contractFormId_fkey" FOREIGN KEY ("bidderId", "contractFormId") REFERENCES "Bidder"("id", "contractFormId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_evaluatedById_fkey" FOREIGN KEY ("evaluatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostLine" ADD CONSTRAINT "CostLine_contractFormId_fkey" FOREIGN KEY ("contractFormId") REFERENCES "ContractForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_contractFormId_fkey" FOREIGN KEY ("contractFormId") REFERENCES "ContractForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_contractFormId_fkey" FOREIGN KEY ("contractFormId") REFERENCES "ContractForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_approvalStepId_contractFormId_fkey" FOREIGN KEY ("approvalStepId", "contractFormId") REFERENCES "ApprovalStep"("id", "contractFormId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_contractFormId_fkey" FOREIGN KEY ("contractFormId") REFERENCES "ContractForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_contractFormId_fkey" FOREIGN KEY ("contractFormId") REFERENCES "ContractForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_contractFormId_fkey" FOREIGN KEY ("contractFormId") REFERENCES "ContractForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
