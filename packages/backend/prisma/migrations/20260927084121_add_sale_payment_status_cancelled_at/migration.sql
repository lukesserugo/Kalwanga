-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'UNPAID';

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID';
