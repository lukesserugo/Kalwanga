/*
  Warnings:

  - A unique constraint covering the columns `[businessUnitId,slug]` on the table `categories` will be added. If there are existing duplicate values, this will fail.
  - Made the column `slug` on table `categories` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "categories" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "categories_businessUnitId_slug_key" ON "categories"("businessUnitId", "slug");
