// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\users\add\page.tsx

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useAuth } from '../../../../../hooks/useAuth';
import { UserForm } from '../../../../../components/users/UserForm';
import { UserGroupManager } from '../../../../../components/users/UserGroupManager';
import {
  ArrowLeft, Lock, UserPlus, Loader2, Shield,
  Info, AlertCircle, CheckCircle, XCircle,
  Building2, Key, Users, Mail,
  Briefcase, UserCheck, UserCog, HelpCircle,
  Eye, EyeOff, Sparkles, Zap, AlertTriangle,
  RefreshCw, UsersRound, Crown, BarChart3
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { UserRole } from '../../../../../types/enums';


const PERMISSIONS = {
  USER_CREATE: 'user:create',
  USER_MANAGE: 'user:manage',
} as const;

// Stats Card Component
const StatsCard = ({ title, value, icon, bgColor }: any) => (
  <div className="card-brand p-4">
    <div className="flex items-center justify-between">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{title}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">{value}</p>
      </div>
      <div className={`p-3 rounded-lg ${bgColor || 'bg-gray-100 text-gray-600 dark:bg-gray-700/50 dark:text-gray-400'} flex-shrink-0`}>
        {icon}
      </div>
    </div>
  </div>
);

// Helper function to parse role
const parseRole = (role?: string): UserRole | undefined => {
  if (!role) return undefined;
  const validRoles: UserRole[] = [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.EDITOR,
    UserRole.VIEWER,
    UserRole.EMPLOYEE,
    UserRole.CASHIER,
    UserRole.USER
  ];
  return validRoles.find(r => r === role);
};

// Helper to create initial data
const createInitialData = (params: AddUserPageProps['searchParams']) => {
  if (!params) return undefined;
  const initialData: any = {};
  if (params.email) initialData.email = params.email;
  if (params.businessUnitId) initialData.businessUnitId = params.businessUnitId;
  const parsedRole = parseRole(params.role);
  if (parsedRole) initialData.role = parsedRole;
  return Object.keys(initialData).length > 0 ? initialData : undefined;
};

interface AddUserPageProps {
  searchParams?: {
    email?: string;
    role?: string;
    businessUnitId?: string;
    groupId?: string;
    source?: string;
    redirect?: string;
  };
}

export default function AddUserPage({ searchParams }: AddUserPageProps) {
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const { user: currentUser, can, isSuperAdmin, isAdmin, isLoading } = useAuth();

  // State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTips, setShowTips] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [lastCreatedUser, setLastCreatedUser] = useState<any>(null);
  const [showSuccessActions, setShowSuccessActions] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>(searchParams?.groupId);

  // Create initial data
  const initialData = createInitialData(searchParams);

  // Permission checks
  const hasAccess = isSuperAdmin || isAdmin || can(PERMISSIONS.USER_CREATE) || can(PERMISSIONS.USER_MANAGE);
  const canCreateSuperAdmin = isSuperAdmin;
  const canCreateAdmin = isSuperAdmin || isAdmin;
  const canCreateManager = isSuperAdmin || isAdmin || can(PERMISSIONS.USER_MANAGE);
  const canAssignPermissions = isSuperAdmin || isAdmin;

  // Available roles
  const availableRoles = useCallback(() => {
    const roles: { value: string; label: string; description: string; icon: React.ReactNode }[] = [];

    if (canCreateSuperAdmin) {
      roles.push({
        value: UserRole.SUPER_ADMIN,
        label: 'Super Admin',
        description: 'Full system access with all permissions',
        icon: <Crown className="w-4 h-4 text-secondary-500" />,
      });
    }

    if (canCreateAdmin) {
      roles.push({
        value: UserRole.ADMIN,
        label: 'Admin',
        description: 'Complete administrative access',
        icon: <Shield className="w-4 h-4 text-danger-500" />,
      });
    }

    if (canCreateManager) {
      roles.push({
        value: UserRole.MANAGER,
        label: 'Manager',
        description: 'Manage business units and teams',
        icon: <Briefcase className="w-4 h-4 text-brand-500" />,
      });
    }

    roles.push(
      {
        value: UserRole.EDITOR,
        label: 'Editor',
        description: 'Create and manage content',
        icon: <Eye className="w-4 h-4 text-success-500" />,
      },
      {
        value: UserRole.VIEWER,
        label: 'Viewer',
        description: 'Read-only access',
        icon: <Eye className="w-4 h-4 text-gray-500" />,
      },
      {
        value: UserRole.EMPLOYEE,
        label: 'Employee',
        description: 'Standard employee access',
        icon: <UserCheck className="w-4 h-4 text-brand-accent-500" />,
      },
      {
        value: UserRole.CASHIER,
        label: 'Cashier',
        description: 'Point of sale and transactions',
        icon: <Briefcase className="w-4 h-4 text-warning-500" />,
      },
      {
        value: UserRole.USER,
        label: 'User',
        description: 'Basic user access',
        icon: <UserPlus className="w-4 h-4 text-gray-400" />,
      }
    );

    return roles;
  }, [canCreateSuperAdmin, canCreateAdmin, canCreateManager]);

  // Role templates
  const roleTemplates = useCallback(() => [
    {
      id: 'admin-team',
      label: 'Admin Team',
      roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
      description: 'Full administrative access',
      icon: <Shield className="w-4 h-4 text-secondary-500" />,
      color: 'bg-secondary-100 text-secondary-800 dark:bg-secondary-900/30 dark:text-secondary-400',
    },
    {
      id: 'management',
      label: 'Management',
      roles: [UserRole.MANAGER, UserRole.EDITOR],
      description: 'Management and content',
      icon: <Briefcase className="w-4 h-4 text-brand-500" />,
      color: 'bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-400',
    },
    {
      id: 'operations',
      label: 'Operations',
      roles: [UserRole.EMPLOYEE, UserRole.CASHIER],
      description: 'Day-to-day operations',
      icon: <Users className="w-4 h-4 text-success-500" />,
      color: 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-400',
    },
    {
      id: 'viewers',
      label: 'Viewers',
      roles: [UserRole.VIEWER, UserRole.USER],
      description: 'Read-only access',
      icon: <Eye className="w-4 h-4 text-gray-500" />,
      color: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-400',
    },
  ], []);

  // Handlers
  const handleSuccess = useCallback((user?: any) => {
    setIsSubmitting(false);
    if (user) {
      setLastCreatedUser(user);
      setShowSuccessActions(true);
    }
    setSuccessMessage('User created successfully!');
    toast.success('User created successfully!');
  }, []);

  const handleCancel = useCallback(() => {
    if (!isSubmitting) {
      router.push('/admin/users');
    }
  }, [isSubmitting, router]);

  const handleError = useCallback((error: string) => {
    setErrorMessage(error);
    toast.error(error);
    setIsSubmitting(false);
  }, []);

  const handleReset = useCallback(() => {
    setFormKey(prev => prev + 1);
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(false);
    setLastCreatedUser(null);
    setShowSuccessActions(false);
    toast.success('Form has been reset');
  }, []);

  const handleCreateAnother = useCallback(() => {
    handleReset();
    setShowSuccessActions(false);
  }, [handleReset]);

  const handleViewUser = useCallback(() => {
    if (lastCreatedUser?.id) {
      router.push(`/admin/users/${lastCreatedUser.id}`);
    }
  }, [lastCreatedUser, router]);

  const handleSendInvite = useCallback(() => {
    if (lastCreatedUser?.email) {
      toast.success(`Invitation sent to ${lastCreatedUser.email}`);
    }
  }, [lastCreatedUser]);

  const handleGroupSelect = useCallback((groupId: string) => {
    setSelectedGroupId(groupId);
  }, []);

  const handleGroupsChange = useCallback(() => {
    toast.success('Groups updated');
  }, []);

  // Clear messages
  useEffect(() => {
    if (successMessage || errorMessage) {
      const timeout = setTimeout(() => {
        setSuccessMessage(null);
        setErrorMessage(null);
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [successMessage, errorMessage]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <Loader2 className="w-12 h-12 text-brand-500 animate-spin" />
        <p className="text-gray-500 dark:text-gray-400 mt-4">Loading...</p>
      </div>
    );
  }

  // Access denied
  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to create users.
        </p>
        <button
          onClick={() => router.push('/admin/users')}
          className="mt-4 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors flex items-center gap-2 focus-ring"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Users
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={handleCancel}
            disabled={isSubmitting}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 focus-ring"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <UserPlus className="w-6 h-6 sm:w-7 sm:h-7 text-brand-500 flex-shrink-0" />
              <span>Add New User</span>
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 hidden sm:block">
              Create a new user account with role, permissions, and assignments
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isSubmitting && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="hidden sm:inline">Creating user...</span>
            </div>
          )}
          <button
            onClick={() => setShowTips(!showTips)}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1 focus-ring"
          >
            <HelpCircle className="w-4 h-4" />
            <span className="hidden sm:inline text-sm">Tips</span>
          </button>
          <button
            onClick={handleReset}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1 focus-ring"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline text-sm">Reset</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatsCard
          title="Total Users"
          value="--"
          icon={<Users className="w-5 h-5" />}
          bgColor="bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400"
        />
        <StatsCard
          title="Active"
          value="--"
          icon={<UserCheck className="w-5 h-5" />}
          bgColor="bg-success-100 text-success-600 dark:bg-success-900/30 dark:text-success-400"
        />
        <StatsCard
          title="Roles Available"
          value={availableRoles().length}
          icon={<Shield className="w-5 h-5" />}
          bgColor="bg-secondary-100 text-secondary-600 dark:bg-secondary-900/30 dark:text-secondary-400"
        />
        <StatsCard
          title="Groups"
          value="--"
          icon={<UsersRound className="w-5 h-5" />}
          bgColor="bg-warning-100 text-warning-600 dark:bg-warning-900/30 dark:text-warning-400"
        />
        <StatsCard
          title="Business Units"
          value="--"
          icon={<Building2 className="w-5 h-5" />}
          bgColor="bg-brand-accent-100 text-brand-accent-600 dark:bg-brand-accent-900/30 dark:text-brand-accent-400"
        />
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-success-600 dark:text-success-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="text-success-700 dark:text-success-300">{successMessage}</span>
            {lastCreatedUser && (
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="text-xs bg-success-100 dark:bg-success-800 text-success-700 dark:text-success-300 px-2 py-1 rounded-full">
                  {lastCreatedUser.email}
                </span>
                <span className="text-xs bg-success-100 dark:bg-success-800 text-success-700 dark:text-success-300 px-2 py-1 rounded-full">
                  {lastCreatedUser.role}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="p-1 hover:bg-success-100 dark:hover:bg-success-800 rounded transition-colors focus-ring"
          >
            <XCircle className="w-5 h-5 text-success-600 dark:text-success-400" />
          </button>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-danger-600 dark:text-danger-400 flex-shrink-0 mt-0.5" />
          <span className="text-danger-700 dark:text-danger-300 flex-1">{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="p-1 hover:bg-danger-100 dark:hover:bg-danger-800 rounded transition-colors focus-ring"
          >
            <XCircle className="w-5 h-5 text-danger-600 dark:text-danger-400" />
          </button>
        </div>
      )}

      {/* Success Actions */}
      {showSuccessActions && lastCreatedUser && (
        <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-brand-800 dark:text-brand-300">
                User created successfully!
              </p>
              <p className="text-xs text-brand-600 dark:text-brand-400">
                What would you like to do next?
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleViewUser}
                className="px-3 py-1.5 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors flex items-center gap-2 focus-ring"
              >
                <Eye className="w-4 h-4" />
                View User
              </button>
              <button
                onClick={handleSendInvite}
                className="px-3 py-1.5 text-sm bg-success-600 text-white rounded-lg hover:bg-success-700 transition-colors flex items-center gap-2 focus-ring"
              >
                <Mail className="w-4 h-4" />
                Send Invite
              </button>
              <button
                onClick={handleCreateAnother}
                className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 focus-ring"
              >
                <UserPlus className="w-4 h-4" />
                Create Another
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Form */}
        <div className="xl:col-span-3">
          <div className="card-brand p-4 sm:p-6">
            <UserForm
              key={formKey}
              onSuccess={handleSuccess}
              onCancel={handleCancel}
              onError={handleError}
              onSubmittingChange={setIsSubmitting}
              initialData={initialData}
              availableRoles={availableRoles()}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="xl:col-span-1 space-y-6">
          {/* Role Templates */}
          <div className="card-brand p-4 sm:p-6">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-warning-500" />
              Quick Role Templates
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Click to auto-select the role
            </p>
            <div className="space-y-2">
              {roleTemplates().map((template) => (
                <button
                  key={template.id}
                  onClick={() => {
                    // Find and set the role in the form
                    const roleSelect = document.querySelector('select[name="role"]') as HTMLSelectElement;
                    if (roleSelect) {
                      const matchingRole = template.roles.find(r =>
                        Array.from(roleSelect.options).some(opt => opt.value === r)
                      );
                      if (matchingRole) {
                        roleSelect.value = matchingRole;
                        roleSelect.dispatchEvent(new Event('change', { bubbles: true }));
                        toast.success(`Applied "${template.label}" template`);
                      } else {
                        toast.error('Role not available');
                      }
                    }
                  }}
                  className={`w-full text-left px-3 py-2.5 text-sm border rounded-lg transition-all duration-200 flex items-center gap-3 hover:shadow-card-hover focus-ring ${
                    template.color
                  } border-gray-200 dark:border-gray-700`}
                >
                  <span className="flex-shrink-0">{template.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">{template.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{template.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Help Tips */}
          {showTips && (
            <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800/30 rounded-xl p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-brand-800 dark:text-brand-300 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Quick Tips
                </h4>
                <button
                  onClick={() => setShowTips(false)}
                  className="p-1 hover:bg-brand-100 dark:hover:bg-brand-800 rounded transition-colors focus-ring"
                >
                  <XCircle className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                </button>
              </div>
              <ul className="space-y-2.5 text-sm">
                <li className="flex items-start gap-2">
                  <Mail className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0" />
                  <span className="text-brand-700 dark:text-brand-400">Email must be unique and valid</span>
                </li>
                <li className="flex items-start gap-2">
                  <Key className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0" />
                  <span className="text-brand-700 dark:text-brand-400">Password must be at least 8 characters</span>
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0" />
                  <span className="text-brand-700 dark:text-brand-400">Choose appropriate role based on access needs</span>
                </li>
                <li className="flex items-start gap-2">
                  <Building2 className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0" />
                  <span className="text-brand-700 dark:text-brand-400">Business Unit can be assigned later</span>
                </li>
                <li className="flex items-start gap-2">
                  <UsersRound className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0" />
                  <span className="text-brand-700 dark:text-brand-400">Assign user to groups for easier management</span>
                </li>
              </ul>
            </div>
          )}

          {/* User Group Manager */}
          <div className="card-brand p-4 sm:p-6">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <UsersRound className="w-4 h-4 text-brand-500" />
              User Groups
            </h4>
            <UserGroupManager
              onGroupSelect={handleGroupSelect}
              selectedGroupId={selectedGroupId}
              onGroupsChange={handleGroupsChange}
              readOnly={!canAssignPermissions}
            />
          </div>

          {/* Quick Stats */}
          <div className="bg-brand-gradient rounded-xl p-4 sm:p-6 text-white">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Quick Stats
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-brand-100">Available Roles</span>
                <span className="font-semibold tabular-nums">{availableRoles().length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-100">Role Templates</span>
                <span className="font-semibold tabular-nums">{roleTemplates().length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
