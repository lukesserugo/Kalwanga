// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\users\[id]\permissions\page.tsx

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../../../../hooks/useAuth';
import { userService } from '../../../../../../services/userService';
import { toast } from 'react-hot-toast';
import {
  ArrowLeft, Shield, Key, Lock, Unlock, Search, Filter,
  Loader2, AlertCircle, CheckCircle, XCircle, Save,
  RefreshCw, Copy, Check, X, Info, AlertTriangle,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Eye, EyeOff, Settings, Users, User, Building,
  Package, FolderTree, FileText, DollarSign, ShoppingCart,
  ClipboardList, Truck, Boxes, Layers, Store, Globe,
  Hash, Tag, Star, Heart, ThumbsUp, MessageSquare,
  Share2, Bookmark, FileDown, FileJson, Download,
  MoreVertical, SlidersHorizontal, BarChart3, TrendingUp,
  PieChart, Activity, Calendar, Clock, Mail, Phone,
  Database, Server, Cloud, Wifi, Bluetooth, Battery,
  Sun, Moon, Wind, Droplet, Flame, Leaf, TreePine,
  Mountain, Waves, Compass, Map, Navigation, Route,
  Target, Crosshair, CreditCard, Percent, Printer, Send,
  Link2, Unlink, Plus, Minus, RotateCcw, History, Zap,
  Sparkles, Trash2, Edit, UserCog, BadgeCheck, Ban,
  ShieldCheck, ShieldAlert, ShieldX, UserCog2,
  UsersRound, Network, GitBranch, GitMerge, FolderOpen,
  FolderClosed, FolderPlus, Tag as TagIcon, Tags
} from 'lucide-react';
import { PERMISSIONS } from '../../../../../../types/permissions';
import { UserRole } from '../../../../../../types/enums';

// Permission resource definitions
interface PermissionResource {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  permissions: PermissionDefinition[];
}

interface PermissionDefinition {
  id: string;
  label: string;
  description: string;
  action: string;
  resource: string;
  category: string;
  isDefault?: boolean;
  isCustom?: boolean;
}

interface RoleTemplate {
  role: UserRole;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  permissions: string[];
}

