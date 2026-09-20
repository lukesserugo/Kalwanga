// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\users\roles\page.tsx

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../../hooks/useAuth';
import { UserRole } from '../../../../../types/enums';
import { userService } from '../../../../../services/userService';
import {
  ArrowLeft, Shield, Users, Loader2, AlertCircle,
  CheckCircle, XCircle, Search, RefreshCw, UserCog,
  Key, Clock, ChevronDown, ChevronUp, Eye, Edit,
  Crown, Briefcase, CreditCard, UsersRound,
  Lock, Unlock, UserCheck, UserX, BadgeCheck,
  Ban, RotateCcw, History, Zap, Sparkles,
  Award, Medal, Trophy, Target, Crosshair,
  TrendingUp, TrendingDown, BarChart3, PieChart,
  Activity, Calendar, Mail, Phone, Building,
  Globe, Hash, Tag, Star, Heart, ThumbsUp,
  MessageSquare, Share2, Bookmark, FileText,
  Download, Upload, Printer, Send, Link2,
  Plus, Minus, Settings, Info, AlertTriangle,
  ShieldCheck, ShieldAlert, ShieldX, UserCog2,
  Grid, List, X
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { PERMISSIONS } from '../../../../../types/permissions';

interface RoleStats {
  role: UserRole;
  count: number;
  users: any[];
  activeCount?: number;
  inactiveCount?: number;
  percentage?: number;
  permissions?: string[];
}

interface RoleDefinition {
  role: UserRole;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  permissions: string[];
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

export default function UserRolesPage() {
  const router = useRouter();
  const { can, isSuperAdmin, isAdmin } = useAuth();

  // State management
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleStats[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showRoleDetails, setShowRoleDetails] = useState(false);
  const [selectedRoleDetails, setSelectedRoleDetails] = useState<RoleStats | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  const hasAccess = isSuperAdmin || isAdmin || can(PERMISSIONS.USER_VIEW);
  const canManageRoles = isSuperAdmin || can(PERMISSIONS.USER_MANAGE);

  // Role definitions
  const roleDefinitions: Record<UserRole, RoleDefinition> = useMemo(() => ({
    [UserRole.SUPER_ADMIN]: {
      role: UserRole.SUPER_ADMIN,
      label: 'Super Admin',
      description: 'Full system access with all permissions and controls',
      icon: <Crown className="w-5 h-5 text-secondary-500" />,
      color: 'bg-secondary-100 text-secondary-800 dark:bg-secondary-900/30 dark:text-secondary-400',
      permissions: ['All permissions', 'User management', 'System settings', 'Company management'],
    },
    [UserRole.ADMIN]: {
      role: UserRole.ADMIN,
      label: 'Admin',
      description: 'Administrative access with user and inventory management',
      icon: <Shield className="w-5 h-5 text-danger-500" />,
      color: 'bg-danger-100 text-danger-800 dark:bg-danger-900/30 dark:text-danger-400',
      permissions: ['User management', 'Inventory management', 'Report viewing', 'Settings access'],
    },
    [UserRole.MANAGER]: {
      role: UserRole.MANAGER,
      label: 'Manager',
      description: 'Manage business units, teams, and day-to-day operations',
      icon: <Briefcase className="w-5 h-5 text-brand-500" />,
      color: 'bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-400',
      permissions: ['Team management', 'Inventory viewing', 'Report creation', 'Business unit access'],
    },
    [UserRole.EDITOR]: {
      role: UserRole.EDITOR,
      label: 'Editor',
      description: 'Create and edit content, products, and inventory items',
      icon: <Edit className="w-5 h-5 text-success-500" />,
      color: 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-400',
      permissions: ['Content editing', 'Product management', 'Inventory updates', 'Category management'],
    },
    [UserRole.VIEWER]: {
      role: UserRole.VIEWER,
      label: 'Viewer',
      description: 'View-only access to reports, inventory, and business data',
      icon: <Eye className="w-5 h-5 text-gray-500" />,
      color: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-400',
      permissions: ['Report viewing', 'Inventory viewing', 'Product viewing', 'Read-only access'],
    },
    [UserRole.EMPLOYEE]: {
      role: UserRole.EMPLOYEE,
      label: 'Employee',
      description: 'Basic employee access for daily tasks and operations',
      icon: <Users className="w-5 h-5 text-brand-accent-500" />,
      color: 'bg-brand-accent-100 text-brand-accent-800 dark:bg-brand-accent-900/30 dark:text-brand-accent-400',
      permissions: ['Basic access', 'Task management', 'Time tracking', 'Communication tools'],
    },
    [UserRole.CASHIER]: {
      role: UserRole.CASHIER,
      label: 'Cashier',
      description: 'Point of sale access for processing transactions',
      icon: <CreditCard className="w-5 h-5 text-warning-500" />,
      color: 'bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-400',
      permissions: ['POS access', 'Transaction processing', 'Payment handling', 'Receipt generation'],
    },
    [UserRole.USER]: {
      role: UserRole.USER,
      label: 'User',
      description: 'Standard user access with basic functionality',
      icon: <UserCog className="w-5 h-5 text-gray-400" />,
      color: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-400',
      permissions: ['Basic access', 'Profile management', 'Personal dashboard', 'Help access'],
    },
  }), []);

  // Load roles data
  const loadRoles = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);

      // ✅ FIXED: No sortBy/sortOrder in UserSearchParams
      const response = await userService.getAllUsers({
        limit: 1000,
      });

      const users = Array.isArray(response)
        ? response
        : response.data || [];

      // Group by role
      const roleMap: Record<string, any[]> = {};
      users.forEach((user: any) => {
        if (!roleMap[user.role]) {
          roleMap[user.role] = [];
        }
        roleMap[user.role].push(user);
      });

      // Convert to array with statistics
      const roleStats: RoleStats[] = Object.entries(roleMap).map(([role, roleUsers]) => ({
        role: role as UserRole,
        count: roleUsers.length,
        users: roleUsers.slice(0, 5),
        activeCount: roleUsers.filter(u => u.isActive).length,
        inactiveCount: roleUsers.filter(u => !u.isActive).length,
        percentage: users.length > 0 ? (roleUsers.length / users.length) * 100 : 0,
        permissions: roleDefinitions[role as UserRole]?.permissions || [],
      }));

      // Sort locally
      roleStats.sort((a, b) => {
        if (sortOrder === 'asc') {
          return a.count - b.count;
        } else {
          return b.count - a.count;
        }
      });

      setRoles(roleStats);
      setTotalUsers(users.length);
      setLastUpdated(new Date());
    } catch (error: any) {
      console.error('Failed to load roles:', error);
      setError(error?.message || 'Failed to load roles');
      toast.error('Failed to load roles');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sortOrder, roleDefinitions]);

  // Initial load
  useEffect(() => {
    if (hasAccess) {
      loadRoles();
    } else {
      setLoading(false);
    }
  }, [hasAccess, loadRoles]);

  // Clear messages
  useEffect(() => {
    if (successMessage || error) {
      const timeout = setTimeout(() => {
        setSuccessMessage(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [successMessage, error]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRoles(false);
    toast.success('Roles refreshed successfully');
  };

  const handleRoleClick = (role: RoleStats) => {
    setSelectedRoleDetails(role);
    setShowRoleDetails(true);
  };

  const handleViewRoleUsers = (role: UserRole) => {
    router.push(`/admin/users?role=${role}`);
  };

  const handleSortToggle = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Filter roles
  const filteredRoles = useMemo(() => {
    let filtered = roles;

    if (selectedRole !== 'all') {
      filtered = filtered.filter(r => r.role === selectedRole);
    }

    if (searchQuery) {
      filtered = filtered.filter(r =>
        r.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
        roleDefinitions[r.role]?.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        roleDefinitions[r.role]?.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(r =>
        filterStatus === 'active' ? (r.activeCount || 0) > 0 : (r.inactiveCount || 0) > 0
      );
    }

    return filtered;
  }, [roles, selectedRole, searchQuery, roleDefinitions, filterStatus]);

  const getRoleIcon = (role: string) => {
    return roleDefinitions[role as UserRole]?.icon || <UserCog className="w-5 h-5 text-gray-400" />;
  };

  // Access Restricted
  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Shield className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to view user roles.
        </p>
        <div className="flex flex-wrap gap-3 mt-6 justify-center">
          <button
            onClick={() => router.push('/admin/users')}
            className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors flex items-center gap-2 focus-ring"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Users
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring"
          >
            Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Loading State
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading roles...</p>
      </div>
    );
  }

  // Error State
  if (error && roles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <AlertCircle className="w-16 h-16 text-danger-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Error Loading Roles</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">{error}</p>
        <div className="flex flex-wrap gap-3 mt-6 justify-center">
          <button
            onClick={() => router.push('/admin/users')}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring"
          >
            Back to Users
          </button>
          <button
            onClick={() => loadRoles()}
            className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors flex items-center gap-2 focus-ring"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const totalActive = roles.reduce((sum, r) => sum + (r.activeCount || 0), 0);
  const totalInactive = roles.reduce((sum, r) => sum + (r.inactiveCount || 0), 0);

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Success Message */}
      {successMessage && (
        <div className="bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-lg p-3 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-success-600 dark:text-success-400 flex-shrink-0" />
          <span className="text-success-700 dark:text-success-300 text-sm flex-1">{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="p-1 hover:bg-success-100 dark:hover:bg-success-800 rounded focus-ring">
            <XCircle className="w-5 h-5 text-success-600 dark:text-success-400" />
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-danger-600 dark:text-danger-400 flex-shrink-0" />
          <span className="text-danger-700 dark:text-danger-300 text-sm flex-1">{error}</span>
          <button onClick={() => setError(null)} className="p-1 hover:bg-danger-100 dark:hover:bg-danger-800 rounded focus-ring">
            <XCircle className="w-5 h-5 text-danger-600 dark:text-danger-400" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <button onClick={() => router.push('/admin/users')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex-shrink-0 focus-ring">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
              <Shield className="w-6 h-6 sm:w-7 sm:h-7 text-brand-500 flex-shrink-0" />
              <span>User Roles</span>
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex flex-wrap items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="tabular-nums">Total Users: {totalUsers}</span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline tabular-nums">Roles: {roles.length}</span>
              {lastUpdated && (
                <span className="text-xs text-gray-400 flex items-center gap-1 tabular-nums">
                  <Clock className="w-3 h-3" />
                  Updated: {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
            <button onClick={() => setViewMode('grid')} className={`p-2 focus-ring ${viewMode === 'grid' ? 'bg-brand-50 text-brand-600' : 'hover:bg-gray-50'}`}>
              <Grid className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('list')} className={`p-2 focus-ring ${viewMode === 'list' ? 'bg-brand-50 text-brand-600' : 'hover:bg-gray-50'}`}>
              <List className="w-4 h-4" />
            </button>
          </div>
          <button onClick={handleSortToggle} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 focus-ring">
            {sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button onClick={handleRefresh} disabled={refreshing} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 focus-ring">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatsCard title="Total Users" value={totalUsers} icon={<Users className="w-5 h-5" />} color="bg-brand-100 text-brand-600" />
        <StatsCard title="Active Users" value={totalActive} icon={<UserCheck className="w-5 h-5" />} color="bg-success-100 text-success-600" subtitle={`${totalUsers > 0 ? Math.round((totalActive / totalUsers) * 100) : 0}%`} />
        <StatsCard title="Inactive Users" value={totalInactive} icon={<UserX className="w-5 h-5" />} color="bg-danger-100 text-danger-600" />
        <StatsCard title="Total Roles" value={roles.length} icon={<Shield className="w-5 h-5" />} color="bg-secondary-100 text-secondary-600" />
        <StatsCard title="Most Common" value={roles.length > 0 ? roleDefinitions[roles[0]?.role]?.label || 'N/A' : 'N/A'} icon={<TrendingUp className="w-5 h-5" />} color="bg-warning-100 text-warning-600" subtitle={roles.length > 0 ? `${roles[0]?.count} users` : ''} />
      </div>

      {/* Search and Filter */}
      <div className="card-brand p-4">
        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
          <div className="flex-1 min-w-[200px] w-full sm:w-auto relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search roles..."
              value={searchQuery}
              onChange={handleSearch}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 focus-ring rounded">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>

          <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value as UserRole | 'all')} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent">
            <option value="all">All Roles</option>
            {Object.values(UserRole).map(role => (
              <option key={role} value={role}>{roleDefinitions[role]?.label || role.replace('_', ' ')}</option>
            ))}
          </select>

          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent">
            <option value="all">All Status</option>
            <option value="active">Has Active</option>
            <option value="inactive">Has Inactive</option>
          </select>

          {(searchQuery || selectedRole !== 'all' || filterStatus !== 'all') && (
            <button onClick={() => { setSearchQuery(''); setSelectedRole('all'); setFilterStatus('all'); }} className="px-3 py-2 text-sm text-danger-600 hover:bg-danger-50 rounded-lg focus-ring">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Roles Grid */}
      {filteredRoles.length === 0 ? (
        <div className="card-brand p-12 text-center">
          <Shield className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium">No Roles Found</h3>
          <p className="text-gray-500 mt-2">No roles match your search criteria.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredRoles.map((role) => {
            const definition = roleDefinitions[role.role];
            const percentage = role.percentage || 0;

            return (
              <div key={role.role} onClick={() => handleRoleClick(role)} className="card-brand p-5 hover:shadow-card-hover cursor-pointer transition-shadow group">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${definition?.color}`}>
                      {getRoleIcon(role.role)}
                    </div>
                    <div>
                      <h3 className="font-semibold">{definition?.label || role.role.replace('_', ' ')}</h3>
                      <p className="text-xs text-gray-500 hidden sm:block">{definition?.description}</p>
                    </div>
                  </div>
                  {canManageRoles && (
                    <button onClick={(e) => { e.stopPropagation(); handleViewRoleUsers(role.role); }} className="p-1 hover:bg-gray-100 rounded-lg opacity-0 group-hover:opacity-100 focus-ring">
                      <Eye className="w-4 h-4 text-gray-400" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-4 mb-4">
                  <div>
                    <p className="text-2xl font-bold tabular-nums">{role.count}</p>
                    <p className="text-xs text-gray-500">Users</p>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1 tabular-nums">
                      <span className="text-success-600">{role.activeCount || 0} Active</span>
                      <span className="text-danger-600">{role.inactiveCount || 0} Inactive</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-brand-500 h-2 rounded-full" style={{ width: `${Math.min(percentage, 100)}%` }} />
                    </div>
                    <p className="text-xs text-gray-500 mt-1 tabular-nums">{percentage.toFixed(1)}% of total</p>
                  </div>
                </div>

                {role.permissions && role.permissions.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-500 mb-2">Key Permissions:</p>
                    <div className="flex flex-wrap gap-1">
                      {role.permissions.slice(0, 3).map((permission, index) => (
                        <span key={index} className="px-2 py-0.5 bg-brand-50 text-brand-700 rounded text-xs">{permission}</span>
                      ))}
                      {role.permissions.length > 3 && (
                        <span className="text-xs text-brand-600 tabular-nums">+{role.permissions.length - 3} more</span>
                      )}
                    </div>
                  </div>
                )}

                {role.users.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs font-medium text-gray-500 mb-2">Recent Users:</p>
                    <div className="space-y-2">
                      {role.users.slice(0, 3).map((user: any) => (
                        <div key={user.id} onClick={(e) => { e.stopPropagation(); router.push(`/admin/users/${user.id}`); }} className="flex items-center gap-2 text-sm hover:bg-gray-50 p-2 rounded-lg cursor-pointer focus-ring">
                          <div className="w-7 h-7 rounded-full bg-brand-gradient flex items-center justify-center text-white text-xs font-medium">
                            {user.firstName?.[0]}{user.lastName?.[0]}
                          </div>
                          <span className="truncate flex-1">{user.firstName} {user.lastName}</span>
                          <span className={user.isActive ? 'text-success-600' : 'text-danger-600'}>
                            {user.isActive ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card-brand p-0 overflow-hidden">
          <div className="overflow-x-auto sidebar-scroll">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Users</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Active</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Inactive</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRoles.map((role) => {
                  const definition = roleDefinitions[role.role];
                  return (
                    <tr key={role.role} onClick={() => handleRoleClick(role)} className="hover:bg-gray-50 cursor-pointer">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${definition?.color}`}>
                            {getRoleIcon(role.role)}
                          </div>
                          <p className="font-medium">{definition?.label || role.role.replace('_', ' ')}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <p className="text-sm text-gray-600 truncate max-w-[200px]">{definition?.description}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium tabular-nums">{role.count}</span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-success-600 tabular-nums">{role.activeCount || 0}</span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-danger-600 tabular-nums">{role.inactiveCount || 0}</span>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleViewRoleUsers(role.role)} className="p-1.5 hover:bg-gray-100 rounded-lg focus-ring">
                            <Users className="w-4 h-4 text-gray-500" />
                          </button>
                          <button onClick={() => handleRoleClick(role)} className="p-1.5 hover:bg-gray-100 rounded-lg focus-ring">
                            <Eye className="w-4 h-4 text-gray-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Role Details Modal */}
      {showRoleDetails && selectedRoleDetails && (
        <div className="fixed inset-0 z-modal overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowRoleDetails(false)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto sidebar-scroll">
              <button onClick={() => setShowRoleDetails(false)} className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-lg focus-ring">
                <XCircle className="w-6 h-6 text-gray-500" />
              </button>

              <div className="flex items-center gap-4 mb-6">
                <div className={`w-16 h-16 rounded-lg flex items-center justify-center ${roleDefinitions[selectedRoleDetails.role]?.color}`}>
                  {getRoleIcon(selectedRoleDetails.role)}
                </div>
                <div>
                  <h3 className="text-xl font-bold">{roleDefinitions[selectedRoleDetails.role]?.label}</h3>
                  <p className="text-gray-500">{roleDefinitions[selectedRoleDetails.role]?.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold tabular-nums">{selectedRoleDetails.count}</p>
                  <p className="text-xs text-gray-500">Total Users</p>
                </div>
                <div className="bg-success-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-success-600 tabular-nums">{selectedRoleDetails.activeCount || 0}</p>
                  <p className="text-xs text-success-600">Active</p>
                </div>
                <div className="bg-danger-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-danger-600 tabular-nums">{selectedRoleDetails.inactiveCount || 0}</p>
                  <p className="text-xs text-danger-600">Inactive</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-4 border-t">
                <button onClick={() => { setShowRoleDetails(false); handleViewRoleUsers(selectedRoleDetails.role); }} className="flex-1 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 focus-ring">
                  View All Users
                </button>
                <button onClick={() => setShowRoleDetails(false)} className="px-4 py-2 border rounded-lg focus-ring">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
