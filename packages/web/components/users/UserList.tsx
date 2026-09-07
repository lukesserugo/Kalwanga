// D:\Projects\Kalwanga\packages\web\components\users\UserList.tsx

'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { PermissionGuard } from '../common/PermissionGuard';
import { PERMISSIONS } from '../../types/permissions';
import { userService } from '../../services/userService';
import { toast } from 'react-hot-toast';
import { 
  Plus, Search, Filter, Edit, Trash2, 
  UserCheck, UserX, Mail, Phone, Shield, Users,
  ChevronLeft, ChevronRight, Download, RefreshCw,
  Loader2, CheckCircle, XCircle, AlertCircle,
  Building, Clock, Eye, Copy, Check,
  ArrowUpDown, SlidersHorizontal, Lock, Key,
  Grid, List, MoreVertical, UserPlus, Ban,
  RotateCcw, FileDown, FileJson, FileSpreadsheet,
  ChevronDown, ChevronUp, X, Info, AlertTriangle,
  UserCog, BadgeCheck, ShieldCheck, ShieldAlert,
  Activity, Calendar, Globe, Hash, Star, Heart,
  UsersRound, Network, GitBranch, GitMerge,
  FolderOpen, FolderClosed, FolderPlus, Tag,
  Tags, Layout, LayoutGrid, LayoutList,
  UserCog2, UserCircle, UserSquare,
  UserRound, UserRoundCheck, UserRoundCog,
  UserRoundPlus, UserRoundSearch, UserRoundX
} from 'lucide-react';
import { User as UserType, UserGroup, UserSearchParams } from '../../types/user';
import { UserRole } from '../../types/enums';

// Stats Card Component - Local definition to avoid import issues
const StatsCard = ({ title, value, icon, bgColor, subtitle, className = '' }: any) => (
  <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow ${className}`}>
    <div className="flex items-center justify-between">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{title}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-lg ${bgColor || 'bg-gray-100 text-gray-600 dark:bg-gray-700/50 dark:text-gray-400'} flex-shrink-0`}>
        {icon}
      </div>
    </div>
  </div>
);

interface UserListProps {
  initialUsers?: UserType[];
  onUserSelect?: (user: UserType) => void;
  onUserEdit?: (user: UserType) => void;
  onUserDelete?: (userId: string) => void;
  showActions?: boolean;
  showSearch?: boolean;
  showFilters?: boolean;
  showExport?: boolean;
  showAddButton?: boolean;
  showPagination?: boolean;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onSearchChange?: (query: string) => void;
  onFilterChange?: (filters: any) => void;
  currentPage?: number;
  totalPages?: number;
  totalUsers?: number;
  loading?: boolean;
  showGroupFilter?: boolean;
  showGroupColumn?: boolean;
  showStats?: boolean;
  className?: string;
}

