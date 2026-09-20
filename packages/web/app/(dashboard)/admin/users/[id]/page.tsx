// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\users\[id]\page.tsx

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useUser as useClerkUser } from '@clerk/nextjs';
import { useAuth } from '../../../../../hooks/useAuth';
import { UserForm } from '../../../../../components/users/UserForm';
import { UserDetail } from '../../../../../components/users/UserDetail';
import { userService } from '../../../../../services/userService';
import { User } from '../../../../../types/user';
import {
  ArrowLeft, Edit, Trash2, Lock, Loader2, UserCog,
  AlertCircle, Shield, XCircle, CheckCircle, RefreshCw,
  Eye, EyeOff, UserCheck, UserX, Key, Building2,
  Calendar, Clock, Mail, Phone, Activity, Settings,
  MoreVertical, ChevronDown, ChevronUp, Info, AlertTriangle,
  FileText, Download, Printer, Copy, Check, LogOut,
  LogIn, ShieldCheck, ShieldAlert, ShieldX, UserPlus,
  UserMinus, BadgeCheck, Ban, RotateCcw, History,
  UsersRound, Network, FolderOpen, BarChart3,
  TrendingUp, TrendingDown, PieChart, CalendarDays,
  Clock3, Hash, Tag, Star, Heart, ThumbsUp,
  MessageSquare, Share2, Bookmark, Link2, Unlink,
  Plus, Minus, Zap, Sparkles, Award, Medal,
  Trophy, Target, Crosshair, Gauge,
  CreditCard, DollarSign, Percent, Store,
  ClipboardList, Truck, Boxes, Layers,
  Database, Server, Cloud, Wifi,
  Bluetooth, Battery, Sun, Moon, Wind,
  Droplet, Flame, Leaf, TreePine, Mountain,
  Waves, Compass, Map, Navigation, Route
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { PERMISSIONS } from '../../../../../types/permissions';
import { UserRole } from '../../../../../types/enums';

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

// Helper function to safely get role label
const getRoleLabel = (role: string | undefined): string => {
  if (!role) return 'User';
  return role.replace(/_/g, ' ');
};

// Helper function to safely get role badge color
const getRoleBadgeColor = (role: string | undefined): string => {
  if (!role) return 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-400 border-gray-200 dark:border-gray-600';

  const colors: Record<string, string> = {
    SUPER_ADMIN: 'bg-secondary-100 text-secondary-800 dark:bg-secondary-900/30 dark:text-secondary-400 border-secondary-200 dark:border-secondary-700',
    ADMIN: 'bg-danger-100 text-danger-800 dark:bg-danger-900/30 dark:text-danger-400 border-danger-200 dark:border-danger-700',
    MANAGER: 'bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-400 border-brand-200 dark:border-brand-700',
    EDITOR: 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-400 border-success-200 dark:border-success-700',
    VIEWER: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-400 border-gray-200 dark:border-gray-600',
    EMPLOYEE: 'bg-brand-accent-100 text-brand-accent-800 dark:bg-brand-accent-900/30 dark:text-brand-accent-400 border-brand-accent-200 dark:border-brand-accent-700',
    CASHIER: 'bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-400 border-warning-200 dark:border-warning-700',
    USER: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-400 border-gray-200 dark:border-gray-600',
  };
  return colors[role] || colors.USER;
};

// Get time ago helper
const getTimeAgo = (date: string) => {
  if (!date) return 'Never';
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
};

export default function UserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params?.id as string;
  const { user: clerkUser } = useClerkUser();
  const { user: currentUser, can, isSuperAdmin, isAdmin } = useAuth();

  // State management
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'permissions'>('overview');

  // Permission checks
  const hasAccess = isSuperAdmin || isAdmin || can(PERMISSIONS.USER_VIEW) || can(PERMISSIONS.USER_MANAGE);
  const canEdit = isSuperAdmin || isAdmin || can(PERMISSIONS.USER_EDIT) || can(PERMISSIONS.USER_MANAGE);
  const canDelete = isSuperAdmin || can(PERMISSIONS.USER_DELETE) || can(PERMISSIONS.USER_MANAGE);
  const canDeactivate = isSuperAdmin || isAdmin || can(PERMISSIONS.USER_EDIT) || can(PERMISSIONS.USER_MANAGE);
  const canManageGroups = isSuperAdmin || isAdmin || can(PERMISSIONS.USER_MANAGE);

  // Check if the ID is a reserved path
  const reservedPaths = useMemo(() => ['roles', 'add', 'create', 'new', 'bulk', 'export', 'import', 'invite', 'groups', 'settings'], []);
  const isReservedPath = reservedPaths.includes(userId);

  // Check if the ID is a Clerk ID (starts with 'user_') or a database ID
  const isClerkId = userId?.startsWith('user_') || userId?.startsWith('clerk_');

  // Load user data
  const loadUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let data: User;

      if (isClerkId) {
        try {
          data = await userService.getUserByClerkId(userId);
        } catch (err) {
          console.log('Falling back to identifier lookup...');
          data = await userService.getUserByIdentifier(userId);
        }
      } else {
        try {
          data = await userService.getUserById(userId);
        } catch (err) {
          console.log('Falling back to identifier lookup...');
          data = await userService.getUserByIdentifier(userId);
        }
      }

      // Ensure role has a default value
      if (data && !data.role) {
        data.role = UserRole.USER;
      }

      setUser(data);
    } catch (error: any) {
      console.error('Failed to load user:', error);
      setError(error?.message || 'Failed to load user. The user may not exist.');
      toast.error('Failed to load user');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [userId, isClerkId]);

  // Initial load
  useEffect(() => {
    if (isReservedPath) {
      router.push('/admin/users');
      return;
    }

    if (userId && hasAccess && !isReservedPath) {
      loadUser();
    }
  }, [userId, hasAccess, isReservedPath, loadUser, router]);

  // Clear messages after timeout
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
    setIsRefreshing(true);
    await loadUser();
    toast.success('User data refreshed');
  };

  const handleDelete = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      await userService.deleteUser(user.id);
      toast.success('User deleted successfully');
      router.push('/admin/users');
    } catch (error: any) {
      console.error('Failed to delete user:', error);
      setError(error?.message || 'Failed to delete user');
      toast.error('Failed to delete user');
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleDeactivate = async () => {
    if (!user) return;
    setIsDeactivating(true);
    try {
      await userService.deactivateUser(user.id);
      toast.success('User deactivated successfully');
      setShowDeactivateModal(false);
      await loadUser();
    } catch (error: any) {
      console.error('Failed to deactivate user:', error);
      setError(error?.message || 'Failed to deactivate user');
      toast.error('Failed to deactivate user');
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleActivate = async () => {
    if (!user) return;
    try {
      await userService.activateUser(user.id);
      toast.success('User activated successfully');
      await loadUser();
    } catch (error: any) {
      console.error('Failed to activate user:', error);
      setError(error?.message || 'Failed to activate user');
      toast.error('Failed to activate user');
    }
  };

  const handleCopyId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      setCopiedId(true);
      toast.success('User ID copied to clipboard');
      setTimeout(() => setCopiedId(false), 3000);
    }
  };

  const handleEditSuccess = () => {
    setIsEditing(false);
    setSuccessMessage('User updated successfully');
    toast.success('User updated successfully');
    loadUser();
  };

  const handleRetry = () => {
    loadUser();
  };

  const handleBack = () => {
    if (isEditing) {
      setIsEditing(false);
    } else {
      router.push('/admin/users');
    }
  };

  // Redirect if reserved path
  if (isReservedPath) {
    return null;
  }

  // Access Restricted
  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to view this user.
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
        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading user details...</p>
      </div>
    );
  }

  // Error State
  if (error || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <AlertCircle className="w-16 h-16 text-danger-500 mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">User Not Found</h3>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          {error || "The user you're looking for doesn't exist or may have been removed."}
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
            onClick={handleRetry}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 focus-ring"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Calculate stats
  const stats = {
    totalPermissions: user.permissions?.length || 0,
    totalGroups: user.groupMemberships?.length || 0,
    totalBusinessUnits: user.businessUnits?.length || 0,
    lastLogin: user.lastLoginAt ? getTimeAgo(user.lastLoginAt) : 'Never',
    joinedDate: new Date(user.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0 focus-ring"
            aria-label={isEditing ? 'Cancel editing' : 'Back to users'}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
                <UserCog className="w-6 h-6 sm:w-7 sm:h-7 text-brand-500 flex-shrink-0" />
                <span className="truncate">{isEditing ? 'Edit User' : `${user.firstName} ${user.lastName}`}</span>
              </h1>
              {!isEditing && (
                <>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${getRoleBadgeColor(user.role)}`}>
                    {getRoleLabel(user.role)}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1 whitespace-nowrap ${
                    user.isActive
                      ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400 border-success-200 dark:border-success-700'
                      : 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400 border-danger-200 dark:border-danger-700'
                  }`}>
                    {user.isActive ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </>
              )}
            </div>
            {!isEditing && user?.clerkId && (
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                  ID: {user.clerkId.substring(0, 20)}...
                </p>
                <button
                  onClick={handleCopyId}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 focus-ring"
                  title="Copy ID"
                >
                  {copiedId ? <Check className="w-3 h-3 text-success-500" /> : <Copy className="w-3 h-3 text-gray-400" />}
                </button>
              </div>
            )}
            {!isEditing && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 hidden sm:block">
                {user.email} • Joined {stats.joinedDate}
              </p>
            )}
          </div>
        </div>

        {!isEditing && (
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 focus-ring"
              title="Refresh user data"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>

            {/* Activate/Deactivate button */}
            {canDeactivate && user.role !== 'SUPER_ADMIN' && (
              user.isActive ? (
                <button
                  onClick={() => setShowDeactivateModal(true)}
                  className="px-4 py-2 bg-warning-600 text-white rounded-lg hover:bg-warning-700 transition-colors flex items-center gap-2 text-sm focus-ring"
                >
                  <UserX className="w-4 h-4" />
                  <span className="hidden sm:inline">Deactivate</span>
                </button>
              ) : (
                <button
                  onClick={handleActivate}
                  className="px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 transition-colors flex items-center gap-2 text-sm focus-ring"
                >
                  <UserCheck className="w-4 h-4" />
                  <span className="hidden sm:inline">Activate</span>
                </button>
              )
            )}

            {/* Edit button */}
            {canEdit && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors flex items-center gap-2 text-sm focus-ring"
              >
                <Edit className="w-4 h-4" />
                <span className="hidden sm:inline">Edit</span>
              </button>
            )}

            {/* Delete button */}
            {canDelete && user.role !== 'SUPER_ADMIN' && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 bg-danger-600 text-white rounded-lg hover:bg-danger-700 transition-colors flex items-center gap-2 text-sm focus-ring"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Delete</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stats Cards */}
      {!isEditing && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <StatsCard
            title="Email"
            value={user.email}
            icon={<Mail className="w-5 h-5" />}
            color="bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400"
            subtitle={user.phoneNumber || 'No phone'}
          />
          <StatsCard
            title="Role"
            value={getRoleLabel(user.role)}
            icon={<Shield className="w-5 h-5" />}
            color="bg-secondary-100 text-secondary-600 dark:bg-secondary-900/30 dark:text-secondary-400"
          />
          <StatsCard
            title="Permissions"
            value={stats.totalPermissions}
            icon={<Key className="w-5 h-5" />}
            color="bg-success-100 text-success-600 dark:bg-success-900/30 dark:text-success-400"
          />
          <StatsCard
            title="Groups"
            value={stats.totalGroups}
            icon={<UsersRound className="w-5 h-5" />}
            color="bg-warning-100 text-warning-600 dark:bg-warning-900/30 dark:text-warning-400"
          />
          <StatsCard
            title="Last Login"
            value={stats.lastLogin}
            icon={<Clock className="w-5 h-5" />}
            color="bg-brand-accent-100 text-brand-accent-600 dark:bg-brand-accent-900/30 dark:text-brand-accent-400"
          />
        </div>
      )}

      {/* Content */}
      {isEditing ? (
        <div className="card-brand p-4 sm:p-6">
          <UserForm
            userId={user.id}
            initialData={user}
            onSuccess={handleEditSuccess}
            onCancel={() => setIsEditing(false)}
          />
        </div>
      ) : (
        <UserDetail userId={user.id} />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-modal overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowDeleteModal(false)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors z-10 focus-ring"
                aria-label="Close modal"
              >
                <XCircle className="w-6 h-6 text-gray-500 dark:text-gray-400" />
              </button>
              <div className="text-center">
                <div className="w-16 h-16 bg-danger-100 dark:bg-danger-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8 text-danger-600 dark:text-danger-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete User</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Are you sure you want to delete <strong className="text-gray-900 dark:text-white">{user?.firstName || 'User'} {user?.lastName || ''}</strong>?
                  <br />
                  <span className="text-sm text-danger-600 dark:text-danger-400">This action cannot be undone.</span>
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-4 py-2 bg-danger-600 text-white rounded-lg hover:bg-danger-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 focus-ring"
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

      {/* Deactivate Confirmation Modal */}
      {showDeactivateModal && (
        <div className="fixed inset-0 z-modal overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowDeactivateModal(false)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <button
                onClick={() => setShowDeactivateModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors z-10 focus-ring"
                aria-label="Close modal"
              >
                <XCircle className="w-6 h-6 text-gray-500 dark:text-gray-400" />
              </button>
              <div className="text-center">
                <div className="w-16 h-16 bg-warning-100 dark:bg-warning-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <UserX className="w-8 h-8 text-warning-600 dark:text-warning-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Deactivate User</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Are you sure you want to deactivate <strong className="text-gray-900 dark:text-white">{user?.firstName || 'User'} {user?.lastName || ''}</strong>?
                  <br />
                  <span className="text-sm text-warning-600 dark:text-warning-400">They will no longer be able to access the system.</span>
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-3">
                  <button
                    onClick={() => setShowDeactivateModal(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeactivate}
                    disabled={isDeactivating}
                    className="px-4 py-2 bg-warning-600 text-white rounded-lg hover:bg-warning-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 focus-ring"
                  >
                    {isDeactivating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserX className="w-4 h-4" />
                    )}
                    Deactivate
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
