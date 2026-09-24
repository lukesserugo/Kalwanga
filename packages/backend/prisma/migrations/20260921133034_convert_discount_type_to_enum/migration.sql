/*
  Warnings:

  - The `discountType` column on the `sales` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED', 'LOYALTY', 'MANUAL');

-- AlterTable
ALTER TABLE "sales" DROP COLUMN "discountType",
ADD COLUMN     "discountType" "DiscountType";
