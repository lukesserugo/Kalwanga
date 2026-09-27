-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "vpaymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'MEDIUM';
