// D:\Projects\Kalwanga\packages\web\components\users\UserForm.tsx

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../types/permissions';
import { UserRole } from '../../types/enums';
import { userService } from '../../services/userService';
import { userManagementService } from '../../services/userManagementService';
import { businessUnitService } from '../../services/businessUnitService';
import { userGroupService } from '../../services/userGroupService';
import { toast } from 'react-hot-toast';
import { 
  Save, User, Mail, Phone, Shield, Building, 
  Lock, Eye, EyeOff, Loader2, AlertCircle,
  CheckCircle, XCircle, ArrowLeft, Key, Plus, X,
  Search, ChevronDown, ChevronUp, Info, Settings,
  Users, Briefcase, CreditCard, BarChart3, Package,
  FolderTree, FileText, DollarSign, ShoppingCart,
  ClipboardList, Truck, Boxes, Layers, Store,
  Globe, Hash, Copy, Check, AlertTriangle, Sparkles,
  UserPlus, UserCheck, UserX, UsersRound, Network,
  GitBranch, GitMerge, FolderOpen, FolderClosed,
  FolderPlus, Star, Heart, ThumbsUp, MessageSquare,
  Share2, Bookmark, Tag, Tags, Grid, Layout,
  LayoutGrid, LayoutList, Columns, Rows, Circle
} from 'lucide-react';

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
  groupIds?: string[];
}

interface UserFormProps {
  userId?: string;
  initialData?: Partial<UserFormData>;
  onSuccess?: (user?: any) => void;
  onCancel?: () => void;
  onError?: (error: string) => void;
  onSubmittingChange?: (isSubmitting: boolean) => void;
  availableRoles?: { value: string; label: string; description: string; icon?: React.ReactNode }[];
}

interface BusinessUnit {
  id: string;
  name: string;
  code: string;
  isActive?: boolean;
}

interface UserGroupOption {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  memberCount?: number;
}

