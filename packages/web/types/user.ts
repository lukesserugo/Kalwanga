// D:\Projects\Kalwanga\packages\web\types\user.ts

import { UserRole } from './enums';

// Import all required types from their respective files
import { Order, PurchaseOrder } from './order';
import { Sale } from './sale';
import { Product, ProductReview } from './product';
import { Category } from './category';
import { Payment, PaymentGateway } from './payment';
import { Customer } from './customer';
import { Supplier } from './supplier';
import { Invoice, Receipt } from './invoice';
import { Cart } from './cart';
import { Inventory, InventoryTransaction, InventoryIssue } from './inventory';
import { 
  CashRegister, 
  CashRegisterSession, 
  CashTransaction, 
  ShiftLog 
} from './register';
import { 
  Account, 
  JournalEntry, 
  TaxRecord, 
  FinancialReport 
} from './bookkeeping';
import { GiftCard, GiftCardTransaction, LoyaltyHistory, LoyaltyProgram } from './customer';
import { Promotion } from './promotion';
import { Notification, AuditLog, Report } from './audit';

// ============================================
// CORE USER TYPES
// ============================================

export interface User {
  id: string;
  clerkId: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  avatar?: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  // ✅ NEW: Permissions field - array of permission strings
  permissions?: string[];
  businessUnits?: BusinessUnitUser[];
  companyId?: string;
  company?: Company;
  // ✅ NEW: Group memberships
  groupMemberships?: UserGroupMember[];
  // ✅ NEW: Activity logs
  activityLogs?: UserActivity[];
  // Additional relations from backend
  orders?: Order[];
  sales?: Sale[];
  inventoryTransactions?: InventoryTransaction[];
  cashRegisterSessions?: CashRegisterSession[];
  shiftLogs?: ShiftLog[];
  notifications?: Notification[];
  auditLogs?: AuditLog[];
  createdProducts?: Product[];
  updatedProducts?: Product[];
  payments?: Payment[];
  giftCardTransactions?: GiftCardTransaction[];
  loyaltyHistories?: LoyaltyHistory[];
  cashTransactions?: CashTransaction[];
  purchaseOrders?: PurchaseOrder[];
  invoices?: Invoice[];
  reports?: Report[];
  inventoryIssues?: InventoryIssue[];
  carts?: Cart[];
  productReviews?: ProductReview[];
  journalEntries?: JournalEntry[];
  financialReports?: FinancialReport[];
  receipts?: Receipt[];
  purchaseOrdersReceived?: PurchaseOrder[];
  // ✅ NEW: Count fields
  salesCount?: number;
  ordersCount?: number;
  purchaseOrderCount?: number;
  groupCount?: number;
  activityCount?: number;
  businessUnitCount?: number;
  fullName?: string;
}

export interface Company {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  taxId?: string;
  currency: string;
  timezone: string;
  logo?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Additional relations from backend
  users?: User[];
  businessUnits?: BusinessUnit[];
  settings?: CompanySettings;
  paymentGateways?: PaymentGateway[];
  giftCards?: GiftCard[];
  loyaltyPrograms?: LoyaltyProgram[];
  promotions?: Promotion[];
  invoices?: Invoice[];
  receipts?: Receipt[];
  reports?: Report[];
  customers?: Customer[];
  suppliers?: Supplier[];
  auditLogs?: AuditLog[];
  notifications?: Notification[];
}

