-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "discountType" TEXT,
ADD COLUMN     "loyaltyDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "loyaltyPointsUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "promotionCode" TEXT,
ADD COLUMN     "promotionDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0;