// Pre-defined permission groups for quick selection
const PERMISSION_GROUPS = {
  USER_MANAGEMENT: {
    label: '👥 User Management',
    permissions: [
      'user:view', 'user:create', 'user:edit', 'user:delete', 'user:manage',
      'user:activate', 'user:deactivate', 'user:role:update', 'user:permission:update',
      'user:bulk:activate', 'user:bulk:deactivate', 'user:bulk:delete', 'user:export'
    ],
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    icon: <Users className="w-4 h-4" />
  },
  INVENTORY: {
    label: '📦 Inventory',
    permissions: [
      'inventory:view', 'inventory:create', 'inventory:edit', 'inventory:delete', 'inventory:manage',
      'inventory:view_low_stock', 'inventory:view_reports', 'inventory:view_audit',
      'inventory:export', 'inventory:import', 'inventory:issue', 'inventory:restock',
      'inventory:adjust', 'inventory:transfer', 'inventory:approve_transfers'
    ],
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    icon: <Boxes className="w-4 h-4" />
  },
  PRODUCTS: {
    label: '📱 Products',
    permissions: [
      'product:view', 'product:create', 'product:edit', 'product:delete', 'product:manage',
      'product:export', 'product:import'
    ],
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    icon: <Package className="w-4 h-4" />
  },
  CATEGORIES: {
    label: '📂 Categories',
    permissions: [
      'category:view', 'category:create', 'category:edit', 'category:delete', 'category:manage'
    ],
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    icon: <FolderTree className="w-4 h-4" />
  },
  REPORTS: {
    label: '📊 Reports',
    permissions: [
      'report:view', 'report:create', 'report:export', 'report:manage'
    ],
    color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
    icon: <BarChart3 className="w-4 h-4" />
  },
  SALES: {
    label: '💰 Sales',
    permissions: [
      'sale:view', 'sale:create', 'sale:edit', 'sale:delete', 'sale:manage',
      'sale:export', 'sale:print', 'sale:email'
    ],
    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    icon: <ShoppingCart className="w-4 h-4" />
  },
  POS: {
    label: '🖥️ POS',
    permissions: [
      'pos:view', 'pos:create', 'pos:manage', 'pos:print'
    ],
    color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
    icon: <CreditCard className="w-4 h-4" />
  },
  CASH_REGISTER: {
    label: '💵 Cash Register',
    permissions: [
      'cash_register:view', 'cash_register:manage', 'cash_register:open', 'cash_register:close'
    ],
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    icon: <DollarSign className="w-4 h-4" />
  },
  SHIFTS: {
    label: '🔄 Shifts',
    permissions: [
      'shift:view', 'shift:manage', 'shift:start', 'shift:end'
    ],
    color: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
    icon: <ClipboardList className="w-4 h-4" />
  },
  RETURNS: {
    label: '↩️ Returns',
    permissions: [
      'return:view', 'return:create', 'return:edit', 'return:delete', 'return:manage',
      'return:approve', 'return:reject', 'return:process'
    ],
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    icon: <Truck className="w-4 h-4" />
  },
  REFUNDS: {
    label: '💸 Refunds',
    permissions: [
      'refund:view', 'refund:create', 'refund:edit', 'refund:delete', 'refund:manage',
      'refund:approve', 'refund:reject', 'refund:complete'
    ],
    color: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
    icon: <DollarSign className="w-4 h-4" />
  },
  INVOICES: {
    label: '📄 Invoices',
    permissions: [
      'invoice:view', 'invoice:create', 'invoice:edit', 'invoice:delete', 'invoice:manage',
      'invoice:send', 'invoice:print', 'invoice:paid', 'invoice:void', 'invoice:cancel'
    ],
    color: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
    icon: <FileText className="w-4 h-4" />
  },
  RECEIPTS: {
    label: '🧾 Receipts',
    permissions: [
      'receipt:view', 'receipt:create', 'receipt:edit', 'receipt:delete', 'receipt:manage',
      'receipt:print', 'receipt:email', 'receipt:void'
    ],
    color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
    icon: <FileText className="w-4 h-4" />
  },
  PAYMENTS: {
    label: '💳 Payments',
    permissions: [
      'payment:view', 'payment:create', 'payment:manage', 'payment:refund'
    ],
    color: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
    icon: <CreditCard className="w-4 h-4" />
  },
  DASHBOARD: {
    label: '📈 Dashboard',
    permissions: [
      'dashboard:view', 'dashboard:manage'
    ],
    color: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400',
    icon: <BarChart3 className="w-4 h-4" />
  },
  SYSTEM: {
    label: '⚙️ System',
    permissions: [
      'system:logs', 'system:backup', 'system:restore', 'system:settings'
    ],
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-400',
    icon: <Settings className="w-4 h-4" />
  },
  BUSINESS_UNITS: {
    label: '🏢 Business Units',
    permissions: [
      'business_unit:view', 'business_unit:create', 'business_unit:edit', 
      'business_unit:delete', 'business_unit:manage'
    ],
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    icon: <Store className="w-4 h-4" />
  },
  INTEGRATIONS: {
    label: '🔗 Integrations',
    permissions: [
      'integration:view', 'integration:manage', 'api:view', 'api:manage',
      'webhook:view', 'webhook:manage'
    ],
    color: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-400',
    icon: <Globe className="w-4 h-4" />
  }
};