export function UserList({ 
  initialUsers = [], 
  onUserSelect, 
  onUserEdit, 
  onUserDelete,
  showActions = true,
  showSearch = true,
  showFilters = true,
  showExport = true,
  showAddButton = true,
  showPagination = true,
  pageSize = 10,
  onPageChange,
  onSearchChange,
  onFilterChange,
  currentPage: controlledPage,
  totalPages: controlledTotalPages,
  totalUsers: controlledTotalUsers,
  loading: controlledLoading,
  showGroupFilter = false,
  showGroupColumn = false,
  showStats = true,
  className = '',
}: UserListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can, isSuperAdmin, isAdmin, userRole } = useAuth();
  
  // State management
  const [users, setUsers] = useState<UserType[]>(initialUsers);
  const [loading, setLoading] = useState(controlledLoading ?? false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchParams?.get('search') || '');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [internalPage, setInternalPage] = useState(1);
  const [internalTotalPages, setInternalTotalPages] = useState(1);
  const [internalTotalUsers, setInternalTotalUsers] = useState(initialUsers.length);
  const [filters, setFilters] = useState({
    role: searchParams?.get('role') || '',
    status: searchParams?.get('status') || 'all',
    businessUnitId: searchParams?.get('businessUnitId') || '',
    groupId: searchParams?.get('groupId') || '',
  });
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserType | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'createdAt',
    direction: 'desc',
  });
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<UserGroup[]>([]);
  const [showGroupAssignModal, setShowGroupAssignModal] = useState(false);
  const [selectedGroupForAssign, setSelectedGroupForAssign] = useState<string>('');
  const [assigningToGroup, setAssigningToGroup] = useState(false);
  
  // Refs
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);

  // Determine current page and totals
  const currentPage = controlledPage ?? internalPage;
  const totalPages = controlledTotalPages ?? internalTotalPages;
  const totalUsers = controlledTotalUsers ?? internalTotalUsers;

  // Permission checks
  const canEditUsers = can(PERMISSIONS.USER_EDIT) || isSuperAdmin || isAdmin;
  const canDeleteUsers = can(PERMISSIONS.USER_DELETE) || isSuperAdmin || isAdmin;
  const canManageUsers = can(PERMISSIONS.USER_MANAGE) || isSuperAdmin || isAdmin;
  const canExportUsers = can(PERMISSIONS.USER_EXPORT) || isSuperAdmin || isAdmin;
  const canViewUsers = can(PERMISSIONS.USER_VIEW) || isSuperAdmin || isAdmin;
  const canCreateUsers = can(PERMISSIONS.USER_CREATE) || isSuperAdmin || isAdmin;
  const canViewPermissions = isSuperAdmin || isAdmin || can(PERMISSIONS.USER_VIEW);
  const canManageGroups = isSuperAdmin || isAdmin || can(PERMISSIONS.USER_MANAGE);

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

  // Update users when initialUsers changes
  useEffect(() => {
    if (initialUsers && initialUsers.length > 0) {
      setUsers(initialUsers);
      setInternalTotalUsers(initialUsers.length);
      setInternalTotalPages(Math.ceil(initialUsers.length / pageSize) || 1);
    }
  }, [initialUsers, pageSize]);

  // Update loading state from props
  useEffect(() => {
    if (controlledLoading !== undefined) {
      setLoading(controlledLoading);
    }
  }, [controlledLoading]);

  // Reset selection when users list changes
  useEffect(() => {
    setSelectedUsers(new Set());
  }, [users.length]);

  // Load groups on mount
  useEffect(() => {
    if (canManageGroups) {
      loadAvailableGroups();
    }
  }, [canManageGroups, loadAvailableGroups]);

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

  // Debounced search
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    
    searchTimeout.current = setTimeout(() => {
      if (onSearchChange) {
        onSearchChange(searchQuery);
      }
      setInternalPage(1);
    }, 500);
    
    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [searchQuery, onSearchChange]);

  // Load users from API if no initial users provided
  const loadUsers = useCallback(async () => {
    if (initialUsers.length > 0) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Fix: Properly type the params with UserRole enum
      const params: UserSearchParams = {
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
        role: filters.role as UserRole | undefined,
        isActive: filters.status !== 'all' ? filters.status === 'active' : undefined,
        businessUnitId: filters.businessUnitId || undefined,
        sortBy: sortConfig.key,
        sortOrder: sortConfig.direction,
      };
      
      const response = await userService.getAllUsers(params);
      
      if (response && response.data) {
        setUsers(response.data);
        setInternalTotalUsers(response.total || response.data.length);
        setInternalTotalPages(response.totalPages || Math.ceil((response.total || response.data.length) / pageSize));
      }
    } catch (error: any) {
      console.error('Failed to load users:', error);
      setError(error?.message || 'Failed to load users');
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [initialUsers.length, currentPage, pageSize, searchQuery, filters, sortConfig]);

  // Load users on mount and when dependencies change
  useEffect(() => {
    if (initialUsers.length === 0) {
      loadUsers();
    }
  }, [loadUsers, initialUsers.length]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    if (initialUsers.length === 0) {
      await loadUsers();
    }
    if (canManageGroups) {
      await loadAvailableGroups();
    }
    setRefreshing(false);
    toast.success('Users refreshed');
  }, [initialUsers.length, loadUsers, canManageGroups, loadAvailableGroups]);

  // Handle select all
  const handleSelectAll = useCallback(() => {
    if (selectedUsers.size === users.length && users.length > 0) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.map(u => u.id)));
    }
  }, [selectedUsers, users]);

  // Handle select user
  const handleSelectUser = useCallback((userId: string) => {
    setSelectedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  }, []);

  // Handle bulk actions
  const handleBulkAction = useCallback(async (action: 'activate' | 'deactivate' | 'delete') => {
    if (selectedUsers.size === 0) return;
    
    const actionMap = {
      activate: { verb: 'activate', icon: <UserCheck className="w-4 h-4" /> },
      deactivate: { verb: 'deactivate', icon: <UserX className="w-4 h-4" /> },
      delete: { verb: 'delete', icon: <Trash2 className="w-4 h-4" /> },
    };
    
    if (!confirm(`Are you sure you want to ${actionMap[action].verb} ${selectedUsers.size} users?`)) return;
    
    try {
      setError(null);
      if (action === 'activate') {
        await userService.bulkActivateUsers(Array.from(selectedUsers));
      } else if (action === 'deactivate') {
        await userService.bulkDeactivateUsers(Array.from(selectedUsers));
      } else {
        await userService.bulkDeleteUsers(Array.from(selectedUsers));
      }
      
      toast.success(`Users ${actionMap[action].verb}d successfully`);
      setSelectedUsers(new Set());
      
      if (initialUsers.length === 0) {
        await loadUsers();
      } else if (onUserDelete) {
        Array.from(selectedUsers).forEach(id => onUserDelete(id));
      }
    } catch (error: any) {
      console.error(`Failed to ${action} users:`, error);
      setError(error?.message || `Failed to ${action} users`);
      toast.error(`Failed to ${action} users`);
    }
  }, [selectedUsers, initialUsers.length, loadUsers, onUserDelete]);

  // Handle bulk group assignment
  const handleBulkAssignToGroup = useCallback(async () => {
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
      
      if (initialUsers.length === 0) {
        await loadUsers();
      }
    } catch (error: any) {
      console.error('Failed to assign users to group:', error);
      toast.error('Failed to assign users to group');
    } finally {
      setAssigningToGroup(false);
    }
  }, [selectedUsers, selectedGroupForAssign, initialUsers.length, loadUsers]);

  // Handle delete click
  const handleDeleteClick = useCallback((user: UserType) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  }, []);

  // Handle confirm delete
  const handleConfirmDelete = useCallback(async () => {
    if (!userToDelete) return;
    
    setIsDeleting(true);
    try {
      setError(null);
      await userService.deleteUser(userToDelete.id);
      toast.success('User deleted successfully');
      setShowDeleteModal(false);
      setUserToDelete(null);
      setSelectedUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userToDelete.id);
        return newSet;
      });
      
      if (onUserDelete) {
        onUserDelete(userToDelete.id);
      }
      
      if (initialUsers.length === 0) {
        await loadUsers();
      }
    } catch (error: any) {
      console.error('Failed to delete user:', error);
      setError(error?.message || 'Failed to delete user');
      toast.error('Failed to delete user');
    } finally {
      setIsDeleting(false);
    }
  }, [userToDelete, initialUsers.length, loadUsers, onUserDelete]);

  // Handle export
  const handleExport = useCallback(async (format: 'csv' | 'excel' | 'json' = 'csv') => {
    if (!canExportUsers) {
      setError('You do not have permission to export users');
      toast.error('You do not have permission to export users');
      return;
    }
    
    setExportLoading(true);
    setError(null);
    try {
      const response = await userService.exportUsers(format);
      
      if (format === 'json' && typeof response === 'object') {
        const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `users_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else if (typeof response === 'string') {
        const blob = new Blob([response], { type: format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `users_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'csv'}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
      
      toast.success('Export completed successfully');
    } catch (error: any) {
      console.error('Failed to export users:', error);
      setError(error?.message || 'Failed to export users');
      toast.error('Failed to export users');
    } finally {
      setExportLoading(false);
    }
  }, [canExportUsers]);

  // Handle copy email
  const handleCopyEmail = useCallback((email: string) => {
    if (!email) return;
    navigator.clipboard.writeText(email).then(() => {
      setCopySuccess(email);
      toast.success('Email copied to clipboard');
      setTimeout(() => setCopySuccess(null), 2000);
    }).catch(() => {
      console.error('Failed to copy email');
      toast.error('Failed to copy email');
    });
  }, []);

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    if (onPageChange) {
      onPageChange(page);
    } else {
      setInternalPage(page);
    }
  }, [onPageChange]);

  // Handle sort change
  const handleSortChange = useCallback((key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
    setShowSortMenu(false);
  }, []);

  // Navigate to user detail
  const handleUserClick = useCallback((user: UserType) => {
    if (onUserSelect) {
      onUserSelect(user);
    } else if (user?.id) {
      const identifier = user.clerkId || user.id;
      router.push(`/admin/users/${identifier}`);
    }
  }, [onUserSelect, router]);

  // Navigate to user edit
  const handleEditClick = useCallback((user: UserType) => {
    if (onUserEdit) {
      onUserEdit(user);
    } else if (user?.id) {
      const identifier = user.clerkId || user.id;
      router.push(`/admin/users/${identifier}/edit`);
    }
  }, [onUserEdit, router]);

  // Navigate to user permissions
  const handlePermissionsClick = useCallback((user: UserType) => {
    if (user?.id) {
      const identifier = user.clerkId || user.id;
      router.push(`/admin/users/${identifier}/permissions`);
    }
  }, [router]);

  // Navigate to user activity
  const handleActivityClick = useCallback((user: UserType) => {
    if (user?.id) {
      const identifier = user.clerkId || user.id;
      router.push(`/admin/users/${identifier}/activity`);
    }
  }, [router]);

  // Get role badge color
  const getRoleBadgeColor = useCallback((role: string) => {
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
  }, []);

  // Get initials
  const getInitials = useCallback((firstName?: string, lastName?: string) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase() || '?';
  }, []);

  // Get status badge
  const getStatusBadge = useCallback((isActive: boolean) => {
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
  }, []);

  // Get time ago
  const getTimeAgo = useCallback((date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }, []);

  // Calculate stats
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter(u => u.isActive).length;
    const inactive = total - active;
    const roles = new Set(users.map(u => u.role)).size;
    const groups = new Set(users.flatMap(u => u.groupMemberships?.map(g => g.groupId) || [])).size;
    const newToday = users.filter(u => new Date(u.createdAt).toDateString() === new Date().toDateString()).length;
    
    return { total, active, inactive, roles, groups, newToday };
  }, [users]);

  // Filter users locally
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // Hide SUPER_ADMIN from non-superadmins
      if (user.role === 'SUPER_ADMIN' && !isSuperAdmin) {
        return false;
      }
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matches = 
          user.firstName?.toLowerCase().includes(query) ||
          user.lastName?.toLowerCase().includes(query) ||
          user.email?.toLowerCase().includes(query) ||
          user.phoneNumber?.toLowerCase().includes(query) ||
          `${user.firstName} ${user.lastName}`.toLowerCase().includes(query);
        if (!matches) return false;
      }
      
      if (filters.role && user.role !== filters.role) return false;
      if (filters.status === 'active' && !user.isActive) return false;
      if (filters.status === 'inactive' && user.isActive) return false;
      if (filters.groupId && user.groupMemberships) {
        const isInGroup = user.groupMemberships.some((gm: any) => gm.groupId === filters.groupId || gm.group?.id === filters.groupId);
        if (!isInGroup) return false;
      }
      
      return true;
    });
  }, [users, searchQuery, filters, isSuperAdmin]);

  // Sort users
  const sortedUsers = useMemo(() => {
    const sorted = [...filteredUsers];
    sorted.sort((a: any, b: any) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (aValue === undefined || aValue === null) return 1;
      if (bValue === undefined || bValue === null) return -1;
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }
      
      return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
    });
    return sorted;
  }, [filteredUsers, sortConfig]);

  // Paginate users
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedUsers.slice(start, start + pageSize);
  }, [sortedUsers, currentPage, pageSize]);

  // Calculate effective total pages
  const effectiveTotalPages = useMemo(() => {
    if (initialUsers.length > 0) {
      return Math.ceil(filteredUsers.length / pageSize) || 1;
    }
    return totalPages || 1;
  }, [initialUsers.length, filteredUsers.length, pageSize, totalPages]);

  // Loading state
  if (loading && users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading users...</p>
      </div>
    );
  }

  // Access denied state
  if (!canViewUsers) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Access Denied</h3>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          You don't have permission to view users.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          <span className="text-red-700 dark:text-red-300 text-sm flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="p-1 hover:bg-red-100 dark:hover:bg-red-800 rounded transition-colors"
            aria-label="Dismiss error"
          >
            <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      {showStats && !loading && users.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatsCard
            title="Total Users"
            value={stats.total}
            icon={<Users className="w-5 h-5" />}
            bgColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          />
          <StatsCard
            title="Active"
            value={stats.active}
            icon={<UserCheck className="w-5 h-5" />}
            bgColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
            subtitle={`${stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%`}
          />
          <StatsCard
            title="Inactive"
            value={stats.inactive}
            icon={<UserX className="w-5 h-5" />}
            bgColor="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
          />
          <StatsCard
            title="Roles"
            value={stats.roles}
            icon={<Shield className="w-5 h-5" />}
            bgColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
          />
          <StatsCard
            title="Groups"
            value={stats.groups}
            icon={<UsersRound className="w-5 h-5" />}
            bgColor="bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
          />
          <StatsCard
            title="New Today"
            value={stats.newToday}
            icon={<Calendar className="w-5 h-5" />}
            bgColor="bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400"
          />
        </div>
      )}

      {/* Search and Actions Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {showSearch && (
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search users by name, email, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              aria-label="Search users"
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
        )}

        {showFilters && (
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className={`p-2 border rounded-lg transition-colors ${
              showFilterPanel ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
            aria-label="Toggle filters"
          >
            <Filter className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          aria-label="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>

        {showExport && (
          <PermissionGuard permission={PERMISSIONS.USER_EXPORT} fallback={null}>
            <div className="relative group">
              <button
                disabled={exportLoading}
                className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                aria-label="Export"
              >
                {exportLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </button>
              <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 hidden group-hover:block z-10">
                <button 
                  onClick={() => handleExport('csv')} 
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm flex items-center gap-2"
                >
                  <FileDown className="w-4 h-4" /> Export as CSV
                </button>
                <button 
                  onClick={() => handleExport('excel')} 
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Export as Excel
                </button>
                <button 
                  onClick={() => handleExport('json')} 
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm flex items-center gap-2"
                >
                  <FileJson className="w-4 h-4" /> Export as JSON
                </button>
              </div>
            </div>
          </PermissionGuard>
        )}

        {showAddButton && (
          <PermissionGuard permission={PERMISSIONS.USER_CREATE}>
            <button
              onClick={() => router.push('/admin/users/add')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Add User</span>
            </button>
          </PermissionGuard>
        )}
      </div>

      {/* Filters Panel */}
      {showFilterPanel && (
        <div ref={filterPanelRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
              <select
                value={filters.role}
                onChange={(e) => {
                  setFilters(prev => ({ ...prev, role: e.target.value }));
                  if (onFilterChange) onFilterChange({ ...filters, role: e.target.value });
                  setInternalPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
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
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => {
                  setFilters(prev => ({ ...prev, status: e.target.value }));
                  if (onFilterChange) onFilterChange({ ...filters, status: e.target.value });
                  setInternalPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            {showGroupFilter && canManageGroups && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Group</label>
                <select
                  value={filters.groupId}
                  onChange={(e) => {
                    setFilters(prev => ({ ...prev, groupId: e.target.value }));
                    if (onFilterChange) onFilterChange({ ...filters, groupId: e.target.value });
                    setInternalPage(1);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="">All Groups</option>
                  {availableGroups.map((group) => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-end gap-2">
              <button
                onClick={() => {
                  setFilters({ role: '', status: 'all', businessUnitId: '', groupId: '' });
                  setSearchQuery('');
                  if (onFilterChange) onFilterChange({ role: '', status: 'all', businessUnitId: '', groupId: '' });
                  setInternalPage(1);
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 transition-colors flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Reset Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sort Menu */}
      <div className="relative" ref={sortMenuRef}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
          >
            <ArrowUpDown className="w-4 h-4" />
            Sort by: {sortConfig.key.charAt(0).toUpperCase() + sortConfig.key.slice(1)}
            {sortConfig.direction === 'asc' ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded transition-colors ${viewMode === 'table' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
              aria-label="Table view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
              aria-label="Grid view"
            >
              <Grid className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {showSortMenu && (
          <div className="absolute left-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
            {['firstName', 'lastName', 'email', 'role', 'createdAt', 'lastLoginAt'].map((key) => (
              <button
                key={key}
                onClick={() => handleSortChange(key)}
                className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm transition-colors"
              >
                {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedUsers.size > 0 && canManageUsers && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center justify-between flex-wrap gap-2">
          <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
            {selectedUsers.size} user{selectedUsers.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <button 
              onClick={() => handleBulkAction('activate')} 
              className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors flex items-center gap-1"
            >
              <UserCheck className="w-4 h-4" /> Activate
            </button>
            <button 
              onClick={() => handleBulkAction('deactivate')} 
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
            <PermissionGuard permission={PERMISSIONS.USER_DELETE} fallback={null}>
              <button 
                onClick={() => handleBulkAction('delete')} 
                className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </PermissionGuard>
            <button 
              onClick={() => setSelectedUsers(new Set())} 
              className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Users Display */}
      {paginatedUsers.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Users className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">No Users Found</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {searchQuery || filters.role !== '' || filters.status !== 'all' 
              ? 'No users match your search criteria.'
              : 'There are no users in the system yet.'}
          </p>
          {(searchQuery || filters.role !== '' || filters.status !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setFilters({ role: '', status: 'all', businessUnitId: '', groupId: '' });
                setInternalPage(1);
              }}
              className="mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <th className="p-4 text-left w-10">
                    <input
                      type="checkbox"
                      checked={selectedUsers.size === paginatedUsers.length && paginatedUsers.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                      aria-label="Select all users"
                    />
                  </th>
                  <th className="p-4 text-left text-sm font-medium text-gray-600 dark:text-gray-400">User</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-600 dark:text-gray-400 hidden sm:table-cell">Contact</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-600 dark:text-gray-400 hidden md:table-cell">Role</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-600 dark:text-gray-400 hidden md:table-cell">Status</th>
                  {showGroupColumn && canManageGroups && (
                    <th className="p-4 text-left text-sm font-medium text-gray-600 dark:text-gray-400 hidden lg:table-cell">Groups</th>
                  )}
                  {canViewPermissions && (
                    <th className="p-4 text-left text-sm font-medium text-gray-600 dark:text-gray-400 hidden xl:table-cell">Permissions</th>
                  )}
                  <th className="p-4 text-left text-sm font-medium text-gray-600 dark:text-gray-400 hidden sm:table-cell">Last Login</th>
                  {showActions && (
                    <th className="p-4 text-right text-sm font-medium text-gray-600 dark:text-gray-400">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((user) => (
                  <tr 
                    key={user.id} 
                    className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                    onClick={() => handleUserClick(user)}
                  >
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedUsers.has(user.id)}
                        onChange={() => handleSelectUser(user.id)}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                        aria-label={`Select ${user.firstName} ${user.lastName}`}
                      />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                          {getInitials(user.firstName, user.lastName)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                            {user.firstName} {user.lastName}
                          </p>
                          {user.clerkId && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                              ID: {user.clerkId.substring(0, 12)}...
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 hidden sm:table-cell">
                      <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                        <Mail className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate max-w-[150px]">{user.email}</span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyEmail(user.email);
                          }}
                          className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                          aria-label="Copy email"
                        >
                          {copySuccess === user.email ? (
                            <Check className="w-3 h-3 text-green-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                      {user.phoneNumber && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3" /> {user.phoneNumber}
                        </p>
                      )}
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getRoleBadgeColor(user.role)}`}>
                        {user.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      {getStatusBadge(user.isActive)}
                    </td>
                    {showGroupColumn && canManageGroups && (
                      <td className="p-4 hidden lg:table-cell">
                        {user.groupMemberships && user.groupMemberships.length > 0 ? (
                          <div className="flex items-center gap-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded text-xs font-medium">
                              <UsersRound className="w-3 h-3" />
                              {user.groupMemberships.length}
                            </span>
                            <span className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[100px]">
                              {user.groupMemberships.slice(0, 2).map((gm: any) => gm.group?.name || 'Unknown').join(', ')}
                              {user.groupMemberships.length > 2 && ` +${user.groupMemberships.length - 2}`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                        )}
                      </td>
                    )}
                    {canViewPermissions && (
                      <td className="p-4 hidden xl:table-cell">
                        {user.permissions && user.permissions.length > 0 ? (
                          <div className="flex items-center gap-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
                              <Key className="w-3 h-3" />
                              {user.permissions.length}
                            </span>
                            <span className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[100px]">
                              {user.permissions.slice(0, 2).join(', ')}
                              {user.permissions.length > 2 && ` +${user.permissions.length - 2}`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">Default</span>
                        )}
                      </td>
                    )}
                    <td className="p-4 text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                      {user.lastLoginAt ? getTimeAgo(user.lastLoginAt) : 'Never'}
                    </td>
                    {showActions && (
                      <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={() => handleUserClick(user)} 
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" 
                            title="View"
                            aria-label="View user"
                          >
                            <Eye className="w-4 h-4 text-gray-500" />
                          </button>
                          <PermissionGuard permission={PERMISSIONS.USER_EDIT} fallback={null}>
                            <button 
                              onClick={() => handleEditClick(user)} 
                              className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors" 
                              title="Edit"
                              aria-label="Edit user"
                            >
                              <Edit className="w-4 h-4 text-blue-600" />
                            </button>
                          </PermissionGuard>
                          <PermissionGuard permission={PERMISSIONS.USER_DELETE} fallback={null}>
                            {user.role !== 'SUPER_ADMIN' && (
                              <button 
                                onClick={() => handleDeleteClick(user)} 
                                className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors" 
                                title="Delete"
                                aria-label="Delete user"
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </button>
                            )}
                          </PermissionGuard>
                          <button
                            onClick={() => handlePermissionsClick(user)}
                            className="p-1.5 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
                            title="Permissions"
                            aria-label="Permissions"
                          >
                            <Key className="w-4 h-4 text-purple-600" />
                          </button>
                          <button
                            onClick={() => handleActivityClick(user)}
                            className="p-1.5 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                            title="Activity"
                            aria-label="Activity"
                          >
                            <Activity className="w-4 h-4 text-green-600" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {showPagination && effectiveTotalPages > 1 && (
            <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between flex-wrap gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, filteredUsers.length)} of {filteredUsers.length} users
              </span>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))} 
                  disabled={currentPage === 1} 
                  className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Page {currentPage} of {effectiveTotalPages}
                </span>
                <button 
                  onClick={() => handlePageChange(Math.min(effectiveTotalPages, currentPage + 1))} 
                  disabled={currentPage === effectiveTotalPages} 
                  className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginatedUsers.map((user) => (
            <div 
              key={user.id} 
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleUserClick(user)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
                    {getInitials(user.firstName, user.lastName)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={selectedUsers.has(user.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    handleSelectUser(user.id);
                  }}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  aria-label={`Select ${user.firstName} ${user.lastName}`}
                />
              </div>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeColor(user.role)}`}>
                  {user.role.replace('_', ' ')}
                </span>
                {getStatusBadge(user.isActive)}
                {user.phoneNumber && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {user.phoneNumber}
                  </span>
                )}
                {showGroupColumn && canManageGroups && user.groupMemberships && user.groupMemberships.length > 0 && (
                  <span className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1">
                    <UsersRound className="w-3 h-3" />
                    {user.groupMemberships.length} groups
                  </span>
                )}
                {canViewPermissions && user.permissions && user.permissions.length > 0 && (
                  <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <Key className="w-3 h-3" />
                    {user.permissions.length} permissions
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-700 flex-wrap justify-end">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUserClick(user);
                  }}
                  className="px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  View
                </button>
                <PermissionGuard permission={PERMISSIONS.USER_EDIT} fallback={null}>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditClick(user);
                    }}
                    className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                </PermissionGuard>
                <PermissionGuard permission={PERMISSIONS.USER_DELETE} fallback={null}>
                  {user.role !== 'SUPER_ADMIN' && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(user);
                      }}
                      className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </PermissionGuard>
                <button
                  onClick={() => handlePermissionsClick(user)}
                  className="px-3 py-1 text-sm text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                >
                  Permissions
                </button>
                <button
                  onClick={() => handleActivityClick(user)}
                  className="px-3 py-1 text-sm text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                >
                  Activity
                </button>
              </div>
            </div>
          ))}
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
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => setShowGroupAssignModal(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkAssignToGroup}
                    disabled={!selectedGroupForAssign || assigningToGroup}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 disabled:opacity-50"
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
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setUserToDelete(null);
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmDelete}
                    disabled={isDeleting}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {isDeleting ? (
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

export default UserList;
