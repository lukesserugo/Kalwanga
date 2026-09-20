/*
  Warnings:

  - You are about to drop the column `images` on the `product_reviews` table. All the data in the column will be lost.
  - You are about to drop the column `images` on the `product_variants` table. All the data in the column will be lost.
  - You are about to drop the column `images` on the `products` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('WAREHOUSE', 'STORE', 'BACKROOM', 'DISTRIBUTION_CENTER', 'STORE_FRONT', 'IN_TRANSIT', 'SUPPLIER', 'OTHER');

-- AlterTable
ALTER TABLE "inventories" ADD COLUMN     "locationId" TEXT;

-- AlterTable
ALTER TABLE "product_reviews" DROP COLUMN "images";

-- AlterTable
ALTER TABLE "product_variants" DROP COLUMN "images";

-- AlterTable
ALTER TABLE "products" DROP COLUMN "images";

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "type" "LocationType" NOT NULL DEFAULT 'STORE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "businessUnitId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variant_images" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variant_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_review_images" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_review_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "locations_businessUnitId_idx" ON "locations"("businessUnitId");

-- CreateIndex
CREATE INDEX "locations_isActive_idx" ON "locations"("isActive");

-- CreateIndex
CREATE INDEX "locations_deletedAt_idx" ON "locations"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "locations_businessUnitId_name_key" ON "locations"("businessUnitId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "locations_businessUnitId_code_key" ON "locations"("businessUnitId", "code");

-- CreateIndex
CREATE INDEX "product_images_productId_idx" ON "product_images"("productId");

-- CreateIndex
CREATE INDEX "product_images_order_idx" ON "product_images"("order");

-- CreateIndex
CREATE UNIQUE INDEX "product_images_productId_url_key" ON "product_images"("productId", "url");

-- CreateIndex
CREATE INDEX "product_variant_images_variantId_idx" ON "product_variant_images"("variantId");

-- CreateIndex
CREATE INDEX "product_variant_images_order_idx" ON "product_variant_images"("order");

-- CreateIndex
CREATE UNIQUE INDEX "product_variant_images_variantId_url_key" ON "product_variant_images"("variantId", "url");

-- CreateIndex
CREATE INDEX "product_review_images_reviewId_idx" ON "product_review_images"("reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "product_review_images_reviewId_url_key" ON "product_review_images"("reviewId", "url");

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant_images" ADD CONSTRAINT "product_variant_images_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_review_images" ADD CONSTRAINT "product_review_images_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "product_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventories" ADD CONSTRAINT "inventories_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
