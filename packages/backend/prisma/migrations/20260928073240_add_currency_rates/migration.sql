-- CreateTable
CREATE TABLE "currency_rates" (
    "id" TEXT NOT NULL,
    "businessUnitId" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currency_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "currency_rates_businessUnitId_idx" ON "currency_rates"("businessUnitId");

-- CreateIndex
CREATE INDEX "currency_rates_currencyCode_idx" ON "currency_rates"("currencyCode");

-- CreateIndex
CREATE UNIQUE INDEX "currency_rates_businessUnitId_currencyCode_key" ON "currency_rates"("businessUnitId", "currencyCode");

-- AddForeignKey
ALTER TABLE "currency_rates" ADD CONSTRAINT "currency_rates_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
