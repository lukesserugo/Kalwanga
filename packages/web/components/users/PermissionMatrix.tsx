// D:\Projects\Kalwanga\packages\web\components\users\PermissionMatrix.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { 
  Shield, Key, Lock, Unlock, Check, X, Search, Filter,
  Users, User, Building, Package, FolderTree, FileText,
  DollarSign, ShoppingCart, ClipboardList, Truck, Boxes,
  Layers, Store, Globe, Hash, Tag, Star, Heart, ThumbsUp,
  MessageSquare, Share2, Bookmark, FileDown, FileJson,
  Download, Upload, RefreshCw, Copy, Info, AlertTriangle,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Eye, EyeOff, Settings, Activity, Calendar, Mail, Phone,
  Database, Server, Cloud, Wifi, Bluetooth, Battery,
  Sun, Moon, Wind, Droplet, Flame, Leaf, TreePine,
  Mountain, Waves, Compass, Map, Navigation, Route,
  Target, Crosshair, Gauge, // ✅ Removed Aim, Bullseye, Speedometer
  CreditCard, Percent, Printer, Send, Link2, Unlink,
  Plus, Minus, RotateCcw, History, Zap, Sparkles,
  CheckCircle, XCircle, Loader2, Save, MoreVertical,
  SlidersHorizontal, BarChart3, TrendingUp, PieChart
} from 'lucide-react';
import { UserRole } from '../../types/enums';

interface PermissionDefinition {
  id: string;
  label: string;
  description: string;
  resource: string;
  action: string;
  category: string;
}

interface PermissionResource {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  permissions: PermissionDefinition[];
}

interface PermissionMatrixProps {
  permissions?: PermissionDefinition[];
  selectedPermissions?: string[];
  onPermissionToggle?: (permissionId: string) => void;
  onSelectAll?: (resourceId: string) => void;
  onDeselectAll?: (resourceId: string) => void;
  onSelectAllPermissions?: () => void;
  onDeselectAllPermissions?: () => void;
  role?: UserRole;
  rolePermissions?: string[];
  showRoleComparison?: boolean;
  showSearch?: boolean;
  showFilter?: boolean;
  showStats?: boolean;
  showLegend?: boolean;
  editable?: boolean;
  loading?: boolean;
  className?: string;
  groupByResource?: boolean;
  collapsedByDefault?: boolean;
  showDescriptions?: boolean;
  showPermissionIds?: boolean;
  highlightInherited?: boolean;
  inheritedPermissions?: string[];
}

