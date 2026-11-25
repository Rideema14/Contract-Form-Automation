ALTER TABLE "Bidder"
ADD COLUMN "vendorTypeId" TEXT;

CREATE INDEX "Bidder_vendorTypeId_idx"
ON "Bidder"("vendorTypeId");

ALTER TABLE "Bidder"
ADD CONSTRAINT "Bidder_vendorTypeId_fkey"
FOREIGN KEY ("vendorTypeId") REFERENCES "VendorType"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
