-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentMethod" ADD VALUE 'PAYPAL';
ALTER TYPE "PaymentMethod" ADD VALUE 'FLUTTERWAVE';
ALTER TYPE "PaymentMethod" ADD VALUE 'PAYSTACK';
ALTER TYPE "PaymentMethod" ADD VALUE 'SQUARE';
ALTER TYPE "PaymentMethod" ADD VALUE 'MTN';
ALTER TYPE "PaymentMethod" ADD VALUE 'AIRTEL';
