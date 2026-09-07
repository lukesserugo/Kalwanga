// D:\Projects\Kalwanga\packages\web\components\users\UserActivityTimeline.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { 
  Activity, LogIn, LogOut, FileText, Settings, Trash2,
  Edit, Eye, Copy, Check, X, Info, AlertTriangle,
  AlertCircle, CheckCircle, XCircle, Loader2, Search,
  Filter, RefreshCw, ChevronDown, ChevronUp, ChevronLeft,
  ChevronRight, Calendar, Clock, User, Shield, Key,
  Lock, Unlock, Mail, Phone, Building, Package,
  FolderTree, FileText as FileIcon, DollarSign,
  ShoppingCart, ClipboardList, Truck, Boxes, Layers,
  Store, Globe, Hash, Tag, Star, Heart, ThumbsUp,
  MessageSquare, Share2, Bookmark, FileDown, FileJson,
  Download, Upload, MoreVertical, SlidersHorizontal,
  BarChart3, TrendingUp, PieChart, CreditCard, Percent,
  Printer, Send, Link2, Unlink, Plus, Minus, RotateCcw,
  History, Zap, Sparkles, Award, Medal, Trophy, Target,
  Crosshair, Gauge, // ✅ Removed Aim, Bullseye, Speedometer
  Database, Server, Cloud, Wifi, Bluetooth, Battery, Sun, Moon,
  Wind, Droplet, Flame, Leaf, TreePine, Mountain, Waves,
  Compass, Map, Navigation, Route, UserPlus, UserCheck,
  UserX, BadgeCheck, Ban, Monitor, Smartphone, Tablet,
  Laptop, // ✅ Removed Desktop (doesn't exist in lucide-react, use Monitor instead)
  Watch, Headphones, Speaker, Mouse,
  Keyboard, HardDrive, MemoryStick, Cpu, CircuitBoard
} from 'lucide-react';
import { UserRole } from '../../types/enums';

interface ActivityItem {
  id: string;
  userId: string;
  action: string;
  description: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  device?: string;
  location?: string;
  status?: 'success' | 'failed' | 'pending';
  severity?: 'info' | 'warning' | 'error' | 'critical';
  resource?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role?: UserRole;
  };
}

interface TimelineGroup {
  date: string;
  activities: ActivityItem[];
}