export function UserForm({ 
  userId, 
  initialData, 
  onSuccess, 
  onCancel,
  onError,
  onSubmittingChange,
  availableRoles
}: UserFormProps) {
  const router = useRouter();
  const { can, isSuperAdmin, isAdmin } = useAuth();
  const isEdit = !!userId;

  const [formData, setFormData] = useState<UserFormData>({
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    email: initialData?.email || '',
    phoneNumber: initialData?.phoneNumber || '',
    role: initialData?.role || UserRole.USER,
    password: '',
    businessUnitId: initialData?.businessUnitId || '',
    isActive: initialData?.isActive !== undefined ? initialData.isActive : true,
    companyId: initialData?.companyId || '',
    permissions: initialData?.permissions || [],
    groupIds: initialData?.groupIds || [],
  });
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [userGroups, setUserGroups] = useState<UserGroupOption[]>([]);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [customPermission, setCustomPermission] = useState('');
  const [showPermissionManager, setShowPermissionManager] = useState(false);
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [permissionSearch, setPermissionSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [showAllPermissions, setShowAllPermissions] = useState(false);

  const canManagePermissions = isSuperAdmin || isAdmin || can(PERMISSIONS.USER_MANAGE);
  const canManageGroups = isSuperAdmin || isAdmin || can(PERMISSIONS.USER_MANAGE);

  // Default role options if not provided
  const defaultRoleOptions = useMemo(() => [
    { value: 'SUPER_ADMIN', label: 'Super Admin', description: 'Full system access with all permissions' },
    { value: 'ADMIN', label: 'Admin', description: 'Administrative access with user management' },
    { value: 'MANAGER', label: 'Manager', description: 'Manage business units and teams' },
    { value: 'EDITOR', label: 'Editor', description: 'Create and edit content and inventory' },
    { value: 'VIEWER', label: 'Viewer', description: 'View-only access to reports and data' },
    { value: 'EMPLOYEE', label: 'Employee', description: 'Basic employee access' },
    { value: 'CASHIER', label: 'Cashier', description: 'Point of sale and transaction access' },
    { value: 'USER', label: 'User', description: 'Basic user access' },
  ], []);

  const roleOptions = availableRoles || defaultRoleOptions;

  // Load business units
  const loadBusinessUnits = useCallback(async () => {
    try {
      const response = await businessUnitService.getAllBusinessUnits();
      
      if (response && Array.isArray(response)) {
        setBusinessUnits(response);
      } else if (response?.data && Array.isArray(response.data)) {
        setBusinessUnits(response.data);
      }
    } catch (error) {
      console.error('Failed to load business units:', error);
      // Use mock data as fallback
      setBusinessUnits([
        { id: '1', name: 'Headquarters', code: 'HQ', isActive: true },
        { id: '2', name: 'Branch 1', code: 'BR1', isActive: true },
        { id: '3', name: 'Branch 2', code: 'BR2', isActive: true },
        { id: '4', name: 'Warehouse', code: 'WH', isActive: true },
      ]);
    }
  }, []);

  // Load user groups
  const loadUserGroups = useCallback(async () => {
    try {
      const response = await userGroupService.getGroups({ limit: 100, isActive: true });
      
      if (response?.data && Array.isArray(response.data)) {
        setUserGroups(response.data.map((group: any) => ({
          id: group.id,
          name: group.name,
          description: group.description,
          color: group.color,
          icon: group.icon,
          memberCount: group.memberCount || group._count?.members || 0,
        })));
      }
    } catch (error) {
      console.error('Failed to load user groups:', error);
      setUserGroups([]);
    }
  }, []);

  // Load user data for edit
  const loadUser = useCallback(async () => {
    try {
      setLoading(true);
      const user = await userService.getUserById(userId!);
      setFormData({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber || '',
        role: user.role as UserRole,
        password: '',
        businessUnitId: user.businessUnits?.[0]?.businessUnitId || '',
        isActive: user.isActive,
        companyId: user.companyId || '',
        permissions: user.permissions || [],
        groupIds: user.groupMemberships?.map((gm: any) => gm.groupId) || [],
      });
      if (user.permissions && user.permissions.length > 0) {
        setShowPermissionManager(true);
      }
      if (user.groupMemberships && user.groupMemberships.length > 0) {
        setShowGroupManager(true);
      }
    } catch (error: any) {
      console.error('Failed to load user:', error);
      setSubmitError(error?.message || 'Failed to load user data');
      toast.error('Failed to load user data');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Initial load
  useEffect(() => {
    loadBusinessUnits();
    loadUserGroups();
    if (isEdit && !initialData) {
      loadUser();
    }
  }, [userId, isEdit, initialData, loadBusinessUnits, loadUserGroups, loadUser]);

  // Handle form field changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
    setTouched(prev => ({ ...prev, [name]: true }));
    
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
    
    if (submitError) {
      setSubmitError(null);
    }
  };

  // Toggle permission
  const togglePermission = useCallback((permission: string) => {
    setFormData(prev => {
      const currentPermissions = prev.permissions || [];
      if (currentPermissions.includes(permission)) {
        return {
          ...prev,
          permissions: currentPermissions.filter(p => p !== permission)
        };
      } else {
        return {
          ...prev,
          permissions: [...currentPermissions, permission]
        };
      }
    });
  }, []);

  // Toggle group assignment
  const toggleGroup = useCallback((groupId: string) => {
    setFormData(prev => {
      const currentGroups = prev.groupIds || [];
      if (currentGroups.includes(groupId)) {
        return {
          ...prev,
          groupIds: currentGroups.filter(g => g !== groupId)
        };
      } else {
        return {
          ...prev,
          groupIds: [...currentGroups, groupId]
        };
      }
    });
  }, []);

  // Add custom permission
  const addCustomPermission = useCallback(() => {
    const permission = customPermission.trim().toLowerCase();
    if (!permission) return;
    
    if (!permission.includes(':')) {
      toast.error('Permission must be in format "resource:action"');
      return;
    }
    
    const [resource, action] = permission.split(':');
    if (!resource || !action) {
      toast.error('Invalid permission format. Use "resource:action"');
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      permissions: [...(prev.permissions || []), permission]
    }));
    setCustomPermission('');
    toast.success(`Added permission: ${permission}`);
  }, [customPermission]);

  // Remove custom permission
  const removePermission = useCallback((permission: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: (prev.permissions || []).filter(p => p !== permission)
    }));
  }, []);

  // Apply permission group
  const applyPermissionGroup = useCallback((groupKey: string) => {
    const group = PERMISSION_GROUPS[groupKey as keyof typeof PERMISSION_GROUPS];
    if (!group) return;
    
    setFormData(prev => {
      const currentPermissions = prev.permissions || [];
      const allAssigned = group.permissions.every(p => currentPermissions.includes(p));
      
      if (allAssigned) {
        return {
          ...prev,
          permissions: currentPermissions.filter(p => !group.permissions.includes(p))
        };
      } else {
        const newPermissions = new Set([...currentPermissions, ...group.permissions]);
        return {
          ...prev,
          permissions: Array.from(newPermissions)
        };
      }
    });
    
    setSelectedGroup(groupKey);
    toast.success(`Toggled ${group.label} permissions`);
  }, []);

  // Clear all permissions
  const clearPermissions = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      permissions: []
    }));
    toast.success('All permissions cleared');
  }, []);

  // Clear all groups
  const clearGroups = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      groupIds: []
    }));
    toast.success('All groups cleared');
  }, []);

  // Validate form
  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    } else if (formData.firstName.trim().length < 2) {
      newErrors.firstName = 'First name must be at least 2 characters';
    }
    
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    } else if (formData.lastName.trim().length < 2) {
      newErrors.lastName = 'Last name must be at least 2 characters';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email address format';
    }
    
    if (!isEdit && !formData.password) {
      newErrors.password = 'Password is required';
    } else if (!isEdit && formData.password && formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (isEdit && formData.password && formData.password.length > 0 && formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    
    if (!formData.role) {
      newErrors.role = 'Role is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, isEdit]);

  /**
   * ✅ FIXED: Handle form submission
   * - For NEW users: Use userManagementService.createUser()
   *   - This handles clerkId generation automatically
   *   - Routes data to correct endpoints (users, permissions, business units, groups, invitations, activities)
   * - For EDIT: Use userService.updateUser()
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);
    
    if (!validate()) {
      const firstError = Object.values(errors)[0];
      toast.error(firstError || 'Please fix the validation errors');
      return;
    }

    setSaving(true);
    onSubmittingChange?.(true);

    try {
      let result;

      if (isEdit) {
        // ✅ EDIT: Use userService.updateUser for updates
        const updateData: any = {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim().toLowerCase(),
          phoneNumber: formData.phoneNumber?.trim() || undefined,
          role: formData.role,
          isActive: formData.isActive,
        };

        if (formData.password) {
          updateData.password = formData.password;
        }

        if (canManagePermissions) {
          updateData.permissions = formData.permissions || [];
        }

        result = await userService.updateUser(userId!, updateData);
        
        // Update groups if managed separately
        if (canManageGroups && formData.groupIds && formData.groupIds.length > 0) {
          try {
            await userGroupService.assignUsersToGroup(result.id, formData.groupIds);
          } catch (groupError) {
            console.warn('Failed to assign groups:', groupError);
          }
        }

        setSuccessMessage('User updated successfully!');
        toast.success('User updated successfully!');

      } else {
        // ✅ CREATE: Use userManagementService.createUser
        // This handles:
        // - clerkId generation (required by Prisma)
        // - Permission assignment
        // - Business unit assignment
        // - Group assignment
        // - Activity logging
        const createResult = await userManagementService.createUser({
          email: formData.email.trim().toLowerCase(),
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          phoneNumber: formData.phoneNumber?.trim() || '',
          role: formData.role,
          password: formData.password,
          isActive: formData.isActive,
          permissions: canManagePermissions ? formData.permissions || [] : [],
          businessUnitId: formData.businessUnitId || undefined,
          groupId: formData.groupIds && formData.groupIds.length > 0 ? formData.groupIds[0] : undefined,
          sendInvitation: false,
        });

        result = createResult.user;
        setSuccessMessage('User created successfully!');
        toast.success('User created successfully!');
      }

      console.log('✅ User saved:', result);

      setTimeout(() => {
        onSuccess?.(result);
      }, 500);

    } catch (error: any) {
      console.error('❌ Failed to save user:', error);
      
      let errorMessage = 'Failed to save user. Please try again.';
      
      if (error?.response?.data?.errors) {
        const fieldErrors: Record<string, string> = {};
        error.response.data.errors.forEach((err: any) => {
          fieldErrors[err.field] = err.message;
        });
        setErrors(fieldErrors);
        errorMessage = 'Please fix the validation errors below.';
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      setSubmitError(errorMessage);
      onError?.(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSaving(false);
      onSubmittingChange?.(false);
    }
  };

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (saving) return;
    if (onCancel) {
      onCancel();
    } else {
      router.push('/admin/users');
    }
  }, [saving, onCancel, router]);

  // Get role description
  const getRoleDescription = useCallback((role: string) => {
    const roleOption = roleOptions.find(r => r.value === role);
    return roleOption?.description || 'User access';
  }, [roleOptions]);

  // Get role icon
  const getRoleIcon = useCallback((role: string) => {
    const roleOption = roleOptions.find(r => r.value === role);
    if (roleOption && 'icon' in roleOption && roleOption.icon) {
      return roleOption.icon;
    }
    return <Shield className="w-4 h-4" />;
  }, [roleOptions]);

  // Filter permissions based on search
  const filteredPermissionGroups = useMemo(() => {
    if (!permissionSearch) return Object.entries(PERMISSION_GROUPS);
    
    return Object.entries(PERMISSION_GROUPS).filter(([key, group]) => {
      const searchLower = permissionSearch.toLowerCase();
      return (
        group.label.toLowerCase().includes(searchLower) ||
        key.toLowerCase().includes(searchLower) ||
        group.permissions.some(p => p.toLowerCase().includes(searchLower))
      );
    });
  }, [permissionSearch]);

  // Filter groups based on search
  const filteredUserGroups = useMemo(() => {
    if (!groupSearch) return userGroups;
    
    return userGroups.filter(group => 
      group.name.toLowerCase().includes(groupSearch.toLowerCase()) ||
      group.description?.toLowerCase().includes(groupSearch.toLowerCase())
    );
  }, [userGroups, groupSearch]);

  // Get sorted permissions
  const sortedPermissions = useMemo(() => {
    return [...(formData.permissions || [])].sort((a, b) => a.localeCompare(b));
  }, [formData.permissions]);

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading user data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        type="button"
        onClick={handleCancel}
        disabled={saving}
        className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-50"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Users
      </button>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Form Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {isEdit ? 'Edit User' : 'Create New User'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {isEdit ? 'Update user information and permissions' : 'Add a new user to the system'}
            </p>
          </div>
          {isEdit && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Status:</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 border ${
                formData.isActive 
                  ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700'
                  : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700'
              }`}>
                {formData.isActive ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                {formData.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          )}
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            <span className="text-green-700 dark:text-green-300 text-sm flex-1">{successMessage}</span>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="p-1 hover:bg-green-100 dark:hover:bg-green-800 rounded transition-colors"
              aria-label="Dismiss"
            >
              <XCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </button>
          </div>
        )}

        {/* Error Summary */}
        {submitError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <span className="text-red-700 dark:text-red-300 text-sm flex-1">{submitError}</span>
            <button
              type="button"
              onClick={() => setSubmitError(null)}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-800 rounded transition-colors"
              aria-label="Dismiss error"
            >
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </button>
          </div>
        )}

        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <User className="w-4 h-4" />
            Basic Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                First Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="John"
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 ${
                    errors.firstName && touched.firstName ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  disabled={saving}
                />
              </div>
              {errors.firstName && touched.firstName && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.firstName}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Last Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Doe"
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 ${
                    errors.lastName && touched.lastName ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  disabled={saving} 
                />
              </div>
              {errors.lastName && touched.lastName && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.lastName}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Address <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="john.doe@example.com"
                className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 ${
                  errors.email && touched.email ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                disabled={saving}
              />
            </div>
            {errors.email && touched.email && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.email}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                placeholder="+1234567890"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                disabled={saving}
              />
            </div>
          </div>
        </div>

        {/* Role & Assignment */}
        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Role & Assignment
          </h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Role <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                  errors.role && touched.role ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                disabled={saving}
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Info className="w-3 h-3" />
              {getRoleDescription(formData.role)}
            </p>
            {errors.role && touched.role && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.role}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Business Unit
            </label>
            <div className="relative">
              <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                name="businessUnitId"
                value={formData.businessUnitId}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={saving}
              >
                <option value="">No Business Unit (Optional)</option>
                {businessUnits.map((bu) => (
                  <option key={bu.id} value={bu.id}>
                    {bu.name} ({bu.code})
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Business unit assignment is optional
            </p>
          </div>
        </div>

        {/* User Groups */}
        {canManageGroups && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <UsersRound className="w-4 h-4" />
                User Groups
                <span className="text-xs text-gray-400 font-normal">
                  ({formData.groupIds?.length || 0} assigned)
                </span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowGroupManager(!showGroupManager)}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
                >
                  {showGroupManager ? 'Hide Groups' : 'Manage Groups'}
                </button>
                {formData.groupIds && formData.groupIds.length > 0 && (
                  <button
                    type="button"
                    onClick={clearGroups}
                    className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 font-medium"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {showGroupManager && (
              <div className="space-y-4">
                {/* Group Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={groupSearch}
                    onChange={(e) => setGroupSearch(e.target.value)}
                    placeholder="Search groups..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  />
                </div>

                {/* Available Groups */}
                {filteredUserGroups.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {filteredUserGroups.map((group) => {
                      const isSelected = formData.groupIds?.includes(group.id);
                      
                      return (
                        <button
                          key={group.id}
                          type="button"
                          onClick={() => toggleGroup(group.id)}
                          className={`p-3 rounded-lg border transition-all text-left ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded-lg ${group.color || 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-400'}`}>
                                <UsersRound className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">{group.name}</p>
                                {group.description && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px]">
                                    {group.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            {isSelected ? (
                              <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            ) : (
                              <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                            )}
                          </div>
                          {group.memberCount !== undefined && (
                            <p className="text-xs text-gray-400 mt-1">
                              {group.memberCount} members
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    No groups available. Create groups first to assign users to them.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Password */}
        {!isEdit && (
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Security
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Minimum 8 characters"
                  className={`w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 ${
                    errors.password && touched.password ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  disabled={saving}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && touched.password && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.password}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Active Status (Edit only) */}
        {isEdit && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                disabled={saving}
              />
              <label className="text-sm text-gray-700 dark:text-gray-300">
                Active (user can access the system)
              </label>
            </div>
          </div>
        )}

        {/* Permissions Section */}
        {canManagePermissions && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Key className="w-4 h-4" />
                Permissions
                <span className="text-xs text-gray-400 font-normal">
                  ({formData.permissions?.length || 0} assigned)
                </span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPermissionManager(!showPermissionManager)}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
                >
                  {showPermissionManager ? 'Hide Permissions' : 'Manage Permissions'}
                </button>
                {formData.permissions && formData.permissions.length > 0 && (
                  <button
                    type="button"
                    onClick={clearPermissions}
                    className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 font-medium"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {showPermissionManager && (
              <div className="space-y-4">
                {/* Permission Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={permissionSearch}
                    onChange={(e) => setPermissionSearch(e.target.value)}
                    placeholder="Search permissions..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  />
                </div>

                {/* Quick Permission Groups */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Quick Permission Groups
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {filteredPermissionGroups.map(([key, group]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => applyPermissionGroup(key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${group.color} hover:opacity-80 flex items-center gap-1`}
                        title={`Toggle ${group.label} permissions`}
                      >
                        {group.icon}
                        {group.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Permission Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Add Custom Permission
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customPermission}
                      onChange={(e) => setCustomPermission(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addCustomPermission();
                        }
                      }}
                      placeholder="e.g., user:view"
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    />
                    <button
                      type="button"
                      onClick={addCustomPermission}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Format: resource:action (e.g., user:view, inventory:manage)
                  </p>
                </div>

                {/* Current Permissions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Assigned Permissions
                  </label>
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 border border-gray-200 dark:border-gray-700 rounded-lg">
                    {sortedPermissions.length > 0 ? (
                      sortedPermissions.map((permission) => (
                        <span
                          key={permission}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-medium border border-blue-200 dark:border-blue-800/30"
                        >
                          {permission}
                          <button
                            type="button"
                            onClick={() => removePermission(permission)}
                            className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            aria-label={`Remove ${permission}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-400 dark:text-gray-500">
                        No permissions assigned. Use the quick groups above or add custom permissions.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isEdit ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isEdit ? 'Update User' : 'Create User'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default UserForm;
