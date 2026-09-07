// D:\Projects\Kalwanga\packages\web\components\users\UserGroups.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import { businessUnitService } from '../../services/businessUnitService';
import { toast } from 'react-hot-toast';
import { 
  Users, User, Building, Shield, Key, Lock, Unlock,
  Plus, Minus, X, Check, Save, Loader2, AlertCircle,
  CheckCircle, XCircle, Eye, EyeOff, Search, Filter,
  RefreshCw, Copy, Info, AlertTriangle, ChevronDown,
  ChevronUp, ChevronLeft, ChevronRight, MoreVertical,
  Star, Heart, ThumbsUp, MessageSquare, Share2,
  FileText, Download, Upload, Settings,
  Zap, Sparkles, Award, Crown, Medal, Trophy,
  Target, Crosshair, Gauge,
  CreditCard, DollarSign, Percent,
  Tag, Store, ClipboardList, Truck, Boxes, Layers,
  FolderTree, Database, Server, Cloud, Wifi,
  Bluetooth, Battery, Sun, Moon, Wind, Droplet,
  Flame, Leaf, TreePine, Mountain, Waves, Compass,
  Map, Navigation, Route, UserPlus, UserCheck,
  UserX, BadgeCheck, Ban, RotateCcw, History,
  UsersIcon, UserCog, UserCircle, UserSquare,
  UserRound, UserRoundCheck, UserRoundCog, UserRoundPlus,
  UserRoundSearch, UserRoundX, UsersRound, GitBranch,
  GitCommit, GitFork, GitMerge, GitPullRequest,
  Network, ShareIcon, Link2, Unlink,
  FolderPlus, FolderMinus, FolderOpen, FolderClosed,
  FolderInput, FolderOutput, FolderSearch, FolderSync,
  FolderTreeIcon, FolderX, TagIcon,
  Tags, Hash, Grid, Layout, LayoutGrid, LayoutList,
  Columns, Rows, PanelTop, PanelBottom, PanelLeft,
  PanelRight, Maximize, Minimize, Move, Trash2,
  Edit2, UserMinus, Briefcase, Globe,
  // ✅ Removed duplicate Bookmark import - only imported once here
  Bookmark
} from 'lucide-react';
import { PERMISSIONS } from '../../types/permissions';
import { UserRole } from '../../types/enums';

// ============================================
// TYPES - Aligned with API response types
// ============================================

// ✅ FIXED: Matches the API response type with optional description
interface UserGroup {
  id: string;
  name: string;
  description?: string; // ✅ Made optional to match API
  icon?: string;
  color?: string;
  members: GroupMember[];
  permissions: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  isActive: boolean;
  businessUnitId?: string;
  businessUnit?: BusinessUnit;
}

interface GroupMember {
  userId: string;
  role: UserRole;
  joinedAt: string;
  isLead: boolean;
}

// ✅ FIXED: Matches the API response type with businessUnits as BusinessUnitUser[]
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  permissions?: string[];
  businessUnits?: BusinessUnit[] | any[]; // ✅ Allow both types
  avatar?: string;
}

interface BusinessUnit {
  id: string;
  name: string;
  code: string;
  isActive?: boolean;
}

interface GroupPermission {
  id: string;
  label: string;
  description: string;
  resource: string;
  action: string;
}

interface UserGroupsProps {
  initialGroups?: UserGroup[];
  onGroupSelect?: (group: UserGroup) => void;
  onGroupCreate?: (group: UserGroup) => void;
  onGroupUpdate?: (group: UserGroup) => void;
  onGroupDelete?: (groupId: string) => void;
  showPermissions?: boolean;
  showMembers?: boolean;
  editable?: boolean;
  className?: string;
}

// ============================================
// CONSTANTS
// ============================================

