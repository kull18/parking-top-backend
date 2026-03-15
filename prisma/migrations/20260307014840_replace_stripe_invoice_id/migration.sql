/*
  Warnings:

  - You are about to drop the column `stripeInvoiceId` on the `subscription_invoices` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "subscription_invoices" DROP COLUMN "stripeInvoiceId",
ADD COLUMN     "mpPaymentId" TEXT;
