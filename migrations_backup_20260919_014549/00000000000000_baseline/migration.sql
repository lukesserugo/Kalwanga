SET search_path TO "public", "pg_catalog";

--
-- PostgreSQL database dump
--

-- Dumped from database version 16.3
-- Dumped by pg_dump version 16.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: AccountCategory; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AccountCategory" AS ENUM (
    'CASH',
    'ACCOUNTS_RECEIVABLE',
    'INVENTORY',
    'SALES_REVENUE',
    'SALES_TAX_PAYABLE',
    'COST_OF_GOODS_SOLD',
    'OPERATING_EXPENSE',
    'OWNER_EQUITY',
    'RETAINED_EARNINGS',
    'ACCOUNTS_PAYABLE',
    'FIXED_ASSETS',
    'DEPRECIATION',
    'PAYROLL',
    'INSURANCE',
    'UTILITIES',
    'RENT'
);


--
-- Name: AccountType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AccountType" AS ENUM (
    'ASSET',
    'LIABILITY',
    'EQUITY',
    'REVENUE',
    'EXPENSE'
);


--
-- Name: AuditAction; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AuditAction" AS ENUM (
    'CREATE',
    'UPDATE',
    'DELETE',
    'VIEW',
    'EXPORT',
    'IMPORT',
    'APPROVE',
    'REJECT',
    'BARCODE_GENERATE',
    'BARCODE_SCAN',
    'BARCODE_ASSOCIATE',
    'QR_CODE_GENERATE',
    'LOGIN',
    'LOGOUT',
    'DOWNLOAD'
);


--
-- Name: AuditSeverity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AuditSeverity" AS ENUM (
    'INFO',
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);


--
-- Name: BusinessUnitType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BusinessUnitType" AS ENUM (
    'HEADQUARTERS',
    'BRANCH',
    'WAREHOUSE',
    'STORE'
);


--
-- Name: CashRegisterStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CashRegisterStatus" AS ENUM (
    'OPEN',
    'CLOSED',
    'PENDING',
    'SUSPENDED'
);


--
-- Name: CashTransactionType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CashTransactionType" AS ENUM (
    'CASH_IN',
    'CASH_OUT',
    'SALE',
    'REFUND',
    'ADJUSTMENT',
    'DEPOSIT',
    'WITHDRAWAL'
);


--
-- Name: Currency; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Currency" AS ENUM (
    'USD',
    'EUR',
    'GBP',
    'NGN',
    'KES',
    'ZAR',
    'GHS',
    'UGX',
    'TZS'
);


--
-- Name: CustomerType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CustomerType" AS ENUM (
    'INDIVIDUAL',
    'BUSINESS',
    'WHOLESALE',
    'RETAIL'
);


--
-- Name: ExportFormat; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ExportFormat" AS ENUM (
    'CSV',
    'EXCEL',
    'JSON',
    'PDF',
    'XML'
);


--
-- Name: ExportStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ExportStatus" AS ENUM (
    'PROCESSING',
    'COMPLETED',
    'FAILED',
    'SCHEDULED'
);


--
-- Name: InventoryIssueStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."InventoryIssueStatus" AS ENUM (
    'ISSUED',
    'RETURNED',
    'OVERDUE',
    'LOST',
    'DAMAGED'
);


--
-- Name: InventoryTransactionType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."InventoryTransactionType" AS ENUM (
    'PURCHASE',
    'SALE',
    'RETURN',
    'ADJUSTMENT',
    'TRANSFER',
    'TRANSFER_IN',
    'TRANSFER_OUT',
    'ISSUE',
    'INITIAL',
    'ADJUSTMENT_IN',
    'ADJUSTMENT_OUT',
    'DAMAGED',
    'LOST',
    'RESTOCK'
);


--
-- Name: InventoryTransferStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."InventoryTransferStatus" AS ENUM (
    'PENDING',
    'IN_TRANSIT',
    'RECEIVED',
    'CANCELLED'
);


--
-- Name: InvoicePaymentTerms; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."InvoicePaymentTerms" AS ENUM (
    'NET_7',
    'NET_15',
    'NET_30',
    'NET_60',
    'DUE_ON_RECEIPT'
);


--
-- Name: InvoiceStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."InvoiceStatus" AS ENUM (
    'DRAFT',
    'SENT',
    'PAID',
    'OVERDUE',
    'CANCELLED',
    'VOID',
    'PARTIALLY_PAID'
);


--
-- Name: JournalEntryStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."JournalEntryStatus" AS ENUM (
    'DRAFT',
    'POSTED',
    'VOID',
    'APPROVED',
    'REJECTED'
);


--
-- Name: LocationType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."LocationType" AS ENUM (
    'WAREHOUSE',
    'STORE',
    'BACKROOM',
    'DISTRIBUTION_CENTER',
    'STORE_FRONT',
    'IN_TRANSIT',
    'SUPPLIER',
    'OTHER'
);


--
-- Name: LoyaltyLevel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."LoyaltyLevel" AS ENUM (
    'BRONZE',
    'SILVER',
    'GOLD',
    'PLATINUM',
    'DIAMOND'
);


--
-- Name: NotificationPriority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."NotificationPriority" AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'URGENT'
);


--
-- Name: NotificationType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."NotificationType" AS ENUM (
    'SALE',
    'INVENTORY',
    'ORDER',
    'PAYMENT',
    'CUSTOMER',
    'SYSTEM',
    'ALERT',
    'SUCCESS',
    'INFO',
    'WARNING',
    'ERROR',
    'PROMOTION',
    'REMINDER'
);


--
-- Name: OrderStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OrderStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'CANCELLED',
    'REFUNDED',
    'ON_HOLD'
);


--
-- Name: PaymentMethod; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PaymentMethod" AS ENUM (
    'CASH',
    'CREDIT_CARD',
    'DEBIT_CARD',
    'MOBILE_MONEY',
    'BANK_TRANSFER',
    'GIFT_CARD',
    'LOYALTY_POINTS',
    'CRYPTO',
    'CHECK'
);


--
-- Name: PaymentProviderEnum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PaymentProviderEnum" AS ENUM (
    'STRIPE',
    'CASH',
    'MOBILE_MONEY',
    'BANK_TRANSFER',
    'GIFT_CARD',
    'LOYALTY_POINTS',
    'PAYPAL',
    'FLUTTERWAVE',
    'PAYSTACK',
    'SQUARE'
);


--
-- Name: PaymentProviderType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PaymentProviderType" AS ENUM (
    'ONLINE',
    'OFFLINE',
    'HYBRID'
);


--
-- Name: PaymentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PaymentStatus" AS ENUM (
    'PENDING',
    'PAID',
    'FAILED',
    'REFUNDED',
    'PARTIAL',
    'PROCESSING',
    'AUTHORIZED',
    'DECLINED'
);


--
-- Name: ProductStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ProductStatus" AS ENUM (
    'DRAFT',
    'ACTIVE',
    'INACTIVE',
    'DISCONTINUED'
);


--
-- Name: ProductType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ProductType" AS ENUM (
    'SIMPLE',
    'VARIABLE',
    'GROUPED',
    'BUNDLE',
    'DIGITAL',
    'SERVICE'
);


--
-- Name: PromotionStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PromotionStatus" AS ENUM (
    'DRAFT',
    'ACTIVE',
    'EXPIRED',
    'PAUSED',
    'ENDED'
);


--
-- Name: PromotionType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PromotionType" AS ENUM (
    'PERCENTAGE',
    'FIXED',
    'BUY_X_GET_Y',
    'FREE_SHIPPING',
    'BOGO',
    'BUNDLE',
    'TIERED'
);


--
-- Name: PurchaseOrderStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PurchaseOrderStatus" AS ENUM (
    'DRAFT',
    'PENDING',
    'APPROVED',
    'ORDERED',
    'PARTIALLY_RECEIVED',
    'RECEIVED',
    'CANCELLED',
    'COMPLETED'
);


--
-- Name: ReceiptStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ReceiptStatus" AS ENUM (
    'ISSUED',
    'SENT',
    'PRINTED',
    'CANCELLED',
    'VOID'
);


--
-- Name: ReceiptType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ReceiptType" AS ENUM (
    'SALE',
    'REFUND',
    'RETURN'
);


--
-- Name: RefundMethod; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RefundMethod" AS ENUM (
    'CASH',
    'CREDIT',
    'STORE_CREDIT',
    'ORIGINAL_PAYMENT',
    'BANK_TRANSFER'
);


--
-- Name: RefundStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RefundStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'COMPLETED',
    'CANCELLED'
);


--
-- Name: ReportDateRange; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ReportDateRange" AS ENUM (
    'TODAY',
    'YESTERDAY',
    'THIS_WEEK',
    'LAST_WEEK',
    'THIS_MONTH',
    'LAST_MONTH',
    'THIS_QUARTER',
    'LAST_QUARTER',
    'THIS_YEAR',
    'CUSTOM'
);


--
-- Name: ReportFormat; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ReportFormat" AS ENUM (
    'PDF',
    'CSV',
    'EXCEL',
    'JSON',
    'HTML'
);


--
-- Name: ReportType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ReportType" AS ENUM (
    'BALANCE_SHEET',
    'INCOME_STATEMENT',
    'CASH_FLOW',
    'TAX_SUMMARY',
    'SALES_REPORT',
    'INVENTORY_REPORT',
    'CUSTOMER_REPORT',
    'PRODUCT_REPORT',
    'EMPLOYEE_REPORT',
    'PAYMENT_REPORT',
    'SUPPLIER_REPORT',
    'PURCHASE_ORDER_REPORT',
    'PROFIT_AND_LOSS',
    'AGING_REPORT',
    'COMPREHENSIVE'
);


--
-- Name: ReturnStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ReturnStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'PROCESSED',
    'CANCELLED'
);


--
-- Name: ReturnType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ReturnType" AS ENUM (
    'FULL',
    'PARTIAL'
);


--
-- Name: ReviewStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ReviewStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'FLAGGED'
);


--
-- Name: SaleStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SaleStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'CANCELLED',
    'REFUNDED',
    'ON_HOLD',
    'VOID',
    'DELETED'
);


--
-- Name: ShiftStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ShiftStatus" AS ENUM (
    'OPEN',
    'CLOSED',
    'VOID',
    'PENDING'
);


--
-- Name: ShiftType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ShiftType" AS ENUM (
    'MORNING',
    'AFTERNOON',
    'NIGHT',
    'WEEKEND'
);


--
-- Name: SortOrder; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SortOrder" AS ENUM (
    'ASC',
    'DESC'
);


--
-- Name: SupplierStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SupplierStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'PENDING',
    'BLACKLISTED'
);


--
-- Name: TaxFilingStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TaxFilingStatus" AS ENUM (
    'PENDING',
    'FILED',
    'PAID',
    'OVERDUE',
    'AUDITED'
);


--
-- Name: TaxType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TaxType" AS ENUM (
    'INCLUSIVE',
    'EXCLUSIVE',
    'EXEMPT'
);


