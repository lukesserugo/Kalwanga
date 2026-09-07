// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\users\page.tsx

'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useAuth } from '../../../../hooks/useAuth';
import { PermissionGuard } from '../../../../components/common/PermissionGuard';
import { PERMISSIONS } from '../../../../types/permissions';
import { 
  Shield, UserCog, UserPlus, RefreshCw, AlertCircle, 
  Search, Download, Filter, Users as UsersIcon,
  UserCheck, UserX, Trash2, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, Lock, Loader2, Eye, EyeOff,
  MoreVertical, Settings2, ArrowUpDown, ChevronDown,
  ChevronUp, Mail, Phone, Calendar, Clock, Building,
  Key, Activity, User, UserCircle, BadgeCheck, Ban,
  RotateCcw, FileDown, FileJson, SlidersHorizontal,
  X, Check, Info, AlertTriangle, LogOut, LogIn,
  ShieldCheck, ShieldAlert, ShieldX, UserCog2, UsersRound,
  Upload, Send, UserPlus as InviteIcon, FileUp,
  Network, GitBranch, FolderOpen, Tag, Tags,
  Menu, Grid, List, LayoutGrid, LayoutList
} from 'lucide-react';
import { userService } from '../../../../services/userService';
import { User as UserType, UserGroup } from '../../../../types/user';
import { toast } from 'react-hot-toast';

// Define interface for the user list item
interface UserListItem {
  id: string;
  clerkId?: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  role: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  permissions?: string[];
  businessUnits?: any[];
  groupMemberships?: any[];
  company?: any;
  avatar?: string;
}

