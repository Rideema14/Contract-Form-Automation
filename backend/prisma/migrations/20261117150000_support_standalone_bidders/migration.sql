ALTER TABLE "ContractForm" ADD COLUMN "recommendedBidderId" TEXT;

ALTER TABLE "Bidder" ADD COLUMN "companyName" TEXT;
ALTER TABLE "Bidder" ADD COLUMN "contactPerson" TEXT;
ALTER TABLE "Bidder" ADD COLUMN "email" TEXT;
ALTER TABLE "Bidder" ADD COLUMN "phone" TEXT;
ALTER TABLE "Bidder" ADD COLUMN "qualifications" TEXT;
ALTER TABLE "Bidder" ALTER COLUMN "vendorId" DROP NOT NULL;

UPDATE "Bidder" b
SET "companyName" = v."name"
FROM "Vendor" v
WHERE b."vendorId" = v."id";

ALTER TABLE "Bidder" ALTER COLUMN "companyName" SET NOT NULL;

ALTER TABLE "ContractForm"
ADD CONSTRAINT "ContractForm_recommendedBidderId_id_fkey"
FOREIGN KEY ("recommendedBidderId", "id") REFERENCES "Bidder"("id", "contractFormId")
ON DELETE RESTRICT ON UPDATE CASCADE;
