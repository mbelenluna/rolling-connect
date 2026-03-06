-- AlterTable
ALTER TABLE "organizations" ADD COLUMN "phone_client_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "organizations_phone_client_id_key" ON "organizations"("phone_client_id");
