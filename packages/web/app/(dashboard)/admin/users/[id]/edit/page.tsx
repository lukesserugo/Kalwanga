// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\users\[id]\edit\page.tsx

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../../../../hooks/useAuth';
import { UserForm } from '../../../../../../components/users/UserForm';
import { userService } from '../../../../../../services/userService';
import {
  ArrowLeft, Lock, Loader2, AlertCircle,
  CheckCircle, XCircle, RefreshCw, UserCog,
  Mail, Phone, Shield, Building, Calendar,
  Clock, Users, Key, Edit, Save, X,
  Info, AlertTriangle, User, UserCheck,
  UserX, BadgeCheck, Ban, RotateCcw,
  History, Activity, Settings, MoreVertical
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { PERMISSIONS } from '../../../../../../types/permissions';
import { UserRole } from '../../../../../../types/enums';

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

// Helper function to get role label
const getRoleLabel = (role: string | undefined): string => {
  if (!role) return 'User';
  return role.replace(/_/g, ' ');
};

// Helper function to get role badge color
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

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params?.id as string;
  const { can, isSuperAdmin, isAdmin, user: currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showTips, setShowTips] = useState(true);

  const hasAccess = isSuperAdmin || isAdmin || can(PERMISSIONS.USER_EDIT);

  useEffect(() => {
    if (hasAccess && userId) {
      loadUser();
    }
  }, [hasAccess, userId]);

  const loadUser = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);

      const userData = await userService.getUserById(userId);
      setUser(userData);
    } catch (error: any) {
      console.error('Failed to load user:', error);
      setError(error?.message || 'Failed to load user');
      toast.error('Failed to load user');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadUser(false);
    toast.success('User data refreshed');
  };

  const handleSuccess = () => {
    setSaving(false);
    setSuccessMessage('User updated successfully');
    toast.success('User updated successfully');
    setTimeout(() => {
      router.push(`/admin/users/${userId}`);
    }, 1500);
  };

  const handleCancel = () => {
    if (!saving) {
      router.push(`/admin/users/${userId}`);
    }
  };

  const handleError = (error: string) => {
    setSaving(false);
    setError(error);
    toast.error(error);
  };

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

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to edit users.
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading user...</p>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <AlertCircle className="w-16 h-16 text-danger-500 mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">User Not Found</h3>
        <p className="text-gray-500 dark:text-gray-400 mt-2">{error || 'User not found'}</p>
        <div className="flex flex-wrap gap-3 mt-6 justify-center">
          <button
            onClick={() => router.push('/admin/users')}
            className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors flex items-center gap-2 focus-ring"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Users
          </button>
          <button
            onClick={() => loadUser()}
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={handleCancel}
            disabled={saving}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0 focus-ring"
            aria-label="Back to user"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
                <Edit className="w-6 h-6 sm:w-7 sm:h-7 text-brand-500 flex-shrink-0" />
                <span>Edit User</span>
              </h1>
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
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 hidden sm:block">
              {user.email} • Joined {stats.joinedDate}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {saving && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="hidden sm:inline">Saving...</span>
            </div>
          )}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || saving}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 focus-ring"
            title="Refresh user data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowTips(!showTips)}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1 focus-ring"
            title={showTips ? 'Hide tips' : 'Show tips'}
          >
            <Info className="w-4 h-4" />
            <span className="hidden sm:inline text-sm">Tips</span>
          </button>
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

      {/* Stats Cards */}
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
          icon={<Users className="w-5 h-5" />}
          color="bg-warning-100 text-warning-600 dark:bg-warning-900/30 dark:text-warning-400"
        />
        <StatsCard
          title="Last Login"
          value={stats.lastLogin}
          icon={<Clock className="w-5 h-5" />}
          color="bg-brand-accent-100 text-brand-accent-600 dark:bg-brand-accent-900/30 dark:text-brand-accent-400"
        />
      </div>

      {/* Help Tips */}
      {showTips && (
        <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800/30 rounded-xl p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-brand-800 dark:text-brand-300 flex items-center gap-2">
              <Info className="w-4 h-4" />
              Editing Tips
            </h4>
            <button
              onClick={() => setShowTips(false)}
              className="p-1 hover:bg-brand-100 dark:hover:bg-brand-800 rounded transition-colors focus-ring"
              aria-label="Hide tips"
            >
              <XCircle className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            </button>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <li className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0" />
              <span className="text-brand-700 dark:text-brand-400">
                Changing role affects user's default permissions
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Key className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0" />
              <span className="text-brand-700 dark:text-brand-400">
                Custom permissions override role defaults
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Users className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0" />
              <span className="text-brand-700 dark:text-brand-400">
                Group assignments can be managed separately
              </span>
            </li>
            <li className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-warning-600 mt-0.5 flex-shrink-0" />
              <span className="text-warning-700 dark:text-warning-400">
                Changes are saved immediately for the user
              </span>
            </li>
          </ul>
        </div>
      )}

      {/* User Form */}
      <div className="card-brand p-4 sm:p-6">
        <UserForm
          userId={userId}
          initialData={user}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
          onError={handleError}
          onSubmittingChange={setSaving}
        />
      </div>
    </div>
  );
}