interface PermissionSet {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isCustom?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Stats Card Component
const StatsCard = ({ title, value, icon, color, subtitle }: any) => (
  <div className="card-brand p-4 hover:shadow-card-hover transition-shadow">
    <div className="flex items-center justify-between">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{title}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-lg ${color} flex-shrink-0`}>
        {icon}
      </div>
    </div>
  </div>
);

// Define all permission resources
const PERMISSION_RESOURCES: PermissionResource[] = [
  {
    id: 'user',
    label: 'User Management',
    description: 'Manage users, roles, and permissions',
    icon: <Users className="w-5 h-5" />,
    color: 'bg-secondary-100 text-secondary-800 dark:bg-secondary-900/30 dark:text-secondary-400',
    permissions: [
      { id: 'user:view', label: 'View Users', description: 'View user list and details', action: 'view', resource: 'user', category: 'user' },
      { id: 'user:create', label: 'Create Users', description: 'Create new user accounts', action: 'create', resource: 'user', category: 'user' },
      { id: 'user:edit', label: 'Edit Users', description: 'Edit user information', action: 'edit', resource: 'user', category: 'user' },
      { id: 'user:delete', label: 'Delete Users', description: 'Delete user accounts', action: 'delete', resource: 'user', category: 'user' },
      { id: 'user:manage', label: 'Manage Users', description: 'Full user management access', action: 'manage', resource: 'user', category: 'user' },
      { id: 'user:activate', label: 'Activate Users', description: 'Activate user accounts', action: 'activate', resource: 'user', category: 'user' },
      { id: 'user:deactivate', label: 'Deactivate Users', description: 'Deactivate user accounts', action: 'deactivate', resource: 'user', category: 'user' },
      { id: 'user:role:update', label: 'Update Roles', description: 'Change user roles', action: 'update', resource: 'user:role', category: 'user' },
      { id: 'user:permission:update', label: 'Update Permissions', description: 'Modify user permissions', action: 'update', resource: 'user:permission', category: 'user' },
      { id: 'user:export', label: 'Export Users', description: 'Export user data', action: 'export', resource: 'user', category: 'user' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory Management',
    description: 'Manage inventory and stock',
    icon: <Boxes className="w-5 h-5" />,
    color: 'bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-400',
    permissions: [
      { id: 'inventory:view', label: 'View Inventory', description: 'View inventory items', action: 'view', resource: 'inventory', category: 'inventory' },
      { id: 'inventory:create', label: 'Create Items', description: 'Add new inventory items', action: 'create', resource: 'inventory', category: 'inventory' },
      { id: 'inventory:edit', label: 'Edit Items', description: 'Edit inventory items', action: 'edit', resource: 'inventory', category: 'inventory' },
      { id: 'inventory:delete', label: 'Delete Items', description: 'Delete inventory items', action: 'delete', resource: 'inventory', category: 'inventory' },
      { id: 'inventory:manage', label: 'Manage Inventory', description: 'Full inventory management', action: 'manage', resource: 'inventory', category: 'inventory' },
      { id: 'inventory:view_low_stock', label: 'View Low Stock', description: 'View low stock alerts', action: 'view_low_stock', resource: 'inventory', category: 'inventory' },
      { id: 'inventory:view_reports', label: 'View Reports', description: 'View inventory reports', action: 'view_reports', resource: 'inventory', category: 'inventory' },
      { id: 'inventory:export', label: 'Export Inventory', description: 'Export inventory data', action: 'export', resource: 'inventory', category: 'inventory' },
      { id: 'inventory:import', label: 'Import Inventory', description: 'Import inventory data', action: 'import', resource: 'inventory', category: 'inventory' },
      { id: 'inventory:adjust', label: 'Adjust Stock', description: 'Adjust inventory levels', action: 'adjust', resource: 'inventory', category: 'inventory' },
      { id: 'inventory:transfer', label: 'Transfer Stock', description: 'Transfer between locations', action: 'transfer', resource: 'inventory', category: 'inventory' },
    ],
  },
  {
    id: 'product',
    label: 'Product Management',
    description: 'Manage products and catalog',
    icon: <Package className="w-5 h-5" />,
    color: 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-400',
    permissions: [
      { id: 'product:view', label: 'View Products', description: 'View product list', action: 'view', resource: 'product', category: 'product' },
      { id: 'product:create', label: 'Create Products', description: 'Add new products', action: 'create', resource: 'product', category: 'product' },
      { id: 'product:edit', label: 'Edit Products', description: 'Edit product details', action: 'edit', resource: 'product', category: 'product' },
      { id: 'product:delete', label: 'Delete Products', description: 'Delete products', action: 'delete', resource: 'product', category: 'product' },
      { id: 'product:manage', label: 'Manage Products', description: 'Full product management', action: 'manage', resource: 'product', category: 'product' },
      { id: 'product:export', label: 'Export Products', description: 'Export product data', action: 'export', resource: 'product', category: 'product' },
      { id: 'product:import', label: 'Import Products', description: 'Import product data', action: 'import', resource: 'product', category: 'product' },
    ],
  },
  {
    id: 'category',
    label: 'Category Management',
    description: 'Manage product categories',
    icon: <FolderTree className="w-5 h-5" />,
    color: 'bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-400',
    permissions: [
      { id: 'category:view', label: 'View Categories', description: 'View category list', action: 'view', resource: 'category', category: 'category' },
      { id: 'category:create', label: 'Create Categories', description: 'Add new categories', action: 'create', resource: 'category', category: 'category' },
      { id: 'category:edit', label: 'Edit Categories', description: 'Edit category details', action: 'edit', resource: 'category', category: 'category' },
      { id: 'category:delete', label: 'Delete Categories', description: 'Delete categories', action: 'delete', resource: 'category', category: 'category' },
      { id: 'category:manage', label: 'Manage Categories', description: 'Full category management', action: 'manage', resource: 'category', category: 'category' },
    ],
  },
  {
    id: 'report',
    label: 'Reports',
    description: 'Access and generate reports',
    icon: <BarChart3 className="w-5 h-5" />,
    color: 'bg-brand-accent-100 text-brand-accent-800 dark:bg-brand-accent-900/30 dark:text-brand-accent-400',
    permissions: [
      { id: 'report:view', label: 'View Reports', description: 'View report list', action: 'view', resource: 'report', category: 'report' },
      { id: 'report:create', label: 'Create Reports', description: 'Generate new reports', action: 'create', resource: 'report', category: 'report' },
      { id: 'report:export', label: 'Export Reports', description: 'Export report data', action: 'export', resource: 'report', category: 'report' },
      { id: 'report:manage', label: 'Manage Reports', description: 'Full report management', action: 'manage', resource: 'report', category: 'report' },
    ],
  },
  {
    id: 'sale',
    label: 'Sales',
    description: 'Manage sales and transactions',
    icon: <ShoppingCart className="w-5 h-5" />,
    color: 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-400',
    permissions: [
      { id: 'sale:view', label: 'View Sales', description: 'View sale records', action: 'view', resource: 'sale', category: 'sale' },
      { id: 'sale:create', label: 'Create Sales', description: 'Process new sales', action: 'create', resource: 'sale', category: 'sale' },
      { id: 'sale:edit', label: 'Edit Sales', description: 'Edit sale records', action: 'edit', resource: 'sale', category: 'sale' },
      { id: 'sale:delete', label: 'Delete Sales', description: 'Delete sale records', action: 'delete', resource: 'sale', category: 'sale' },
      { id: 'sale:manage', label: 'Manage Sales', description: 'Full sales management', action: 'manage', resource: 'sale', category: 'sale' },
      { id: 'sale:export', label: 'Export Sales', description: 'Export sales data', action: 'export', resource: 'sale', category: 'sale' },
      { id: 'sale:print', label: 'Print Receipts', description: 'Print sale receipts', action: 'print', resource: 'sale', category: 'sale' },
    ],
  },
  {
    id: 'pos',
    label: 'Point of Sale',
    description: 'POS system access',
    icon: <CreditCard className="w-5 h-5" />,
    color: 'bg-brand-accent-100 text-brand-accent-800 dark:bg-brand-accent-900/30 dark:text-brand-accent-400',
    permissions: [
      { id: 'pos:view', label: 'View POS', description: 'Access POS interface', action: 'view', resource: 'pos', category: 'pos' },
      { id: 'pos:create', label: 'Process Transactions', description: 'Process POS transactions', action: 'create', resource: 'pos', category: 'pos' },
      { id: 'pos:manage', label: 'Manage POS', description: 'Full POS management', action: 'manage', resource: 'pos', category: 'pos' },
      { id: 'pos:print', label: 'Print Receipts', description: 'Print POS receipts', action: 'print', resource: 'pos', category: 'pos' },
    ],
  },
  {
    id: 'business_unit',
    label: 'Business Units',
    description: 'Manage business units',
    icon: <Store className="w-5 h-5" />,
    color: 'bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-400',
    permissions: [
      { id: 'business_unit:view', label: 'View Units', description: 'View business units', action: 'view', resource: 'business_unit', category: 'business_unit' },
      { id: 'business_unit:create', label: 'Create Units', description: 'Create business units', action: 'create', resource: 'business_unit', category: 'business_unit' },
      { id: 'business_unit:edit', label: 'Edit Units', description: 'Edit business units', action: 'edit', resource: 'business_unit', category: 'business_unit' },
      { id: 'business_unit:delete', label: 'Delete Units', description: 'Delete business units', action: 'delete', resource: 'business_unit', category: 'business_unit' },
      { id: 'business_unit:manage', label: 'Manage Units', description: 'Full unit management', action: 'manage', resource: 'business_unit', category: 'business_unit' },
    ],
  },
  {
    id: 'system',
    label: 'System Settings',
    description: 'System configuration access',
    icon: <Settings className="w-5 h-5" />,
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-400',
    permissions: [
      { id: 'system:logs', label: 'View Logs', description: 'View system logs', action: 'logs', resource: 'system', category: 'system' },
      { id: 'system:backup', label: 'Backup System', description: 'Create system backups', action: 'backup', resource: 'system', category: 'system' },
      { id: 'system:restore', label: 'Restore System', description: 'Restore from backup', action: 'restore', resource: 'system', category: 'system' },
      { id: 'system:settings', label: 'System Settings', description: 'Manage system settings', action: 'settings', resource: 'system', category: 'system' },
    ],
  },
];

// Role templates
const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    role: UserRole.SUPER_ADMIN,
    label: 'Super Admin',
    description: 'Full system access with all permissions',
    icon: <Shield className="w-5 h-5" />,
    color: 'bg-secondary-100 text-secondary-800 dark:bg-secondary-900/30 dark:text-secondary-400',
    permissions: PERMISSION_RESOURCES.flatMap(r => r.permissions.map(p => p.id)),
  },
  {
    role: UserRole.ADMIN,
    label: 'Admin',
    description: 'Administrative access with user management',
    icon: <Shield className="w-5 h-5" />,
    color: 'bg-danger-100 text-danger-800 dark:bg-danger-900/30 dark:text-danger-400',
    permissions: [
      'user:view', 'user:create', 'user:edit', 'user:delete', 'user:manage',
      'user:activate', 'user:deactivate', 'user:role:update', 'user:permission:update',
      'inventory:view', 'inventory:create', 'inventory:edit', 'inventory:delete',
      'inventory:view_low_stock', 'inventory:view_reports',
      'product:view', 'product:create', 'product:edit', 'product:delete',
      'category:view', 'category:create', 'category:edit', 'category:delete',
      'report:view', 'report:create', 'report:export',
      'sale:view', 'sale:create', 'sale:edit', 'sale:export',
      'business_unit:view', 'business_unit:create', 'business_unit:edit',
    ],
  },
  {
    role: UserRole.MANAGER,
    label: 'Manager',
    description: 'Manage business units and teams',
    icon: <Users className="w-5 h-5" />,
    color: 'bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-400',
    permissions: [
      'user:view',
      'inventory:view', 'inventory:create', 'inventory:edit',
      'inventory:view_low_stock', 'inventory:view_reports',
      'product:view', 'product:create', 'product:edit',
      'category:view', 'category:create', 'category:edit',
      'report:view', 'report:create',
      'sale:view', 'sale:create', 'sale:edit',
      'business_unit:view', 'business_unit:create', 'business_unit:edit',
    ],
  },
  {
    role: UserRole.EDITOR,
    label: 'Editor',
    description: 'Create and edit content',
    icon: <Edit className="w-5 h-5" />,
    color: 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-400',
    permissions: [
      'inventory:view', 'inventory:create', 'inventory:edit',
      'inventory:view_low_stock',
      'product:view', 'product:create', 'product:edit',
      'category:view', 'category:create', 'category:edit',
      'report:view',
      'sale:view',
    ],
  },
  {
    role: UserRole.VIEWER,
    label: 'Viewer',
    description: 'View-only access',
    icon: <Eye className="w-5 h-5" />,
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-400',
    permissions: [
      'inventory:view', 'inventory:view_low_stock',
      'product:view',
      'category:view',
      'report:view',
      'sale:view',
    ],
  },
  {
    role: UserRole.EMPLOYEE,
    label: 'Employee',
    description: 'Basic employee access',
    icon: <User className="w-5 h-5" />,
    color: 'bg-brand-accent-100 text-brand-accent-800 dark:bg-brand-accent-900/30 dark:text-brand-accent-400',
    permissions: [
      'inventory:view', 'inventory:view_low_stock',
      'product:view',
      'category:view',
    ],
  },
  {
    role: UserRole.CASHIER,
    label: 'Cashier',
    description: 'POS and transaction access',
    icon: <CreditCard className="w-5 h-5" />,
    color: 'bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-400',
    permissions: [
      'pos:view', 'pos:create', 'pos:print',
      'sale:view', 'sale:create', 'sale:print',
      'product:view',
      'inventory:view',
    ],
  },
  {
    role: UserRole.USER,
    label: 'User',
    description: 'Basic user access',
    icon: <User className="w-5 h-5" />,
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-400',
    permissions: [
      'product:view',
      'inventory:view',
    ],
  },
];

export default function UserPermissionsPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params?.id as string;
  const { can, isSuperAdmin, isAdmin } = useAuth();

  // State management
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [originalPermissions, setOriginalPermissions] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResource, setSelectedResource] = useState<string>('all');
  const [expandedResources, setExpandedResources] = useState<Set<string>>(new Set(PERMISSION_RESOURCES.map(r => r.id)));
  const [showRoleTemplates, setShowRoleTemplates] = useState(false);
  const [showCustomPermissionModal, setShowCustomPermissionModal] = useState(false);
  const [customPermission, setCustomPermission] = useState({ resource: '', action: '' });
  const [customPermissionSets, setCustomPermissionSets] = useState<PermissionSet[]>([]);
  const [showPermissionSets, setShowPermissionSets] = useState(false);
  const [showInheritanceVisualization, setShowInheritanceVisualization] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [selectAll, setSelectAll] = useState(false);
  const [permissionStats, setPermissionStats] = useState({
    total: 0,
    selected: 0,
    inherited: 0,
    custom: 0,
  });

  const hasAccess = isSuperAdmin || isAdmin || can(PERMISSIONS.USER_MANAGE);

  // Load user data
  const loadUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const userData = await userService.getUserById(userId);
      setUser(userData);

      const permissions = userData.permissions || [];
      setSelectedPermissions(new Set(permissions));
      setOriginalPermissions(new Set(permissions));

      setPermissionStats(prev => ({
        ...prev,
        total: PERMISSION_RESOURCES.flatMap(r => r.permissions).length,
        selected: permissions.length,
        inherited: 0,
        custom: permissions.filter(p => !PERMISSION_RESOURCES.flatMap(r => r.permissions).some(rp => rp.id === p)).length,
      }));

      loadPermissionSets();
    } catch (error: any) {
      console.error('Failed to load user:', error);
      setError(error?.message || 'Failed to load user');
      toast.error('Failed to load user');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Load permission sets
  const loadPermissionSets = useCallback(async () => {
    try {
      const mockSets: PermissionSet[] = [
        {
          id: 'set_1',
          name: 'Standard Employee',
          description: 'Basic employee permissions',
          permissions: ['product:view', 'inventory:view', 'category:view'],
        },
        {
          id: 'set_2',
          name: 'Inventory Manager',
          description: 'Full inventory management access',
          permissions: ['inventory:view', 'inventory:create', 'inventory:edit', 'inventory:delete', 'inventory:manage'],
        },
        {
          id: 'set_3',
          name: 'Sales Team',
          description: 'Sales and POS permissions',
          permissions: ['sale:view', 'sale:create', 'sale:edit', 'pos:view', 'pos:create'],
        },
      ];
      setCustomPermissionSets(mockSets);
    } catch (error) {
      console.error('Failed to load permission sets:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (hasAccess && userId) {
      loadUser();
    }
  }, [hasAccess, userId, loadUser]);

  // Check for changes
  useEffect(() => {
    const hasChanges =
      selectedPermissions.size !== originalPermissions.size ||
      Array.from(selectedPermissions).some(p => !originalPermissions.has(p));
    setHasChanges(hasChanges);

    const totalPermissions = PERMISSION_RESOURCES.flatMap(r => r.permissions).length;
    const customPermissions = Array.from(selectedPermissions).filter(p =>
      !PERMISSION_RESOURCES.flatMap(r => r.permissions).some(rp => rp.id === p)
    ).length;

    setPermissionStats({
      total: totalPermissions + customPermissions,
      selected: selectedPermissions.size,
      inherited: 0,
      custom: customPermissions,
    });
  }, [selectedPermissions, originalPermissions]);

  // Handle permission toggle
  const handlePermissionToggle = useCallback((permissionId: string) => {
    setSelectedPermissions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(permissionId)) {
        newSet.delete(permissionId);
      } else {
        newSet.add(permissionId);
      }
      return newSet;
    });
  }, []);

  // Handle select all permissions in a resource
  const handleSelectAllInResource = useCallback((resourceId: string) => {
    const resource = PERMISSION_RESOURCES.find(r => r.id === resourceId);
    if (!resource) return;

    setSelectedPermissions(prev => {
      const newSet = new Set(prev);
      const allSelected = resource.permissions.every(p => newSet.has(p.id));

      resource.permissions.forEach(p => {
        if (allSelected) {
          newSet.delete(p.id);
        } else {
          newSet.add(p.id);
        }
      });

      return newSet;
    });
  }, []);

  // Handle select all permissions
  const handleSelectAll = useCallback(() => {
    if (selectAll) {
      setSelectedPermissions(new Set());
      setSelectAll(false);
    } else {
      const allPermissions = PERMISSION_RESOURCES.flatMap(r => r.permissions.map(p => p.id));
      setSelectedPermissions(new Set(allPermissions));
      setSelectAll(true);
    }
  }, [selectAll]);

  // Handle apply role template
  const handleApplyRoleTemplate = useCallback((role: UserRole) => {
    const template = ROLE_TEMPLATES.find(t => t.role === role);
    if (!template) return;

    setSelectedPermissions(new Set(template.permissions));
    setShowRoleTemplates(false);
    toast.success(`Applied ${template.label} template`);
  }, []);

  // Handle add custom permission
  const handleAddCustomPermission = useCallback(() => {
    const permissionId = `${customPermission.resource}:${customPermission.action}`;

    if (!customPermission.resource || !customPermission.action) {
      toast.error('Resource and action are required');
      return;
    }

    setSelectedPermissions(prev => {
      const newSet = new Set(prev);
      newSet.add(permissionId);
      return newSet;
    });

    setCustomPermission({ resource: '', action: '' });
    setShowCustomPermissionModal(false);
    toast.success(`Added custom permission: ${permissionId}`);
  }, [customPermission]);

  // Handle apply permission set
  const handleApplyPermissionSet = useCallback((permissionSet: PermissionSet) => {
    setSelectedPermissions(new Set(permissionSet.permissions));
    setShowPermissionSets(false);
    toast.success(`Applied permission set: ${permissionSet.name}`);
  }, []);

  // Handle save permissions
  const handleSavePermissions = useCallback(async () => {
    try {
      setSaving(true);
      setError(null);

      const permissions = Array.from(selectedPermissions);
      await userService.updateUserPermissions(userId, permissions);

      setOriginalPermissions(new Set(selectedPermissions));
      setHasChanges(false);
      setSuccessMessage('Permissions saved successfully');
      toast.success('Permissions saved successfully');

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error('Failed to save permissions:', error);
      setError(error?.message || 'Failed to save permissions');
      toast.error('Failed to save permissions');
    } finally {
      setSaving(false);
    }
  }, [userId, selectedPermissions]);

  // Handle reset permissions
  const handleResetPermissions = useCallback(() => {
    setSelectedPermissions(new Set(originalPermissions));
    setHasChanges(false);
    toast.success('Permissions reset to saved state');
  }, [originalPermissions]);

  // Handle clear all permissions
  const handleClearAllPermissions = useCallback(() => {
    if (confirm('Are you sure you want to clear all permissions?')) {
      setSelectedPermissions(new Set());
      setSelectAll(false);
      toast.success('All permissions cleared');
    }
  }, []);

  // Filter resources based on search
  const filteredResources = useMemo(() => {
    if (!searchQuery) return PERMISSION_RESOURCES;

    return PERMISSION_RESOURCES.filter(resource => {
      const matchesResource =
        resource.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        resource.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesPermission = resource.permissions.some(p =>
        p.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.id.toLowerCase().includes(searchQuery.toLowerCase())
      );

      return matchesResource || matchesPermission;
    });
  }, [searchQuery]);

  // Filter by selected resource
  const visibleResources = useMemo(() => {
    if (selectedResource === 'all') return filteredResources;
    return filteredResources.filter(r => r.id === selectedResource);
  }, [filteredResources, selectedResource]);

  // Check if all permissions in a resource are selected
  const isResourceFullySelected = useCallback((resourceId: string) => {
    const resource = PERMISSION_RESOURCES.find(r => r.id === resourceId);
    if (!resource) return false;
    return resource.permissions.every(p => selectedPermissions.has(p.id));
  }, [selectedPermissions]);

  // Check if some permissions in a resource are selected
  const isResourcePartiallySelected = useCallback((resourceId: string) => {
    const resource = PERMISSION_RESOURCES.find(r => r.id === resourceId);
    if (!resource) return false;
    const selectedCount = resource.permissions.filter(p => selectedPermissions.has(p.id)).length;
    return selectedCount > 0 && selectedCount < resource.permissions.length;
  }, [selectedPermissions]);

  // Access denied
  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to manage user permissions.
        </p>
        <button
          onClick={() => router.push(`/admin/users/${userId}`)}
          className="mt-4 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors flex items-center gap-2 focus-ring"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to User
        </button>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading permissions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(`/admin/users/${userId}`)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0 focus-ring"
            aria-label="Back to user"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
              <Key className="w-6 h-6 sm:w-7 sm:h-7 text-brand-500 flex-shrink-0" />
              <span>User Permissions</span>
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 hidden sm:block">
              {user ? `${user.firstName} ${user.lastName} - ` : ''}Manage granular permissions
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasChanges && (
            <>
              <button
                onClick={handleResetPermissions}
                disabled={saving}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-sm focus-ring"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">Reset</span>
              </button>
              <button
                onClick={handleSavePermissions}
                disabled={saving}
                className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors flex items-center gap-2 text-sm focus-ring"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Save Changes</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-lg p-3 flex items-center gap-2 animate-slideIn">
          <CheckCircle className="w-5 h-5 text-success-600 dark:text-success-400 flex-shrink-0" />
          <span className="text-success-700 dark:text-success-300 text-sm flex-1">{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="p-1 hover:bg-success-100 dark:hover:bg-success-800 rounded transition-colors flex-shrink-0 focus-ring"
            aria-label="Dismiss"
          >
            <XCircle className="w-5 h-5 text-success-600 dark:text-success-400" />
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4 flex items-center gap-3 animate-slideIn">
          <AlertCircle className="w-5 h-5 text-danger-600 dark:text-danger-400 flex-shrink-0" />
          <span className="text-danger-700 dark:text-danger-300 text-sm flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="p-1 hover:bg-danger-100 dark:hover:bg-danger-800 rounded transition-colors flex-shrink-0 focus-ring"
            aria-label="Dismiss error"
          >
            <XCircle className="w-5 h-5 text-danger-600 dark:text-danger-400" />
          </button>
        </div>
      )}

      {/* Permission Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <StatsCard
          title="Total Permissions"
          value={permissionStats.total}
          icon={<Key className="w-5 h-5" />}
          color="bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400"
        />
        <StatsCard
          title="Selected"
          value={permissionStats.selected}
          icon={<CheckCircle className="w-5 h-5" />}
          color="bg-success-100 text-success-600 dark:bg-success-900/30 dark:text-success-400"
          subtitle={`${permissionStats.total > 0 ? Math.round((permissionStats.selected / permissionStats.total) * 100) : 0}%`}
        />
        <StatsCard
          title="Role Default"
          value={ROLE_TEMPLATES.find(t => t.role === user?.role)?.permissions.length || 0}
          icon={<Shield className="w-5 h-5" />}
          color="bg-secondary-100 text-secondary-600 dark:bg-secondary-900/30 dark:text-secondary-400"
        />
        <StatsCard
          title="Custom"
          value={permissionStats.custom}
          icon={<Zap className="w-5 h-5" />}
          color="bg-brand-accent-100 text-brand-accent-600 dark:bg-brand-accent-900/30 dark:text-brand-accent-400"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowRoleTemplates(!showRoleTemplates)}
          className={`px-3 py-2 border rounded-lg transition-colors flex items-center gap-2 text-sm focus-ring ${
            showRoleTemplates ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span className="hidden sm:inline">Role Templates</span>
        </button>
        <button
          onClick={() => setShowPermissionSets(!showPermissionSets)}
          className={`px-3 py-2 border rounded-lg transition-colors flex items-center gap-2 text-sm focus-ring ${
            showPermissionSets ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <Star className="w-4 h-4" />
          <span className="hidden sm:inline">Permission Sets</span>
        </button>
        <button
          onClick={() => setShowCustomPermissionModal(true)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-sm focus-ring"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Custom</span>
        </button>
        <button
          onClick={() => setShowInheritanceVisualization(!showInheritanceVisualization)}
          className={`px-3 py-2 border rounded-lg transition-colors flex items-center gap-2 text-sm focus-ring ${
            showInheritanceVisualization ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span className="hidden sm:inline">Inheritance</span>
        </button>
        <button
          onClick={handleSelectAll}
          className={`px-3 py-2 border rounded-lg transition-colors flex items-center gap-2 text-sm focus-ring ${
            selectAll ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          {selectAll ? <Unlink className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
          <span className="hidden sm:inline">{selectAll ? 'Deselect All' : 'Select All'}</span>
        </button>
        {selectedPermissions.size > 0 && (
          <button
            onClick={handleClearAllPermissions}
            className="px-3 py-2 border border-danger-300 dark:border-danger-700 rounded-lg text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors flex items-center gap-2 text-sm focus-ring"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Clear All</span>
          </button>
        )}
      </div>

      {/* Role Templates Panel */}
      {showRoleTemplates && (
        <div className="card-brand p-4 sm:p-6 animate-slideIn">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Role Templates</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ROLE_TEMPLATES.map(template => (
              <div
                key={template.role}
                className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-card-hover focus-ring ${
                  user?.role === template.role ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
                onClick={() => handleApplyRoleTemplate(template.role)}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 rounded-lg ${template.color}`}>
                    {template.icon}
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">{template.label}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{template.permissions.length} permissions</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{template.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Permission Sets Panel */}
      {showPermissionSets && (
        <div className="card-brand p-4 sm:p-6 animate-slideIn">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Saved Permission Sets</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {customPermissionSets.map(set => (
              <div
                key={set.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 cursor-pointer hover:shadow-card-hover transition-all focus-ring"
                onClick={() => handleApplyPermissionSet(set)}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-warning-500" />
                  <h4 className="font-medium text-gray-900 dark:text-white">{set.name}</h4>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{set.description}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{set.permissions.length} permissions</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inheritance Visualization */}
      {showInheritanceVisualization && user && (
        <div className="card-brand p-4 sm:p-6 animate-slideIn">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Permission Inheritance</h3>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="p-2 bg-secondary-100 dark:bg-secondary-900/30 rounded-lg">
                <Shield className="w-5 h-5 text-secondary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white">Role: {user.role}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Inherited from role template
                </p>
              </div>
              <span className="text-sm text-gray-500 whitespace-nowrap tabular-nums">
                {ROLE_TEMPLATES.find(t => t.role === user.role)?.permissions.length || 0} permissions
              </span>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="p-2 bg-brand-100 dark:bg-brand-900/30 rounded-lg">
                <Users className="w-5 h-5 text-brand-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white">Business Unit Assignments</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Inherited from business unit roles
                </p>
              </div>
              <span className="text-sm text-gray-500 whitespace-nowrap tabular-nums">
                {user.businessUnits?.length || 0} units
              </span>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="p-2 bg-success-100 dark:bg-success-900/30 rounded-lg">
                <Key className="w-5 h-5 text-success-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white">Custom Permissions</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Directly assigned permissions
                </p>
              </div>
              <span className="text-sm text-gray-500 whitespace-nowrap tabular-nums">
                {selectedPermissions.size} permissions
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filter */}
      <div className="card-brand p-4">
        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
          <div className="flex-1 min-w-[200px] w-full sm:w-auto relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search permissions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors focus-ring"
                aria-label="Clear search"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>

          <select
            value={selectedResource}
            onChange={(e) => setSelectedResource(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          >
            <option value="all">All Resources</option>
            {PERMISSION_RESOURCES.map(resource => (
              <option key={resource.id} value={resource.id}>{resource.label}</option>
            ))}
          </select>

          {(searchQuery || selectedResource !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedResource('all');
              }}
              className="px-3 py-2 text-sm text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg transition-colors flex items-center gap-1 focus-ring"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Permission Resources */}
      <div className="space-y-4">
        {visibleResources.map(resource => {
          const isExpanded = expandedResources.has(resource.id);
          const isFullySelected = isResourceFullySelected(resource.id);
          const isPartiallySelected = isResourcePartiallySelected(resource.id);
          const selectedCount = resource.permissions.filter(p => selectedPermissions.has(p.id)).length;

          return (
            <div key={resource.id} className="card-brand p-0 overflow-hidden">
              <div
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors gap-3"
                onClick={() => {
                  setExpandedResources(prev => {
                    const newSet = new Set(prev);
                    if (newSet.has(resource.id)) {
                      newSet.delete(resource.id);
                    } else {
                      newSet.add(resource.id);
                    }
                    return newSet;
                  });
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2 rounded-lg flex-shrink-0 ${resource.color}`}>
                    {resource.icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-medium text-gray-900 dark:text-white truncate">{resource.label}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate hidden sm:block">{resource.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap tabular-nums">
                      {selectedCount}/{resource.permissions.length}
                    </span>
                    <input
                      type="checkbox"
                      checked={isFullySelected}
                      onChange={() => handleSelectAllInResource(resource.id)}
                      className={`rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500 ${
                        isPartiallySelected ? 'bg-brand-100' : ''
                      }`}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select all ${resource.label} permissions`}
                    />
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {resource.permissions.map(permission => {
                      const isSelected = selectedPermissions.has(permission.id);

                      return (
                        <div
                          key={permission.id}
                          className={`p-3 rounded-lg border transition-all cursor-pointer focus-ring ${
                            isSelected
                              ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                          onClick={() => handlePermissionToggle(permission.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handlePermissionToggle(permission.id)}
                                  className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500 flex-shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label={`Toggle ${permission.label}`}
                                />
                                <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{permission.label}</p>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">{permission.description}</p>
                              <code className="text-xs text-gray-400 dark:text-gray-500 mt-1 inline-block truncate max-w-full">
                                {permission.id}
                              </code>
                            </div>
                            {isSelected && (
                              <CheckCircle className="w-4 h-4 text-brand-600 dark:text-brand-400 flex-shrink-0" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Custom Permission Modal */}
      {showCustomPermissionModal && (
        <div className="fixed inset-0 z-modal overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowCustomPermissionModal(false)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <button
                onClick={() => setShowCustomPermissionModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors z-10 focus-ring"
                aria-label="Close modal"
              >
                <XCircle className="w-6 h-6 text-gray-500 dark:text-gray-400" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-brand-100 dark:bg-brand-900/30 rounded-lg">
                  <Plus className="w-6 h-6 text-brand-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Add Custom Permission</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Create a custom permission</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Resource <span className="text-danger-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={customPermission.resource}
                    onChange={(e) => setCustomPermission(prev => ({ ...prev, resource: e.target.value }))}
                    placeholder="e.g., user, inventory, product"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Action <span className="text-danger-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={customPermission.action}
                    onChange={(e) => setCustomPermission(prev => ({ ...prev, action: e.target.value }))}
                    placeholder="e.g., view, create, edit, delete"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>

                {customPermission.resource && customPermission.action && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Permission ID:</p>
                    <code className="text-sm text-brand-600 dark:text-brand-400 font-mono">
                      {customPermission.resource}:{customPermission.action}
                    </code>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setShowCustomPermissionModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddCustomPermission}
                    disabled={!customPermission.resource || !customPermission.action}
                    className="flex-1 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 focus-ring"
                  >
                    <Plus className="w-4 h-4" />
                    Add Permission
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