--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."UserRole" AS ENUM (
    'SUPER_ADMIN',
    'ADMIN',
    'MANAGER',
    'EDITOR',
    'VIEWER',
    'EMPLOYEE',
    'CASHIER',
    'USER'
);


--
-- Name: WishlistStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."WishlistStatus" AS ENUM (
    'ACTIVE',
    'REMOVED'
);


--
-- Name: WishlistVisibility; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."WishlistVisibility" AS ENUM (
    'PUBLIC',
    'PRIVATE'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    type public."AccountType" NOT NULL,
    category public."AccountCategory" NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "businessUnitId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_logs (
    id text NOT NULL,
    "userId" text NOT NULL,
    action text NOT NULL,
    description text NOT NULL,
    "timestamp" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "ipAddress" text,
    "userAgent" text,
    device text,
    location text,
    status text DEFAULT 'success'::text NOT NULL,
    severity text DEFAULT 'info'::text NOT NULL,
    resource text,
    "resourceId" text,
    metadata jsonb
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id text NOT NULL,
    action public."AuditAction" NOT NULL,
    "entityType" text NOT NULL,
    "entityId" text NOT NULL,
    "entityName" text,
    changes jsonb,
    "ipAddress" text,
    "userAgent" text,
    severity public."AuditSeverity" DEFAULT 'INFO'::public."AuditSeverity" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "userId" text NOT NULL,
    "companyId" text,
    "businessUnitId" text
);


--
-- Name: barcode_image_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.barcode_image_records (
    id text NOT NULL,
    code text NOT NULL,
    barcode text NOT NULL,
    format text NOT NULL,
    data text NOT NULL,
    "imageUrl" text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    scans integer DEFAULT 0 NOT NULL,
    "lastScanned" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "productId" text,
    "variantId" text,
    "businessUnitId" text,
    "createdBy" text
);