const PERMISSION_RESOURCES = [
  {
    id: 'user',
    label: '👥 User Management',
    permissions: [
      { id: 'user:view', label: 'View Users', description: 'View user list and details' },
      { id: 'user:create', label: 'Create Users', description: 'Create new users' },
      { id: 'user:edit', label: 'Edit Users', description: 'Edit user details' },
      { id: 'user:delete', label: 'Delete Users', description: 'Delete users' },
      { id: 'user:manage', label: 'Manage Users', description: 'Full user management' },
      { id: 'user:activate', label: 'Activate Users', description: 'Activate user accounts' },
      { id: 'user:deactivate', label: 'Deactivate Users', description: 'Deactivate user accounts' },
      { id: 'user:role:update', label: 'Update Roles', description: 'Change user roles' },
      { id: 'user:permission:update', label: 'Update Permissions', description: 'Change user permissions' },
    ],
  },
  {
    id: 'inventory',
    label: '📦 Inventory',
    permissions: [
      { id: 'inventory:view', label: 'View Inventory', description: 'View inventory items' },
      { id: 'inventory:create', label: 'Create Items', description: 'Add inventory items' },
      { id: 'inventory:edit', label: 'Edit Items', description: 'Edit inventory items' },
      { id: 'inventory:delete', label: 'Delete Items', description: 'Delete inventory items' },
      { id: 'inventory:manage', label: 'Manage Inventory', description: 'Full inventory management' },
      { id: 'inventory:view_low_stock', label: 'View Low Stock', description: 'View low stock alerts' },
      { id: 'inventory:view_reports', label: 'View Reports', description: 'View inventory reports' },
      { id: 'inventory:export', label: 'Export Inventory', description: 'Export inventory data' },
    ],
  },
  {
    id: 'product',
    label: '📱 Products',
    permissions: [
      { id: 'product:view', label: 'View Products', description: 'View product list' },
      { id: 'product:create', label: 'Create Products', description: 'Add new products' },
      { id: 'product:edit', label: 'Edit Products', description: 'Edit product details' },
      { id: 'product:delete', label: 'Delete Products', description: 'Delete products' },
      { id: 'product:manage', label: 'Manage Products', description: 'Full product management' },
      { id: 'product:export', label: 'Export Products', description: 'Export product data' },
    ],
  },
  {
    id: 'category',
    label: '📂 Categories',
    permissions: [
      { id: 'category:view', label: 'View Categories', description: 'View category list' },
      { id: 'category:create', label: 'Create Categories', description: 'Add new categories' },
      { id: 'category:edit', label: 'Edit Categories', description: 'Edit category details' },
      { id: 'category:delete', label: 'Delete Categories', description: 'Delete categories' },
      { id: 'category:manage', label: 'Manage Categories', description: 'Full category management' },
    ],
  },
  {
    id: 'report',
    label: '📊 Reports',
    permissions: [
      { id: 'report:view', label: 'View Reports', description: 'View reports' },
      { id: 'report:create', label: 'Create Reports', description: 'Generate reports' },
      { id: 'report:export', label: 'Export Reports', description: 'Export report data' },
      { id: 'report:manage', label: 'Manage Reports', description: 'Full report management' },
    ],
  },
  {
    id: 'sale',
    label: '💰 Sales',
    permissions: [
      { id: 'sale:view', label: 'View Sales', description: 'View sales data' },
      { id: 'sale:create', label: 'Create Sales', description: 'Create new sales' },
      { id: 'sale:edit', label: 'Edit Sales', description: 'Edit sales data' },
      { id: 'sale:delete', label: 'Delete Sales', description: 'Delete sales records' },
      { id: 'sale:manage', label: 'Manage Sales', description: 'Full sales management' },
      { id: 'sale:export', label: 'Export Sales', description: 'Export sales data' },
    ],
  },
  {
    id: 'pos',
    label: '🖥️ POS',
    permissions: [
      { id: 'pos:view', label: 'View POS', description: 'View point of sale' },
      { id: 'pos:create', label: 'Create POS', description: 'Create POS transactions' },
      { id: 'pos:manage', label: 'Manage POS', description: 'Full POS management' },
      { id: 'pos:print', label: 'Print POS', description: 'Print POS receipts' },
    ],
  },
  {
    id: 'business_unit',
    label: '🏢 Business Units',
    permissions: [
      { id: 'business_unit:view', label: 'View Business Units', description: 'View business units' },
      { id: 'business_unit:create', label: 'Create Business Units', description: 'Create new business units' },
      { id: 'business_unit:edit', label: 'Edit Business Units', description: 'Edit business unit details' },
      { id: 'business_unit:delete', label: 'Delete Business Units', description: 'Delete business units' },
      { id: 'business_unit:manage', label: 'Manage Business Units', description: 'Full business unit management' },
    ],
  },
  {
    id: 'settings',
    label: '⚙️ Settings',
    permissions: [
      { id: 'settings:view', label: 'View Settings', description: 'View system settings' },
      { id: 'settings:edit', label: 'Edit Settings', description: 'Edit system settings' },
      { id: 'settings:manage', label: 'Manage Settings', description: 'Full settings management' },
    ],
  },
];

