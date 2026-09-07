// D:\Projects\Kalwanga\packages\web\components\users\UserGroupManager.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import { businessUnitService } from '../../services/businessUnitService';
import { PERMISSIONS } from '../../types/permissions';
import { UserRole } from '../../types/enums';
import { toast } from 'react-hot-toast';
import {
  UsersRound, Plus, X, Search, Edit2, Trash2, 
  Loader2, CheckCircle, XCircle, AlertCircle,
  Shield, User, Mail, Calendar, Clock, MoreVertical,
  ChevronDown, ChevronUp, FolderOpen, FolderClosed,
  UserPlus, UserMinus, UserCheck, UserX,
  Settings, Hash, Tag, Palette, ImageIcon,
  Copy, Check, RefreshCw, ArrowLeft, ArrowRight,
  Menu, Grid, List, Filter, SortAsc, SortDesc,
  Eye, EyeOff, Lock, Unlock, Archive, Trash,
  PlusCircle, MinusCircle, Move, GitBranch,
  Share2, Bookmark, Star, Heart, ThumbsUp,
  MessageSquare, Link, ExternalLink, Download,
  Upload, FileText, Printer, Send, Mail as MailIcon,
  Briefcase, Building, Store, Globe, Crown, Award,
  Zap, Sparkles, Rocket, Target, Flag, Gift
} from 'lucide-react';

interface UserGroup {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  permissions: string[];
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
  members?: GroupMember[];
  businessUnitId?: string;
}

interface GroupMember {
  userId: string;
  role: UserRole;
  joinedAt: string;
  isLead: boolean;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
}

interface CreateGroupData {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  permissions?: string[];
  members?: Array<{
    userId: string;
    role?: UserRole;
    isLead?: boolean;
  }>;
  businessUnitId?: string;
}

interface UpdateGroupData {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  permissions?: string[];
  isActive?: boolean;
  businessUnitId?: string;
}

interface UserGroupManagerProps {
  onGroupSelect?: (groupId: string) => void;
  selectedGroupId?: string;
  onGroupsChange?: () => void;
  readOnly?: boolean;
}

// Pre-defined colors for groups
const GROUP_COLORS = [
  { name: 'Red', value: 'bg-red-500', text: 'text-red-500' },
  { name: 'Blue', value: 'bg-blue-500', text: 'text-blue-500' },
  { name: 'Green', value: 'bg-green-500', text: 'text-green-500' },
  { name: 'Yellow', value: 'bg-yellow-500', text: 'text-yellow-500' },
  { name: 'Purple', value: 'bg-purple-500', text: 'text-purple-500' },
  { name: 'Pink', value: 'bg-pink-500', text: 'text-pink-500' },
  { name: 'Indigo', value: 'bg-indigo-500', text: 'text-indigo-500' },
  { name: 'Cyan', value: 'bg-cyan-500', text: 'text-cyan-500' },
  { name: 'Orange', value: 'bg-orange-500', text: 'text-orange-500' },
  { name: 'Teal', value: 'bg-teal-500', text: 'text-teal-500' },
];

// Pre-defined icons for groups
const GROUP_ICONS = [
  { name: 'Users', component: <UsersRound className="w-5 h-5" /> },
  { name: 'Star', component: <Star className="w-5 h-5" /> },
  { name: 'Heart', component: <Heart className="w-5 h-5" /> },
  { name: 'Briefcase', component: <Briefcase className="w-5 h-5" /> },
  { name: 'Folder', component: <FolderOpen className="w-5 h-5" /> },
  { name: 'Tag', component: <Tag className="w-5 h-5" /> },
  { name: 'Shield', component: <Shield className="w-5 h-5" /> },
  { name: 'Settings', component: <Settings className="w-5 h-5" /> },
  { name: 'Globe', component: <Globe className="w-5 h-5" /> },
  { name: 'Bookmark', component: <Bookmark className="w-5 h-5" /> },
];

// Pre-defined permission templates for groups
const GROUP_PERMISSION_TEMPLATES = {
  ADMIN: {
    label: 'Admin Access',
    permissions: [
      'user:view', 'user:create', 'user:edit', 'user:delete',
      'inventory:view', 'inventory:create', 'inventory:edit', 'inventory:delete',
      'product:view', 'product:create', 'product:edit', 'product:delete',
      'report:view', 'report:create', 'report:export',
      'settings:view', 'settings:edit'
    ]
  },
  MANAGER: {
    label: 'Manager Access',
    permissions: [
      'user:view',
      'inventory:view', 'inventory:create', 'inventory:edit',
      'product:view', 'product:create', 'product:edit',
      'report:view', 'report:create'
    ]
  },
  EDITOR: {
    label: 'Editor Access',
    permissions: [
      'inventory:view', 'inventory:create', 'inventory:edit',
      'product:view', 'product:create', 'product:edit',
      'report:view'
    ]
  },
  VIEWER: {
    label: 'Viewer Access',
    permissions: [
      'inventory:view',
      'product:view',
      'report:view'
    ]
  }
};