--
-- Name: bills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bills (
    id text NOT NULL,
    "billNumber" text NOT NULL,
    "businessUnitId" text NOT NULL,
    "supplierId" text,
    total double precision NOT NULL,
    subtotal double precision DEFAULT 0 NOT NULL,
    tax double precision DEFAULT 0 NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "dueDate" timestamp(3) without time zone,
    "issueDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "paidDate" timestamp(3) without time zone,
    notes text,
    "createdBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: business_unit_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_unit_users (
    id text NOT NULL,
    "userId" text NOT NULL,
    "businessUnitId" text NOT NULL,
    role public."UserRole" DEFAULT 'EMPLOYEE'::public."UserRole" NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: business_units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_units (
    id text NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    address text,
    phone text,
    email text,
    type public."BusinessUnitType" DEFAULT 'STORE'::public."BusinessUnitType" NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    settings jsonb,
    "taxRate" double precision,
    currency text DEFAULT 'USD'::text NOT NULL,
    timezone text DEFAULT 'UTC'::text NOT NULL,
    logo text,
    description text,
    "parentId" text,
    metadata jsonb,
    "deletedAt" timestamp(3) without time zone,
    "deletedBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "companyId" text NOT NULL
);


--
-- Name: cart_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cart_items (
    id text NOT NULL,
    "cartId" text NOT NULL,
    "productId" text NOT NULL,
    "variantId" text,
    quantity integer NOT NULL,
    "unitPrice" double precision NOT NULL,
    total double precision NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: cart_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cart_settings (
    id text NOT NULL,
    "businessUnitId" text NOT NULL,
    "allowGuestCheckout" boolean DEFAULT true NOT NULL,
    "requireCustomerForReturn" boolean DEFAULT false NOT NULL,
    "maxCartItems" integer DEFAULT 50 NOT NULL,
    "cartExpiryHours" integer DEFAULT 24 NOT NULL,
    "discountEnabled" boolean DEFAULT true NOT NULL,
    "maxDiscountPercentage" double precision DEFAULT 20 NOT NULL,
    "maxDiscountAmount" double precision DEFAULT 100 NOT NULL,
    "autoApplyPromotions" boolean DEFAULT true NOT NULL,
    "loyaltyPointsEnabled" boolean DEFAULT true NOT NULL,
    "pointsPerDollar" integer DEFAULT 10 NOT NULL,
    "minPointsForRedeem" integer DEFAULT 100 NOT NULL,
    "maxPointsPerOrder" integer DEFAULT 1000 NOT NULL,
    "reserveStockOnAdd" boolean DEFAULT true NOT NULL,
    "reserveStockMinutes" integer DEFAULT 15 NOT NULL,
    "lowStockThreshold" integer DEFAULT 5 NOT NULL,
    "defaultPaymentMethod" text DEFAULT 'CASH'::text NOT NULL,
    "allowPartialPayment" boolean DEFAULT true NOT NULL,
    "requireSignature" boolean DEFAULT false NOT NULL,
    "taxInclusive" boolean DEFAULT false NOT NULL,
    "freeShippingThreshold" double precision DEFAULT 50 NOT NULL,
    "shippingCost" double precision DEFAULT 5 NOT NULL,
    "taxRate" double precision DEFAULT 8 NOT NULL,
    "notifyOnAbandonedCart" boolean DEFAULT true NOT NULL,
    "abandonedCartHours" integer DEFAULT 24 NOT NULL,
    "notifyOnLowStock" boolean DEFAULT true NOT NULL,
    "currencyCode" text DEFAULT 'USD'::text NOT NULL,
    "currencySymbol" text DEFAULT '$'::text NOT NULL,
    "showStockBadge" boolean DEFAULT true NOT NULL,
    "showVariantImages" boolean DEFAULT true NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: carts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carts (
    id text NOT NULL,
    "userId" text NOT NULL,
    "businessUnitId" text NOT NULL,
    "customerId" text,
    subtotal double precision DEFAULT 0 NOT NULL,
    tax double precision DEFAULT 0 NOT NULL,
    discount double precision DEFAULT 0 NOT NULL,
    total double precision DEFAULT 0 NOT NULL,
    notes text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: cash_register_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_register_sessions (
    id text NOT NULL,
    "openedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "closedAt" timestamp(3) without time zone,
    "startingBalance" double precision NOT NULL,
    "endingBalance" double precision,
    "expectedEndingBalance" double precision,
    discrepancy double precision,
    "discrepancyReason" text,
    notes text,
    status public."ShiftStatus" DEFAULT 'OPEN'::public."ShiftStatus" NOT NULL,
    "cashRegisterId" text NOT NULL,
    "userId" text NOT NULL
);


--
-- Name: cash_registers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_registers (
    id text NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "cashBalance" double precision DEFAULT 0 NOT NULL,
    status public."CashRegisterStatus" DEFAULT 'OPEN'::public."CashRegisterStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "businessUnitId" text NOT NULL
);


--
-- Name: cash_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_transactions (
    id text NOT NULL,
    type public."CashTransactionType" NOT NULL,
    amount double precision NOT NULL,
    reason text NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "cashRegisterId" text NOT NULL,
    "cashRegisterSessionId" text,
    "userId" text NOT NULL
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    "parentId" text,
    "isActive" boolean DEFAULT true NOT NULL,
    featured boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "businessUnitId" text NOT NULL
);


--
-- Name: checkout_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checkout_settings (
    id text NOT NULL,
    "businessUnitId" text NOT NULL,
    "allowGuestCheckout" boolean DEFAULT true NOT NULL,
    "requireCustomerForReturn" boolean DEFAULT false NOT NULL,
    "requireSignature" boolean DEFAULT false NOT NULL,
    "allowPartialPayment" boolean DEFAULT true NOT NULL,
    "maxDiscount" double precision DEFAULT 50 NOT NULL,
    "taxInclusive" boolean DEFAULT false NOT NULL,
    "defaultPaymentMethod" text DEFAULT 'CASH'::text NOT NULL,
    "receiptFooter" text DEFAULT 'Thank you for your business!'::text NOT NULL,
    "loyaltyPointsEnabled" boolean DEFAULT true NOT NULL,
    "pointsPerDollar" integer DEFAULT 10 NOT NULL,
    "maxCartItems" integer DEFAULT 100 NOT NULL,
    "cartExpiryHours" integer DEFAULT 24 NOT NULL,
    "reserveStockOnAdd" boolean DEFAULT true NOT NULL,
    "reserveStockMinutes" integer DEFAULT 15 NOT NULL,
    "lowStockThreshold" integer DEFAULT 5 NOT NULL,
    "discountEnabled" boolean DEFAULT true NOT NULL,
    "maxDiscountPercentage" double precision DEFAULT 20 NOT NULL,
    "autoApplyPromotions" boolean DEFAULT false NOT NULL,
    "freeShippingThreshold" double precision DEFAULT 100 NOT NULL,
    "shippingCost" double precision DEFAULT 0 NOT NULL,
    "taxRate" double precision DEFAULT 8 NOT NULL,
    "notifyOnAbandonedCart" boolean DEFAULT true NOT NULL,
    "abandonedCartHours" integer DEFAULT 2 NOT NULL,
    "currencyCode" text DEFAULT 'USD'::text NOT NULL,
    "currencySymbol" text DEFAULT '$'::text NOT NULL,
    "showStockBadge" boolean DEFAULT true NOT NULL,
    "showVariantImages" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    address text,
    "taxId" text,
    currency text DEFAULT 'USD'::text NOT NULL,
    timezone text DEFAULT 'UTC'::text NOT NULL,
    logo text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: company_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_settings (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "taxRate" double precision DEFAULT 0.0 NOT NULL,
    "taxInclusive" boolean DEFAULT false NOT NULL,
    "receiptFooter" text,
    "receiptHeader" text,
    "lowStockThreshold" integer DEFAULT 10 NOT NULL,
    "autoReorder" boolean DEFAULT false NOT NULL,
    "allowReturns" boolean DEFAULT true NOT NULL,
    "requireCustomerForReturn" boolean DEFAULT false NOT NULL,
    "maxReturnDays" integer DEFAULT 30 NOT NULL,
    "allowCash" boolean DEFAULT true NOT NULL,
    "allowCard" boolean DEFAULT true NOT NULL,
    "allowMobileMoney" boolean DEFAULT true NOT NULL,
    "allowGiftCards" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id text NOT NULL,
    email text NOT NULL,
    "phoneNumber" text NOT NULL,
    "firstName" text NOT NULL,
    "lastName" text NOT NULL,
    address text,
    city text,
    state text,
    "zipCode" text,
    country text,
    notes text,
    "isActive" boolean DEFAULT true NOT NULL,
    "loyaltyPoints" integer DEFAULT 0 NOT NULL,
    "totalSpent" double precision DEFAULT 0 NOT NULL,
    "lastPurchaseAt" timestamp(3) without time zone,
    type public."CustomerType" DEFAULT 'INDIVIDUAL'::public."CustomerType" NOT NULL,
    "loyaltyLevel" public."LoyaltyLevel" DEFAULT 'BRONZE'::public."LoyaltyLevel" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "companyId" text NOT NULL
);


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id text NOT NULL,
    "businessUnitId" text NOT NULL,
    amount double precision NOT NULL,
    category text NOT NULL,
    description text,
    date timestamp(3) without time zone NOT NULL,
    reference text,
    "createdBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: export_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.export_history (
    id text NOT NULL,
    "fileName" text NOT NULL,
    format public."ExportFormat" DEFAULT 'CSV'::public."ExportFormat" NOT NULL,
    size integer NOT NULL,
    status public."ExportStatus" DEFAULT 'PROCESSING'::public."ExportStatus" NOT NULL,
    "downloadUrl" text,
    "errorMessage" text,
    filters jsonb,
    "userId" text NOT NULL,
    "businessUnitId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "downloadedAt" timestamp(3) without time zone,
    "expiresAt" timestamp(3) without time zone
);


--
-- Name: financial_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_reports (
    id text NOT NULL,
    "reportType" public."ReportType" NOT NULL,
    period text NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone NOT NULL,
    data jsonb NOT NULL,
    format public."ReportFormat" DEFAULT 'PDF'::public."ReportFormat" NOT NULL,
    "fileUrl" text,
    "generatedBy" text NOT NULL,
    "businessUnitId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: gift_card_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gift_card_transactions (
    id text NOT NULL,
    amount double precision NOT NULL,
    type text NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "giftCardId" text NOT NULL,
    "saleId" text,
    "userId" text NOT NULL
);


--
-- Name: gift_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gift_cards (
    id text NOT NULL,
    "cardNumber" text NOT NULL,
    pin text,
    balance double precision DEFAULT 0 NOT NULL,
    "initialBalance" double precision NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "expiresAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "customerId" text,
    "companyId" text NOT NULL,
    "businessUnitId" text
);


--
-- Name: import_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.import_history (
    id text NOT NULL,
    "fileName" text NOT NULL,
    "fileSize" integer NOT NULL,
    "totalRows" integer NOT NULL,
    "successCount" integer DEFAULT 0 NOT NULL,
    "failedCount" integer DEFAULT 0 NOT NULL,
    "warningCount" integer DEFAULT 0 NOT NULL,
    "skippedCount" integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "importedBy" text NOT NULL,
    "importedById" text,
    "importDuration" integer DEFAULT 0 NOT NULL,
    "errorSummary" text,
    "importedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: inventories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventories (
    id text NOT NULL,
    "businessUnitId" text NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    reserved integer DEFAULT 0 NOT NULL,
    available integer DEFAULT 0 NOT NULL,
    "reorderPoint" integer DEFAULT 5 NOT NULL,
    "reorderQuantity" integer DEFAULT 10 NOT NULL,
    location text DEFAULT 'Warehouse'::text,
    "shelfNumber" text,
    supplier text,
    notes text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    images text[] DEFAULT ARRAY[]::text[],
    description text,
    weight double precision,
    "taxRate" double precision,
    tags text[] DEFAULT ARRAY[]::text[],
    "locationId" text
);


--
-- Name: inventory_issues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_issues (
    id text NOT NULL,
    "inventoryId" text NOT NULL,
    "productId" text NOT NULL,
    "variantId" text,
    "businessUnitId" text NOT NULL,
    "issuedTo" text NOT NULL,
    quantity integer NOT NULL,
    purpose text,
    remarks text,
    status public."InventoryIssueStatus" DEFAULT 'ISSUED'::public."InventoryIssueStatus" NOT NULL,
    "expectedReturnDate" timestamp(3) without time zone,
    "returnDate" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "userId" text NOT NULL
);


--
-- Name: inventory_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_transactions (
    id text NOT NULL,
    "transactionType" public."InventoryTransactionType" NOT NULL,
    quantity integer NOT NULL,
    notes text,
    reference text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "productId" text NOT NULL,
    "variantId" text,
    "inventoryId" text NOT NULL,
    "businessUnitId" text NOT NULL,
    "userId" text NOT NULL,
    "saleId" text,
    "purchaseOrderId" text
);


--
-- Name: invitation_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invitation_templates (
    id text NOT NULL,
    name text NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    role public."UserRole",
    variables text[] DEFAULT ARRAY[]::text[],
    "isDefault" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invitations (
    id text NOT NULL,
    email text NOT NULL,
    role public."UserRole" NOT NULL,
    "businessUnitId" text,
    message text,
    "expiresIn" integer DEFAULT 7 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "sentAt" timestamp(3) without time zone,
    "expiresAt" timestamp(3) without time zone,
    "acceptedAt" timestamp(3) without time zone,
    "cancelledAt" timestamp(3) without time zone,
    "invitationToken" text NOT NULL,
    "invitedBy" text NOT NULL,
    "invitedById" text,
    "reminderSent" boolean DEFAULT false NOT NULL,
    "reminderSentAt" timestamp(3) without time zone,
    "reminderCount" integer DEFAULT 0 NOT NULL,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id text NOT NULL,
    "invoiceNumber" text NOT NULL,
    total double precision NOT NULL,
    tax double precision DEFAULT 0 NOT NULL,
    subtotal double precision NOT NULL,
    discount double precision DEFAULT 0 NOT NULL,
    "paidAmount" double precision DEFAULT 0 NOT NULL,
    "balanceDue" double precision DEFAULT 0 NOT NULL,
    status public."InvoiceStatus" DEFAULT 'DRAFT'::public."InvoiceStatus" NOT NULL,
    "paymentTerms" public."InvoicePaymentTerms" DEFAULT 'NET_30'::public."InvoicePaymentTerms" NOT NULL,
    "dueDate" timestamp(3) without time zone,
    "sentAt" timestamp(3) without time zone,
    "paidAt" timestamp(3) without time zone,
    "voidAt" timestamp(3) without time zone,
    "cancelledAt" timestamp(3) without time zone,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "saleId" text,
    "companyId" text NOT NULL,
    "customerId" text NOT NULL,
    "userId" text NOT NULL,
    "businessUnitId" text
);


--
-- Name: journal_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_entries (
    id text NOT NULL,
    "entryNumber" text NOT NULL,
    date timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    description text NOT NULL,
    reference text,
    status public."JournalEntryStatus" DEFAULT 'POSTED'::public."JournalEntryStatus" NOT NULL,
    "businessUnitId" text NOT NULL,
    "createdBy" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: journal_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_lines (
    id text NOT NULL,
    "journalEntryId" text NOT NULL,
    "accountId" text NOT NULL,
    debit double precision DEFAULT 0 NOT NULL,
    credit double precision DEFAULT 0 NOT NULL,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: location_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.location_settings (
    id text NOT NULL,
    "businessUnitId" text NOT NULL,
    "defaultLocationId" text,
    "enabledTypes" text[] DEFAULT ARRAY[]::text[],
    "allowNegativeStock" boolean DEFAULT false NOT NULL,
    "reserveStockOnAdd" boolean DEFAULT true NOT NULL,
    "defaultReorderPoint" integer DEFAULT 5 NOT NULL,
    "defaultReorderQuantity" integer DEFAULT 10 NOT NULL,
    "requireTransferReference" boolean DEFAULT false NOT NULL,
    "autoReceiveTransfers" boolean DEFAULT false NOT NULL,
    "allowCrossBusinessUnitTransfers" boolean DEFAULT false NOT NULL,
    "showCodeOnCards" boolean DEFAULT true NOT NULL,
    "showInactiveInLists" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.locations (
    id text NOT NULL,
    name text NOT NULL,
    code text,
    description text,
    address text,
    phone text,
    type public."LocationType" DEFAULT 'STORE'::public."LocationType" NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    metadata jsonb,
    "businessUnitId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "deletedBy" text
);


--
-- Name: loyalty_histories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_histories (
    id text NOT NULL,
    points integer NOT NULL,
    type text NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "customerId" text NOT NULL,
    "saleId" text,
    "rewardId" text,
    "userId" text NOT NULL,
    "businessUnitId" text
);


--
-- Name: loyalty_programs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_programs (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    "pointsPerDollar" integer DEFAULT 1 NOT NULL,
    "minPointsForRedeem" integer DEFAULT 100 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "startDate" timestamp(3) without time zone,
    "endDate" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "companyId" text NOT NULL
);


--
-- Name: loyalty_rewards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_rewards (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    "pointsRequired" integer NOT NULL,
    "discountValue" double precision,
    "freeProductId" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "loyaltyProgramId" text NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type public."NotificationType" NOT NULL,
    priority public."NotificationPriority" DEFAULT 'MEDIUM'::public."NotificationPriority" NOT NULL,
    "isRead" boolean DEFAULT false NOT NULL,
    link text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "readAt" timestamp(3) without time zone,
    data jsonb,
    "userId" text NOT NULL,
    "companyId" text,
    "businessUnitId" text
);


--
-- Name: onboarding_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.onboarding_events (
    id text NOT NULL,
    "userId" text NOT NULL,
    "stepId" integer NOT NULL,
    "stepKey" text NOT NULL,
    event text NOT NULL,
    "previousState" jsonb,
    "newState" jsonb,
    source text DEFAULT 'auto'::text NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: onboarding_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.onboarding_progress (
    id text NOT NULL,
    "userId" text NOT NULL,
    "companyId" text,
    "businessUnitId" text,
    steps jsonb DEFAULT '{}'::jsonb NOT NULL,
    "completedAt" timestamp(3) without time zone,
    "isComplete" boolean DEFAULT false NOT NULL,
    "totalSteps" integer DEFAULT 12 NOT NULL,
    "completedCount" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id text NOT NULL,
    quantity integer NOT NULL,
    "unitPrice" double precision NOT NULL,
    discount double precision DEFAULT 0 NOT NULL,
    total double precision NOT NULL,
    notes text,
    "orderId" text NOT NULL,
    "productId" text NOT NULL,
    "variantId" text
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id text NOT NULL,
    "orderNumber" text NOT NULL,
    status public."OrderStatus" DEFAULT 'PENDING'::public."OrderStatus" NOT NULL,
    subtotal double precision NOT NULL,
    tax double precision DEFAULT 0 NOT NULL,
    discount double precision DEFAULT 0 NOT NULL,
    total double precision NOT NULL,
    notes text,
    "customerId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "businessUnitId" text NOT NULL,
    "userId" text NOT NULL
);


--
-- Name: payment_gateways; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_gateways (
    id text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    credentials jsonb NOT NULL,
    "testMode" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "companyId" text NOT NULL
);


--
-- Name: payment_method_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_method_configs (
    id text NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    description text,
    icon text,
    "isActive" boolean DEFAULT true NOT NULL,
    "providerId" text NOT NULL,
    "businessUnitId" text,
    "requiresRedirect" boolean DEFAULT false NOT NULL,
    "isInstant" boolean DEFAULT true NOT NULL,
    "minAmount" double precision,
    "maxAmount" double precision,
    "feePercentage" double precision,
    "feeFixed" double precision,
    "order" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);


--
-- Name: payment_provider_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_provider_configs (
    id text NOT NULL,
    "providerId" text NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    "isSecret" boolean DEFAULT false NOT NULL,
    description text
);


--
-- Name: payment_provider_currencies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_provider_currencies (
    id text NOT NULL,
    "providerId" text NOT NULL,
    currency text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "conversionRate" double precision
);


--
-- Name: payment_providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_providers (
    id text NOT NULL,
    provider public."PaymentProviderEnum" NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    type public."PaymentProviderType" NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "isHealthy" boolean DEFAULT true NOT NULL,
    configured boolean DEFAULT false NOT NULL,
    config jsonb,
    "businessUnitId" text,
    transactions24h integer DEFAULT 0 NOT NULL,
    volume24h double precision DEFAULT 0 NOT NULL,
    transactions7d integer DEFAULT 0 NOT NULL,
    volume7d double precision DEFAULT 0 NOT NULL,
    transactions30d integer DEFAULT 0 NOT NULL,
    volume30d double precision DEFAULT 0 NOT NULL,
    settings jsonb,
    "order" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id text NOT NULL,
    amount double precision NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    "paymentMethod" public."PaymentMethod" NOT NULL,
    status public."PaymentStatus" DEFAULT 'PENDING'::public."PaymentStatus" NOT NULL,
    "transactionId" text,
    reference text,
    notes text,
    metadata jsonb,
    "processedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "saleId" text,
    "orderId" text,
    "cashRegisterId" text,
    "cashRegisterSessionId" text,
    "userId" text NOT NULL,
    "gatewayId" text,
    "businessUnitId" text,
    "refundedAt" timestamp(3) without time zone,
    "refundReason" text,
    "refundedBy" text,
    "refundedAmount" double precision DEFAULT 0 NOT NULL
);


--
-- Name: processed_webhooks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.processed_webhooks (
    id text NOT NULL,
    "eventId" text NOT NULL,
    "eventType" text NOT NULL,
    provider text DEFAULT 'STRIPE'::text NOT NULL,
    "processedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: product_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_images (
    id text NOT NULL,
    "productId" text NOT NULL,
    url character varying(2048) NOT NULL,
    alt text,
    width integer,
    height integer,
    "order" integer DEFAULT 0 NOT NULL,
    "isPrimary" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: product_promotions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_promotions (
    id text NOT NULL,
    "promotionId" text NOT NULL,
    "productId" text NOT NULL,
    "businessUnitId" text
);


--
-- Name: product_review_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_review_images (
    id text NOT NULL,
    "reviewId" text NOT NULL,
    url character varying(2048) NOT NULL,
    alt text,
    "order" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: product_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_reviews (
    id text NOT NULL,
    "productId" text NOT NULL,
    "userId" text NOT NULL,
    rating integer DEFAULT 5 NOT NULL,
    title text,
    comment text,
    "isVerified" boolean DEFAULT false NOT NULL,
    "helpfulCount" integer DEFAULT 0 NOT NULL,
    status public."ReviewStatus" DEFAULT 'PENDING'::public."ReviewStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "businessUnitId" text
);


--
-- Name: product_variant_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_variant_images (
    id text NOT NULL,
    "variantId" text NOT NULL,
    url character varying(2048) NOT NULL,
    alt text,
    "order" integer DEFAULT 0 NOT NULL,
    "isPrimary" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: product_variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_variants (
    id text NOT NULL,
    "productId" text NOT NULL,
    name text NOT NULL,
    sku text NOT NULL,
    price double precision NOT NULL,
    "costPrice" double precision,
    stock integer DEFAULT 0 NOT NULL,
    attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    barcode text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "deletedBy" text,
    "inventoryId" text
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    sku text NOT NULL,
    barcode text,
    "unitPrice" double precision NOT NULL,
    "costPrice" double precision,
    "taxRate" double precision,
    "minStock" integer DEFAULT 5 NOT NULL,
    "maxStock" integer,
    "isActive" boolean DEFAULT true NOT NULL,
    "isDigital" boolean DEFAULT false NOT NULL,
    featured boolean DEFAULT false NOT NULL,
    weight double precision,
    dimensions jsonb,
    attributes jsonb,
    notes text,
    rating double precision DEFAULT 0,
    "reviewCount" integer DEFAULT 0,
    tags text[] DEFAULT ARRAY[]::text[],
    seo jsonb,
    status public."ProductStatus" DEFAULT 'ACTIVE'::public."ProductStatus" NOT NULL,
    type public."ProductType" DEFAULT 'SIMPLE'::public."ProductType" NOT NULL,
    "taxType" public."TaxType" DEFAULT 'EXCLUSIVE'::public."TaxType" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "deletedBy" text,
    "categoryId" text,
    "businessUnitId" text NOT NULL,
    "supplierId" text,
    "inventoryId" text,
    "createdBy" text,
    "updatedBy" text
);


--
-- Name: promotions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotions (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    type public."PromotionType" NOT NULL,
    value double precision NOT NULL,
    "minPurchase" double precision,
    "maxDiscount" double precision,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "isStackable" boolean DEFAULT false NOT NULL,
    "applicableProducts" jsonb,
    "excludedProducts" jsonb,
    "applicableCategories" jsonb,
    status public."PromotionStatus" DEFAULT 'ACTIVE'::public."PromotionStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "companyId" text NOT NULL
);


--
-- Name: purchase_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_order_items (
    id text NOT NULL,
    quantity integer NOT NULL,
    "unitPrice" double precision NOT NULL,
    total double precision NOT NULL,
    "receivedQuantity" integer DEFAULT 0 NOT NULL,
    notes text,
    "purchaseOrderId" text NOT NULL,
    "productId" text NOT NULL,
    "variantId" text
);


--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_orders (
    id text NOT NULL,
    "orderNumber" text NOT NULL,
    "supplierId" text NOT NULL,
    status public."PurchaseOrderStatus" DEFAULT 'DRAFT'::public."PurchaseOrderStatus" NOT NULL,
    total double precision NOT NULL,
    notes text,
    "expectedDelivery" timestamp(3) without time zone,
    "receivedAt" timestamp(3) without time zone,
    "receivedBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "businessUnitId" text NOT NULL,
    "userId" text NOT NULL
);


--
-- Name: qr_code_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qr_code_records (
    id text NOT NULL,
    code text NOT NULL,
    data text NOT NULL,
    type text NOT NULL,
    "imageUrl" text,
    "isActive" boolean DEFAULT true NOT NULL,
    scans integer DEFAULT 0 NOT NULL,
    "lastScanned" timestamp(3) without time zone,
    "expiresAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "productId" text,
    "variantId" text,
    "businessUnitId" text,
    "createdBy" text,
    "saleId" text,
    "receiptId" text
);


--
-- Name: receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receipts (
    id text NOT NULL,
    "receiptNumber" text NOT NULL,
    content text,
    format text DEFAULT 'PDF'::text NOT NULL,
    type public."ReceiptType" DEFAULT 'SALE'::public."ReceiptType" NOT NULL,
    status public."ReceiptStatus" DEFAULT 'ISSUED'::public."ReceiptStatus" NOT NULL,
    "sentAt" timestamp(3) without time zone,
    "printedAt" timestamp(3) without time zone,
    "printCount" integer DEFAULT 0 NOT NULL,
    "lastPrintedBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "companyId" text NOT NULL,
    "saleId" text,
    "orderId" text,
    "businessUnitId" text
);


--
-- Name: recently_viewed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recently_viewed (
    id text NOT NULL,
    "userId" text NOT NULL,
    "productId" text NOT NULL,
    "viewedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "businessUnitId" text
);


--
-- Name: refund_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refund_items (
    id text NOT NULL,
    "refundId" text NOT NULL,
    "productId" text NOT NULL,
    "variantId" text,
    quantity integer NOT NULL,
    "unitPrice" double precision NOT NULL,
    total double precision NOT NULL,
    reason text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: refunds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refunds (
    id text NOT NULL,
    "refundNumber" text NOT NULL,
    "saleId" text NOT NULL,
    "returnId" text,
    "customerId" text,
    "userId" text NOT NULL,
    "processedBy" text,
    reason text NOT NULL,
    status public."RefundStatus" DEFAULT 'PENDING'::public."RefundStatus" NOT NULL,
    "refundMethod" public."RefundMethod" DEFAULT 'ORIGINAL_PAYMENT'::public."RefundMethod" NOT NULL,
    "refundType" text DEFAULT 'full'::text NOT NULL,
    subtotal double precision NOT NULL,
    tax double precision DEFAULT 0 NOT NULL,
    total double precision NOT NULL,
    notes text,
    "paymentId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "processedAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "companyId" text NOT NULL,
    "businessUnitId" text NOT NULL
);


--
-- Name: reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reports (
    id text NOT NULL,
    name text NOT NULL,
    type public."ReportType" NOT NULL,
    format public."ReportFormat" DEFAULT 'PDF'::public."ReportFormat" NOT NULL,
    data jsonb NOT NULL,
    period text NOT NULL,
    "startDate" timestamp(3) without time zone,
    "endDate" timestamp(3) without time zone,
    "generatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "companyId" text NOT NULL,
    "userId" text NOT NULL
);


--
-- Name: return_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.return_items (
    id text NOT NULL,
    "returnId" text NOT NULL,
    "productId" text NOT NULL,
    "variantId" text,
    quantity integer NOT NULL,
    "unitPrice" double precision NOT NULL,
    total double precision NOT NULL,
    reason text,
    condition text DEFAULT 'good'::text NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: returns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.returns (
    id text NOT NULL,
    "returnNumber" text NOT NULL,
    "saleId" text NOT NULL,
    "customerId" text,
    "userId" text NOT NULL,
    "processedBy" text,
    reason text NOT NULL,
    status public."ReturnStatus" DEFAULT 'PENDING'::public."ReturnStatus" NOT NULL,
    "returnType" public."ReturnType" DEFAULT 'PARTIAL'::public."ReturnType" NOT NULL,
    "refundMethod" public."RefundMethod" DEFAULT 'ORIGINAL_PAYMENT'::public."RefundMethod" NOT NULL,
    subtotal double precision NOT NULL,
    tax double precision DEFAULT 0 NOT NULL,
    total double precision NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "processedAt" timestamp(3) without time zone,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "companyId" text NOT NULL,
    "businessUnitId" text NOT NULL
);


--
-- Name: sale_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sale_items (
    id text NOT NULL,
    quantity integer NOT NULL,
    "unitPrice" double precision NOT NULL,
    discount double precision DEFAULT 0 NOT NULL,
    total double precision NOT NULL,
    notes text,
    "saleId" text NOT NULL,
    "productId" text NOT NULL,
    "variantId" text
);


--
-- Name: sales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales (
    id text NOT NULL,
    "receiptNumber" text NOT NULL,
    subtotal double precision NOT NULL,
    tax double precision DEFAULT 0 NOT NULL,
    discount double precision DEFAULT 0 NOT NULL,
    total double precision NOT NULL,
    "paidAmount" double precision NOT NULL,
    "changeAmount" double precision DEFAULT 0 NOT NULL,
    notes text,
    status public."SaleStatus" DEFAULT 'COMPLETED'::public."SaleStatus" NOT NULL,
    "saleDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "invoiceId" text,
    "businessUnitId" text NOT NULL,
    "userId" text NOT NULL,
    "customerId" text,
    "orderId" text,
    "cashRegisterId" text,
    "cashRegisterSessionId" text
);


--
-- Name: sales_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_settings (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "taxRate" double precision DEFAULT 8 NOT NULL,
    "discountEnabled" boolean DEFAULT true NOT NULL,
    "maxDiscount" double precision DEFAULT 20 NOT NULL,
    "loyaltyPointsEnabled" boolean DEFAULT true NOT NULL,
    "pointsPerDollar" integer DEFAULT 10 NOT NULL,
    "autoPrintReceipt" boolean DEFAULT true NOT NULL,
    "emailReceipts" boolean DEFAULT true NOT NULL,
    "receiptFooter" text DEFAULT 'Thank you for your business!'::text NOT NULL,
    "defaultPaymentMethod" text DEFAULT 'CASH'::text NOT NULL,
    "currencySymbol" text DEFAULT '$'::text NOT NULL,
    "currencyCode" text DEFAULT 'USD'::text NOT NULL,
    "invoicePrefix" text DEFAULT 'INV-'::text NOT NULL,
    "receiptPrefix" text DEFAULT 'RCP-'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: shift_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift_logs (
    id text NOT NULL,
    "shiftStart" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "shiftEnd" timestamp(3) without time zone,
    "startingCash" double precision NOT NULL,
    "endingCash" double precision,
    "expectedCash" double precision,
    discrepancy double precision,
    "discrepancyReason" text,
    notes text,
    "entityName" text,
    status public."ShiftStatus" DEFAULT 'OPEN'::public."ShiftStatus" NOT NULL,
    type public."ShiftType" DEFAULT 'MORNING'::public."ShiftType" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "userId" text NOT NULL,
    "businessUnitId" text NOT NULL,
    "cashRegisterSessionId" text
);


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id text NOT NULL,
    name text NOT NULL,
    "contactPerson" text,
    email text,
    phone text,
    address text,
    "taxId" text,
    notes text,
    "paymentTerms" text,
    "deliveryTerms" text,
    website text,
    rating double precision,
    "creditLimit" double precision,
    status public."SupplierStatus" DEFAULT 'ACTIVE'::public."SupplierStatus" NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "companyId" text NOT NULL
);


--
-- Name: tax_calculations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_calculations (
    id text NOT NULL,
    "businessUnitId" text NOT NULL,
    subtotal double precision NOT NULL,
    "taxRate" double precision NOT NULL,
    "taxAmount" double precision NOT NULL,
    total double precision NOT NULL,
    breakdown jsonb NOT NULL,
    "calculatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: tax_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_records (
    id text NOT NULL,
    "saleId" text NOT NULL,
    "taxType" text NOT NULL,
    "taxRate" double precision NOT NULL,
    "taxAmount" double precision NOT NULL,
    "taxableAmount" double precision NOT NULL,
    "businessUnitId" text NOT NULL,
    period text NOT NULL,
    "filingStatus" public."TaxFilingStatus" DEFAULT 'PENDING'::public."TaxFilingStatus" NOT NULL,
    "filedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: user_group_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_group_members (
    id text NOT NULL,
    "groupId" text NOT NULL,
    "userId" text NOT NULL,
    role public."UserRole" DEFAULT 'USER'::public."UserRole" NOT NULL,
    "isLead" boolean DEFAULT false NOT NULL,
    "joinedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: user_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_groups (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    icon text,
    color text,
    permissions text[] DEFAULT ARRAY[]::text[],
    "isActive" boolean DEFAULT true NOT NULL,
    "createdBy" text NOT NULL,
    "createdById" text,
    "parentGroupId" text,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id text NOT NULL,
    "clerkId" text NOT NULL,
    email text NOT NULL,
    password text,
    "firstName" text NOT NULL,
    "lastName" text NOT NULL,
    "phoneNumber" text,
    avatar text,
    role public."UserRole" DEFAULT 'USER'::public."UserRole" NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "lastLoginAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    permissions text[] DEFAULT ARRAY[]::text[],
    "companyId" text,
    "stripeCustomerId" text,
    "stripePaymentMethodId" text
);


--
-- Name: wishlists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wishlists (
    id text NOT NULL,
    "userId" text NOT NULL,
    "productId" text NOT NULL,
    status public."WishlistStatus" DEFAULT 'ACTIVE'::public."WishlistStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "businessUnitId" text
);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: barcode_image_records barcode_image_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barcode_image_records
    ADD CONSTRAINT barcode_image_records_pkey PRIMARY KEY (id);


--
-- Name: bills bills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT bills_pkey PRIMARY KEY (id);


--
-- Name: business_unit_users business_unit_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_unit_users
    ADD CONSTRAINT business_unit_users_pkey PRIMARY KEY (id);


--
-- Name: business_units business_units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_units
    ADD CONSTRAINT business_units_pkey PRIMARY KEY (id);


--
-- Name: cart_items cart_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_pkey PRIMARY KEY (id);


--
-- Name: cart_settings cart_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_settings
    ADD CONSTRAINT cart_settings_pkey PRIMARY KEY (id);


--
-- Name: carts carts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_pkey PRIMARY KEY (id);


--
-- Name: cash_register_sessions cash_register_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_register_sessions
    ADD CONSTRAINT cash_register_sessions_pkey PRIMARY KEY (id);


--
-- Name: cash_registers cash_registers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_registers
    ADD CONSTRAINT cash_registers_pkey PRIMARY KEY (id);


--
-- Name: cash_transactions cash_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_transactions
    ADD CONSTRAINT cash_transactions_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: checkout_settings checkout_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_settings
    ADD CONSTRAINT checkout_settings_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: company_settings company_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_settings
    ADD CONSTRAINT company_settings_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: export_history export_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.export_history
    ADD CONSTRAINT export_history_pkey PRIMARY KEY (id);


--
-- Name: financial_reports financial_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_reports
    ADD CONSTRAINT financial_reports_pkey PRIMARY KEY (id);


--
-- Name: gift_card_transactions gift_card_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_card_transactions
    ADD CONSTRAINT gift_card_transactions_pkey PRIMARY KEY (id);


--
-- Name: gift_cards gift_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_cards
    ADD CONSTRAINT gift_cards_pkey PRIMARY KEY (id);


--
-- Name: import_history import_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_history
    ADD CONSTRAINT import_history_pkey PRIMARY KEY (id);


--
-- Name: inventories inventories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventories
    ADD CONSTRAINT inventories_pkey PRIMARY KEY (id);


--
-- Name: inventory_issues inventory_issues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_issues
    ADD CONSTRAINT inventory_issues_pkey PRIMARY KEY (id);


--
-- Name: inventory_transactions inventory_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_pkey PRIMARY KEY (id);


--
-- Name: invitation_templates invitation_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitation_templates
    ADD CONSTRAINT invitation_templates_pkey PRIMARY KEY (id);


--
-- Name: invitations invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: journal_entries journal_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_pkey PRIMARY KEY (id);


--
-- Name: journal_lines journal_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_lines
    ADD CONSTRAINT journal_lines_pkey PRIMARY KEY (id);


--
-- Name: location_settings location_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.location_settings
    ADD CONSTRAINT location_settings_pkey PRIMARY KEY (id);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: loyalty_histories loyalty_histories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_histories
    ADD CONSTRAINT loyalty_histories_pkey PRIMARY KEY (id);


--
-- Name: loyalty_programs loyalty_programs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_programs
    ADD CONSTRAINT loyalty_programs_pkey PRIMARY KEY (id);


--
-- Name: loyalty_rewards loyalty_rewards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_rewards
    ADD CONSTRAINT loyalty_rewards_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: onboarding_events onboarding_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_events
    ADD CONSTRAINT onboarding_events_pkey PRIMARY KEY (id);


--
-- Name: onboarding_progress onboarding_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_progress
    ADD CONSTRAINT onboarding_progress_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: payment_gateways payment_gateways_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_gateways
    ADD CONSTRAINT payment_gateways_pkey PRIMARY KEY (id);


--
-- Name: payment_method_configs payment_method_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_method_configs
    ADD CONSTRAINT payment_method_configs_pkey PRIMARY KEY (id);


--
-- Name: payment_provider_configs payment_provider_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_provider_configs
    ADD CONSTRAINT payment_provider_configs_pkey PRIMARY KEY (id);


--
-- Name: payment_provider_currencies payment_provider_currencies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_provider_currencies
    ADD CONSTRAINT payment_provider_currencies_pkey PRIMARY KEY (id);


--
-- Name: payment_providers payment_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_providers
    ADD CONSTRAINT payment_providers_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: processed_webhooks processed_webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processed_webhooks
    ADD CONSTRAINT processed_webhooks_pkey PRIMARY KEY (id);


--
-- Name: product_images product_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_pkey PRIMARY KEY (id);


--
-- Name: product_promotions product_promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_promotions
    ADD CONSTRAINT product_promotions_pkey PRIMARY KEY (id);


--
-- Name: product_review_images product_review_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_review_images
    ADD CONSTRAINT product_review_images_pkey PRIMARY KEY (id);


--
-- Name: product_reviews product_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_pkey PRIMARY KEY (id);


--
-- Name: product_variant_images product_variant_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variant_images
    ADD CONSTRAINT product_variant_images_pkey PRIMARY KEY (id);


--
-- Name: product_variants product_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: promotions promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_items purchase_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: qr_code_records qr_code_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_code_records
    ADD CONSTRAINT qr_code_records_pkey PRIMARY KEY (id);


--
-- Name: receipts receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_pkey PRIMARY KEY (id);


--
-- Name: recently_viewed recently_viewed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recently_viewed
    ADD CONSTRAINT recently_viewed_pkey PRIMARY KEY (id);


--
-- Name: refund_items refund_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_items
    ADD CONSTRAINT refund_items_pkey PRIMARY KEY (id);


--
-- Name: refunds refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_pkey PRIMARY KEY (id);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: return_items return_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_items
    ADD CONSTRAINT return_items_pkey PRIMARY KEY (id);


--
-- Name: returns returns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_pkey PRIMARY KEY (id);


--
-- Name: sale_items sale_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_pkey PRIMARY KEY (id);


--
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id);


--
-- Name: sales_settings sales_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_settings
    ADD CONSTRAINT sales_settings_pkey PRIMARY KEY (id);


--
-- Name: shift_logs shift_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_logs
    ADD CONSTRAINT shift_logs_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: tax_calculations tax_calculations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_calculations
    ADD CONSTRAINT tax_calculations_pkey PRIMARY KEY (id);


--
-- Name: tax_records tax_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_records
    ADD CONSTRAINT tax_records_pkey PRIMARY KEY (id);


--
-- Name: user_group_members user_group_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_group_members
    ADD CONSTRAINT user_group_members_pkey PRIMARY KEY (id);


--
-- Name: user_groups user_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_groups
    ADD CONSTRAINT user_groups_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: wishlists wishlists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlists
    ADD CONSTRAINT wishlists_pkey PRIMARY KEY (id);


--
-- Name: accounts_businessUnitId_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "accounts_businessUnitId_code_key" ON public.accounts USING btree ("businessUnitId", code);


--
-- Name: accounts_businessUnitId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "accounts_businessUnitId_idx" ON public.accounts USING btree ("businessUnitId");


--
-- Name: activity_logs_action_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activity_logs_action_idx ON public.activity_logs USING btree (action);


--
-- Name: activity_logs_timestamp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activity_logs_timestamp_idx ON public.activity_logs USING btree ("timestamp");


--
-- Name: activity_logs_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "activity_logs_userId_idx" ON public.activity_logs USING btree ("userId");


--
-- Name: audit_logs_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "audit_logs_createdAt_idx" ON public.audit_logs USING btree ("createdAt");


--
-- Name: audit_logs_entityType_entityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "audit_logs_entityType_entityId_idx" ON public.audit_logs USING btree ("entityType", "entityId");


--
-- Name: audit_logs_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "audit_logs_userId_idx" ON public.audit_logs USING btree ("userId");


--
-- Name: barcode_image_records_barcode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX barcode_image_records_barcode_idx ON public.barcode_image_records USING btree (barcode);


--
-- Name: barcode_image_records_barcode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX barcode_image_records_barcode_key ON public.barcode_image_records USING btree (barcode);


--
-- Name: barcode_image_records_businessUnitId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "barcode_image_records_businessUnitId_idx" ON public.barcode_image_records USING btree ("businessUnitId");


--
-- Name: barcode_image_records_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX barcode_image_records_code_key ON public.barcode_image_records USING btree (code);


--
-- Name: barcode_image_records_productId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "barcode_image_records_productId_idx" ON public.barcode_image_records USING btree ("productId");


--
-- Name: barcode_image_records_variantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "barcode_image_records_variantId_idx" ON public.barcode_image_records USING btree ("variantId");


--
-- Name: bills_billNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "bills_billNumber_key" ON public.bills USING btree ("billNumber");


--
-- Name: bills_businessUnitId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "bills_businessUnitId_idx" ON public.bills USING btree ("businessUnitId");


--
-- Name: bills_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bills_status_idx ON public.bills USING btree (status);


--
-- Name: bills_supplierId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "bills_supplierId_idx" ON public.bills USING btree ("supplierId");


--
-- Name: business_unit_users_userId_businessUnitId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "business_unit_users_userId_businessUnitId_key" ON public.business_unit_users USING btree ("userId", "businessUnitId");


--
-- Name: business_units_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX business_units_code_idx ON public.business_units USING btree (code);


--
-- Name: business_units_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX business_units_code_key ON public.business_units USING btree (code);


--
-- Name: business_units_companyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "business_units_companyId_idx" ON public.business_units USING btree ("companyId");


--
-- Name: business_units_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "business_units_deletedAt_idx" ON public.business_units USING btree ("deletedAt");


--
-- Name: business_units_parentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "business_units_parentId_idx" ON public.business_units USING btree ("parentId");


--
-- Name: cart_settings_businessUnitId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "cart_settings_businessUnitId_key" ON public.cart_settings USING btree ("businessUnitId");


--
-- Name: carts_userId_businessUnitId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "carts_userId_businessUnitId_key" ON public.carts USING btree ("userId", "businessUnitId");


--
-- Name: cash_registers_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cash_registers_code_key ON public.cash_registers USING btree (code);


--
-- Name: checkout_settings_businessUnitId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "checkout_settings_businessUnitId_key" ON public.checkout_settings USING btree ("businessUnitId");


--
-- Name: companies_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX companies_email_key ON public.companies USING btree (email);


--
-- Name: company_settings_companyId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "company_settings_companyId_key" ON public.company_settings USING btree ("companyId");


--
-- Name: customers_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customers_email_key ON public.customers USING btree (email);


--
-- Name: expenses_businessUnitId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "expenses_businessUnitId_idx" ON public.expenses USING btree ("businessUnitId");


--
-- Name: expenses_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expenses_date_idx ON public.expenses USING btree (date);


--
-- Name: gift_cards_cardNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "gift_cards_cardNumber_key" ON public.gift_cards USING btree ("cardNumber");


--
-- Name: import_history_importedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "import_history_importedAt_idx" ON public.import_history USING btree ("importedAt");


--
-- Name: import_history_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX import_history_status_idx ON public.import_history USING btree (status);


--
-- Name: inventories_businessUnitId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventories_businessUnitId_idx" ON public.inventories USING btree ("businessUnitId");


--
-- Name: inventories_location_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventories_location_idx ON public.inventories USING btree (location);


--
-- Name: inventories_quantity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventories_quantity_idx ON public.inventories USING btree (quantity);


--
-- Name: inventories_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventories_status_idx ON public.inventories USING btree (status);


--
-- Name: inventory_issues_businessUnitId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_issues_businessUnitId_idx" ON public.inventory_issues USING btree ("businessUnitId");


--
-- Name: inventory_issues_inventoryId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_issues_inventoryId_idx" ON public.inventory_issues USING btree ("inventoryId");


--
-- Name: inventory_issues_productId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_issues_productId_idx" ON public.inventory_issues USING btree ("productId");


--
-- Name: inventory_issues_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_issues_status_idx ON public.inventory_issues USING btree (status);


--
-- Name: inventory_issues_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_issues_userId_idx" ON public.inventory_issues USING btree ("userId");


--
-- Name: inventory_transactions_businessUnitId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_transactions_businessUnitId_idx" ON public.inventory_transactions USING btree ("businessUnitId");


--
-- Name: inventory_transactions_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_transactions_createdAt_idx" ON public.inventory_transactions USING btree ("createdAt");


--
-- Name: inventory_transactions_inventoryId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_transactions_inventoryId_idx" ON public.inventory_transactions USING btree ("inventoryId");


--
-- Name: inventory_transactions_productId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_transactions_productId_idx" ON public.inventory_transactions USING btree ("productId");


--
-- Name: inventory_transactions_transactionType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_transactions_transactionType_idx" ON public.inventory_transactions USING btree ("transactionType");


--
-- Name: inventory_transactions_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "inventory_transactions_userId_idx" ON public.inventory_transactions USING btree ("userId");


--
-- Name: invitations_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invitations_email_idx ON public.invitations USING btree (email);


--
-- Name: invitations_invitationToken_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "invitations_invitationToken_idx" ON public.invitations USING btree ("invitationToken");


--
-- Name: invitations_invitationToken_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "invitations_invitationToken_key" ON public.invitations USING btree ("invitationToken");


--
-- Name: invitations_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invitations_status_idx ON public.invitations USING btree (status);


--
-- Name: invoices_invoiceNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON public.invoices USING btree ("invoiceNumber");


--
-- Name: invoices_saleId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "invoices_saleId_key" ON public.invoices USING btree ("saleId");


--
-- Name: journal_entries_entryNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "journal_entries_entryNumber_key" ON public.journal_entries USING btree ("entryNumber");


--
-- Name: location_settings_businessUnitId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "location_settings_businessUnitId_key" ON public.location_settings USING btree ("businessUnitId");


--
-- Name: locations_businessUnitId_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "locations_businessUnitId_code_key" ON public.locations USING btree ("businessUnitId", code);


--
-- Name: locations_businessUnitId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "locations_businessUnitId_idx" ON public.locations USING btree ("businessUnitId");


--
-- Name: locations_businessUnitId_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "locations_businessUnitId_name_key" ON public.locations USING btree ("businessUnitId", name);


--
-- Name: locations_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "locations_deletedAt_idx" ON public.locations USING btree ("deletedAt");


--
-- Name: locations_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "locations_isActive_idx" ON public.locations USING btree ("isActive");


--
-- Name: onboarding_events_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "onboarding_events_createdAt_idx" ON public.onboarding_events USING btree ("createdAt");


--
-- Name: onboarding_events_userId_stepId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "onboarding_events_userId_stepId_idx" ON public.onboarding_events USING btree ("userId", "stepId");


--
-- Name: onboarding_progress_companyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "onboarding_progress_companyId_idx" ON public.onboarding_progress USING btree ("companyId");


--
-- Name: onboarding_progress_isComplete_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "onboarding_progress_isComplete_idx" ON public.onboarding_progress USING btree ("isComplete");


--
-- Name: onboarding_progress_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "onboarding_progress_userId_key" ON public.onboarding_progress USING btree ("userId");


--
-- Name: orders_orderNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "orders_orderNumber_key" ON public.orders USING btree ("orderNumber");


--
-- Name: payment_method_configs_businessUnitId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "payment_method_configs_businessUnitId_idx" ON public.payment_method_configs USING btree ("businessUnitId");


--
-- Name: payment_method_configs_code_businessUnitId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "payment_method_configs_code_businessUnitId_key" ON public.payment_method_configs USING btree (code, "businessUnitId");


--
-- Name: payment_method_configs_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payment_method_configs_code_key ON public.payment_method_configs USING btree (code);


--
-- Name: payment_method_configs_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "payment_method_configs_deletedAt_idx" ON public.payment_method_configs USING btree ("deletedAt");


--
-- Name: payment_method_configs_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "payment_method_configs_isActive_idx" ON public.payment_method_configs USING btree ("isActive");


--
-- Name: payment_method_configs_providerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "payment_method_configs_providerId_idx" ON public.payment_method_configs USING btree ("providerId");


--
-- Name: payment_provider_configs_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_provider_configs_key_idx ON public.payment_provider_configs USING btree (key);


--
-- Name: payment_provider_configs_providerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "payment_provider_configs_providerId_idx" ON public.payment_provider_configs USING btree ("providerId");


--
-- Name: payment_provider_configs_providerId_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "payment_provider_configs_providerId_key_key" ON public.payment_provider_configs USING btree ("providerId", key);


--
-- Name: payment_provider_currencies_currency_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_provider_currencies_currency_idx ON public.payment_provider_currencies USING btree (currency);


--
-- Name: payment_provider_currencies_providerId_currency_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "payment_provider_currencies_providerId_currency_key" ON public.payment_provider_currencies USING btree ("providerId", currency);


--
-- Name: payment_provider_currencies_providerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "payment_provider_currencies_providerId_idx" ON public.payment_provider_currencies USING btree ("providerId");


--
-- Name: payment_providers_businessUnitId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "payment_providers_businessUnitId_idx" ON public.payment_providers USING btree ("businessUnitId");


--
-- Name: payment_providers_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_providers_code_idx ON public.payment_providers USING btree (code);


--
-- Name: payment_providers_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "payment_providers_deletedAt_idx" ON public.payment_providers USING btree ("deletedAt");


--
-- Name: payment_providers_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "payment_providers_isActive_idx" ON public.payment_providers USING btree ("isActive");


--
-- Name: payment_providers_provider_businessUnitId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "payment_providers_provider_businessUnitId_key" ON public.payment_providers USING btree (provider, "businessUnitId");


--
-- Name: payments_orderId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "payments_orderId_key" ON public.payments USING btree ("orderId");


--
-- Name: processed_webhooks_eventId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "processed_webhooks_eventId_idx" ON public.processed_webhooks USING btree ("eventId");


--
-- Name: processed_webhooks_eventId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "processed_webhooks_eventId_key" ON public.processed_webhooks USING btree ("eventId");


--
-- Name: processed_webhooks_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX processed_webhooks_provider_idx ON public.processed_webhooks USING btree (provider);


--
-- Name: product_images_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_images_order_idx ON public.product_images USING btree ("order");


--
-- Name: product_images_productId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "product_images_productId_idx" ON public.product_images USING btree ("productId");


--
-- Name: product_images_productId_url_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "product_images_productId_url_key" ON public.product_images USING btree ("productId", url);


--
-- Name: product_promotions_promotionId_productId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "product_promotions_promotionId_productId_key" ON public.product_promotions USING btree ("promotionId", "productId");


--
-- Name: product_review_images_reviewId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "product_review_images_reviewId_idx" ON public.product_review_images USING btree ("reviewId");


--
-- Name: product_review_images_reviewId_url_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "product_review_images_reviewId_url_key" ON public.product_review_images USING btree ("reviewId", url);


--
-- Name: product_reviews_productId_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "product_reviews_productId_userId_key" ON public.product_reviews USING btree ("productId", "userId");


--
-- Name: product_variant_images_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_variant_images_order_idx ON public.product_variant_images USING btree ("order");


--
-- Name: product_variant_images_variantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "product_variant_images_variantId_idx" ON public.product_variant_images USING btree ("variantId");


--
-- Name: product_variant_images_variantId_url_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "product_variant_images_variantId_url_key" ON public.product_variant_images USING btree ("variantId", url);


--
-- Name: product_variants_barcode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_variants_barcode_idx ON public.product_variants USING btree (barcode);


--
-- Name: product_variants_barcode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX product_variants_barcode_key ON public.product_variants USING btree (barcode);


--
-- Name: product_variants_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "product_variants_deletedAt_idx" ON public.product_variants USING btree ("deletedAt");


--
-- Name: product_variants_inventoryId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "product_variants_inventoryId_idx" ON public.product_variants USING btree ("inventoryId");


--
-- Name: product_variants_inventoryId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "product_variants_inventoryId_key" ON public.product_variants USING btree ("inventoryId");


--
-- Name: product_variants_productId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "product_variants_productId_idx" ON public.product_variants USING btree ("productId");


--
-- Name: product_variants_sku_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_variants_sku_idx ON public.product_variants USING btree (sku);


--
-- Name: product_variants_sku_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX product_variants_sku_key ON public.product_variants USING btree (sku);


--
-- Name: products_barcode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_barcode_idx ON public.products USING btree (barcode);


--
-- Name: products_barcode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX products_barcode_key ON public.products USING btree (barcode);


--
-- Name: products_businessUnitId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "products_businessUnitId_idx" ON public.products USING btree ("businessUnitId");


--
-- Name: products_categoryId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "products_categoryId_idx" ON public.products USING btree ("categoryId");


--
-- Name: products_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "products_deletedAt_idx" ON public.products USING btree ("deletedAt");


--
-- Name: products_inventoryId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "products_inventoryId_idx" ON public.products USING btree ("inventoryId");


--
-- Name: products_inventoryId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "products_inventoryId_key" ON public.products USING btree ("inventoryId");


--
-- Name: products_sku_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX products_sku_key ON public.products USING btree (sku);


--
-- Name: products_supplierId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "products_supplierId_idx" ON public.products USING btree ("supplierId");


--
-- Name: purchase_orders_orderNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "purchase_orders_orderNumber_key" ON public.purchase_orders USING btree ("orderNumber");


--
-- Name: qr_code_records_businessUnitId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "qr_code_records_businessUnitId_idx" ON public.qr_code_records USING btree ("businessUnitId");


--
-- Name: qr_code_records_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX qr_code_records_code_idx ON public.qr_code_records USING btree (code);


--
-- Name: qr_code_records_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX qr_code_records_code_key ON public.qr_code_records USING btree (code);


--
-- Name: qr_code_records_productId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "qr_code_records_productId_idx" ON public.qr_code_records USING btree ("productId");


--
-- Name: qr_code_records_receiptId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "qr_code_records_receiptId_idx" ON public.qr_code_records USING btree ("receiptId");


--
-- Name: qr_code_records_saleId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "qr_code_records_saleId_idx" ON public.qr_code_records USING btree ("saleId");


--
-- Name: qr_code_records_variantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "qr_code_records_variantId_idx" ON public.qr_code_records USING btree ("variantId");


--
-- Name: receipts_orderId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "receipts_orderId_key" ON public.receipts USING btree ("orderId");


--
-- Name: receipts_receiptNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "receipts_receiptNumber_key" ON public.receipts USING btree ("receiptNumber");


--
-- Name: receipts_saleId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "receipts_saleId_key" ON public.receipts USING btree ("saleId");


--
-- Name: recently_viewed_userId_productId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "recently_viewed_userId_productId_key" ON public.recently_viewed USING btree ("userId", "productId");


--
-- Name: refunds_refundNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "refunds_refundNumber_key" ON public.refunds USING btree ("refundNumber");


--
-- Name: refunds_returnId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "refunds_returnId_key" ON public.refunds USING btree ("returnId");


--
-- Name: returns_returnNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "returns_returnNumber_key" ON public.returns USING btree ("returnNumber");


--
-- Name: sales_invoiceId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "sales_invoiceId_key" ON public.sales USING btree ("invoiceId");


--
-- Name: sales_orderId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "sales_orderId_key" ON public.sales USING btree ("orderId");


--
-- Name: sales_receiptNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "sales_receiptNumber_key" ON public.sales USING btree ("receiptNumber");


--
-- Name: sales_settings_companyId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "sales_settings_companyId_key" ON public.sales_settings USING btree ("companyId");


--
-- Name: shift_logs_cashRegisterSessionId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "shift_logs_cashRegisterSessionId_key" ON public.shift_logs USING btree ("cashRegisterSessionId");


--
-- Name: tax_calculations_businessUnitId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "tax_calculations_businessUnitId_idx" ON public.tax_calculations USING btree ("businessUnitId");


--
-- Name: user_group_members_groupId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "user_group_members_groupId_idx" ON public.user_group_members USING btree ("groupId");


--
-- Name: user_group_members_groupId_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "user_group_members_groupId_userId_key" ON public.user_group_members USING btree ("groupId", "userId");


--
-- Name: user_group_members_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "user_group_members_userId_idx" ON public.user_group_members USING btree ("userId");


--
-- Name: user_groups_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "user_groups_isActive_idx" ON public.user_groups USING btree ("isActive");


--
-- Name: user_groups_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_groups_name_idx ON public.user_groups USING btree (name);


--
-- Name: user_groups_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX user_groups_name_key ON public.user_groups USING btree (name);


--
-- Name: users_clerkId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "users_clerkId_key" ON public.users USING btree ("clerkId");


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: users_stripeCustomerId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "users_stripeCustomerId_key" ON public.users USING btree ("stripeCustomerId");


--
-- Name: wishlists_userId_productId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "wishlists_userId_productId_key" ON public.wishlists USING btree ("userId", "productId");


--
-- Name: accounts accounts_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT "accounts_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: activity_logs activity_logs_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: audit_logs audit_logs_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "audit_logs_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "audit_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: barcode_image_records barcode_image_records_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barcode_image_records
    ADD CONSTRAINT "barcode_image_records_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: barcode_image_records barcode_image_records_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barcode_image_records
    ADD CONSTRAINT "barcode_image_records_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: barcode_image_records barcode_image_records_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barcode_image_records
    ADD CONSTRAINT "barcode_image_records_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: barcode_image_records barcode_image_records_variantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barcode_image_records
    ADD CONSTRAINT "barcode_image_records_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES public.product_variants(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: bills bills_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT "bills_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: bills bills_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT "bills_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: bills bills_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT "bills_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES public.suppliers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: business_unit_users business_unit_users_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_unit_users
    ADD CONSTRAINT "business_unit_users_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: business_unit_users business_unit_users_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_unit_users
    ADD CONSTRAINT "business_unit_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: business_units business_units_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_units
    ADD CONSTRAINT "business_units_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: business_units business_units_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_units
    ADD CONSTRAINT "business_units_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: cart_items cart_items_cartId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT "cart_items_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES public.carts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: cart_items cart_items_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT "cart_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: cart_items cart_items_variantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT "cart_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES public.product_variants(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: cart_settings cart_settings_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_settings
    ADD CONSTRAINT "cart_settings_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: carts carts_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT "carts_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: carts carts_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT "carts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: carts carts_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT "carts_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: cash_register_sessions cash_register_sessions_cashRegisterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_register_sessions
    ADD CONSTRAINT "cash_register_sessions_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES public.cash_registers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: cash_register_sessions cash_register_sessions_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_register_sessions
    ADD CONSTRAINT "cash_register_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: cash_registers cash_registers_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_registers
    ADD CONSTRAINT "cash_registers_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: cash_transactions cash_transactions_cashRegisterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_transactions
    ADD CONSTRAINT "cash_transactions_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES public.cash_registers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: cash_transactions cash_transactions_cashRegisterSessionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_transactions
    ADD CONSTRAINT "cash_transactions_cashRegisterSessionId_fkey" FOREIGN KEY ("cashRegisterSessionId") REFERENCES public.cash_register_sessions(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: cash_transactions cash_transactions_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_transactions
    ADD CONSTRAINT "cash_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: categories categories_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT "categories_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: categories categories_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public.categories(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: checkout_settings checkout_settings_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_settings
    ADD CONSTRAINT "checkout_settings_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: company_settings company_settings_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_settings
    ADD CONSTRAINT "company_settings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: customers customers_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT "customers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: expenses expenses_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT "expenses_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: expenses expenses_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT "expenses_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: export_history export_history_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.export_history
    ADD CONSTRAINT "export_history_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: export_history export_history_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.export_history
    ADD CONSTRAINT "export_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: financial_reports financial_reports_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_reports
    ADD CONSTRAINT "financial_reports_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: financial_reports financial_reports_generatedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_reports
    ADD CONSTRAINT "financial_reports_generatedBy_fkey" FOREIGN KEY ("generatedBy") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: gift_card_transactions gift_card_transactions_giftCardId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_card_transactions
    ADD CONSTRAINT "gift_card_transactions_giftCardId_fkey" FOREIGN KEY ("giftCardId") REFERENCES public.gift_cards(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: gift_card_transactions gift_card_transactions_saleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_card_transactions
    ADD CONSTRAINT "gift_card_transactions_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES public.sales(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: gift_card_transactions gift_card_transactions_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_card_transactions
    ADD CONSTRAINT "gift_card_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: gift_cards gift_cards_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_cards
    ADD CONSTRAINT "gift_cards_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: gift_cards gift_cards_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_cards
    ADD CONSTRAINT "gift_cards_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: gift_cards gift_cards_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_cards
    ADD CONSTRAINT "gift_cards_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: import_history import_history_importedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_history
    ADD CONSTRAINT "import_history_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventories inventories_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventories
    ADD CONSTRAINT "inventories_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventories inventories_locationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventories
    ADD CONSTRAINT "inventories_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES public.locations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_issues inventory_issues_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_issues
    ADD CONSTRAINT "inventory_issues_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_issues inventory_issues_inventoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_issues
    ADD CONSTRAINT "inventory_issues_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES public.inventories(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_issues inventory_issues_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_issues
    ADD CONSTRAINT "inventory_issues_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_issues inventory_issues_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_issues
    ADD CONSTRAINT "inventory_issues_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_issues inventory_issues_variantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_issues
    ADD CONSTRAINT "inventory_issues_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES public.product_variants(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_transactions inventory_transactions_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT "inventory_transactions_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_transactions inventory_transactions_inventoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT "inventory_transactions_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES public.inventories(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_transactions inventory_transactions_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT "inventory_transactions_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_transactions inventory_transactions_purchaseOrderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT "inventory_transactions_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES public.purchase_orders(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_transactions inventory_transactions_saleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT "inventory_transactions_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES public.sales(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_transactions inventory_transactions_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT "inventory_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_transactions inventory_transactions_variantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT "inventory_transactions_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES public.product_variants(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: invitations invitations_invitedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT "invitations_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: invoices invoices_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT "invoices_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: invoices invoices_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT "invoices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: invoices invoices_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT "invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: invoices invoices_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT "invoices_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: journal_entries journal_entries_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT "journal_entries_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: journal_entries journal_entries_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT "journal_entries_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: journal_lines journal_lines_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_lines
    ADD CONSTRAINT "journal_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public.accounts(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: journal_lines journal_lines_journalEntryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_lines
    ADD CONSTRAINT "journal_lines_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES public.journal_entries(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: location_settings location_settings_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.location_settings
    ADD CONSTRAINT "location_settings_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: locations locations_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT "locations_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: loyalty_histories loyalty_histories_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_histories
    ADD CONSTRAINT "loyalty_histories_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: loyalty_histories loyalty_histories_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_histories
    ADD CONSTRAINT "loyalty_histories_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: loyalty_histories loyalty_histories_rewardId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_histories
    ADD CONSTRAINT "loyalty_histories_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES public.loyalty_rewards(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: loyalty_histories loyalty_histories_saleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_histories
    ADD CONSTRAINT "loyalty_histories_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES public.sales(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: loyalty_histories loyalty_histories_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_histories
    ADD CONSTRAINT "loyalty_histories_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: loyalty_programs loyalty_programs_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_programs
    ADD CONSTRAINT "loyalty_programs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: loyalty_rewards loyalty_rewards_loyaltyProgramId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_rewards
    ADD CONSTRAINT "loyalty_rewards_loyaltyProgramId_fkey" FOREIGN KEY ("loyaltyProgramId") REFERENCES public.loyalty_programs(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: notifications notifications_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "notifications_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: notifications notifications_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "notifications_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: notifications notifications_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: onboarding_events onboarding_events_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_events
    ADD CONSTRAINT "onboarding_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: onboarding_progress onboarding_progress_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_progress
    ADD CONSTRAINT "onboarding_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: order_items order_items_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: order_items order_items_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: order_items order_items_variantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT "order_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES public.product_variants(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: orders orders_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT "orders_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: orders orders_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: orders orders_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: payment_gateways payment_gateways_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_gateways
    ADD CONSTRAINT "payment_gateways_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: payment_method_configs payment_method_configs_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_method_configs
    ADD CONSTRAINT "payment_method_configs_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: payment_method_configs payment_method_configs_providerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_method_configs
    ADD CONSTRAINT "payment_method_configs_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES public.payment_providers(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: payment_provider_configs payment_provider_configs_providerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_provider_configs
    ADD CONSTRAINT "payment_provider_configs_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES public.payment_providers(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: payment_provider_currencies payment_provider_currencies_providerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_provider_currencies
    ADD CONSTRAINT "payment_provider_currencies_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES public.payment_providers(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: payment_providers payment_providers_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_providers
    ADD CONSTRAINT "payment_providers_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: payments payments_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT "payments_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: payments payments_cashRegisterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT "payments_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES public.cash_registers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: payments payments_cashRegisterSessionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT "payments_cashRegisterSessionId_fkey" FOREIGN KEY ("cashRegisterSessionId") REFERENCES public.cash_register_sessions(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: payments payments_gatewayId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT "payments_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES public.payment_gateways(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: payments payments_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: payments payments_saleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT "payments_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES public.sales(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: payments payments_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT "payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: product_images product_images_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT "product_images_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: product_promotions product_promotions_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_promotions
    ADD CONSTRAINT "product_promotions_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: product_promotions product_promotions_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_promotions
    ADD CONSTRAINT "product_promotions_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: product_promotions product_promotions_promotionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_promotions
    ADD CONSTRAINT "product_promotions_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES public.promotions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: product_review_images product_review_images_reviewId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_review_images
    ADD CONSTRAINT "product_review_images_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES public.product_reviews(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: product_reviews product_reviews_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT "product_reviews_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: product_reviews product_reviews_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT "product_reviews_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: product_reviews product_reviews_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT "product_reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: product_variant_images product_variant_images_variantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variant_images
    ADD CONSTRAINT "product_variant_images_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES public.product_variants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: product_variants product_variants_inventoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT "product_variants_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES public.inventories(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: product_variants product_variants_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: products products_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT "products_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: products products_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public.categories(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: products products_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT "products_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: products products_inventoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT "products_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES public.inventories(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: products products_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT "products_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES public.suppliers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: products products_updatedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT "products_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: promotions promotions_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT "promotions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_order_items purchase_order_items_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT "purchase_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_order_items purchase_order_items_purchaseOrderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT "purchase_order_items_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES public.purchase_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: purchase_order_items purchase_order_items_variantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT "purchase_order_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES public.product_variants(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: purchase_orders purchase_orders_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT "purchase_orders_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_orders purchase_orders_receivedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT "purchase_orders_receivedBy_fkey" FOREIGN KEY ("receivedBy") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: purchase_orders purchase_orders_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT "purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES public.suppliers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_orders purchase_orders_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT "purchase_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: qr_code_records qr_code_records_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_code_records
    ADD CONSTRAINT "qr_code_records_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: qr_code_records qr_code_records_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_code_records
    ADD CONSTRAINT "qr_code_records_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: qr_code_records qr_code_records_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_code_records
    ADD CONSTRAINT "qr_code_records_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: qr_code_records qr_code_records_receiptId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_code_records
    ADD CONSTRAINT "qr_code_records_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES public.receipts(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: qr_code_records qr_code_records_saleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_code_records
    ADD CONSTRAINT "qr_code_records_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES public.sales(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: qr_code_records qr_code_records_variantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_code_records
    ADD CONSTRAINT "qr_code_records_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES public.product_variants(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: receipts receipts_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT "receipts_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: receipts receipts_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT "receipts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: receipts receipts_lastPrintedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT "receipts_lastPrintedBy_fkey" FOREIGN KEY ("lastPrintedBy") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: receipts receipts_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT "receipts_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: receipts receipts_saleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT "receipts_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES public.sales(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: recently_viewed recently_viewed_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recently_viewed
    ADD CONSTRAINT "recently_viewed_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: recently_viewed recently_viewed_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recently_viewed
    ADD CONSTRAINT "recently_viewed_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: recently_viewed recently_viewed_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recently_viewed
    ADD CONSTRAINT "recently_viewed_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: refund_items refund_items_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_items
    ADD CONSTRAINT "refund_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: refund_items refund_items_refundId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_items
    ADD CONSTRAINT "refund_items_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES public.refunds(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: refund_items refund_items_variantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_items
    ADD CONSTRAINT "refund_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES public.product_variants(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: refunds refunds_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT "refunds_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: refunds refunds_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT "refunds_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: refunds refunds_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT "refunds_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: refunds refunds_paymentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT "refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES public.payments(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: refunds refunds_processedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT "refunds_processedBy_fkey" FOREIGN KEY ("processedBy") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: refunds refunds_returnId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT "refunds_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES public.returns(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: refunds refunds_saleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT "refunds_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES public.sales(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: refunds refunds_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT "refunds_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: reports reports_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT "reports_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: reports reports_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT "reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: return_items return_items_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_items
    ADD CONSTRAINT "return_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: return_items return_items_returnId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_items
    ADD CONSTRAINT "return_items_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES public.returns(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: return_items return_items_variantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_items
    ADD CONSTRAINT "return_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES public.product_variants(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: returns returns_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT "returns_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: returns returns_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT "returns_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: returns returns_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT "returns_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: returns returns_processedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT "returns_processedBy_fkey" FOREIGN KEY ("processedBy") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: returns returns_saleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT "returns_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES public.sales(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: returns returns_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT "returns_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sale_items sale_items_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT "sale_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sale_items sale_items_saleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT "sale_items_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES public.sales(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sale_items sale_items_variantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT "sale_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES public.product_variants(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sales sales_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT "sales_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sales sales_cashRegisterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT "sales_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES public.cash_registers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sales sales_cashRegisterSessionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT "sales_cashRegisterSessionId_fkey" FOREIGN KEY ("cashRegisterSessionId") REFERENCES public.cash_register_sessions(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sales sales_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT "sales_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sales sales_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT "sales_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public.invoices(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sales sales_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT "sales_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sales_settings sales_settings_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_settings
    ADD CONSTRAINT "sales_settings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sales sales_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT "sales_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: shift_logs shift_logs_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_logs
    ADD CONSTRAINT "shift_logs_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: shift_logs shift_logs_cashRegisterSessionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_logs
    ADD CONSTRAINT "shift_logs_cashRegisterSessionId_fkey" FOREIGN KEY ("cashRegisterSessionId") REFERENCES public.cash_register_sessions(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: shift_logs shift_logs_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_logs
    ADD CONSTRAINT "shift_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: suppliers suppliers_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT "suppliers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: tax_calculations tax_calculations_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_calculations
    ADD CONSTRAINT "tax_calculations_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: tax_records tax_records_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_records
    ADD CONSTRAINT "tax_records_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: tax_records tax_records_saleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_records
    ADD CONSTRAINT "tax_records_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES public.sales(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: user_group_members user_group_members_groupId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_group_members
    ADD CONSTRAINT "user_group_members_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES public.user_groups(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_group_members user_group_members_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_group_members
    ADD CONSTRAINT "user_group_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_groups user_groups_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_groups
    ADD CONSTRAINT "user_groups_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: user_groups user_groups_parentGroupId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_groups
    ADD CONSTRAINT "user_groups_parentGroupId_fkey" FOREIGN KEY ("parentGroupId") REFERENCES public.user_groups(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: users users_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: wishlists wishlists_businessUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlists
    ADD CONSTRAINT "wishlists_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES public.business_units(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: wishlists wishlists_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlists
    ADD CONSTRAINT "wishlists_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: wishlists wishlists_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlists
    ADD CONSTRAINT "wishlists_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