const PERMISSION_RESOURCES: PermissionResource[] = [
  {
    id: 'user',
    label: 'User Management',
    description: 'Manage users, roles, and permissions',
    icon: <Users className="w-5 h-5" />,
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    permissions: [
      { id: 'user:view', label: 'View Users', description: 'View user list and details', resource: 'user', action: 'view', category: 'user' },
      { id: 'user:create', label: 'Create Users', description: 'Create new user accounts', resource: 'user', action: 'create', category: 'user' },
      { id: 'user:edit', label: 'Edit Users', description: 'Edit user information', resource: 'user', action: 'edit', category: 'user' },
      { id: 'user:delete', label: 'Delete Users', description: 'Delete user accounts', resource: 'user', action: 'delete', category: 'user' },
      { id: 'user:manage', label: 'Manage Users', description: 'Full user management access', resource: 'user', action: 'manage', category: 'user' },
      { id: 'user:activate', label: 'Activate Users', description: 'Activate user accounts', resource: 'user', action: 'activate', category: 'user' },
      { id: 'user:deactivate', label: 'Deactivate Users', description: 'Deactivate user accounts', resource: 'user', action: 'deactivate', category: 'user' },
      { id: 'user:role:update', label: 'Update Roles', description: 'Change user roles', resource: 'user:role', action: 'update', category: 'user' },
      { id: 'user:permission:update', label: 'Update Permissions', description: 'Modify user permissions', resource: 'user:permission', action: 'update', category: 'user' },
      { id: 'user:export', label: 'Export Users', description: 'Export user data', resource: 'user', action: 'export', category: 'user' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory Management',
    description: 'Manage inventory and stock',
    icon: <Boxes className="w-5 h-5" />,
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    permissions: [
      { id: 'inventory:view', label: 'View Inventory', description: 'View inventory items', resource: 'inventory', action: 'view', category: 'inventory' },
      { id: 'inventory:create', label: 'Create Items', description: 'Add new inventory items', resource: 'inventory', action: 'create', category: 'inventory' },
      { id: 'inventory:edit', label: 'Edit Items', description: 'Edit inventory items', resource: 'inventory', action: 'edit', category: 'inventory' },
      { id: 'inventory:delete', label: 'Delete Items', description: 'Delete inventory items', resource: 'inventory', action: 'delete', category: 'inventory' },
      { id: 'inventory:manage', label: 'Manage Inventory', description: 'Full inventory management', resource: 'inventory', action: 'manage', category: 'inventory' },
      { id: 'inventory:view_low_stock', label: 'View Low Stock', description: 'View low stock alerts', resource: 'inventory', action: 'view_low_stock', category: 'inventory' },
      { id: 'inventory:view_reports', label: 'View Reports', description: 'View inventory reports', resource: 'inventory', action: 'view_reports', category: 'inventory' },
      { id: 'inventory:export', label: 'Export Inventory', description: 'Export inventory data', resource: 'inventory', action: 'export', category: 'inventory' },
      { id: 'inventory:import', label: 'Import Inventory', description: 'Import inventory data', resource: 'inventory', action: 'import', category: 'inventory' },
      { id: 'inventory:adjust', label: 'Adjust Stock', description: 'Adjust inventory levels', resource: 'inventory', action: 'adjust', category: 'inventory' },
      { id: 'inventory:transfer', label: 'Transfer Stock', description: 'Transfer between locations', resource: 'inventory', action: 'transfer', category: 'inventory' },
    ],
  },
  {
    id: 'product',
    label: 'Product Management',
    description: 'Manage products and catalog',
    icon: <Package className="w-5 h-5" />,
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    permissions: [
      { id: 'product:view', label: 'View Products', description: 'View product list', resource: 'product', action: 'view', category: 'product' },
      { id: 'product:create', label: 'Create Products', description: 'Add new products', resource: 'product', action: 'create', category: 'product' },
      { id: 'product:edit', label: 'Edit Products', description: 'Edit product details', resource: 'product', action: 'edit', category: 'product' },
      { id: 'product:delete', label: 'Delete Products', description: 'Delete products', resource: 'product', action: 'delete', category: 'product' },
      { id: 'product:manage', label: 'Manage Products', description: 'Full product management', resource: 'product', action: 'manage', category: 'product' },
      { id: 'product:export', label: 'Export Products', description: 'Export product data', resource: 'product', action: 'export', category: 'product' },
      { id: 'product:import', label: 'Import Products', description: 'Import product data', resource: 'product', action: 'import', category: 'product' },
    ],
  },
  {
    id: 'category',
    label: 'Category Management',
    description: 'Manage product categories',
    icon: <FolderTree className="w-5 h-5" />,
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    permissions: [
      { id: 'category:view', label: 'View Categories', description: 'View category list', resource: 'category', action: 'view', category: 'category' },
      { id: 'category:create', label: 'Create Categories', description: 'Add new categories', resource: 'category', action: 'create', category: 'category' },
      { id: 'category:edit', label: 'Edit Categories', description: 'Edit category details', resource: 'category', action: 'edit', category: 'category' },
      { id: 'category:delete', label: 'Delete Categories', description: 'Delete categories', resource: 'category', action: 'delete', category: 'category' },
      { id: 'category:manage', label: 'Manage Categories', description: 'Full category management', resource: 'category', action: 'manage', category: 'category' },
    ],
  },
  {
    id: 'report',
    label: 'Reports',
    description: 'Access and generate reports',
    icon: <BarChart3 className="w-5 h-5" />,
    color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
    permissions: [
      { id: 'report:view', label: 'View Reports', description: 'View report list', resource: 'report', action: 'view', category: 'report' },
      { id: 'report:create', label: 'Create Reports', description: 'Generate new reports', resource: 'report', action: 'create', category: 'report' },
      { id: 'report:export', label: 'Export Reports', description: 'Export report data', resource: 'report', action: 'export', category: 'report' },
      { id: 'report:manage', label: 'Manage Reports', description: 'Full report management', resource: 'report', action: 'manage', category: 'report' },
    ],
  },
  {
    id: 'sale',
    label: 'Sales',
    description: 'Manage sales and transactions',
    icon: <ShoppingCart className="w-5 h-5" />,
    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    permissions: [
      { id: 'sale:view', label: 'View Sales', description: 'View sale records', resource: 'sale', action: 'view', category: 'sale' },
      { id: 'sale:create', label: 'Create Sales', description: 'Process new sales', resource: 'sale', action: 'create', category: 'sale' },
      { id: 'sale:edit', label: 'Edit Sales', description: 'Edit sale records', resource: 'sale', action: 'edit', category: 'sale' },
      { id: 'sale:delete', label: 'Delete Sales', description: 'Delete sale records', resource: 'sale', action: 'delete', category: 'sale' },
      { id: 'sale:manage', label: 'Manage Sales', description: 'Full sales management', resource: 'sale', action: 'manage', category: 'sale' },
      { id: 'sale:export', label: 'Export Sales', description: 'Export sales data', resource: 'sale', action: 'export', category: 'sale' },
      { id: 'sale:print', label: 'Print Receipts', description: 'Print sale receipts', resource: 'sale', action: 'print', category: 'sale' },
    ],
  },
];

export function PermissionMatrix({
  permissions = PERMISSION_RESOURCES.flatMap(r => r.permissions),
  selectedPermissions = [],
  onPermissionToggle,
  onSelectAll,
  onDeselectAll,
  onSelectAllPermissions,
  onDeselectAllPermissions,
  role,
  rolePermissions = [],
  showRoleComparison = false,
  showSearch = true,
  showFilter = true,
  showStats = true,
  showLegend = true,
  editable = true,
  loading = false,
  className = '',
  groupByResource = true,
  collapsedByDefault = false,
  showDescriptions = true,
  showPermissionIds = false,
  highlightInherited = false,
  inheritedPermissions = [],
}: PermissionMatrixProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResource, setSelectedResource] = useState<string>('all');
  const [expandedResources, setExpandedResources] = useState<Set<string>>(
    new Set(collapsedByDefault ? [] : PERMISSION_RESOURCES.map(r => r.id))
  );
  const [showAllPermissions, setShowAllPermissions] = useState(false);
  const [selectAll, setSelectAll] = useState(false);
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const [showOnlyInherited, setShowOnlyInherited] = useState(false);
  const [sortBy, setSortBy] = useState<'resource' | 'action' | 'label'>('resource');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  const matrixRef = useRef<HTMLDivElement>(null);

  // Get all permission resources
  const allResources = useMemo(() => {
    return PERMISSION_RESOURCES;
  }, []);

  // Get all permissions
  const allPermissions = useMemo(() => {
    return permissions;
  }, [permissions]);

  // Check if all permissions are selected
  const areAllPermissionsSelected = useMemo(() => {
    return allPermissions.every(p => selectedPermissions.includes(p.id));
  }, [allPermissions, selectedPermissions]);

  // Filter permissions based on search and filters
  const filteredResources = useMemo(() => {
    let resources = allResources;
    
    if (selectedResource !== 'all') {
      resources = resources.filter(r => r.id === selectedResource);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      resources = resources
        .map(resource => ({
          ...resource,
          permissions: resource.permissions.filter(p => 
            p.label.toLowerCase().includes(query) ||
            p.id.toLowerCase().includes(query) ||
            p.description.toLowerCase().includes(query)
          ),
        }))
        .filter(resource => resource.permissions.length > 0 || resource.label.toLowerCase().includes(query));
    }
    
    if (showOnlySelected) {
      resources = resources
        .map(resource => ({
          ...resource,
          permissions: resource.permissions.filter(p => selectedPermissions.includes(p.id)),
        }))
        .filter(resource => resource.permissions.length > 0);
    }
    
    if (showOnlyInherited && inheritedPermissions.length > 0) {
      resources = resources
        .map(resource => ({
          ...resource,
          permissions: resource.permissions.filter(p => inheritedPermissions.includes(p.id)),
        }))
        .filter(resource => resource.permissions.length > 0);
    }
    
    // Sort permissions within resources
    resources = resources.map(resource => ({
      ...resource,
      permissions: [...resource.permissions].sort((a, b) => {
        let comparison = 0;
        if (sortBy === 'action') {
          comparison = a.action.localeCompare(b.action);
        } else if (sortBy === 'label') {
          comparison = a.label.localeCompare(b.label);
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      }),
    }));
    
    return resources;
  }, [allResources, selectedResource, searchQuery, showOnlySelected, showOnlyInherited, inheritedPermissions, sortBy, sortOrder, selectedPermissions]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = allPermissions.length;
    const selected = selectedPermissions.length;
    const inherited = inheritedPermissions.length;
    const custom = selected - inherited;
    const percentage = total > 0 ? Math.round((selected / total) * 100) : 0;
    
    return {
      total,
      selected,
      inherited,
      custom,
      percentage,
    };
  }, [allPermissions, selectedPermissions, inheritedPermissions]);

  // Handle toggle resource
  const handleToggleResource = useCallback((resourceId: string) => {
    setExpandedResources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(resourceId)) {
        newSet.delete(resourceId);
      } else {
        newSet.add(resourceId);
      }
      return newSet;
    });
  }, []);

  // Handle select all
  const handleSelectAll = useCallback(() => {
    if (areAllPermissionsSelected) {
      onDeselectAllPermissions?.();
      setSelectAll(false);
    } else {
      onSelectAllPermissions?.();
      setSelectAll(true);
    }
  }, [areAllPermissionsSelected, onSelectAllPermissions, onDeselectAllPermissions]);

  // Check if resource is fully selected
  const isResourceFullySelected = useCallback((resourceId: string) => {
    const resource = allResources.find(r => r.id === resourceId);
    if (!resource) return false;
    return resource.permissions.every(p => selectedPermissions.includes(p.id));
  }, [allResources, selectedPermissions]);

  // Check if resource is partially selected
  const isResourcePartiallySelected = useCallback((resourceId: string) => {
    const resource = allResources.find(r => r.id === resourceId);
    if (!resource) return false;
    const selectedCount = resource.permissions.filter(p => selectedPermissions.includes(p.id)).length;
    return selectedCount > 0 && selectedCount < resource.permissions.length;
  }, [allResources, selectedPermissions]);

  // Get selected count for resource
  const getResourceSelectedCount = useCallback((resourceId: string) => {
    const resource = allResources.find(r => r.id === resourceId);
    if (!resource) return 0;
    return resource.permissions.filter(p => selectedPermissions.includes(p.id)).length;
  }, [allResources, selectedPermissions]);

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading permissions...</p>
      </div>
    );
  }

  return (
    <div ref={matrixRef} className={`space-y-4 ${className}`}>
      {/* Statistics */}
      {showStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 p-3">
            <p className="text-sm text-green-600 dark:text-green-400">Selected</p>
            <p className="text-xl font-bold text-green-700 dark:text-green-400">{stats.selected}</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-3">
            <p className="text-sm text-blue-600 dark:text-blue-400">Inherited</p>
            <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{stats.inherited}</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800 p-3">
            <p className="text-sm text-purple-600 dark:text-purple-400">Custom</p>
            <p className="text-xl font-bold text-purple-700 dark:text-purple-400">{stats.custom}</p>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      {(showSearch || showFilter) && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex flex-wrap items-center gap-2">
            {showSearch && (
              <div className="flex-1 min-w-[200px] relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search permissions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
            )}
            
            {showFilter && (
              <select
                value={selectedResource}
                onChange={(e) => setSelectedResource(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="all">All Resources</option>
                {allResources.map(resource => (
                  <option key={resource.id} value={resource.id}>{resource.label}</option>
                ))}
              </select>
            )}
            
            <button
              onClick={() => setShowOnlySelected(!showOnlySelected)}
              className={`px-3 py-2 border rounded-lg text-sm transition-colors ${
                showOnlySelected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
              }`}
            >
              Selected Only
            </button>
            
            {highlightInherited && inheritedPermissions.length > 0 && (
              <button
                onClick={() => setShowOnlyInherited(!showOnlyInherited)}
                className={`px-3 py-2 border rounded-lg text-sm transition-colors ${
                  showOnlyInherited
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                }`}
              >
                Inherited Only
              </button>
            )}
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="resource">Sort by Resource</option>
              <option value="action">Sort by Action</option>
              <option value="label">Sort by Label</option>
            </select>
            
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortOrder === 'asc' ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            
            {editable && (
              <button
                onClick={handleSelectAll}
                className={`px-3 py-2 border rounded-lg text-sm transition-colors flex items-center gap-1 ${
                  areAllPermissionsSelected
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-600'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                }`}
              >
                {areAllPermissionsSelected ? <Unlink className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                {areAllPermissionsSelected ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      {showLegend && (
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
            <Check className="w-3 h-3 text-green-500" /> Selected
          </span>
          {highlightInherited && (
            <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
              <Shield className="w-3 h-3 text-blue-500" /> Inherited
            </span>
          )}
          {showRoleComparison && role && (
            <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
              <Star className="w-3 h-3 text-yellow-500" /> Role Default
            </span>
          )}
        </div>
      )}

      {/* Permission Matrix */}
      <div className="space-y-3">
        {filteredResources.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
            <Shield className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-gray-500 dark:text-gray-400">No permissions found</p>
          </div>
        ) : (
          filteredResources.map(resource => {
            const isExpanded = expandedResources.has(resource.id);
            const isFullySelected = isResourceFullySelected(resource.id);
            const isPartiallySelected = isResourcePartiallySelected(resource.id);
            const selectedCount = getResourceSelectedCount(resource.id);
            
            return (
              <div key={resource.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Resource Header */}
                <div
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  onClick={() => handleToggleResource(resource.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${resource.color}`}>
                      {resource.icon}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">{resource.label}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{resource.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {selectedCount}/{resource.permissions.length}
                    </span>
                    {editable && (
                      <input
                        type="checkbox"
                        checked={isFullySelected}
                        onChange={() => {
                          if (isFullySelected) {
                            onDeselectAll?.(resource.id);
                          } else {
                            onSelectAll?.(resource.id);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className={`rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 ${
                          isPartiallySelected ? 'bg-blue-100' : ''
                        }`}
                      />
                    )}
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Permission Items */}
                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-gray-700 p-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {resource.permissions.map(permission => {
                        const isSelected = selectedPermissions.includes(permission.id);
                        const isInherited = inheritedPermissions.includes(permission.id);
                        const isRoleDefault = rolePermissions.includes(permission.id);
                        
                        return (
                          <div
                            key={permission.id}
                            className={`p-2 rounded-lg border transition-all ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : isInherited
                                ? 'border-blue-300 bg-blue-50/50 dark:bg-blue-900/10'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                            } ${editable ? 'cursor-pointer' : ''}`}
                            onClick={() => editable && onPermissionToggle?.(permission.id)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2 flex-1">
                                {editable ? (
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => onPermissionToggle?.(permission.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                                  />
                                ) : (
                                  isSelected ? (
                                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                                  )
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                                      {permission.label}
                                    </p>
                                    {isInherited && highlightInherited && (
                                      <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-full">
                                        Inherited
                                      </span>
                                    )}
                                    {isRoleDefault && showRoleComparison && (
                                      <span className="px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs rounded-full">
                                        Role Default
                                      </span>
                                    )}
                                  </div>
                                  {showDescriptions && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                      {permission.description}
                                    </p>
                                  )}
                                  {showPermissionIds && (
                                    <code className="text-xs text-gray-400 dark:text-gray-500">
                                      {permission.id}
                                    </code>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Progress bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {stats.selected} of {stats.total} permissions selected
          </span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {stats.percentage}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${stats.percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default PermissionMatrix;