export interface CompanySettings {
  id: string;
  companyId: string;
  company?: Company;
  taxRate: number;
  taxInclusive: boolean;
  receiptFooter?: string;
  receiptHeader?: string;
  lowStockThreshold: number;
  autoReorder: boolean;
  allowReturns: boolean;
  requireCustomerForReturn: boolean;
  maxReturnDays: number;
  allowCash: boolean;
  allowCard: boolean;
  allowMobileMoney: boolean;
  allowGiftCards: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessUnit {
  id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  companyId: string;
  company?: Company;
  users?: BusinessUnitUser[];
  inventory?: Inventory[];
  products?: Product[];
  orders?: Order[];
  sales?: Sale[];
  categories?: Category[];
  inventoryTransactions?: InventoryTransaction[];
  purchaseOrders?: PurchaseOrder[];
  shiftLogs?: ShiftLog[];
  cashRegisters?: CashRegister[];
  inventoryIssues?: InventoryIssue[];
  carts?: Cart[];
  journalEntries?: JournalEntry[];
  accounts?: Account[];
  taxRecords?: TaxRecord[];
  financialReports?: FinancialReport[];
  notifications?: Notification[];
}

export interface BusinessUnitUser {
  id: string;
  userId: string;
  user?: User;
  businessUnitId: string;
  businessUnit?: BusinessUnit;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

// ============================================
// USER SEARCH PARAMS
// ============================================

export interface UserSearchParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole | string;
  isActive?: boolean;
  businessUnitId?: string;
  companyId?: string;
  includePermissions?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// USER STATS
// ============================================

export interface UserStats {
  total: number;
  active: number;
  inactive: number;
  byRole: Record<UserRole, number>;
  newThisMonth: number;
  growth: number;
}

// ============================================
// USER PERMISSION TYPES
// ============================================

export interface UserPermission {
  id: string;
  userId: string;
  permission: string;
  grantedAt: string;
  grantedBy?: string;
  expiresAt?: string;
}

export interface UserWithPermissions extends User {
  permissions: string[];
}

// ============================================
// USER ACTIVITY TYPES
// ============================================

export interface UserActivity {
  id: string;
  userId: string;
  action: string;
  description: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  device?: string;
  location?: string;
  status: 'success' | 'failed' | 'pending';
  severity: 'info' | 'warning' | 'error' | 'critical';
  resource?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface UserActivityResponse {
  data: UserActivity[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export interface ActivityFilter {
  page?: number;
  limit?: number;
  search?: string;
  action?: string;
  status?: string;
  severity?: string;
  dateFrom?: string;
  dateTo?: string;
  device?: string;
  location?: string;
  ipAddress?: string;
  resource?: string;
  resourceId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ActivityStats {
  total: number;
  successCount: number;
  failedCount: number;
  pendingCount: number;
  successRate: number;
  byAction: Record<string, number>;
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
  byDevice: Record<string, number>;
  byLocation: Record<string, number>;
}

export interface ActivitySummary {
  totalActivities: number;
  todayActivities: number;
  thisWeekActivities: number;
  thisMonthActivities: number;
  successRate: number;
  failureRate: number;
  averagePerDay: number;
  mostActiveDay: string;
  mostActiveTime: string;
  byAction: Record<string, number>;
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
  byDevice: Record<string, number>;
  byLocation: Record<string, number>;
  byHour: Record<number, number>;
  byDay: Record<string, number>;
  byMonth: Record<string, number>;
  recentActivities: UserActivity[];
  topActions: Array<{ action: string; count: number }>;
  topDevices: Array<{ device: string; count: number }>;
  topLocations: Array<{ location: string; count: number }>;
}

export interface AuditTrailEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  changes: Record<string, any>;
  timestamp: string;
  severity: string;
  userId?: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

// ============================================
// USER IMPORT TYPES
// ============================================

export interface ImportUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  role: UserRole;
  businessUnitId?: string;
  isActive: boolean;
  password?: string;
  permissions?: string[];
  companyId?: string;
  avatar?: string;
  status: 'valid' | 'invalid' | 'warning' | 'duplicate';
  errors: string[];
  warnings: string[];
  originalData: Record<string, any>;
  rowNumber: number;
}

export interface ImportResult {
  totalRows: number;
  successCount: number;
  failedCount: number;
  warningCount: number;
  skippedCount: number;
  errors: ImportError[];
  warnings: ImportWarning[];
  importedUsers: string[];
  failedUsers: string[];
  importDuration?: number;
  importId?: string;
  importedAt?: string;
}

export interface ImportError {
  rowNumber: number;
  email: string;
  error: string;
  field?: string;
  value?: string;
}

export interface ImportWarning {
  rowNumber: number;
  email: string;
  warning: string;
  field?: string;
  value?: string;
}

export interface ImportHistory {
  id: string;
  fileName: string;
  fileSize: number;
  totalRows: number;
  successCount: number;
  failedCount: number;
  warningCount: number;
  skippedCount: number;
  status: 'completed' | 'partial' | 'failed' | 'pending' | 'cancelled';
  importedBy: string;
  importedById?: string;
  importDuration: number;
  errorSummary?: string;
  importedAt: string;
  details?: ImportResult;
}

export interface ImportTemplate {
  id: string;
  name: string;
  description: string;
  format: 'csv' | 'excel';
  headers: string[];
  requiredHeaders: string[];
  optionalHeaders: string[];
  exampleData: Record<string, any>[];
  downloadUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ImportOptions {
  skipDuplicates?: boolean;
  skipInvalid?: boolean;
  sendWelcomeEmail?: boolean;
  defaultPassword?: string;
  autoActivate?: boolean;
  batchSize?: number;
}

export interface ImportValidationResult {
  valid: boolean;
  errors: ImportError[];
  warnings: ImportWarning[];
  validUsers: ImportUser[];
  invalidUsers: ImportUser[];
  duplicateEmails: string[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
    warnings: number;
    duplicates: number;
    readyToImport: number;
  };
}

export interface ImportStats {
  totalImports: number;
  totalUsersImported: number;
  successRate: number;
  averageImportTime: number;
  lastImport?: ImportHistory;
  byMonth: Array<{ month: string; count: number }>;
  byStatus: Record<string, number>;
}

// ============================================
// USER INVITATION TYPES
// ============================================

export interface UserInvitation {
  id: string;
  email: string;
  role: UserRole;
  businessUnitId?: string;
  message?: string;
  expiresIn: number;
  status: 'pending' | 'sent' | 'accepted' | 'expired' | 'cancelled' | 'revoked';
  sentAt?: string;
  expiresAt?: string;
  acceptedAt?: string;
  cancelledAt?: string;
  invitationToken: string;
  invitedBy: string;
  invitedById?: string;
  reminderSent?: boolean;
  reminderSentAt?: string;
  reminderCount?: number;
  metadata?: Record<string, any>;
}

export interface InvitationResult {
  id: string;
  email: string;
  status: 'sent' | 'failed' | 'duplicate' | 'invalid';
  message?: string;
  error?: string;
  invitation?: UserInvitation;
}

export interface BatchInvitationResult {
  total: number;
  successCount: number;
  failedCount: number;
  duplicateCount: number;
  invalidCount: number;
  results: InvitationResult[];
  duration: number;
}

export interface InvitationTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  role?: UserRole;
  variables: string[];
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface InvitationStats {
  total: number;
  pending: number;
  sent: number;
  accepted: number;
  expired: number;
  cancelled: number;
  revoked: number;
  acceptanceRate: number;
  averageResponseTime: number;
  byRole: Record<string, number>;
  byStatus: Record<string, number>;
  byMonth: Array<{ month: string; count: number }>;
}

export interface InvitationFilter {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  invitedBy?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface InvitationOptions {
  businessUnitId?: string;
  message?: string;
  expiresIn?: number;
  sendEmail?: boolean;
  templateId?: string;
  metadata?: Record<string, any>;
}

// ============================================
// USER GROUP TYPES
// ============================================

export interface UserGroup {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  permissions: string[];
  isActive: boolean;
  createdBy: string;
  createdById?: string;
  parentGroupId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  members?: UserGroupMember[];
  parentGroup?: UserGroup;
  childGroups?: UserGroup[];
  memberCount?: number;
  childGroupCount?: number;
}

export interface UserGroupMember {
  id?: string;
  groupId?: string;
  userId: string;
  role: UserRole;
  isLead: boolean;
  joinedAt: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role?: UserRole;
    isActive?: boolean;
    permissions?: string[];
  };
  group?: UserGroup;
}

export interface CreateGroupData {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  parentGroupId?: string;
  permissions?: string[];
  members?: Array<{
    userId: string;
    role?: UserRole;
    isLead?: boolean;
  }>;
  metadata?: Record<string, any>;
}

export interface UpdateGroupData {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  parentGroupId?: string;
  permissions?: string[];
  isActive?: boolean;
  metadata?: Record<string, any>;
}

export interface GroupFilter {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  parentGroupId?: string;
  createdBy?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface GroupStats {
  totalGroups: number;
  totalMembers: number;
  activeGroups: number;
  inactiveGroups: number;
  totalPermissions: number;
  averageMembersPerGroup: number;
  byRole: Record<string, number>;
  byPermission: Record<string, number>;
  byMonth: Array<{ month: string; count: number }>;
}

export interface GroupHierarchy {
  group: UserGroup;
  children: GroupHierarchy[];
  depth: number;
}

export interface GroupPermissionResult {
  groupId: string;
  permissions: string[];
  updatedAt: string;
  updatedBy: string;
}

export interface AssignUsersResult {
  groupId: string;
  assignedCount: number;
  skippedCount: number;
  failedCount: number;
  assignedUsers: string[];
  skippedUsers: string[];
  failedUsers: Array<{ userId: string; error: string }>;
  duration: number;
}

export interface RemoveUsersResult {
  groupId: string;
  removedCount: number;
  skippedCount: number;
  failedCount: number;
  removedUsers: string[];
  skippedUsers: string[];
  failedUsers: Array<{ userId: string; error: string }>;
}

// ============================================
// USER MANAGEMENT TYPES
// ============================================

export interface CreateUserData {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  phoneNumber?: string;
  role: UserRole;
  businessUnitId?: string | null;
  clerkId?: string;
  companyId?: string;
  permissions?: string[];
}

export interface UpdateUserData {
  email?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  role?: UserRole;
  isActive?: boolean;
  password?: string;
  companyId?: string;
  avatar?: string;
  permissions?: string[];
  lastLoginAt?: string;
  businessUnitId?: string | null;
}

export interface UpdateUserRoleData {
  role: UserRole;
}

export interface UpdateUserPermissionsData {
  permissions: string[];
}

export interface BulkActionData {
  ids: string[];
}

export interface ExportOptions {
  format: 'csv' | 'json' | 'excel';
  fields?: string[];
  filters?: UserSearchParams;
}

// ============================================
// RESPONSE TYPES
// ============================================

export interface UserResponse {
  success: boolean;
  data: User;
  message?: string;
}

export interface UsersResponse {
  success: boolean;
  data: User[];
  pagination: {
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  };
  message?: string;
}

export interface BulkActionResponse {
  success: boolean;
  message: string;
  count: number;
  errors?: Array<{ id: string; error: string }>;
}

// ============================================
// PERMISSION DEFINITION TYPES
// ============================================

export interface PermissionDefinition {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  category: string;
}

export interface RolePermissions {
  role: UserRole;
  permissions: string[];
  inherited?: string[];
}

// ============================================
// USER FILTER TYPES
// ============================================

export interface UserFilters {
  role?: UserRole | string;
  isActive?: boolean;
  businessUnitId?: string;
  companyId?: string;
  search?: string;
  createdAfter?: string;
  createdBefore?: string;
  lastLoginAfter?: string;
  lastLoginBefore?: string;
  hasPermissions?: string[];
  minOrders?: number;
  maxOrders?: number;
  minSales?: number;
  maxSales?: number;
}

// ============================================
// USER SORT OPTIONS
// ============================================

export interface UserSortOptions {
  field: 'firstName' | 'lastName' | 'email' | 'role' | 'createdAt' | 'updatedAt' | 'lastLoginAt' | 'isActive';
  direction: 'asc' | 'desc';
}

// ============================================
// USER FORM TYPES
// ============================================

export interface UserFormData {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  role: UserRole;
  password: string;
  businessUnitId: string;
  isActive: boolean;
  companyId?: string;
  permissions?: string[];
}

// ============================================
// USER LIST ITEM (COMPACT)
// ============================================

export interface UserListItem {
  id: string;
  clerkId: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  permissions?: string[];
  businessUnitCount: number;
  groupCount?: number;
  activityCount?: number;
}

// ============================================
// USER DETAIL (FULL)
// ============================================

export interface UserDetail extends User {
  fullName: string;
  businessUnitCount: number;
  salesCount: number;
  ordersCount: number;
  purchaseOrderCount: number;
  permissions: string[];
  recentActivity?: UserActivity[];
  groups?: UserGroup[];
  auditTrail?: AuditTrailEntry[];
}

// ============================================
// USER STATS EXTENDED
// ============================================

export interface UserStatsExtended extends UserStats {
  byBusinessUnit: {
    businessUnitId: string;
    businessUnitName: string;
    count: number;
    active: number;
    inactive: number;
  }[];
  byPermission: {
    permission: string;
    count: number;
  }[];
  growthHistory: {
    date: string;
    total: number;
    newUsers: number;
  }[];
}

// ============================================
// USER SETTINGS TYPES
// ============================================

export interface UserSettings {
  // Default User Settings
  defaultRole: UserRole;
  defaultBusinessUnitId: string;
  defaultCompanyId: string;
  defaultPermissions: string[];
  autoActivateUsers: boolean;
  sendWelcomeEmail: boolean;
  requireEmailVerification: boolean;
  
  // Password Policies
  minPasswordLength: number;
  maxPasswordLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialCharacters: boolean;
  passwordExpiryDays: number;
  preventPasswordReuse: number;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
  
  // Session Settings
  sessionTimeoutMinutes: number;
  maxConcurrentSessions: number;
  rememberMeEnabled: boolean;
  rememberMeDurationDays: number;
  forceLogoutOnPasswordChange: boolean;
  trackLoginHistory: boolean;
  
  // Login Restrictions
  allowedIPAddresses: string[];
  blockedIPAddresses: string[];
  allowedDomains: string[];
  blockedDomains: string[];
  requireTwoFactor: boolean;
  twoFactorMethods: string[];
  loginAlertsEnabled: boolean;
  loginAlertEmail: string;
  restrictLoginTimes: boolean;
  allowedLoginStartTime: string;
  allowedLoginEndTime: string;
  restrictLoginDays: boolean;
  allowedLoginDays: string[];
  
  // Notification Settings
  emailNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
  notificationEmail: string;
  
  // Security Settings
  enableCaptcha: boolean;
  enableRateLimiting: boolean;
  rateLimitRequests: number;
  rateLimitWindowMinutes: number;
  enableAuditLogging: boolean;
  auditLogRetentionDays: number;
}