const GROUP_COLORS = [
  { value: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', name: 'Blue' },
  { value: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', name: 'Green' },
  { value: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', name: 'Yellow' },
  { value: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', name: 'Red' },
  { value: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', name: 'Purple' },
  { value: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400', name: 'Pink' },
  { value: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400', name: 'Indigo' },
  { value: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400', name: 'Cyan' },
  { value: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', name: 'Orange' },
  { value: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400', name: 'Teal' },
  { value: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', name: 'Amber' },
  { value: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400', name: 'Rose' },
];

// ✅ FIXED: Removed icons that don't exist in lucide-react
const GROUP_ICONS = [
  { value: 'Users', component: <UsersIcon className="w-5 h-5" /> },
  { value: 'UserCog', component: <UserCog className="w-5 h-5" /> },
  { value: 'UserCircle', component: <UserCircle className="w-5 h-5" /> },
  { value: 'UserSquare', component: <UserSquare className="w-5 h-5" /> },
  { value: 'UserRound', component: <UserRound className="w-5 h-5" /> },
  { value: 'UserRoundCheck', component: <UserRoundCheck className="w-5 h-5" /> },
  { value: 'UserRoundCog', component: <UserRoundCog className="w-5 h-5" /> },
  { value: 'UserRoundPlus', component: <UserRoundPlus className="w-5 h-5" /> },
  { value: 'UsersRound', component: <UsersRound className="w-5 h-5" /> },
  { value: 'Network', component: <Network className="w-5 h-5" /> },
  // ✅ Removed 'Nodes' - doesn't exist in lucide-react
  { value: 'GitBranch', component: <GitBranch className="w-5 h-5" /> },
  { value: 'GitMerge', component: <GitMerge className="w-5 h-5" /> },
  { value: 'FolderOpen', component: <FolderOpen className="w-5 h-5" /> },
  { value: 'Star', component: <Star className="w-5 h-5" /> },
  { value: 'Heart', component: <Heart className="w-5 h-5" /> },
  { value: 'Briefcase', component: <Briefcase className="w-5 h-5" /> },
  { value: 'Shield', component: <Shield className="w-5 h-5" /> },
  { value: 'Settings', component: <Settings className="w-5 h-5" /> },
  { value: 'Globe', component: <Globe className="w-5 h-5" /> },
  { value: 'Bookmark', component: <Bookmark className="w-5 h-5" /> },
  { value: 'Tag', component: <Tag className="w-5 h-5" /> },
  { value: 'Building', component: <Building className="w-5 h-5" /> },
  { value: 'Store', component: <Store className="w-5 h-5" /> },
  { value: 'Truck', component: <Truck className="w-5 h-5" /> },
  { value: 'Database', component: <Database className="w-5 h-5" /> },
  { value: 'Server', component: <Server className="w-5 h-5" /> },
  { value: 'Cloud', component: <Cloud className="w-5 h-5" /> },
];

// ============================================
// COMPONENT
// ============================================

export function UserGroups({
  initialGroups = [],
  onGroupSelect,
  onGroupCreate,
  onGroupUpdate,
  onGroupDelete,
  showPermissions = true,
  showMembers = true,
  editable = true,
  className = '',
}: UserGroupsProps) {
  const router = useRouter();
  const { can, isSuperAdmin, isAdmin } = useAuth();
  
  // State management
  const [groups, setGroups] = useState<UserGroup[]>(initialGroups);
  const [users, setUsers] = useState<User[]>([]);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<UserGroup | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    color: GROUP_COLORS[0].value,
    icon: 'Users',
    businessUnitId: '',
  });
  const [editGroup, setEditGroup] = useState<UserGroup | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'name',
    direction: 'asc',
  });
  const [groupStats, setGroupStats] = useState({
    totalGroups: 0,
    totalMembers: 0,
    activeGroups: 0,
    inactiveGroups: 0,
    totalPermissions: 0,
  });
  const [memberRole, setMemberRole] = useState<UserRole>(UserRole.USER);
  const [memberIsLead, setMemberIsLead] = useState(false);

  const canManageGroups = isSuperAdmin || isAdmin || can(PERMISSIONS.USER_MANAGE);

  // Load users
  const loadUsers = useCallback(async () => {
    try {
      const response = await userService.getAllUsers({ limit: 1000 });
      // ✅ FIXED: Safely handle the response data
      const userData = response?.data || response || [];
      setUsers(Array.isArray(userData) ? userData : []);
    } catch (error) {
      console.error('Failed to load users:', error);
      // Use mock data as fallback
      setUsers([
        {
          id: 'user_1',
          email: 'john.doe@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: UserRole.MANAGER,
          isActive: true,
          permissions: ['user:view', 'inventory:view'],
          businessUnits: [{ id: 'bu_1', name: 'Headquarters', code: 'HQ' }],
        },
        {
          id: 'user_2',
          email: 'jane.smith@example.com',
          firstName: 'Jane',
          lastName: 'Smith',
          role: UserRole.EDITOR,
          isActive: true,
          permissions: ['inventory:view', 'inventory:create'],
          businessUnits: [{ id: 'bu_2', name: 'Branch 1', code: 'BR1' }],
        },
        {
          id: 'user_3',
          email: 'bob.wilson@example.com',
          firstName: 'Bob',
          lastName: 'Wilson',
          role: UserRole.EMPLOYEE,
          isActive: true,
          permissions: ['inventory:view'],
          businessUnits: [{ id: 'bu_1', name: 'Headquarters', code: 'HQ' }],
        },
        {
          id: 'user_4',
          email: 'alice.brown@example.com',
          firstName: 'Alice',
          lastName: 'Brown',
          role: UserRole.VIEWER,
          isActive: true,
          permissions: ['inventory:view'],
          businessUnits: [{ id: 'bu_2', name: 'Branch 1', code: 'BR1' }],
        },
        {
          id: 'user_5',
          email: 'charlie.davis@example.com',
          firstName: 'Charlie',
          lastName: 'Davis',
          role: UserRole.CASHIER,
          isActive: true,
          permissions: ['sale:view', 'sale:create'],
          businessUnits: [{ id: 'bu_3', name: 'Branch 2', code: 'BR2' }],
        },
      ]);
    }
  }, []);

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
      // Use mock data as fallback
      setBusinessUnits([
        { id: 'bu_1', name: 'Headquarters', code: 'HQ', isActive: true },
        { id: 'bu_2', name: 'Branch 1', code: 'BR1', isActive: true },
        { id: 'bu_3', name: 'Branch 2', code: 'BR2', isActive: true },
        { id: 'bu_4', name: 'Warehouse', code: 'WH', isActive: true },
      ]);
    }
  }, []);

  // Load groups (if no initial groups provided)
  const loadGroups = useCallback(async () => {
    if (initialGroups.length > 0) {
      updateGroupStats(initialGroups);
      return;
    }
    
    try {
      setLoading(true);
      const response = await userService.getGroups({ limit: 100 });
      
      // ✅ FIXED: Safely handle the response data
      const groupData = response?.data || response || [];
      
      if (Array.isArray(groupData) && groupData.length > 0) {
        // ✅ FIXED: Ensure description is always a string
        const mappedGroups = groupData.map((g: any) => ({
          ...g,
          description: g.description || '',
        }));
        setGroups(mappedGroups);
        updateGroupStats(mappedGroups);
      } else {
        // Use mock data as fallback
        await new Promise(resolve => setTimeout(resolve, 500));
        const mockGroups: UserGroup[] = [
          {
            id: 'group_1',
            name: 'Management Team',
            description: 'Senior management and leadership team',
            color: GROUP_COLORS[0].value,
            icon: 'Users',
            members: [
              { userId: 'user_1', role: UserRole.MANAGER, joinedAt: new Date().toISOString(), isLead: true },
            ],
            permissions: ['user:view', 'user:create', 'user:edit', 'inventory:view', 'inventory:manage', 'report:view', 'report:create'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: 'Admin',
            isActive: true,
            businessUnitId: 'bu_1',
          },
          {
            id: 'group_2',
            name: 'Inventory Team',
            description: 'Inventory management and stock control',
            color: GROUP_COLORS[1].value,
            icon: 'FolderOpen',
            members: [
              { userId: 'user_2', role: UserRole.EDITOR, joinedAt: new Date().toISOString(), isLead: true },
              { userId: 'user_3', role: UserRole.EMPLOYEE, joinedAt: new Date().toISOString(), isLead: false },
            ],
            permissions: ['inventory:view', 'inventory:create', 'inventory:edit', 'inventory:delete', 'product:view'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: 'Admin',
            isActive: true,
            businessUnitId: 'bu_1',
          },
          {
            id: 'group_3',
            name: 'Sales Team',
            description: 'Sales and customer relations',
            color: GROUP_COLORS[2].value,
            icon: 'UserRoundCheck',
            members: [
              { userId: 'user_5', role: UserRole.CASHIER, joinedAt: new Date().toISOString(), isLead: true },
            ],
            permissions: ['sale:view', 'sale:create', 'pos:view', 'pos:create', 'product:view'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: 'Admin',
            isActive: true,
            businessUnitId: 'bu_3',
          },
        ];
        setGroups(mockGroups);
        updateGroupStats(mockGroups);
      }
    } catch (error: any) {
      console.error('Failed to load groups:', error);
      setError(error?.message || 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  }, [initialGroups]);

  // Initial load
  useEffect(() => {
    loadUsers();
    loadBusinessUnits();
    loadGroups();
  }, [loadUsers, loadBusinessUnits, loadGroups]);

  // Update group stats
  const updateGroupStats = useCallback((groupList: UserGroup[]) => {
    const totalMembers = groupList.reduce((sum, group) => sum + group.members.length, 0);
    const totalPermissions = groupList.reduce((sum, group) => sum + group.permissions.length, 0);
    
    setGroupStats({
      totalGroups: groupList.length,
      totalMembers,
      activeGroups: groupList.filter(g => g.isActive).length,
      inactiveGroups: groupList.filter(g => !g.isActive).length,
      totalPermissions,
    });
  }, []);

  // Handle create group
  const handleCreateGroup = useCallback(async () => {
    try {
      setSaving(true);
      setError(null);
      
      if (!newGroup.name.trim()) {
        toast.error('Group name is required');
        return;
      }
      
      const selectedBU = businessUnits.find(bu => bu.id === newGroup.businessUnitId);
      
      const group: UserGroup = {
        id: `group_${Date.now()}`,
        name: newGroup.name.trim(),
        description: newGroup.description.trim(),
        color: newGroup.color,
        icon: newGroup.icon,
        members: [],
        permissions: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'Current User',
        isActive: true,
        businessUnitId: newGroup.businessUnitId || undefined,
        businessUnit: selectedBU,
      };
      
      // Call API to create group
      const result = await userService.createGroup({
        name: group.name,
        description: group.description,
        icon: group.icon,
        color: group.color,
        permissions: group.permissions,
      });
      
      if (result) {
        group.id = result.id || group.id;
      }
      
      setGroups(prev => [...prev, group]);
      updateGroupStats([...groups, group]);
      setShowCreateModal(false);
      setNewGroup({ name: '', description: '', color: GROUP_COLORS[0].value, icon: 'Users', businessUnitId: '' });
      setSuccessMessage('Group created successfully');
      toast.success('Group created successfully');
      
      if (onGroupCreate) {
        onGroupCreate(group);
      }
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error('Failed to create group:', error);
      setError(error?.message || 'Failed to create group');
      toast.error('Failed to create group');
    } finally {
      setSaving(false);
    }
  }, [newGroup, groups, businessUnits, updateGroupStats, onGroupCreate]);

  // Handle update group
  const handleUpdateGroup = useCallback(async () => {
    if (!editGroup) return;
    
    try {
      setSaving(true);
      setError(null);
      
      if (!editGroup.name.trim()) {
        toast.error('Group name is required');
        return;
      }
      
      const updatedGroup = {
        ...editGroup,
        name: editGroup.name.trim(),
        description: editGroup.description?.trim() || '',
        updatedAt: new Date().toISOString(),
      };
      
      // Call API to update group
      await userService.updateGroup(editGroup.id, {
        name: updatedGroup.name,
        description: updatedGroup.description,
        icon: updatedGroup.icon,
        color: updatedGroup.color,
        isActive: updatedGroup.isActive,
        permissions: updatedGroup.permissions,
      });
      
      setGroups(prev => prev.map(g => g.id === updatedGroup.id ? updatedGroup : g));
      setShowEditModal(false);
      setEditGroup(null);
      setSuccessMessage('Group updated successfully');
      toast.success('Group updated successfully');
      
      if (onGroupUpdate) {
        onGroupUpdate(updatedGroup);
      }
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error('Failed to update group:', error);
      setError(error?.message || 'Failed to update group');
      toast.error('Failed to update group');
    } finally {
      setSaving(false);
    }
  }, [editGroup, onGroupUpdate]);

  // Handle delete group
  const handleDeleteGroup = useCallback(async () => {
    if (!selectedGroup) return;
    
    try {
      setSaving(true);
      setError(null);
      
      // Call API to delete group
      await userService.deleteGroup(selectedGroup.id);
      
      setGroups(prev => prev.filter(g => g.id !== selectedGroup.id));
      updateGroupStats(groups.filter(g => g.id !== selectedGroup.id));
      setShowDeleteModal(false);
      setSelectedGroup(null);
      setSuccessMessage('Group deleted successfully');
      toast.success('Group deleted successfully');
      
      if (onGroupDelete) {
        onGroupDelete(selectedGroup.id);
      }
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error('Failed to delete group:', error);
      setError(error?.message || 'Failed to delete group');
      toast.error('Failed to delete group');
    } finally {
      setSaving(false);
    }
  }, [selectedGroup, groups, updateGroupStats, onGroupDelete]);

  // Handle add members
  const handleAddMembers = useCallback(async () => {
    if (!selectedGroup) return;
    
    try {
      setSaving(true);
      setError(null);
      
      // Call API to assign users to group
      await userService.assignUsersToGroup(selectedGroup.id, Array.from(selectedMembers), {
        role: memberRole,
        isLead: memberIsLead,
      });
      
      const newMembers: GroupMember[] = Array.from(selectedMembers).map(userId => ({
        userId,
        role: memberRole,
        joinedAt: new Date().toISOString(),
        isLead: memberIsLead,
      }));
      
      const updatedGroup = {
        ...selectedGroup,
        members: [...selectedGroup.members, ...newMembers],
        updatedAt: new Date().toISOString(),
      };
      
      setGroups(prev => prev.map(g => g.id === updatedGroup.id ? updatedGroup : g));
      setSelectedGroup(updatedGroup);
      setShowMembersModal(false);
      setSelectedMembers(new Set());
      setMemberRole(UserRole.USER);
      setMemberIsLead(false);
      setSuccessMessage('Members added successfully');
      toast.success('Members added successfully');
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error('Failed to add members:', error);
      setError(error?.message || 'Failed to add members');
      toast.error('Failed to add members');
    } finally {
      setSaving(false);
    }
  }, [selectedGroup, selectedMembers, memberRole, memberIsLead]);

  // Handle remove member
  const handleRemoveMember = useCallback(async (userId: string) => {
    if (!selectedGroup) return;
    
    try {
      setSaving(true);
      setError(null);
      
      // Call API to remove user from group
      await userService.removeUsersFromGroup(selectedGroup.id, [userId]);
      
      const updatedGroup = {
        ...selectedGroup,
        members: selectedGroup.members.filter(m => m.userId !== userId),
        updatedAt: new Date().toISOString(),
      };
      
      setGroups(prev => prev.map(g => g.id === updatedGroup.id ? updatedGroup : g));
      setSelectedGroup(updatedGroup);
      toast.success('Member removed successfully');
    } catch (error: any) {
      console.error('Failed to remove member:', error);
      setError(error?.message || 'Failed to remove member');
      toast.error('Failed to remove member');
    } finally {
      setSaving(false);
    }
  }, [selectedGroup]);

  // Handle update permissions
  const handleUpdatePermissions = useCallback(async () => {
    if (!selectedGroup) return;
    
    try {
      setSaving(true);
      setError(null);
      
      // Call API to update group permissions
      await userService.updateGroupPermissions(selectedGroup.id, Array.from(selectedPermissions));
      
      const updatedGroup = {
        ...selectedGroup,
        permissions: Array.from(selectedPermissions),
        updatedAt: new Date().toISOString(),
      };
      
      setGroups(prev => prev.map(g => g.id === updatedGroup.id ? updatedGroup : g));
      setSelectedGroup(updatedGroup);
      setShowPermissionsModal(false);
      setSuccessMessage('Permissions updated successfully');
      toast.success('Permissions updated successfully');
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error('Failed to update permissions:', error);
      setError(error?.message || 'Failed to update permissions');
      toast.error('Failed to update permissions');
    } finally {
      setSaving(false);
    }
  }, [selectedGroup, selectedPermissions]);

  // Handle toggle group expansion
  const handleToggleGroup = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  }, []);

  // Handle sort
  const handleSort = useCallback((key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  // Filter and sort groups
  const filteredGroups = useMemo(() => {
    let filtered = groups;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(group => 
        group.name.toLowerCase().includes(query) ||
        (group.description?.toLowerCase() || '').includes(query)
      );
    }
    
    const sorted = [...filtered].sort((a: any, b: any) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }
      
      return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
    });
    
    return sorted;
  }, [groups, searchQuery, sortConfig]);

  // Get user by ID
  const getUserById = useCallback((userId: string) => {
    return users.find(u => u.id === userId);
  }, [users]);

  // Get business unit by ID
  const getBusinessUnitById = useCallback((buId: string) => {
    return businessUnits.find(bu => bu.id === buId);
  }, [businessUnits]);

  // Get group icon
  const getGroupIcon = useCallback((iconName: string) => {
    const icon = GROUP_ICONS.find(i => i.value === iconName);
    return icon?.component || <UsersIcon className="w-5 h-5" />;
  }, []);

  // Get color class
  const getColorClass = useCallback((color: string) => {
    return color || GROUP_COLORS[0].value;
  }, []);

  // Get initials
  const getInitials = useCallback((firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  }, []);

  // Format date
  const formatDate = useCallback((date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading groups...</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <UsersIcon className="w-6 h-6 text-blue-500" />
            User Groups & Teams
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage groups, assign users, and configure permissions
          </p>
        </div>
        {editable && canManageGroups && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Group
          </button>
        )}
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          <span className="text-green-700 dark:text-green-300 text-sm flex-1">{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="p-1 hover:bg-green-100 dark:hover:bg-green-800 rounded transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5 text-green-600 dark:text-green-400" />
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          <span className="text-red-700 dark:text-red-300 flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="p-1 hover:bg-red-100 dark:hover:bg-red-800 rounded transition-colors"
            aria-label="Dismiss error"
          >
            <X className="w-5 h-5 text-red-600 dark:text-red-400" />
          </button>
        </div>
      )}

      {/* Group Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <UsersIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Groups</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{groupStats.totalGroups}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <UserCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Members</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{groupStats.totalMembers}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Permissions</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{groupStats.totalPermissions}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <CheckCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Active Groups</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{groupStats.activeGroups}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Inactive Groups</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{groupStats.inactiveGroups}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search groups..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
        />
      </div>

      {/* Groups Grid */}
      {filteredGroups.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <UsersIcon className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">No Groups Found</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {searchQuery ? 'No groups match your search criteria.' : 'Create your first group to get started.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.map(group => {
            const isExpanded = expandedGroups.has(group.id);
            const businessUnit = getBusinessUnitById(group.businessUnitId || '');
            
            return (
              <div
                key={group.id}
                className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border transition-all ${
                  selectedGroup?.id === group.id
                    ? 'border-blue-500 ring-2 ring-blue-500/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {/* Group Header */}
                <div className="p-4 cursor-pointer" onClick={() => {
                  setSelectedGroup(group);
                  onGroupSelect?.(group);
                }}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${getColorClass(group.color || '')}`}>
                        {getGroupIcon(group.icon || 'Users')}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">{group.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{group.description || ''}</p>
                        {businessUnit && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-1">
                            <Building className="w-3 h-3" />
                            {businessUnit.name}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleGroup(group.id);
                      }}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <UsersIcon className="w-3 h-3" />
                      {group.members.length} members
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      {group.permissions.length} permissions
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      group.isActive
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {group.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3">
                    {/* Members */}
                    {showMembers && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Members</h4>
                        {group.members.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400">No members yet</p>
                        ) : (
                          <div className="space-y-2">
                            {group.members.slice(0, 3).map(member => {
                              const user = getUserById(member.userId);
                              if (!user) return null;
                              
                              return (
                                <div key={member.userId} className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xs font-medium">
                                    {getInitials(user.firstName, user.lastName)}
                                  </div>
                                  <span className="text-sm text-gray-900 dark:text-white">
                                    {user.firstName} {user.lastName}
                                  </span>
                                  {member.isLead && (
                                    <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">Lead</span>
                                  )}
                                </div>
                              );
                            })}
                            {group.members.length > 3 && (
                              <p className="text-xs text-blue-600 dark:text-blue-400">
                                +{group.members.length - 3} more
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Permissions */}
                    {showPermissions && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Permissions</h4>
                        {group.permissions.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400">No permissions assigned</p>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {group.permissions.slice(0, 5).map(permission => (
                              <span key={permission} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-xs">
                                {permission}
                              </span>
                            ))}
                            {group.permissions.length > 5 && (
                              <span className="text-xs text-gray-500">+{group.permissions.length - 5} more</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    {editable && canManageGroups && (
                      <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700 flex-wrap">
                        <button
                          onClick={() => {
                            setSelectedGroup(group);
                            setEditGroup(group);
                            setShowEditModal(true);
                          }}
                          className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setSelectedGroup(group);
                            setSelectedMembers(new Set(group.members.map(m => m.userId)));
                            setShowMembersModal(true);
                          }}
                          className="px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <UserPlus className="w-4 h-4" />
                          Members
                        </button>
                        <button
                          onClick={() => {
                            setSelectedGroup(group);
                            setSelectedPermissions(new Set(group.permissions));
                            setShowPermissionsModal(true);
                          }}
                          className="px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <Shield className="w-4 h-4" />
                          Permissions
                        </button>
                        <button
                          onClick={() => {
                            setSelectedGroup(group);
                            setShowDeleteModal(true);
                          }}
                          className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowCreateModal(false)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Plus className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Create Group</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Create a new user group</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Group Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newGroup.name}
                    onChange={(e) => setNewGroup(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Management Team"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={newGroup.description}
                    onChange={(e) => setNewGroup(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    placeholder="Describe the purpose of this group"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Business Unit
                  </label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                      value={newGroup.businessUnitId}
                      onChange={(e) => setNewGroup(prev => ({ ...prev, businessUnitId: e.target.value }))}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {GROUP_COLORS.map((color, index) => (
                      <button
                        key={index}
                        onClick={() => setNewGroup(prev => ({ ...prev, color: color.value }))}
                        className={`w-8 h-8 rounded-full ${color.value} border-2 ${
                          newGroup.color === color.value ? 'border-blue-500' : 'border-transparent'
                        }`}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Icon
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {GROUP_ICONS.map(icon => (
                      <button
                        key={icon.value}
                        onClick={() => setNewGroup(prev => ({ ...prev, icon: icon.value }))}
                        className={`p-2 rounded-lg border ${
                          newGroup.icon === icon.value
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700'
                        }`}
                        title={icon.value}
                      >
                        {icon.component}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateGroup}
                    disabled={saving || !newGroup.name.trim()}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    Create Group
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      {showEditModal && editGroup && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowEditModal(false)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Edit2 className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Edit Group</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Update group information</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Group Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editGroup.name}
                    onChange={(e) => setEditGroup(prev => ({ ...prev!, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={editGroup.description || ''}
                    onChange={(e) => setEditGroup(prev => ({ ...prev!, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {GROUP_COLORS.map((color, index) => (
                      <button
                        key={index}
                        onClick={() => setEditGroup(prev => ({ ...prev!, color: color.value }))}
                        className={`w-8 h-8 rounded-full ${color.value} border-2 ${
                          editGroup.color === color.value ? 'border-blue-500' : 'border-transparent'
                        }`}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Icon
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {GROUP_ICONS.map(icon => (
                      <button
                        key={icon.value}
                        onClick={() => setEditGroup(prev => ({ ...prev!, icon: icon.value }))}
                        className={`p-2 rounded-lg border ${
                          editGroup.icon === icon.value
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700'
                        }`}
                        title={icon.value}
                      >
                        {icon.component}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editGroup.isActive}
                      onChange={(e) => setEditGroup(prev => ({ ...prev!, isActive: e.target.checked }))}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Active group</span>
                  </label>
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateGroup}
                    disabled={saving || !editGroup.name.trim()}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Update Group
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Group Modal */}
      {showDeleteModal && selectedGroup && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowDeleteModal(false)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Group</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Are you sure you want to delete <strong>{selectedGroup.name}</strong>?
                  <br />
                  <span className="text-sm text-red-600">This action cannot be undone.</span>
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteGroup}
                    disabled={saving}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Delete Group
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Members Modal */}
      {showMembersModal && selectedGroup && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowMembersModal(false)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full p-6">
              <button
                onClick={() => setShowMembersModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <UserPlus className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Manage Members</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{selectedGroup.name}</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Current Members */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Current Members</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedGroup.members.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">No members yet</p>
                    ) : (
                      selectedGroup.members.map(member => {
                        const user = getUserById(member.userId);
                        if (!user) return null;
                        
                        return (
                          <div key={member.userId} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xs font-medium">
                                {getInitials(user.firstName, user.lastName)}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  {user.firstName} {user.lastName}
                                </p>
                                <p className="text-xs text-gray-500">{user.email}</p>
                              </div>
                              {member.isLead && (
                                <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">Lead</span>
                              )}
                            </div>
                            <button
                              onClick={() => handleRemoveMember(member.userId)}
                              className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Add Members */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Add Members</h4>
                  
                  {/* Member Role Selection */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Role</label>
                      <select
                        value={memberRole}
                        onChange={(e) => setMemberRole(e.target.value as UserRole)}
                        className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      >
                        {Object.values(UserRole).map((role) => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2 pt-4">
                      <input
                        type="checkbox"
                        checked={memberIsLead}
                        onChange={(e) => setMemberIsLead(e.target.checked)}
                        className="rounded border-gray-300 dark:border-gray-600 text-yellow-500 focus:ring-yellow-500"
                        id="memberIsLead"
                      />
                      <label htmlFor="memberIsLead" className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        Set as Lead
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {users
                      .filter(user => !selectedGroup.members.some(m => m.userId === user.id))
                      .map(user => (
                        <label key={user.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedMembers.has(user.id)}
                            onChange={() => {
                              setSelectedMembers(prev => {
                                const newSet = new Set(prev);
                                if (newSet.has(user.id)) {
                                  newSet.delete(user.id);
                                } else {
                                  newSet.add(user.id);
                                }
                                return newSet;
                              });
                            }}
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xs font-medium">
                            {getInitials(user.firstName, user.lastName)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                            {user.businessUnits && user.businessUnits.length > 0 && (
                              <p className="text-xs text-gray-400">
                                {user.businessUnits.map((bu: any) => bu.name || bu.businessUnit?.name || '').filter(Boolean).join(', ')}
                              </p>
                            )}
                          </div>
                        </label>
                      ))}
                  </div>
                  {users.filter(user => !selectedGroup.members.some(m => m.userId === user.id)).length === 0 && (
                    <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-2">
                      All available users are already members of this group
                    </p>
                  )}
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setShowMembersModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleAddMembers}
                    disabled={saving || selectedMembers.size === 0}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserPlus className="w-4 h-4" />
                    )}
                    Add {selectedMembers.size} Members
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {showPermissionsModal && selectedGroup && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowPermissionsModal(false)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[80vh] flex flex-col">
              <button
                onClick={() => setShowPermissionsModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Shield className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Group Permissions</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{selectedGroup.name}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4">
                {PERMISSION_RESOURCES.map(resource => (
                  <div key={resource.id}>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{resource.label}</h4>
                    <div className="space-y-2">
                      {resource.permissions.map(permission => (
                        <label key={permission.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedPermissions.has(permission.id)}
                            onChange={() => {
                              setSelectedPermissions(prev => {
                                const newSet = new Set(prev);
                                if (newSet.has(permission.id)) {
                                  newSet.delete(permission.id);
                                } else {
                                  newSet.add(permission.id);
                                }
                                return newSet;
                              });
                            }}
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{permission.label}</p>
                            <p className="text-xs text-gray-500">{permission.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowPermissionsModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdatePermissions}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Permissions
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserGroups;