interface BusinessUnit {
  id: string;
  name: string;
  code: string;
  isActive?: boolean;
}

export function UserGroupManager({ 
  onGroupSelect, 
  selectedGroupId,
  onGroupsChange,
  readOnly = false
}: UserGroupManagerProps) {
  const { can, isSuperAdmin, isAdmin } = useAuth();
  
  // State
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<UserGroup | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'members' | 'created'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterActive, setFilterActive] = useState<boolean | null>(null);
  
  // Form state for create/edit
  const [formData, setFormData] = useState<CreateGroupData>({
    name: '',
    description: '',
    icon: 'Users',
    color: 'bg-blue-500',
    permissions: [],
    members: [],
    businessUnitId: '',
  });
  
  // Member management
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberRole, setMemberRole] = useState<UserRole>(UserRole.USER);
  const [memberIsLead, setMemberIsLead] = useState(false);

  const canManageGroups = isSuperAdmin || isAdmin || can(PERMISSIONS.USER_MANAGE);
  const isReadOnly = readOnly || !canManageGroups;

  // Load business units
  const loadBusinessUnits = useCallback(async () => {
    try {
      const response = await businessUnitService?.getAllBusinessUnits?.();
      
      if (response && Array.isArray(response)) {
        setBusinessUnits(response);
      } else if (response?.data && Array.isArray(response.data)) {
        setBusinessUnits(response.data);
      }
    } catch (error) {
      console.error('Failed to load business units:', error);
      setBusinessUnits([
        { id: 'bu_1', name: 'Headquarters', code: 'HQ', isActive: true },
        { id: 'bu_2', name: 'Branch 1', code: 'BR1', isActive: true },
        { id: 'bu_3', name: 'Branch 2', code: 'BR2', isActive: true },
        { id: 'bu_4', name: 'Warehouse', code: 'WH', isActive: true },
      ]);
    }
  }, []);

  // Load groups
  const loadGroups = useCallback(async () => {
    try {
      setLoading(true);
      const response = await userService.getGroups({ 
        limit: 100,
        isActive: filterActive !== null ? filterActive : undefined
      });
      
      if (response?.data && Array.isArray(response.data)) {
        setGroups(response.data);
        // Select first group if none selected
        if (!selectedGroupId && response.data.length > 0) {
          setSelectedGroup(response.data[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load groups:', error);
      toast.error('Failed to load user groups');
    } finally {
      setLoading(false);
    }
  }, [filterActive]);

  // Load available users for member management
  const loadAvailableUsers = useCallback(async () => {
    try {
      const response = await userService.getAllUsers({ 
        limit: 100, 
        isActive: true 
      });
      if (response?.data && Array.isArray(response.data)) {
        setAvailableUsers(response.data);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  }, []);

  // Load group members
  const loadGroupMembers = useCallback(async (groupId: string) => {
    try {
      const response = await userService.getGroupMembers(groupId, { limit: 100 });
      if (response?.data && Array.isArray(response.data)) {
        setSelectedGroup(prev => prev ? { ...prev, members: response.data } : null);
      }
    } catch (error) {
      console.error('Failed to load group members:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadBusinessUnits();
    loadGroups();
    if (canManageGroups) {
      loadAvailableUsers();
    }
  }, [loadGroups, loadAvailableUsers, canManageGroups, loadBusinessUnits]);

  // Handle group selection
  useEffect(() => {
    if (selectedGroupId && groups.length > 0) {
      const group = groups.find(g => g.id === selectedGroupId);
      if (group) {
        setSelectedGroup(group);
        loadGroupMembers(group.id);
      }
    }
  }, [selectedGroupId, groups, loadGroupMembers]);

  // Filter groups
  const filteredGroups = useMemo(() => {
    let result = groups;
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(g => 
        g.name.toLowerCase().includes(search) ||
        g.description?.toLowerCase().includes(search)
      );
    }
    
    if (filterActive !== null) {
      result = result.filter(g => g.isActive === filterActive);
    }
    
    // Sort
    result = [...result].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'members':
          comparison = (a.memberCount || 0) - (b.memberCount || 0);
          break;
        case 'created':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [groups, searchTerm, filterActive, sortBy, sortOrder]);

  // Create group
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Group name is required');
      return;
    }
    
    try {
      setLoading(true);
      const data: CreateGroupData = {
        name: formData.name.trim(),
        description: formData.description?.trim() || undefined,
        icon: formData.icon,
        color: formData.color,
        permissions: formData.permissions || [],
        businessUnitId: formData.businessUnitId || undefined,
        members: selectedMembers.map(userId => ({
          userId,
          role: memberRole,
          isLead: memberIsLead
        }))
      };
      
      const result = await userService.createGroup(data);
      toast.success('Group created successfully!');
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        icon: 'Users',
        color: 'bg-blue-500',
        permissions: [],
        members: [],
        businessUnitId: '',
      });
      setSelectedMembers([]);
      setShowCreateModal(false);
      
      // Reload groups
      await loadGroups();
      onGroupsChange?.();
      
      // Select the new group
      if (result?.id) {
        setSelectedGroup(result);
        onGroupSelect?.(result.id);
      }
    } catch (error: any) {
      console.error('Failed to create group:', error);
      toast.error(error?.message || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  // Update group
  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup) return;
    if (!formData.name.trim()) {
      toast.error('Group name is required');
      return;
    }
    
    try {
      setLoading(true);
      const data: UpdateGroupData = {
        name: formData.name.trim(),
        description: formData.description?.trim() || undefined,
        icon: formData.icon,
        color: formData.color,
        permissions: formData.permissions || [],
        isActive: selectedGroup.isActive,
        businessUnitId: formData.businessUnitId || undefined,
      };
      
      await userService.updateGroup(selectedGroup.id, data);
      toast.success('Group updated successfully!');
      
      setShowEditModal(false);
      await loadGroups();
      onGroupsChange?.();
    } catch (error: any) {
      console.error('Failed to update group:', error);
      toast.error(error?.message || 'Failed to update group');
    } finally {
      setLoading(false);
    }
  };

  // Delete group
  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;
    
    try {
      setLoading(true);
      await userService.deleteGroup(selectedGroup.id);
      toast.success('Group deleted successfully!');
      
      setShowDeleteConfirm(false);
      setSelectedGroup(null);
      await loadGroups();
      onGroupsChange?.();
    } catch (error: any) {
      console.error('Failed to delete group:', error);
      toast.error(error?.message || 'Failed to delete group');
    } finally {
      setLoading(false);
    }
  };

  // Assign users to group
  const handleAssignUsers = async () => {
    if (!selectedGroup || selectedMembers.length === 0) return;
    
    try {
      setLoading(true);
      const result = await userService.assignUsersToGroup(
        selectedGroup.id,
        selectedMembers,
        { role: memberRole, isLead: memberIsLead }
      );
      
      toast.success(`${result.assignedCount} users assigned successfully!`);
      setSelectedMembers([]);
      await loadGroupMembers(selectedGroup.id);
      await loadGroups();
      onGroupsChange?.();
    } catch (error: any) {
      console.error('Failed to assign users:', error);
      toast.error(error?.message || 'Failed to assign users');
    } finally {
      setLoading(false);
    }
  };

  // Remove user from group
  const handleRemoveUser = async (userId: string) => {
    if (!selectedGroup) return;
    
    try {
      setLoading(true);
      await userService.removeUsersFromGroup(selectedGroup.id, [userId]);
      toast.success('User removed from group');
      await loadGroupMembers(selectedGroup.id);
      await loadGroups();
      onGroupsChange?.();
    } catch (error: any) {
      console.error('Failed to remove user:', error);
      toast.error(error?.message || 'Failed to remove user');
    } finally {
      setLoading(false);
    }
  };

  // Toggle group status
  const handleToggleStatus = async () => {
    if (!selectedGroup) return;
    
    try {
      setLoading(true);
      if (selectedGroup.isActive) {
        await userService.deactivateGroup(selectedGroup.id);
        toast.success('Group deactivated');
      } else {
        await userService.activateGroup(selectedGroup.id);
        toast.success('Group activated');
      }
      await loadGroups();
      onGroupsChange?.();
    } catch (error: any) {
      console.error('Failed to toggle group status:', error);
      toast.error(error?.message || 'Failed to update group status');
    } finally {
      setLoading(false);
    }
  };

  // Open edit modal
  const openEditModal = (group: UserGroup) => {
    setSelectedGroup(group);
    setFormData({
      name: group.name,
      description: group.description || '',
      icon: group.icon || 'Users',
      color: group.color || 'bg-blue-500',
      permissions: group.permissions || [],
      businessUnitId: group.businessUnitId || '',
      members: group.members?.map(m => ({ userId: m.userId, role: m.role, isLead: m.isLead })) || []
    });
    setShowEditModal(true);
  };

  // Open members modal
  const openMembersModal = (group: UserGroup) => {
    setSelectedGroup(group);
    setSelectedMembers([]);
    setMemberRole(UserRole.USER);
    setMemberIsLead(false);
    setShowMembersModal(true);
    loadGroupMembers(group.id);
  };

  // Get color class
  const getColorClass = (color?: string) => {
    return color || 'bg-blue-500';
  };

  // Get icon component
  const getIconComponent = (iconName?: string) => {
    const icon = GROUP_ICONS.find(i => i.name === iconName);
    return icon?.component || <UsersRound className="w-5 h-5" />;
  };

  // Get business unit name
  const getBusinessUnitName = (businessUnitId?: string) => {
    if (!businessUnitId) return null;
    const bu = businessUnits.find(b => b.id === businessUnitId);
    return bu ? `${bu.name} (${bu.code})` : null;
  };

  // Loading state
  if (loading && groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading groups...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <UsersRound className="w-6 h-6 text-blue-500" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              User Groups
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {groups.length} groups • {groups.filter(g => g.isActive).length} active
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          {!isReadOnly && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Group
            </button>
          )}
          <button
            onClick={() => { loadGroups(); loadBusinessUnits(); }}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="Refresh groups"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search groups..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="name">Sort by Name</option>
            <option value="members">Sort by Members</option>
            <option value="created">Sort by Created</option>
          </select>
          
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
          </button>
          
          <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${
                viewMode === 'grid' 
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors ${
                viewMode === 'list' 
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Groups Grid/List */}
      {filteredGroups.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
          <UsersRound className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            {searchTerm ? 'No groups match your search' : 'No groups created yet'}
          </p>
          {!isReadOnly && !searchTerm && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create your first group
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.map((group) => (
            <div
              key={group.id}
              className={`border rounded-xl p-4 transition-all cursor-pointer ${
                selectedGroup?.id === group.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
              onClick={() => {
                setSelectedGroup(group);
                onGroupSelect?.(group.id);
                loadGroupMembers(group.id);
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${getColorClass(group.color)} text-white`}>
                    {getIconComponent(group.icon)}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {group.name}
                    </h3>
                    {group.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                        {group.description}
                      </p>
                    )}
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  group.isActive
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-400'
                }`}>
                  {group.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              <div className="mt-3 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
                <span className="flex items-center gap-1">
                  <UsersRound className="w-4 h-4" />
                  {group.memberCount || 0} members
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(group.createdAt).toLocaleDateString()}
                </span>
                {group.businessUnitId && getBusinessUnitName(group.businessUnitId) && (
                  <span className="flex items-center gap-1 text-xs">
                    <Building className="w-3 h-3" />
                    {getBusinessUnitName(group.businessUnitId)}
                  </span>
                )}
              </div>
              
              {group.permissions && group.permissions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {group.permissions.slice(0, 3).map((perm, idx) => (
                    <span key={idx} className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-400">
                      {perm}
                    </span>
                  ))}
                  {group.permissions.length > 3 && (
                    <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-400">
                      +{group.permissions.length - 3}
                    </span>
                  )}
                </div>
              )}
              
              {!isReadOnly && (
                <div className="mt-3 flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700 flex-wrap">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(group);
                    }}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Edit group"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openMembersModal(group);
                    }}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Manage members"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedGroup(group);
                      setShowDeleteConfirm(true);
                    }}
                    className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-red-600 dark:text-red-400"
                    title="Delete group"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Group
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Members
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Business Unit
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Created
                </th>
                {!isReadOnly && (
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredGroups.map((group) => (
                <tr
                  key={group.id}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer ${
                    selectedGroup?.id === group.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                  onClick={() => {
                    setSelectedGroup(group);
                    onGroupSelect?.(group.id);
                    loadGroupMembers(group.id);
                  }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${getColorClass(group.color)} text-white`}>
                        {getIconComponent(group.icon)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{group.name}</p>
                        {group.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">{group.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {group.memberCount || 0}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {group.businessUnitId ? getBusinessUnitName(group.businessUnitId) || '-' : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      group.isActive
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-400'
                    }`}>
                      {group.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(group.createdAt).toLocaleDateString()}
                  </td>
                  {!isReadOnly && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(group);
                          }}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openMembersModal(group);
                          }}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="Manage members"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedGroup(group);
                            setShowDeleteConfirm(true);
                          }}
                          className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-red-600 dark:text-red-400"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Group Modal - Keep existing modal code */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <UsersRound className="w-5 h-5 text-blue-500" />
                Create New Group
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Group Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter group name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter group description"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Business Unit
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    value={formData.businessUnitId || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, businessUnitId: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                  Assign a business unit to this group for organizational purposes
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Icon
                  </label>
                  <select
                    value={formData.icon || 'Users'}
                    onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {GROUP_ICONS.map((icon) => (
                      <option key={icon.name} value={icon.name}>
                        {icon.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {GROUP_COLORS.map((color) => (
                      <button
                        key={color.name}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, color: color.value }))}
                        className={`w-8 h-8 rounded-full ${color.value} border-2 ${
                          formData.color === color.value ? 'border-blue-500' : 'border-transparent'
                        }`}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !formData.name.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      {showEditModal && selectedGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-500" />
                Edit Group
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateGroup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Group Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter group name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter group description"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Business Unit
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    value={formData.businessUnitId || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, businessUnitId: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">No Business Unit (Optional)</option>
                    {businessUnits.map((bu) => (
                      <option key={bu.id} value={bu.id}>
                        {bu.name} ({bu.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Icon
                  </label>
                  <select
                    value={formData.icon || 'Users'}
                    onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {GROUP_ICONS.map((icon) => (
                      <option key={icon.name} value={icon.name}>
                        {icon.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {GROUP_COLORS.map((color) => (
                      <button
                        key={color.name}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, color: color.value }))}
                        className={`w-8 h-8 rounded-full ${color.value} border-2 ${
                          formData.color === color.value ? 'border-blue-500' : 'border-transparent'
                        }`}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={selectedGroup.isActive}
                    onChange={handleToggleStatus}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  Active
                </label>
              </div>
              
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !formData.name.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Update Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Members Management Modal */}
      {showMembersModal && selectedGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <UsersRound className="w-5 h-5 text-blue-500" />
                Manage Members - {selectedGroup.name}
              </h3>
              <button
                onClick={() => setShowMembersModal(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Add Members */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Add Members
                </h4>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Search users..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={memberRole}
                      onChange={(e) => setMemberRole(e.target.value as UserRole)}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {Object.values(UserRole).map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={memberIsLead}
                        onChange={(e) => setMemberIsLead(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      Lead
                    </label>
                  </div>
                </div>
                
                <div className="mt-3">
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800">
                    {availableUsers
                      .filter(u => 
                        !selectedGroup.members?.some(m => m.userId === u.id) &&
                        (u.email.toLowerCase().includes(memberSearch.toLowerCase()) ||
                         u.firstName.toLowerCase().includes(memberSearch.toLowerCase()) ||
                         u.lastName.toLowerCase().includes(memberSearch.toLowerCase()))
                      )
                      .slice(0, 20)
                      .map((user) => (
                        <button
                          key={user.id}
                          onClick={() => {
                            setSelectedMembers(prev => 
                              prev.includes(user.id) 
                                ? prev.filter(id => id !== user.id)
                                : [...prev, user.id]
                            );
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                            selectedMembers.includes(user.id)
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600'
                          } border`}
                        >
                          {selectedMembers.includes(user.id) ? <Check className="w-3 h-3" /> : <User className="w-3 h-3" />}
                          {user.firstName} {user.lastName} ({user.email})
                        </button>
                      ))}
                  </div>
                  {selectedMembers.length > 0 && (
                    <button
                      onClick={handleAssignUsers}
                      disabled={loading}
                      className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                      Add {selectedMembers.length} users
                    </button>
                  )}
                </div>
              </div>
              
              {/* Current Members */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Current Members ({selectedGroup.members?.length || 0})
                </h4>
                <div className="space-y-2">
                  {selectedGroup.members?.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No members yet</p>
                  ) : (
                    selectedGroup.members?.map((member) => (
                      <div
                        key={member.userId}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 font-medium">
                            {member.user?.firstName?.[0] || member.user?.email?.[0] || '?'}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {member.user?.firstName} {member.user?.lastName}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {member.user?.email}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              member.isLead
                                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-400'
                            }`}>
                              {member.role} {member.isLead && '⭐ Lead'}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveUser(member.userId)}
                          disabled={loading}
                          className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-red-600 dark:text-red-400"
                          title="Remove from group"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowMembersModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-full">
                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Delete Group
              </h3>
            </div>
            
            <p className="text-gray-600 dark:text-gray-300 mb-2">
              Are you sure you want to delete <strong>{selectedGroup.name}</strong>?
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              This action cannot be undone. All members will be removed from this group.
            </p>
            
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteGroup}
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete Group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserGroupManager;
