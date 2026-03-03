-- AlterTable
ALTER TABLE "users" ADD COLUMN "email_confirmed_at" TIMESTAMP(3),
ADD COLUMN "registration_path" TEXT;

-- CreateTable
CREATE TABLE "email_confirmation_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_confirmation_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_confirmation_tokens_user_id_key" ON "email_confirmation_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_confirmation_tokens_token_key" ON "email_confirmation_tokens"("token");

-- AddForeignKey
ALTER TABLE "email_confirmation_tokens" ADD CONSTRAINT "email_confirmation_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
