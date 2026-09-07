// D:\Projects\Kalwanga\packages\web\components\users\UserDetail.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../types/permissions';
import { UserRole } from '../../types/enums';
import { userService } from '../../services/userService';
import { User, UserActivity, UserPermission, UserGroup, UserGroupMember } from '../../types/user';
import {
  ArrowLeft, Edit, Trash2, Mail, Phone, Shield, Building,
  Calendar, Clock, Activity, UserCheck, UserX, Loader2,
  CheckCircle, XCircle, AlertCircle, Download,
  Printer, Mail as MailIcon, PhoneCall, Key,
  Users, ChevronDown, ChevronUp, Copy, Check, RefreshCw,
  Plus, Lock, Search, Filter, MoreVertical, MapPin,
  Briefcase, BadgeCheck, UserPlus, UserMinus, Eye, EyeOff,
  Smartphone, Globe, Hash, Info, Settings, LogOut, LogIn,
  FileText, CreditCard, ShoppingCart, Package, TrendingUp,
  BarChart3, PieChart, DollarSign, Percent, Tag, Store,
  ClipboardList, Truck, Boxes, Layers, FolderTree,
  UsersRound, Network, GitBranch, GitMerge, FolderOpen,
  FolderClosed, FolderPlus, Star, Heart, ThumbsUp,
  MessageSquare, Share2, Bookmark
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface UserDetailProps {
  userId: string;
}

interface ActivityItem {
  id: string;
  action: string;
  description: string;
  timestamp: string;
  user: string;
  metadata?: Record<string, any>;
}

interface PermissionItem {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  category: string;
}

interface TabConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface GroupItem {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  role: UserRole;
  isLead: boolean;
  joinedAt: string;
  memberCount?: number;
  permissions?: string[];
}

export function UserDetail({ userId }: UserDetailProps) {
  const router = useRouter();
  const { can, isSuperAdmin, user: currentUser } = useAuth();
  
  // State management
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [availableGroups, setAvailableGroups] = useState<GroupItem[]>([]);
  const [showAllPermissions, setShowAllPermissions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingRole, setEditingRole] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole | ''>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [showPermissionDetails, setShowPermissionDetails] = useState(false);
  const [showAssignGroupModal, setShowAssignGroupModal] = useState(false);
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const [auditTrail, setAuditTrail] = useState<any[]>([]);
  const [loadingAuditTrail, setLoadingAuditTrail] = useState(false);

  // Permission checks
  const canEdit = useMemo(() => can(PERMISSIONS.USER_EDIT) || isSuperAdmin, [can, isSuperAdmin]);
  const canDelete = useMemo(() => can(PERMISSIONS.USER_DELETE) || isSuperAdmin, [can, isSuperAdmin]);
  const canManage = useMemo(() => can(PERMISSIONS.USER_MANAGE) || isSuperAdmin, [can, isSuperAdmin]);
  const canViewPermissions = useMemo(() => can(PERMISSIONS.USER_VIEW) || isSuperAdmin, [can, isSuperAdmin]);
  const canAssignBusinessUnits = useMemo(() => can(PERMISSIONS.USER_EDIT) || isSuperAdmin, [can, isSuperAdmin]);
  const canManageGroups = useMemo(() => can(PERMISSIONS.USER_MANAGE) || isSuperAdmin, [can, isSuperAdmin]);

  // Define tabs
  const tabs: TabConfig[] = useMemo(() => [
    { id: 'overview', label: 'Overview', icon: <Info className="w-4 h-4" /> },
    { id: 'permissions', label: 'Permissions', icon: <Shield className="w-4 h-4" /> },
    { id: 'groups', label: 'Groups', icon: <UsersRound className="w-4 h-4" /> },
    { id: 'business-units', label: 'Business Units', icon: <Building className="w-4 h-4" /> },
    { id: 'activity', label: 'Activity', icon: <Activity className="w-4 h-4" /> },
  ], []);

  // Load user data
  const loadUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      let data: User;
      
      const isClerkId = userId.startsWith('user_') || userId.startsWith('clerk_');
      
      if (isClerkId) {
        try {
          data = await userService.getUserByIdentifier(userId);
        } catch (err) {
          console.log('Falling back to Clerk ID lookup...');
          data = await userService.getUserByClerkId(userId);
        }
      } else {
        try {
          data = await userService.getUserById(userId);
        } catch (err) {
          console.log('Falling back to identifier lookup...');
          data = await userService.getUserByIdentifier(userId);
        }
      }
      
      setUser(data);
      setSelectedRole(data.role);
      
      // Load groups from user data
      if (data.groupMemberships && data.groupMemberships.length > 0) {
        const userGroups: GroupItem[] = data.groupMemberships.map((gm: any) => ({
          id: gm.group?.id || gm.groupId,
          name: gm.group?.name || 'Unknown Group',
          description: gm.group?.description,
          color: gm.group?.color,
          icon: gm.group?.icon,
          role: gm.role,
          isLead: gm.isLead,
          joinedAt: gm.joinedAt,
          memberCount: gm.group?.memberCount || gm.group?._count?.members || 0,
          permissions: gm.group?.permissions || [],
        }));
        setGroups(userGroups);
      }
    } catch (error: any) {
      console.error('Failed to load user:', error);
      setError(error?.message || 'Failed to load user. The user may not exist.');
      toast.error('Failed to load user details');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Load activities
  const loadActivities = useCallback(async () => {
    try {
      const response = await userService.getUserActivity(userId, { limit: 10 });
      const data = response.data || [];
      setActivities(data.map((activity: any) => ({
        id: activity.id,
        action: activity.action || 'UNKNOWN',
        description: activity.description || `${activity.action} action performed`,
        timestamp: activity.createdAt || activity.timestamp || new Date().toISOString(),
        user: activity.user || 'System',
        metadata: activity.metadata || activity.details,
      })));
    } catch (error) {
      console.error('Failed to load activities:', error);
      setActivities([
        {
          id: '1',
          action: 'LOGIN',
          description: 'User logged in',
          timestamp: new Date().toISOString(),
          user: 'System',
        },
        {
          id: '2',
          action: 'UPDATE',
          description: 'Profile updated',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          user: 'Self',
        },
        {
          id: '3',
          action: 'ROLE_CHANGE',
          description: 'Role changed to ADMIN',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          user: 'Admin',
        },
      ]);
    }
  }, [userId]);

  // Load permissions
  const loadPermissions = useCallback(async () => {
    try {
      const permissionStrings = await userService.getUserPermissions(userId);
      const formattedPermissions: PermissionItem[] = permissionStrings.map((p: string) => {
        const [resource, action] = p.split(':');
        return {
          id: p,
          name: `${action?.charAt(0).toUpperCase()}${action?.slice(1)} ${resource?.charAt(0).toUpperCase()}${resource?.slice(1)}`,
          resource: resource || 'general',
          action: action || 'view',
          description: `Permission to ${action || 'view'} ${resource || 'resource'}`,
          category: resource || 'general',
        };
      });
      setPermissions(formattedPermissions);
    } catch (error) {
      console.error('Failed to load permissions:', error);
      setPermissions([
        { id: 'user:view', name: 'View Users', resource: 'user', action: 'view', description: 'View user details', category: 'user' },
        { id: 'user:edit', name: 'Edit Users', resource: 'user', action: 'edit', description: 'Edit user details', category: 'user' },
        { id: 'category:view', name: 'View Categories', resource: 'category', action: 'view', description: 'View categories', category: 'category' },
      ]);
    }
  }, [userId]);

  // Load available groups
  const loadAvailableGroups = useCallback(async () => {
    try {
      const response = await userService.getGroups({ limit: 100, isActive: true });
      if (response?.data && Array.isArray(response.data)) {
        const allGroups: GroupItem[] = response.data.map((group: any) => ({
          id: group.id,
          name: group.name,
          description: group.description,
          color: group.color,
          icon: group.icon,
          role: UserRole.USER,
          isLead: false,
          joinedAt: '',
          memberCount: group.memberCount || group._count?.members || 0,
          permissions: group.permissions || [],
        }));
        setAvailableGroups(allGroups);
      }
    } catch (error) {
      console.error('Failed to load available groups:', error);
      setAvailableGroups([]);
    }
  }, []);

  // Load audit trail
  const loadAuditTrail = useCallback(async () => {
    try {
      setLoadingAuditTrail(true);
      const response = await userService.getUserAuditTrail(userId, { limit: 20 });
      setAuditTrail(response.data || []);
    } catch (error) {
      console.error('Failed to load audit trail:', error);
      setAuditTrail([]);
    } finally {
      setLoadingAuditTrail(false);
    }
  }, [userId]);

  // Initial data load
  useEffect(() => {
    if (userId) {
      loadUser();
      loadActivities();
      loadPermissions();
      loadAvailableGroups();
    }
  }, [userId, loadUser, loadActivities, loadPermissions, loadAvailableGroups]);

  // Handle user actions
  const handleDeactivate = async () => {
    if (!user) return;
    setShowDeactivateConfirm(true);
  };

  const confirmDeactivate = async () => {
    if (!user) return;
    try {
      setSaving(true);
      await userService.deactivateUser(user.id);
      toast.success('User deactivated successfully');
      await loadUser();
    } catch (error) {
      console.error('Failed to deactivate user:', error);
      toast.error('Failed to deactivate user');
    } finally {
      setSaving(false);
      setShowDeactivateConfirm(false);
    }
  };

  const handleActivate = async () => {
    if (!user) return;
    try {
      setSaving(true);
      await userService.activateUser(user.id);
      toast.success('User activated successfully');
      await loadUser();
    } catch (error) {
      console.error('Failed to activate user:', error);
      toast.error('Failed to activate user');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!user) return;
    try {
      setSaving(true);
      await userService.deleteUser(user.id);
      toast.success('User deleted successfully');
      router.push('/admin/users');
    } catch (error) {
      console.error('Failed to delete user:', error);
      toast.error('Failed to delete user');
    } finally {
      setSaving(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleRoleUpdate = async () => {
    if (!user || !selectedRole) return;
    try {
      setSaving(true);
      await userService.updateUserRole(user.id, selectedRole as UserRole);
      toast.success('User role updated successfully');
      await loadUser();
      setEditingRole(false);
    } catch (error) {
      console.error('Failed to update role:', error);
      toast.error('Failed to update role');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyEmail = () => {
    if (user?.email) {
      navigator.clipboard.writeText(user.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
      toast.success('Email copied to clipboard');
    }
  };

  const handleCopyId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      toast.success('User ID copied to clipboard');
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadUser(), loadActivities(), loadPermissions(), loadAvailableGroups()]);
    setIsRefreshing(false);
    toast.success('User data refreshed');
  };

  const handleBack = () => {
    router.push('/admin/users');
  };

  const handleEdit = () => {
    if (user) {
      router.push(`/admin/users/edit/${user.id}`);
    }
  };

  const handlePermissionToggle = async (permissionId: string) => {
    if (!user || !canManage) return;
    try {
      const currentPermissions = user.permissions || [];
      const newPermissions = currentPermissions.includes(permissionId)
        ? currentPermissions.filter(p => p !== permissionId)
        : [...currentPermissions, permissionId];
      
      await userService.updateUserPermissions(user.id, newPermissions);
      toast.success('Permissions updated');
      await loadUser();
      await loadPermissions();
    } catch (error) {
      console.error('Failed to update permissions:', error);
      toast.error('Failed to update permissions');
    }
  };

  // Handle group assignment
  const handleAssignGroup = async (groupId: string) => {
    if (!user || !canManageGroups) return;
    try {
      setSaving(true);
      await userService.assignUsersToGroup(groupId, [user.id]);
      toast.success('User assigned to group');
      setShowAssignGroupModal(false);
      await loadUser();
      await loadAvailableGroups();
    } catch (error) {
      console.error('Failed to assign group:', error);
      toast.error('Failed to assign group');
    } finally {
      setSaving(false);
    }
  };

  // Handle group removal
  const handleRemoveGroup = async (groupId: string) => {
    if (!user) return;
    try {
      setSaving(true);
      await userService.removeUsersFromGroup(groupId, [user.id]);
      toast.success('User removed from group');
      await loadUser();
      await loadAvailableGroups();
    } catch (error) {
      console.error('Failed to remove group:', error);
      toast.error('Failed to remove group');
    } finally {
      setSaving(false);
    }
  };

  // Filter groups not already assigned
  const filteredAvailableGroups = useMemo(() => {
    const assignedGroupIds = new Set(groups.map(g => g.id));
    let available = availableGroups.filter(g => !assignedGroupIds.has(g.id));
    
    if (groupSearchQuery) {
      const query = groupSearchQuery.toLowerCase();
      available = available.filter(g => 
        g.name.toLowerCase().includes(query) ||
        g.description?.toLowerCase().includes(query)
      );
    }
    
    return available;
  }, [availableGroups, groups, groupSearchQuery]);

  // Helper functions
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

  const getActionIcon = useCallback((action: string) => {
    switch (action.toUpperCase()) {
      case 'LOGIN':
        return <LogIn className="w-4 h-4 text-green-500" />;
      case 'LOGOUT':
        return <LogOut className="w-4 h-4 text-red-500" />;
      case 'CREATE':
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case 'UPDATE':
        return <Edit className="w-4 h-4 text-yellow-500" />;
      case 'DELETE':
        return <Trash2 className="w-4 h-4 text-red-500" />;
      case 'ROLE_CHANGE':
        return <Shield className="w-4 h-4 text-purple-500" />;
      case 'PERMISSION_CHANGE':
        return <Key className="w-4 h-4 text-indigo-500" />;
      case 'PASSWORD_CHANGE':
        return <Lock className="w-4 h-4 text-orange-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  }, []);

  const getInitials = useCallback((firstName?: string, lastName?: string) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  }, []);

  const getTimeAgo = useCallback((date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);

    if (months > 0) return `${months}mo ago`;
    if (weeks > 0) return `${weeks}w ago`;
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }, []);

  const formatDate = useCallback((date: string) => {
    return new Date(date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }, []);

  const formatDateTime = useCallback((date: string) => {
    return new Date(date).toLocaleString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  // Filter permissions based on search
  const filteredPermissions = useMemo(() => {
    if (!searchQuery) return permissions;
    return permissions.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.resource.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.action.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [permissions, searchQuery]);

  // Group permissions by resource
  const groupedPermissions = useMemo(() => {
    const groups: Record<string, PermissionItem[]> = {};
    filteredPermissions.forEach(p => {
      if (!groups[p.resource]) {
        groups[p.resource] = [];
      }
      groups[p.resource].push(p);
    });
    return groups;
  }, [filteredPermissions]);

  // Loading State
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading user details...</p>
      </div>
    );
  }

  // Error State
  if (error || !user) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">User Not Found</h3>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          {error || "The user you're looking for doesn't exist or may have been removed."}
        </p>
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => router.push('/admin/users')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Users
          </button>
          <button
            onClick={loadUser}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete User</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete {user.firstName} {user.lastName}? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={saving}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Confirmation Modal */}
      {showDeactivateConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <UserX className="w-6 h-6 text-yellow-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Deactivate User</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to deactivate {user.firstName} {user.lastName}? They will no longer be able to access the system.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeactivateConfirm(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeactivate}
                disabled={saving}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Group Modal */}
      {showAssignGroupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Assign to Group</h3>
              <button
                onClick={() => setShowAssignGroupModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search groups..."
                value={groupSearchQuery}
                onChange={(e) => setGroupSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2">
              {filteredAvailableGroups.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  No available groups to assign
                </p>
              ) : (
                filteredAvailableGroups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => handleAssignGroup(group.id)}
                    disabled={saving}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${group.color || 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                        <UsersRound className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{group.name}</p>
                        {group.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">{group.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{group.memberCount || 0} members</span>
                      <Plus className="w-4 h-4 text-blue-500" />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Back to users"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-2xl font-semibold shadow-lg">
              {getInitials(user.firstName, user.lastName)}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {user.firstName} {user.lastName}
                </h1>
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getRoleBadgeColor(user.role)}`}>
                  {user.role.replace('_', ' ')}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${
                  user.isActive 
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-700'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-700'
                }`}>
                  {user.isActive ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {user.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-sm text-gray-500 dark:text-gray-400">{user.email}</span>
                <button
                  onClick={handleCopyEmail}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  title="Copy email"
                >
                  {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-gray-400" />}
                </button>
                {user.id && (
                  <button
                    onClick={handleCopyId}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    title="Copy user ID"
                  >
                    <Hash className="w-3 h-3" />
                    ID: {user.id.substring(0, 8)}...
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          
          {canManage && user.role !== 'SUPER_ADMIN' && (
            <>
              {user.isActive ? (
                <button
                  onClick={handleDeactivate}
                  disabled={saving}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <UserX className="w-4 h-4" />
                  Deactivate
                </button>
              ) : (
                <button
                  onClick={handleActivate}
                  disabled={saving}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <UserCheck className="w-4 h-4" />
                  Activate
                </button>
              )}
            </>
          )}
          
          {canEdit && (
            <button
              onClick={handleEdit}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
          )}
          
          {canDelete && user.role !== 'SUPER_ADMIN' && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Role</p>
              <p className="font-semibold text-gray-900 dark:text-white text-sm">{user.role.replace('_', ' ')}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Building className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Business Units</p>
              <p className="font-semibold text-gray-900 dark:text-white">{user.businessUnits?.length || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Key className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Permissions</p>
              <p className="font-semibold text-gray-900 dark:text-white">{permissions.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <UsersRound className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Groups</p>
              <p className="font-semibold text-gray-900 dark:text-white">{groups.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Last Login</p>
              <p className="font-semibold text-gray-900 dark:text-white text-sm">
                {user.lastLoginAt ? getTimeAgo(user.lastLoginAt) : 'Never'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.id === 'groups' && groups.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-full">
                  {groups.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Contact Information</h3>
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <Mail className="w-5 h-5 text-gray-400" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                  <p className="font-medium text-gray-900 dark:text-white">{user.email}</p>
                </div>
                <button 
                  onClick={handleCopyEmail}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                  title="Copy email"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
                </button>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <Phone className="w-5 h-5 text-gray-400" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Phone</p>
                  <p className="font-medium text-gray-900 dark:text-white">{user.phoneNumber || 'N/A'}</p>
                </div>
                {user.phoneNumber && (
                  <a 
                    href={`tel:${user.phoneNumber}`}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                    title="Call"
                  >
                    <PhoneCall className="w-4 h-4 text-gray-400" />
                  </a>
                )}
              </div>
              {user.company && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <Store className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Company</p>
                    <p className="font-medium text-gray-900 dark:text-white">{user.company.name}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Account Information</h3>
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Joined</p>
                  <p className="font-medium text-gray-900 dark:text-white">{formatDate(user.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <Clock className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Last Login</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Never'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <Shield className="w-5 h-5 text-gray-400" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Role</p>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getRoleBadgeColor(user.role)}`}>
                      {user.role.replace('_', ' ')}
                    </span>
                    {canManage && user.role !== 'SUPER_ADMIN' && !editingRole && (
                      <button
                        onClick={() => setEditingRole(true)}
                        className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
                      >
                        Change
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {editingRole && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                    className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={saving}
                  >
                    <option value="">Select role...</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                    <option value="ADMIN">Admin</option>
                    <option value="MANAGER">Manager</option>
                    <option value="EDITOR">Editor</option>
                    <option value="VIEWER">Viewer</option>
                    <option value="EMPLOYEE">Employee</option>
                    <option value="CASHIER">Cashier</option>
                    <option value="USER">User</option>
                  </select>
                  <button
                    onClick={handleRoleUpdate}
                    disabled={saving || !selectedRole}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                  >
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditingRole(false)}
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Permissions Tab */}
        {activeTab === 'permissions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">User Permissions</h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search permissions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <span className="text-sm text-gray-500">{filteredPermissions.length} permissions</span>
                {canManage && (
                  <button 
                    onClick={() => setShowPermissionDetails(!showPermissionDetails)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-1"
                  >
                    <Settings className="w-4 h-4" />
                    Manage
                  </button>
                )}
              </div>
            </div>
            
            {showPermissionDetails ? (
              <div className="space-y-4">
                {Object.entries(groupedPermissions).map(([resource, perms]) => (
                  <div key={resource} className="space-y-2">
                    <h4 className="font-medium text-gray-700 dark:text-gray-300 capitalize">{resource}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {perms.map((perm) => (
                        <div key={perm.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">{perm.action}</p>
                              <p className="text-xs text-gray-500">{perm.description}</p>
                            </div>
                          </div>
                          {canManage && (
                            <button
                              onClick={() => handlePermissionToggle(perm.id)}
                              className="text-red-600 hover:text-red-700 dark:text-red-400 text-xs font-medium"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {(showAllPermissions ? filteredPermissions : filteredPermissions.slice(0, 8)).map((perm) => (
                    <div key={perm.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {perm.resource}:{perm.action}
                      </span>
                    </div>
                  ))}
                </div>
                {filteredPermissions.length > 8 && (
                  <button
                    onClick={() => setShowAllPermissions(!showAllPermissions)}
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 font-medium"
                  >
                    {showAllPermissions ? (
                      <>Show Less <ChevronUp className="w-4 h-4" /></>
                    ) : (
                      <>Show All ({filteredPermissions.length - 8} more) <ChevronDown className="w-4 h-4" /></>
                    )}
                  </button>
                )}
              </>
            )}
            
            {filteredPermissions.length === 0 && (
              <div className="text-center py-8">
                <Shield className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                <p className="text-gray-500 dark:text-gray-400">No permissions found</p>
                <p className="text-sm text-gray-400">
                  {searchQuery ? 'Try adjusting your search' : 'This user has no specific permissions assigned'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Groups Tab */}
        {activeTab === 'groups' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">User Groups</h3>
              {canManageGroups && (
                <button
                  onClick={() => setShowAssignGroupModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Assign Group
                </button>
              )}
            </div>
            
            {groups.length === 0 ? (
              <div className="text-center py-8">
                <UsersRound className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                <p className="text-gray-500 dark:text-gray-400">No groups assigned</p>
                <p className="text-sm text-gray-400">This user is not a member of any group</p>
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map((group) => (
                  <div key={group.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${group.color || 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                        <UsersRound className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{group.name}</p>
                        {group.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">{group.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeColor(group.role)}`}>
                            {group.role.replace('_', ' ')}
                          </span>
                          {group.isLead && (
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full font-medium">
                              Group Lead
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            Joined: {formatDate(group.joinedAt)}
                          </span>
                        </div>
                        {group.permissions && group.permissions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {group.permissions.slice(0, 3).map((perm) => (
                              <span key={perm} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded">
                                {perm}
                              </span>
                            ))}
                            {group.permissions.length > 3 && (
                              <span className="text-xs text-gray-400">+{group.permissions.length - 3} more</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {canManageGroups && (
                      <button
                        onClick={() => handleRemoveGroup(group.id)}
                        disabled={saving}
                        className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        title="Remove from group"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Business Units Tab */}
        {activeTab === 'business-units' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Business Units</h3>
              {canAssignBusinessUnits && (
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-1">
                  <Plus className="w-4 h-4" />
                  Assign Unit
                </button>
              )}
            </div>
            {user.businessUnits?.map((bu: any) => (
              <div key={bu.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <Building className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {bu.businessUnit?.name || 'Unknown Unit'}
                    </p>
                    {bu.businessUnit?.code && (
                      <p className="text-xs text-gray-500">Code: {bu.businessUnit.code}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeColor(bu.role)}`}>
                        {bu.role.replace('_', ' ')}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                        bu.isActive 
                          ? 'bg-green-100 text-green-700 border-green-200' 
                          : 'bg-red-100 text-red-700 border-red-200'
                      }`}>
                        {bu.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
                {canAssignBusinessUnits && (
                  <button 
                    className="text-red-600 hover:text-red-700 dark:text-red-400 text-sm font-medium"
                    onClick={async () => {
                      if (confirm('Remove user from this business unit?')) {
                        try {
                          await userService.removeBusinessUnit(user.id, bu.businessUnitId);
                          toast.success('User removed from business unit');
                          await loadUser();
                        } catch (error) {
                          console.error('Failed to remove business unit:', error);
                          toast.error('Failed to remove business unit');
                        }
                      }
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            {(!user.businessUnits || user.businessUnits.length === 0) && (
              <div className="text-center py-8">
                <Building className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                <p className="text-gray-500 dark:text-gray-400">No business units assigned</p>
                <p className="text-sm text-gray-400">This user is not assigned to any business unit</p>
              </div>
            )}
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Recent Activity</h3>
              <div className="flex items-center gap-2">
                <button 
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button 
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Print"
                  onClick={() => window.print()}
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => {
                    setShowAuditTrail(!showAuditTrail);
                    if (!showAuditTrail) loadAuditTrail();
                  }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Toggle audit trail"
                >
                  <FileText className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {/* Audit Trail Section */}
            {showAuditTrail && (
              <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Audit Trail</h4>
                {loadingAuditTrail ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  </div>
                ) : auditTrail.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No audit trail entries found</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {auditTrail.map((entry: any) => (
                      <div key={entry.id} className="flex items-start gap-2 text-sm">
                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-full font-medium shrink-0">
                          {entry.action}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-700 dark:text-gray-300 truncate">
                            {entry.entityType}: {entry.entityName || entry.entityId}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(entry.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            <div className="space-y-3">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center shrink-0">
                    {getActionIcon(activity.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white">{activity.description}</p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {getTimeAgo(activity.timestamp)}
                      </span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        By: {activity.user}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                        activity.action === 'LOGIN' 
                          ? 'bg-green-100 text-green-700 border-green-200'
                          : activity.action === 'DELETE'
                          ? 'bg-red-100 text-red-700 border-red-200'
                          : 'bg-blue-100 text-blue-700 border-blue-200'
                      }`}>
                        {activity.action.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {activities.length === 0 && (
                <div className="text-center py-8">
                  <Activity className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                  <p className="text-gray-500 dark:text-gray-400">No activity found</p>
                  <p className="text-sm text-gray-400">This user hasn't performed any actions yet</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default UserDetail;
