-- CreateTable
CREATE TABLE "location_settings" (
    "id" TEXT NOT NULL,
    "businessUnitId" TEXT NOT NULL,
    "defaultLocationId" TEXT,
    "enabledTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false,
    "reserveStockOnAdd" BOOLEAN NOT NULL DEFAULT true,
    "defaultReorderPoint" INTEGER NOT NULL DEFAULT 5,
    "defaultReorderQuantity" INTEGER NOT NULL DEFAULT 10,
    "requireTransferReference" BOOLEAN NOT NULL DEFAULT false,
    "autoReceiveTransfers" BOOLEAN NOT NULL DEFAULT false,
    "allowCrossBusinessUnitTransfers" BOOLEAN NOT NULL DEFAULT false,
    "showCodeOnCards" BOOLEAN NOT NULL DEFAULT true,
    "showInactiveInLists" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "location_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "location_settings_businessUnitId_key" ON "location_settings"("businessUnitId");

-- AddForeignKey
ALTER TABLE "location_settings" ADD CONSTRAINT "location_settings_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