interface UserActivityTimelineProps {
  activities: ActivityItem[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onLoadMore?: (page: number) => void;
  onActivityClick?: (activity: ActivityItem) => void;
  showSearch?: boolean;
  showFilter?: boolean;
  showDateFilter?: boolean;
  showTypeFilter?: boolean;
  showPagination?: boolean;
  showStats?: boolean;
  pageSize?: number;
  totalActivities?: number;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  className?: string;
  emptyMessage?: string;
  groupByDate?: boolean;
  showTime?: boolean;
  showDate?: boolean;
  showDevice?: boolean;
  showLocation?: boolean;
  showIP?: boolean;
  showStatus?: boolean;
  showSeverity?: boolean;
  showMetadata?: boolean;
  animated?: boolean;
  compact?: boolean;
}

const ACTION_TYPES: Record<string, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
  LOGIN: { label: 'Login', icon: <LogIn className="w-4 h-4" />, color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  LOGOUT: { label: 'Logout', icon: <LogOut className="w-4 h-4" />, color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30' },
  CREATE: { label: 'Create', icon: <Plus className="w-4 h-4" />, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  UPDATE: { label: 'Update', icon: <Edit className="w-4 h-4" />, color: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-100 dark:bg-indigo-900/30' },
  DELETE: { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  VIEW: { label: 'View', icon: <Eye className="w-4 h-4" />, color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-700/50' },
  EXPORT: { label: 'Export', icon: <Download className="w-4 h-4" />, color: 'text-teal-600 dark:text-teal-400', bgColor: 'bg-teal-100 dark:bg-teal-900/30' },
  IMPORT: { label: 'Import', icon: <Upload className="w-4 h-4" />, color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30' },
  ROLE_CHANGE: { label: 'Role Change', icon: <Shield className="w-4 h-4" />, color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
  PERMISSION_CHANGE: { label: 'Permission Change', icon: <Key className="w-4 h-4" />, color: 'text-pink-600 dark:text-pink-400', bgColor: 'bg-pink-100 dark:bg-pink-900/30' },
  PASSWORD_CHANGE: { label: 'Password Change', icon: <Lock className="w-4 h-4" />, color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
  PROFILE_UPDATE: { label: 'Profile Update', icon: <User className="w-4 h-4" />, color: 'text-cyan-600 dark:text-cyan-400', bgColor: 'bg-cyan-100 dark:bg-cyan-900/30' },
  SETTINGS_CHANGE: { label: 'Settings Change', icon: <Settings className="w-4 h-4" />, color: 'text-slate-600 dark:text-slate-400', bgColor: 'bg-slate-100 dark:bg-slate-900/30' },
};

const STATUS_CONFIGS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  success: { label: 'Success', icon: <CheckCircle className="w-3 h-3" />, color: 'text-green-600 dark:text-green-400' },
  failed: { label: 'Failed', icon: <XCircle className="w-3 h-3" />, color: 'text-red-600 dark:text-red-400' },
  pending: { label: 'Pending', icon: <Clock className="w-3 h-3" />, color: 'text-yellow-600 dark:text-yellow-400' },
};

const SEVERITY_CONFIGS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  info: { label: 'Info', icon: <Info className="w-3 h-3" />, color: 'text-blue-600 dark:text-blue-400' },
  warning: { label: 'Warning', icon: <AlertTriangle className="w-3 h-3" />, color: 'text-yellow-600 dark:text-yellow-400' },
  error: { label: 'Error', icon: <AlertCircle className="w-3 h-3" />, color: 'text-red-600 dark:text-red-400' },
  critical: { label: 'Critical', icon: <AlertCircle className="w-3 h-3" />, color: 'text-purple-600 dark:text-purple-400' },
};

// ✅ Updated: Use Monitor instead of Desktop (since Desktop doesn't exist in lucide-react)
const DEVICE_ICONS: Record<string, React.ReactNode> = {
  desktop: <Monitor className="w-4 h-4" />,
  mobile: <Smartphone className="w-4 h-4" />,
  tablet: <Tablet className="w-4 h-4" />,
  laptop: <Laptop className="w-4 h-4" />,
  monitor: <Monitor className="w-4 h-4" />,
};

export function UserActivityTimeline({
  activities,
  loading = false,
  error = null,
  onRefresh,
  onLoadMore,
  onActivityClick,
  showSearch = true,
  showFilter = true,
  showDateFilter = true,
  showTypeFilter = true,
  showPagination = true,
  showStats = true,
  pageSize = 10,
  totalActivities,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  className = '',
  emptyMessage = 'No activities found',
  groupByDate = true,
  showTime = true,
  showDate = true,
  showDevice = true,
  showLocation = true,
  showIP = true,
  showStatus = true,
  showSeverity = true,
  showMetadata = false,
  animated = true,
  compact = false,
}: UserActivityTimelineProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const timelineRef = useRef<HTMLDivElement>(null);

  // Filter activities
  const filteredActivities = useMemo(() => {
    let filtered = activities;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(activity => 
        activity.description.toLowerCase().includes(query) ||
        activity.action.toLowerCase().includes(query) ||
        activity.ipAddress?.toLowerCase().includes(query) ||
        activity.location?.toLowerCase().includes(query)
      );
    }
    
    if (filterAction !== 'all') {
      filtered = filtered.filter(activity => activity.action === filterAction);
    }
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(activity => activity.status === filterStatus);
    }
    
    if (filterSeverity !== 'all') {
      filtered = filtered.filter(activity => activity.severity === filterSeverity);
    }
    
    if (filterDate === 'today') {
      const today = new Date();
      filtered = filtered.filter(activity => {
        const date = new Date(activity.timestamp);
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
      });
    } else if (filterDate === 'week') {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(activity => new Date(activity.timestamp) >= weekAgo);
    } else if (filterDate === 'month') {
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(activity => new Date(activity.timestamp) >= monthAgo);
    } else if (filterDate === 'custom' && dateRange.from && dateRange.to) {
      const from = new Date(dateRange.from);
      const to = new Date(dateRange.to);
      filtered = filtered.filter(activity => {
        const date = new Date(activity.timestamp);
        return date >= from && date <= to;
      });
    }
    
    // Sort by timestamp
    filtered.sort((a, b) => {
      return sortOrder === 'desc'
        ? new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        : new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
    
    return filtered;
  }, [activities, searchQuery, filterAction, filterStatus, filterSeverity, filterDate, dateRange, sortOrder]);

  // Group activities by date
  const groupedActivities = useMemo(() => {
    if (!groupByDate) {
      return [{ date: 'All Activities', activities: filteredActivities }] as TimelineGroup[];
    }
    
    const groups: Record<string, ActivityItem[]> = {};
    
    filteredActivities.forEach(activity => {
      const date = new Date(activity.timestamp);
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      
      let dateKey: string;
      if (date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear()) {
        dateKey = 'Today';
      } else if (date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear()) {
        dateKey = 'Yesterday';
      } else {
        dateKey = date.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
      }
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(activity);
    });
    
    return Object.entries(groups).map(([date, activities]) => ({
      date,
      activities,
    }));
  }, [filteredActivities, groupByDate]);

  // Get paginated activities
  const paginatedGroups = useMemo(() => {
    if (!showPagination) return groupedActivities;
    
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    
    let count = 0;
    const result: TimelineGroup[] = [];
    
    for (const group of groupedActivities) {
      const groupStart = count;
      const groupEnd = count + group.activities.length;
      
      if (groupEnd > start && groupStart < end) {
        const activitiesStart = Math.max(0, start - groupStart);
        const activitiesEnd = Math.min(group.activities.length, end - groupStart);
        
        if (activitiesStart < activitiesEnd) {
          result.push({
            date: group.date,
            activities: group.activities.slice(activitiesStart, activitiesEnd),
          });
        }
      }
      
      count = groupEnd;
      if (count >= end) break;
    }
    
    return result;
  }, [groupedActivities, currentPage, pageSize, showPagination]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = filteredActivities.length;
    const successCount = filteredActivities.filter(a => a.status === 'success').length;
    const failedCount = filteredActivities.filter(a => a.status === 'failed').length;
    const pendingCount = filteredActivities.filter(a => a.status === 'pending').length;
    
    return {
      total,
      successCount,
      failedCount,
      pendingCount,
      successRate: total > 0 ? Math.round((successCount / total) * 100) : 0,
    };
  }, [filteredActivities]);

  // Handle activity toggle
  const handleToggleActivity = useCallback((activityId: string) => {
    setExpandedActivities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(activityId)) {
        newSet.delete(activityId);
      } else {
        newSet.add(activityId);
      }
      return newSet;
    });
  }, []);

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    onPageChange?.(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [onPageChange]);

  // Get action config
  const getActionConfig = useCallback((action: string) => {
    return ACTION_TYPES[action] || {
      label: action.replace('_', ' '),
      icon: <Activity className="w-4 h-4" />,
      color: 'text-gray-600 dark:text-gray-400',
      bgColor: 'bg-gray-100 dark:bg-gray-700/50',
    };
  }, []);

  // Get status config
  const getStatusConfig = useCallback((status: string) => {
    return STATUS_CONFIGS[status] || STATUS_CONFIGS.pending;
  }, []);

  // Get severity config
  const getSeverityConfig = useCallback((severity: string) => {
    return SEVERITY_CONFIGS[severity] || SEVERITY_CONFIGS.info;
  }, []);

  // Get device icon
  const getDeviceIcon = useCallback((device: string) => {
    const deviceKey = device?.toLowerCase() || 'desktop';
    return DEVICE_ICONS[deviceKey] || <Monitor className="w-4 h-4" />;
  }, []);

  // Get time
  const formatTime = useCallback((timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  // Get time ago
  const getTimeAgo = useCallback((timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading activities...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <p className="text-gray-500 dark:text-gray-400">{error}</p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={timelineRef} className={`space-y-4 ${className}`}>
      {/* Statistics */}
      {showStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 p-3">
            <p className="text-sm text-green-600 dark:text-green-400">Success</p>
            <p className="text-xl font-bold text-green-700 dark:text-green-400">{stats.successCount}</p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 p-3">
            <p className="text-sm text-red-600 dark:text-red-400">Failed</p>
            <p className="text-xl font-bold text-red-700 dark:text-red-400">{stats.failedCount}</p>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 p-3">
            <p className="text-sm text-yellow-600 dark:text-yellow-400">Success Rate</p>
            <p className="text-xl font-bold text-yellow-700 dark:text-yellow-400">{stats.successRate}%</p>
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
                  placeholder="Search activities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
            )}
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 border rounded-lg transition-colors ${
                showFilters
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
              }`}
            >
              <Filter className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              title={sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}
            >
              {sortOrder === 'desc' ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
            </button>
            
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {/* Extended filters */}
          {showFilters && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {showTypeFilter && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Action Type</label>
                  <select
                    value={filterAction}
                    onChange={(e) => setFilterAction(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="all">All Actions</option>
                    {Object.entries(ACTION_TYPES).map(([key, value]) => (
                      <option key={key} value={key}>{value.label}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="success">Success</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Severity</label>
                <select
                  value={filterSeverity}
                  onChange={(e) => setFilterSeverity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="all">All Severity</option>
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              
              {showDateFilter && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Date Range</label>
                  <select
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                    <option value="custom">Custom Range</option>
                  </select>
                </div>
              )}
              
              {filterDate === 'custom' && (
                <div className="col-span-full grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">From</label>
                    <input
                      type="date"
                      value={dateRange.from}
                      onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">To</label>
                    <input
                      type="date"
                      value={dateRange.to}
                      onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      {paginatedGroups.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <Activity className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
          <p className="text-gray-500 dark:text-gray-400">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {paginatedGroups.map((group, groupIndex) => (
            <div key={group.date}>
              {/* Date header */}
              {showDate && (
                <div className="flex items-center gap-3 mb-3">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <h4 className="font-medium text-gray-700 dark:text-gray-300">{group.date}</h4>
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {group.activities.length} activities
                  </span>
                </div>
              )}
              
              {/* Timeline items */}
              <div className="relative pl-6">
                {/* Timeline line */}
                <div className="absolute left-2 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
                
                <div className="space-y-3">
                  {group.activities.map((activity, activityIndex) => {
                    const actionConfig = getActionConfig(activity.action);
                    const statusConfig = getStatusConfig(activity.status || 'success');
                    const severityConfig = getSeverityConfig(activity.severity || 'info');
                    const isExpanded = expandedActivities.has(activity.id);
                    
                    return (
                      <div
                        key={activity.id}
                        className={`relative ${animated ? 'animate-fadeIn' : ''}`}
                        style={{ animationDelay: `${activityIndex * 50}ms` }}
                      >
                        {/* Timeline dot */}
                        <div
                          className={`absolute -left-4 top-3 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${
                            activity.status === 'success'
                              ? 'bg-green-500'
                              : activity.status === 'failed'
                              ? 'bg-red-500'
                              : 'bg-yellow-500'
                          }`}
                        />
                        
                        {/* Activity card */}
                        <div
                          className={`bg-white dark:bg-gray-800 rounded-lg border ${
                            activity.severity === 'critical'
                              ? 'border-red-300 dark:border-red-700'
                              : activity.severity === 'error'
                              ? 'border-red-200 dark:border-red-800'
                              : 'border-gray-200 dark:border-gray-700'
                          } ${onActivityClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
                          onClick={() => onActivityClick?.(activity)}
                        >
                          <div className={`p-3 ${compact ? '' : 'sm:p-4'}`}>
                            <div className="flex items-start gap-3">
                              {/* Action icon */}
                              <div className={`p-2 rounded-lg ${actionConfig.bgColor} flex-shrink-0`}>
                                {actionConfig.icon}
                              </div>
                              
                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={`font-medium text-sm ${actionConfig.color}`}>
                                        {actionConfig.label}
                                      </span>
                                      {showStatus && (
                                        <span className={`inline-flex items-center gap-1 text-xs ${statusConfig.color}`}>
                                          {statusConfig.icon}
                                          {statusConfig.label}
                                        </span>
                                      )}
                                      {showSeverity && activity.severity && activity.severity !== 'info' && (
                                        <span className={`inline-flex items-center gap-1 text-xs ${severityConfig.color}`}>
                                          {severityConfig.icon}
                                          {severityConfig.label}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">
                                      {activity.description}
                                    </p>
                                  </div>
                                  
                                  {showTime && (
                                    <div className="text-right flex-shrink-0">
                                      <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {formatTime(activity.timestamp)}
                                      </p>
                                      <p className="text-xs text-gray-400 dark:text-gray-500">
                                        {getTimeAgo(activity.timestamp)}
                                      </p>
                                    </div>
                                  )}
                                </div>
                                
                                {/* Metadata row */}
                                <div className="flex items-center gap-3 mt-2 flex-wrap">
                                  {showDevice && activity.device && (
                                    <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                      {getDeviceIcon(activity.device)}
                                      {activity.device}
                                    </span>
                                  )}
                                  {showLocation && activity.location && (
                                    <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                      <Globe className="w-3 h-3" />
                                      {activity.location}
                                    </span>
                                  )}
                                  {showIP && activity.ipAddress && (
                                    <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                      <Hash className="w-3 h-3" />
                                      {activity.ipAddress}
                                    </span>
                                  )}
                                  {activity.resource && (
                                    <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                      <FileIcon className="w-3 h-3" />
                                      {activity.resource}
                                    </span>
                                  )}
                                </div>
                                
                                {/* Expanded metadata */}
                                {showMetadata && activity.metadata && Object.keys(activity.metadata).length > 0 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleActivity(activity.id);
                                    }}
                                    className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                                  >
                                    {isExpanded ? 'Hide details' : 'Show details'}
                                  </button>
                                )}
                                
                                {isExpanded && showMetadata && activity.metadata && (
                                  <pre className="mt-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded text-xs text-gray-600 dark:text-gray-400 overflow-x-auto">
                                    {JSON.stringify(activity.metadata, null, 2)}
                                  </pre>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {showPagination && totalPages > 1 && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Page {currentPage} of {totalPages}
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
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(page => 
                page === 1 || 
                page === totalPages || 
                Math.abs(page - currentPage) <= 2
              )
              .map((page, index, array) => (
                <React.Fragment key={page}>
                  {index > 0 && array[index - 1] !== page - 1 && (
                    <span className="text-sm text-gray-400">...</span>
                  )}
                  <button
                    onClick={() => handlePageChange(page)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {page}
                  </button>
                </React.Fragment>
              ))}
            <button
              onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserActivityTimeline;