// Stats Card Component
const StatsCard = ({ title, value, icon, color, subtitle }: any) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{title}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-lg ${color} flex-shrink-0`}>
        {icon}
      </div>
    </div>
  </div>
);

export default function UsersManagementPage() {
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const { 
    user: currentUser, 
    can, 
    isSuperAdmin, 
    isAdmin,
    canViewUsers,
    canManageUsers,
    canCreateUsers,
    canExportUsers,
    canDeleteUsers
  } = useAuth();
  
  // State Management
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    role: '',
    status: 'all',
    businessUnitId: '',
    groupId: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    limit: 10,
  });
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserListItem | null>(null);
  const [exporting, setExporting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  }>({ key: 'createdAt', direction: 'desc' });
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [availableGroups, setAvailableGroups] = useState<UserGroup[]>([]);
  const [showGroupAssignModal, setShowGroupAssignModal] = useState(false);
  const [selectedGroupForAssign, setSelectedGroupForAssign] = useState('');
  const [assigningToGroup, setAssigningToGroup] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Refs
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const isPolling = useRef(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // Get role from Clerk metadata or useAuth
  const userRole = (clerkUser?.publicMetadata?.role as string) || 
                   (clerkUser?.unsafeMetadata?.role as string) || 
                   currentUser?.role || 
                   'USER';

  const hasAccess = isSuperAdmin || isAdmin || canViewUsers || 
                    userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';

  const canManageGroups = isSuperAdmin || isAdmin || can(PERMISSIONS.USER_MANAGE);

  // Debounced search
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    searchTimeout.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPagination(prev => ({ ...prev, page: 1 }));
    }, 500);
    
    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [searchQuery]);

  // Load available groups
  const loadAvailableGroups = useCallback(async () => {
    try {
      const response = await userService.getGroups({ limit: 100, isActive: true });
      if (response?.data && Array.isArray(response.data)) {
        setAvailableGroups(response.data);
      }
    } catch (error) {
      console.error('Failed to load groups:', error);
      setAvailableGroups([]);
    }
  }, []);

  // Load users from database
  const loadUsers = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
        sortBy: sortConfig.key,
        sortOrder: sortConfig.direction,
      };
      
      if (debouncedSearch) params.search = debouncedSearch;
      if (filters.role) params.role = filters.role;
      if (filters.status !== 'all') params.isActive = filters.status === 'active';
      if (filters.businessUnitId) params.businessUnitId = filters.businessUnitId;

      const response = await userService.getAllUsers(params);
      
      let userData: UserListItem[] = [];
      let total = 0;
      let pages = 1;
      
      if (response && typeof response === 'object') {
        if ('data' in response && Array.isArray(response.data)) {
          userData = response.data;
          total = response.total || response.data.length;
          pages = response.totalPages || 1;
        } else if (Array.isArray(response)) {
          userData = response;
          total = response.length;
          pages = 1;
        }
      }
      
      // Filter out SUPER_ADMIN for non-superadmins
      if (!isSuperAdmin) {
        userData = userData.filter(u => u.role !== 'SUPER_ADMIN');
        total = userData.length;
        pages = 1;
      }
      
      // Filter by group if selected
      if (filters.groupId) {
        userData = userData.filter(u => 
          u.groupMemberships?.some((gm: any) => gm.groupId === filters.groupId || gm.group?.id === filters.groupId)
        );
        total = userData.length;
        pages = Math.ceil(total / pagination.limit) || 1;
      }
      
      setUsers(userData);
      setPagination(prev => ({
        ...prev,
        total: total || userData.length,
        totalPages: pages || 1,
      }));
      setLastUpdated(new Date());
    } catch (error: any) {
      console.error('Failed to load users:', error);
      setError(error?.message || 'Failed to load users. Please try again.');
      setUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [pagination.page, pagination.limit, debouncedSearch, filters, isSuperAdmin, sortConfig]);

  // Start polling for real-time updates
  const startPolling = useCallback(() => {
    if (isPolling.current) return;
    isPolling.current = true;
    
    pollingInterval.current = setInterval(() => {
      loadUsers(false);
    }, 30000);
  }, [loadUsers]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
    isPolling.current = false;
  }, []);

  // Initial load
  useEffect(() => {
    if (hasAccess) {
      loadUsers();
      startPolling();
      if (canManageGroups) {
        loadAvailableGroups();
      }
    } else {
      setLoading(false);
    }
    
    return () => {
      stopPolling();
    };
  }, [loadUsers, hasAccess, startPolling, stopPolling, canManageGroups, loadAvailableGroups]);

  // Close sort menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setShowSortMenu(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Show success message
  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    toast.success(message);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  // Handlers
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadUsers(false);
    if (canManageGroups) {
      await loadAvailableGroups();
    }
    showSuccess('Users refreshed successfully');
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSortChange = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
    setShowSortMenu(false);
  };

  // Navigation handlers
  const handleAddUser = () => {
    router.push('/admin/users/add');
  };

  const handleImportUsers = () => {
    router.push('/admin/users/import');
  };

  const handleInviteUsers = () => {
    router.push('/admin/users/invite');
  };

  const handleManageGroups = () => {
    router.push('/admin/users/groups');
  };

  const handleManageRoles = () => {
    router.push('/admin/users/roles');
  };

  const handleSettings = () => {
    router.push('/admin/users/settings');
  };

  const handleUserSelect = (user: UserListItem) => {
    const identifier = user.clerkId || user.id;
    router.push(`/admin/users/${identifier}`);
  };

  const handleUserEdit = (user: UserListItem) => {
    const identifier = user.clerkId || user.id;
    router.push(`/admin/users/${identifier}/edit`);
  };

  // DELETE USER
  const handleDeleteUser = async (userId: string) => {
    try {
      setRefreshing(true);
      await userService.deleteUser(userId);
      console.log('✅ User deleted:', userId);
      
      setShowDeleteModal(false);
      setUserToDelete(null);
      setSelectedUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
      
      await loadUsers(false);
      
      showSuccess('User deleted successfully!');
    } catch (error: any) {
      console.error('Failed to delete user:', error);
      setError(error?.message || 'Failed to delete user.');
      toast.error(error?.message || 'Failed to delete user');
    } finally {
      setRefreshing(false);
    }
  };

  // EXPORT
  const handleExport = async (format: 'csv' | 'json' = 'csv') => {
    if (!canExportUsers && !isSuperAdmin && !isAdmin) {
      setError('You do not have permission to export users');
      toast.error('You do not have permission to export users');
      return;
    }
    
    setExporting(true);
    try {
      const response = await userService.exportUsers(format);
      
      if (format === 'csv' && typeof response === 'string') {
        const blob = new Blob([response], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `users_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `users_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
      showSuccess('Export completed successfully!');
    } catch (error: any) {
      console.error('Failed to export users:', error);
      setError(error?.message || 'Failed to export users.');
      toast.error(error?.message || 'Failed to export users');
    } finally {
      setExporting(false);
    }
  };

  // BULK OPERATIONS
  const handleBulkActivate = async () => {
    if (!canManageUsers && !isSuperAdmin && !isAdmin) {
      setError('You do not have permission to activate users');
      toast.error('You do not have permission to activate users');
      return;
    }
    try {
      await userService.bulkActivateUsers(Array.from(selectedUsers));
      setSelectedUsers(new Set());
      await loadUsers(false);
      showSuccess('Users activated successfully!');
    } catch (error: any) {
      setError(error?.message || 'Failed to activate users.');
      toast.error(error?.message || 'Failed to activate users');
    }
  };

  const handleBulkDeactivate = async () => {
    if (!canManageUsers && !isSuperAdmin && !isAdmin) {
      setError('You do not have permission to deactivate users');
      toast.error('You do not have permission to deactivate users');
      return;
    }
    try {
      await userService.bulkDeactivateUsers(Array.from(selectedUsers));
      setSelectedUsers(new Set());
      await loadUsers(false);
      showSuccess('Users deactivated successfully!');
    } catch (error: any) {
      setError(error?.message || 'Failed to deactivate users.');
      toast.error(error?.message || 'Failed to deactivate users');
    }
  };

  const handleBulkDelete = async () => {
    if (!canDeleteUsers && !canManageUsers && !isSuperAdmin && !isAdmin) {
      setError('You do not have permission to delete users');
      toast.error('You do not have permission to delete users');
      return;
    }
    if (!confirm(`Are you sure you want to delete ${selectedUsers.size} users? This action cannot be undone.`)) return;
    try {
      await userService.bulkDeleteUsers(Array.from(selectedUsers));
      setSelectedUsers(new Set());
      await loadUsers(false);
      showSuccess('Users deleted successfully!');
    } catch (error: any) {
      setError(error?.message || 'Failed to delete users.');
      toast.error(error?.message || 'Failed to delete users');
    }
  };

  const handleBulkAssignToGroup = async () => {
    if (selectedUsers.size === 0 || !selectedGroupForAssign) {
      toast.error('Select users and a group first');
      return;
    }
    
    setAssigningToGroup(true);
    try {
      await userService.assignUsersToGroup(selectedGroupForAssign, Array.from(selectedUsers));
      toast.success(`Assigned ${selectedUsers.size} users to group`);
      setSelectedUsers(new Set());
      setShowGroupAssignModal(false);
      setSelectedGroupForAssign('');
      await loadUsers(false);
    } catch (error: any) {
      console.error('Failed to assign users to group:', error);
      toast.error('Failed to assign users to group');
    } finally {
      setAssigningToGroup(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.map(u => u.id)));
    }
  };

  const handleSelectUser = (userId: string) => {
    setSelectedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  // Get user initials for avatar
  const getUserInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase() || '?';
  };

  // Get role badge color
  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      SUPER_ADMIN: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-700',
      ADMIN: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-700',
      MANAGER: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-700',
      EDITOR: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-700',
      VIEWER: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-400 border-gray-200 dark:border-gray-600',
      EMPLOYEE: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400 border-cyan-200 dark:border-cyan-700',
      CASHIER: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-700',
      USER: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-400 border-gray-200 dark:border-gray-600',
    };
    return colors[role] || colors.USER;
  };

  // Get status badge
  const getStatusBadge = (isActive: boolean) => {
    if (isActive) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-700">
          <CheckCircle className="w-3 h-3" />
          Active
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-700">
        <XCircle className="w-3 h-3" />
        Inactive
      </span>
    );
  };

  // Get time ago
  const getTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  // Show access restricted
  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to view users.
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          Your role: {userRole}
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-500 dark:text-gray-400">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="w-full sm:w-auto">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
            <UserCog className="w-6 h-6 sm:w-7 sm:h-7 text-blue-500 flex-shrink-0" />
            <span>User Management</span>
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
              ({pagination.total} users)
            </span>
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 hidden sm:block">
            Manage user accounts, roles, permissions, and groups
          </p>
          {lastUpdated && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        
        {/* Action Buttons - Mobile Friendly */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* View Mode Toggle */}
          <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 transition-colors ${viewMode === 'table' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              aria-label="Table view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              aria-label="Grid view"
            >
              <Grid className="w-4 h-4" />
            </button>
          </div>

          {/* Export Dropdown */}
          <div className="relative group">
            <button
              onClick={() => handleExport('csv')}
              disabled={exporting}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              title="Export users"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </button>
            <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 hidden group-hover:block z-10">
              <button 
                onClick={() => handleExport('csv')} 
                className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm transition-colors flex items-center gap-2"
              >
                <FileDown className="w-4 h-4" /> Export CSV
              </button>
              <button 
                onClick={() => handleExport('json')} 
                className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm transition-colors flex items-center gap-2"
              >
                <FileJson className="w-4 h-4" /> Export JSON
              </button>
            </div>
          </div>

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            title="Refresh users"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* Manage Groups */}
          {canManageGroups && (
            <button 
              onClick={handleManageGroups}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-sm"
            >
              <UsersRound className="w-4 h-4" />
              <span className="hidden sm:inline">Groups</span>
            </button>
          )}

          {/* Manage Roles */}
          {canManageGroups && (
            <button 
              onClick={handleManageRoles}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-sm"
            >
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Roles</span>
            </button>
          )}

          {/* Settings */}
          {canManageGroups && (
            <button 
              onClick={handleSettings}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-sm"
            >
              <Settings2 className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          )}

          {/* Invite Users */}
          {canCreateUsers && (
            <button 
              onClick={handleInviteUsers}
              className="px-3 py-2 border border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-400 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors flex items-center gap-2 text-sm"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Invite</span>
            </button>
          )}

          {/* Import Users */}
          {canCreateUsers && (
            <button 
              onClick={handleImportUsers}
              className="px-3 py-2 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors flex items-center gap-2 text-sm"
            >
              <FileUp className="w-4 h-4" />
              <span className="hidden sm:inline">Import</span>
            </button>
          )}

          {/* Add User */}
          {canCreateUsers && (
            <button 
              onClick={handleAddUser}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
            >
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Add User</span>
            </button>
          )}
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2 animate-slideIn">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          <span className="text-green-700 dark:text-green-300 text-sm flex-1">{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="p-1 hover:bg-green-100 dark:hover:bg-green-800 rounded transition-colors flex-shrink-0"
            aria-label="Dismiss"
          >
            <XCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3 animate-slideIn">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          <span className="text-red-700 dark:text-red-300 text-sm flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="p-1 hover:bg-red-100 dark:hover:bg-red-800 rounded transition-colors flex-shrink-0"
            aria-label="Dismiss error"
          >
            <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </button>
        </div>
      )}

      {/* Stats Cards - Responsive Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
        <StatsCard
          title="Total Users"
          value={pagination.total}
          icon={<UsersIcon className="w-5 h-5" />}
          color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
        />
        <StatsCard
          title="Active"
          value={users.filter(u => u.isActive).length}
          icon={<UserCheck className="w-5 h-5" />}
          color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          subtitle={`${users.length > 0 ? Math.round((users.filter(u => u.isActive).length / users.length) * 100) : 0}%`}
        />
        <StatsCard
          title="Inactive"
          value={users.filter(u => !u.isActive).length}
          icon={<UserX className="w-5 h-5" />}
          color="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
        />
        <StatsCard
          title="Roles"
          value={new Set(users.map(u => u.role)).size}
          icon={<Shield className="w-5 h-5" />}
          color="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
        />
        <StatsCard
          title="Groups"
          value={availableGroups.length}
          icon={<UsersRound className="w-5 h-5" />}
          color="bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
        />
        <StatsCard
          title="New Today"
          value={users.filter(u => new Date(u.createdAt).toDateString() === new Date().toDateString()).length}
          icon={<Calendar className="w-5 h-5" />}
          color="bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400"
        />
      </div>

      {/* User Role Badge */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800/30">
        <Shield className="w-4 h-4 text-blue-500 flex-shrink-0" />
        <span className="text-gray-600 dark:text-gray-400">Your role:</span>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(userRole)}`}>
          {userRole.replace('_', ' ')}
        </span>
        {isSuperAdmin && (
          <span className="text-xs bg-purple-200 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 px-2 py-0.5 rounded-full flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Full Access
          </span>
        )}
        {isAdmin && !isSuperAdmin && (
          <span className="text-xs bg-red-200 dark:bg-red-900/40 text-red-800 dark:text-red-300 px-2 py-0.5 rounded-full flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" /> Admin Access
          </span>
        )}
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
          <div className="flex-1 min-w-[200px] w-full sm:w-auto relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search users by name, email, phone..."
              value={searchQuery}
              onChange={handleSearch}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                aria-label="Clear search"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <select
              value={filters.role}
              onChange={(e) => handleFilterChange('role', e.target.value)}
              className="flex-1 sm:flex-none px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Roles</option>
              {isSuperAdmin && <option value="SUPER_ADMIN">Super Admin</option>}
              {(isAdmin || isSuperAdmin) && <option value="ADMIN">Admin</option>}
              <option value="MANAGER">Manager</option>
              <option value="EDITOR">Editor</option>
              <option value="VIEWER">Viewer</option>
              <option value="EMPLOYEE">Employee</option>
              <option value="CASHIER">Cashier</option>
              <option value="USER">User</option>
            </select>

            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="flex-1 sm:flex-none px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            {/* Group Filter */}
            {canManageGroups && availableGroups.length > 0 && (
              <select
                value={filters.groupId}
                onChange={(e) => handleFilterChange('groupId', e.target.value)}
                className="flex-1 sm:flex-none px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Groups</option>
                {availableGroups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            )}

            {/* Sort Dropdown */}
            <div className="relative" ref={sortMenuRef}>
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2 transition-colors"
              >
                <ArrowUpDown className="w-4 h-4" />
                <span className="hidden sm:inline">Sort</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {showSortMenu && (
                <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                  <button
                    onClick={() => handleSortChange('firstName')}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm transition-colors"
                  >
                    Name
                  </button>
                  <button
                    onClick={() => handleSortChange('email')}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm transition-colors"
                  >
                    Email
                  </button>
                  <button
                    onClick={() => handleSortChange('role')}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm transition-colors"
                  >
                    Role
                  </button>
                  <button
                    onClick={() => handleSortChange('createdAt')}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm transition-colors"
                  >
                    Date Created
                  </button>
                  <button
                    onClick={() => handleSortChange('lastLoginAt')}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm transition-colors"
                  >
                    Last Login
                  </button>
                </div>
              )}
            </div>

            {(searchQuery || filters.role || filters.status !== 'all' || filters.groupId) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilters({ role: '', status: 'all', businessUnitId: '', groupId: '' });
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                className="px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedUsers.size > 0 && (canManageUsers || isSuperAdmin || isAdmin) && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2 animate-slideIn">
          <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
            {selectedUsers.size} user{selectedUsers.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button 
              onClick={handleBulkActivate} 
              className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors flex items-center gap-1"
            >
              <UserCheck className="w-4 h-4" /> Activate
            </button>
            <button 
              onClick={handleBulkDeactivate} 
              className="px-3 py-1.5 bg-yellow-600 text-white rounded-lg text-sm hover:bg-yellow-700 transition-colors flex items-center gap-1"
            >
              <UserX className="w-4 h-4" /> Deactivate
            </button>
            {canManageGroups && (
              <button 
                onClick={() => setShowGroupAssignModal(true)} 
                className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors flex items-center gap-1"
              >
                <UsersRound className="w-4 h-4" /> Assign to Group
              </button>
            )}
            {(canDeleteUsers || isSuperAdmin || isAdmin) && (
              <button 
                onClick={handleBulkDelete} 
                className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            )}
            <button 
              onClick={() => setSelectedUsers(new Set())} 
              className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Users Table/Grid */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {viewMode === 'table' ? (
          // Table View
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="px-3 sm:px-4 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={selectedUsers.size === users.length && users.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">
                    Role
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                    Status
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                    Business Units
                  </th>
                  {canManageGroups && (
                    <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden xl:table-cell">
                      Groups
                    </th>
                  )}
                  <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                    Last Login
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={canManageGroups ? 8 : 7} className="px-4 py-12 text-center">
                      <UsersRound className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                      <p className="text-gray-500 dark:text-gray-400">No users found</p>
                      <p className="text-sm text-gray-400 dark:text-gray-500">
                        {searchQuery || filters.role || filters.status !== 'all' || filters.groupId
                          ? 'Try adjusting your search or filters' 
                          : 'Add a user to get started'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr 
                      key={user.id} 
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer"
                      onClick={() => handleUserSelect(user)}
                    >
                      <td className="px-3 sm:px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedUsers.has(user.id)}
                          onChange={() => handleSelectUser(user.id)}
                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-3 sm:px-4 py-3">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xs sm:text-sm font-semibold flex-shrink-0">
                            {getUserInitials(user.firstName, user.lastName)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate hidden sm:block">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 py-3 hidden sm:table-cell">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getRoleBadgeColor(user.role)}`}>
                          {user.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-3 hidden md:table-cell">
                        {getStatusBadge(user.isActive)}
                      </td>
                      <td className="px-3 sm:px-4 py-3 hidden lg:table-cell">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {user.businessUnits?.length || 0}
                        </span>
                      </td>
                      {canManageGroups && (
                        <td className="px-3 sm:px-4 py-3 hidden xl:table-cell">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {user.groupMemberships?.length || 0}
                          </span>
                        </td>
                      )}
                      <td className="px-3 sm:px-4 py-3 hidden md:table-cell">
                        <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {user.lastLoginAt 
                            ? getTimeAgo(user.lastLoginAt)
                            : 'Never'}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1 sm:gap-2">
                          <button
                            onClick={() => handleUserEdit(user)}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="Edit user"
                          >
                            <UserCog className="w-4 h-4 text-gray-500" />
                          </button>
                          <button
                            onClick={() => {
                              setUserToDelete(user);
                              setShowDeleteModal(true);
                            }}
                            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                            title="Delete user"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          // Grid View
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
            {users.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <UsersRound className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                <p className="text-gray-500 dark:text-gray-400">No users found</p>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  {searchQuery || filters.role || filters.status !== 'all' || filters.groupId
                    ? 'Try adjusting your search or filters' 
                    : 'Add a user to get started'}
                </p>
              </div>
            ) : (
              users.map((user) => (
                <div
                  key={user.id}
                  className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer border border-gray-200 dark:border-gray-600"
                  onClick={() => handleUserSelect(user)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                        {getUserInitials(user.firstName, user.lastName)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(user.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleSelectUser(user.id);
                      }}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                    />
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                      {user.role.replace('_', ' ')}
                    </span>
                    {getStatusBadge(user.isActive)}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Building className="w-3 h-3" />
                      {user.businessUnits?.length || 0} units
                    </span>
                    {canManageGroups && (
                      <span className="flex items-center gap-1">
                        <UsersRound className="w-3 h-3" />
                        {user.groupMemberships?.length || 0} groups
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {user.lastLoginAt ? getTimeAgo(user.lastLoginAt) : 'Never'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUserEdit(user);
                      }}
                      className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setUserToDelete(user);
                        setShowDeleteModal(true);
                      }}
                      className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-gray-500 dark:text-gray-400 text-center sm:text-left">
            Showing {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} users
          </span>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                .filter(page => 
                  page === 1 || 
                  page === pagination.totalPages || 
                  Math.abs(page - pagination.page) <= 2
                )
                .map((page, index, array) => (
                  <React.Fragment key={page}>
                    {index > 0 && array[index - 1] !== page - 1 && (
                      <span className="text-sm text-gray-400 px-1">...</span>
                    )}
                    <button
                      onClick={() => handlePageChange(page)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        pagination.page === page
                          ? 'bg-blue-600 text-white'
                          : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {page}
                    </button>
                  </React.Fragment>
                ))}
            </div>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Group Assignment Modal */}
      {showGroupAssignModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowGroupAssignModal(false)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <button
                onClick={() => setShowGroupAssignModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors z-10"
                aria-label="Close modal"
              >
                <XCircle className="w-6 h-6 text-gray-500 dark:text-gray-400" />
              </button>
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <UsersRound className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Assign to Group</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Assign {selectedUsers.size} selected user{selectedUsers.size !== 1 ? 's' : ''} to a group
                </p>
                <select
                  value={selectedGroupForAssign}
                  onChange={(e) => setSelectedGroupForAssign(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm mb-4"
                >
                  <option value="">Select a group...</option>
                  {availableGroups.map((group) => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
                <div className="flex flex-col sm:flex-row justify-center gap-3">
                  <button
                    onClick={() => setShowGroupAssignModal(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkAssignToGroup}
                    disabled={!selectedGroupForAssign || assigningToGroup}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {assigningToGroup ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UsersRound className="w-4 h-4" />
                    )}
                    Assign
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && userToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowDeleteModal(false)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors z-10"
                aria-label="Close modal"
              >
                <XCircle className="w-6 h-6 text-gray-500 dark:text-gray-400" />
              </button>
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete User</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Are you sure you want to delete <strong className="text-gray-900 dark:text-white">{userToDelete.firstName} {userToDelete.lastName}</strong>? 
                  <br />
                  <span className="text-sm text-red-600 dark:text-red-400">This action cannot be undone.</span>
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteUser(userToDelete.id)}
                    disabled={refreshing}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {refreshing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Delete User
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
