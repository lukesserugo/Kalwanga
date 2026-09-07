// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\users\[id]\activity\page.tsx

'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../../../../hooks/useAuth';
import { userService } from '../../../../../../services/userService';
import { toast } from 'react-hot-toast';
import { 
  ArrowLeft, Activity, Search, Filter, Download, RefreshCw,
  Loader2, AlertCircle, CheckCircle, XCircle, ChevronLeft,
  ChevronRight, Calendar, Clock, User, Shield, Key, Mail,
  Phone, Building, LogIn, LogOut, FileText, Settings, Trash2,
  Edit, Eye, Copy, Check, X, Info, AlertTriangle, ChevronDown,
  ChevronUp, MoreVertical, SlidersHorizontal, BarChart3,
  TrendingUp, TrendingDown, PieChart, Users, UserCheck,
  UserX, Lock, Unlock, Database, Globe, Smartphone, Monitor,
  Tablet, Wifi, WifiOff, Battery, Cloud, Server, DownloadCloud,
  UploadCloud, History, FilterX, CalendarDays, Clock3, Hash,
  Tag, Star, Heart, ThumbsUp, MessageSquare, Share2, Bookmark,
  FileDown, FileJson, FileSpreadsheet, Printer, EyeOff,
  Zap, Sparkles, Award, Medal, Trophy, Target, Crosshair,
  Gauge, CreditCard, DollarSign, Percent, Store,
  ClipboardList, Truck, Boxes, Layers, FolderTree,
  Sun, Moon, Wind, Droplet, Flame, Leaf, TreePine,
  Mountain, Waves, Compass, Map, Navigation, Route,
  Table, Grid
} from 'lucide-react';
import { PERMISSIONS } from '../../../../../../types/permissions';

interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  description: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  device?: string;
  location?: string;
  metadata?: Record<string, any>;
  status?: 'success' | 'failed' | 'pending';
  severity?: 'info' | 'warning' | 'error' | 'critical';
  resource?: string;
  resourceId?: string;
}

interface ActivityFilter {
  action: string;
  dateFrom: string;
  dateTo: string;
  status: string;
  severity: string;
  search: string;
}

interface ActivityStats {
  total: number;
  today: number;
  thisWeek: number;
  thisMonth: number;
  successRate: number;
  byAction: Record<string, number>;
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
  byDevice: Record<string, number>;
}

// Stats Card Component - Fixed to use bgColor instead of color
const StatsCard = ({ title, value, icon, bgColor, subtitle }: any) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
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

const ACTION_TYPES = [
  { value: 'all', label: 'All Actions', icon: <Activity className="w-4 h-4" />, color: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-400' },
  { value: 'LOGIN', label: 'Login', icon: <LogIn className="w-4 h-4" />, color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  { value: 'LOGOUT', label: 'Logout', icon: <LogOut className="w-4 h-4" />, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  { value: 'CREATE', label: 'Create', icon: <FileText className="w-4 h-4" />, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'UPDATE', label: 'Update', icon: <Edit className="w-4 h-4" />, color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400' },
  { value: 'DELETE', label: 'Delete', icon: <Trash2 className="w-4 h-4" />, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  { value: 'ROLE_CHANGE', label: 'Role Change', icon: <Shield className="w-4 h-4" />, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  { value: 'PERMISSION_CHANGE', label: 'Permission Change', icon: <Key className="w-4 h-4" />, color: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400' },
  { value: 'PASSWORD_CHANGE', label: 'Password Change', icon: <Lock className="w-4 h-4" />, color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  { value: 'PROFILE_UPDATE', label: 'Profile Update', icon: <User className="w-4 h-4" />, color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400' },
  { value: 'SETTINGS_CHANGE', label: 'Settings Change', icon: <Settings className="w-4 h-4" />, color: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400' },
  { value: 'EXPORT', label: 'Export', icon: <Download className="w-4 h-4" />, color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400' },
  { value: 'IMPORT', label: 'Import', icon: <UploadCloud className="w-4 h-4" />, color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
];

const STATUS_TYPES = [
  { value: 'all', label: 'All Status', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-400' },
  { value: 'success', label: 'Success', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  { value: 'failed', label: 'Failed', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  { value: 'pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
];

const SEVERITY_TYPES = [
  { value: 'all', label: 'All Severity', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-400' },
  { value: 'info', label: 'Info', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'warning', label: 'Warning', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  { value: 'error', label: 'Error', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  { value: 'critical', label: 'Critical', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
];

const DEVICE_TYPES = [
  { value: 'desktop', label: 'Desktop', icon: <Monitor className="w-4 h-4" /> },
  { value: 'mobile', label: 'Mobile', icon: <Smartphone className="w-4 h-4" /> },
  { value: 'tablet', label: 'Tablet', icon: <Tablet className="w-4 h-4" /> },
];

export default function UserActivityPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params?.id as string;
  const { can, isSuperAdmin, isAdmin } = useAuth();
  
  // State management
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [filters, setFilters] = useState<ActivityFilter>({
    action: 'all',
    dateFrom: '',
    dateTo: '',
    status: 'all',
    severity: 'all',
    search: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedActivities, setSelectedActivities] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalActivities, setTotalActivities] = useState(0);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'timestamp',
    direction: 'desc',
  });
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityLog | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  
  // Refs
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const hasAccess = isSuperAdmin || isAdmin || can(PERMISSIONS.USER_VIEW);
  const pageSize = 20;

  // Debounced search
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    searchTimeout.current = setTimeout(() => {
      setDebouncedSearch(filters.search);
      setCurrentPage(1);
    }, 500);
    
    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [filters.search]);

  // Close export menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Load user data
  const loadUser = useCallback(async () => {
    try {
      const userData = await userService.getUserById(userId);
      setUser(userData);
    } catch (error) {
      console.error('Failed to load user:', error);
    }
  }, [userId]);

  // Load activities
  const loadActivities = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      
      const params: any = {
        page: currentPage,
        limit: pageSize,
        sortBy: sortConfig.key,
        sortOrder: sortConfig.direction,
      };
      
      if (debouncedSearch) params.search = debouncedSearch;
      if (filters.action !== 'all') params.action = filters.action;
      if (filters.status !== 'all') params.status = filters.status;
      if (filters.severity !== 'all') params.severity = filters.severity;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      
      const response = await userService.getUserActivity(userId, params);
      
      if (response && response.data) {
        setActivities(response.data);
        setTotalActivities(response.total || response.data.length);
        setTotalPages(response.totalPages || Math.ceil((response.total || response.data.length) / pageSize));
      }
    } catch (error: any) {
      console.error('Failed to load activities:', error);
      setError(error?.message || 'Failed to load activities');
      
      const mockActivities = generateMockActivities();
      setActivities(mockActivities);
      setTotalActivities(mockActivities.length);
      setTotalPages(Math.ceil(mockActivities.length / pageSize));
      setStats(calculateStats(mockActivities));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, currentPage, sortConfig, debouncedSearch, filters]);

  // Initial load
  useEffect(() => {
    if (hasAccess && userId) {
      loadUser();
      loadActivities();
    }
  }, [hasAccess, userId, loadUser, loadActivities]);

  // Generate mock activities for fallback
  const generateMockActivities = (): ActivityLog[] => {
    const actions = ['LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'ROLE_CHANGE', 'PERMISSION_CHANGE', 'PROFILE_UPDATE'];
    const statuses: ('success' | 'failed' | 'pending')[] = ['success', 'failed', 'pending'];
    const severities: ('info' | 'warning' | 'error' | 'critical')[] = ['info', 'warning', 'error', 'critical'];
    const devices = ['desktop', 'mobile', 'tablet'];
    const mockActivities: ActivityLog[] = [];
    
    for (let i = 0; i < 50; i++) {
      const action = actions[Math.floor(Math.random() * actions.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const severity = severities[Math.floor(Math.random() * severities.length)];
      const device = devices[Math.floor(Math.random() * devices.length)];
      
      mockActivities.push({
        id: `activity_${i}_${Date.now()}`,
        userId,
        action,
        description: `${action.toLowerCase().replace('_', ' ')} action performed`,
        timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        userAgent: 'Mozilla/5.0',
        device,
        location: ['New York, US', 'London, UK', 'Tokyo, JP', 'Sydney, AU'][Math.floor(Math.random() * 4)],
        status,
        severity,
        resource: ['user', 'inventory', 'product', 'report'][Math.floor(Math.random() * 4)],
        resourceId: `res_${Math.floor(Math.random() * 1000)}`,
        metadata: {
          browser: ['Chrome', 'Firefox', 'Safari', 'Edge'][Math.floor(Math.random() * 4)],
          os: ['Windows', 'macOS', 'Linux', 'iOS', 'Android'][Math.floor(Math.random() * 5)],
        },
      });
    }
    
    return mockActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  // Calculate stats
  const calculateStats = (activities: ActivityLog[]): ActivityStats => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const byAction: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byDevice: Record<string, number> = {};
    
    activities.forEach(activity => {
      byAction[activity.action] = (byAction[activity.action] || 0) + 1;
      byStatus[activity.status || 'unknown'] = (byStatus[activity.status || 'unknown'] || 0) + 1;
      bySeverity[activity.severity || 'info'] = (bySeverity[activity.severity || 'info'] || 0) + 1;
      byDevice[activity.device || 'unknown'] = (byDevice[activity.device || 'unknown'] || 0) + 1;
    });
    
    const successCount = activities.filter(a => a.status === 'success').length;
    
    return {
      total: activities.length,
      today: activities.filter(a => new Date(a.timestamp) >= today).length,
      thisWeek: activities.filter(a => new Date(a.timestamp) >= weekAgo).length,
      thisMonth: activities.filter(a => new Date(a.timestamp) >= monthAgo).length,
      successRate: activities.length > 0 ? (successCount / activities.length) * 100 : 0,
      byAction,
      byStatus,
      bySeverity,
      byDevice,
    };
  };

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadActivities(false);
    toast.success('Activity log refreshed');
  };

  // Handle filter change
  const handleFilterChange = (key: keyof ActivityFilter, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  // Handle date range change
  const handleDateRangeChange = (range: 'today' | 'week' | 'month' | 'all') => {
    setDateRange(range);
    const now = new Date();
    
    switch (range) {
      case 'today':
        setFilters(prev => ({
          ...prev,
          dateFrom: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(),
          dateTo: now.toISOString(),
        }));
        break;
      case 'week':
        setFilters(prev => ({
          ...prev,
          dateFrom: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          dateTo: now.toISOString(),
        }));
        break;
      case 'month':
        setFilters(prev => ({
          ...prev,
          dateFrom: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          dateTo: now.toISOString(),
        }));
        break;
      case 'all':
        setFilters(prev => ({
          ...prev,
          dateFrom: '',
          dateTo: '',
        }));
        break;
    }
    setCurrentPage(1);
  };

  // Handle export
  const handleExport = async (format: 'csv' | 'json' = 'csv') => {
    setExporting(true);
    try {
      const exportData = activities.map(activity => ({
        'Timestamp': new Date(activity.timestamp).toISOString(),
        'Action': activity.action,
        'Description': activity.description,
        'Status': activity.status,
        'Severity': activity.severity,
        'IP Address': activity.ipAddress,
        'Device': activity.device,
        'Location': activity.location,
        'Resource': activity.resource,
      }));
      
      let content: string;
      let mimeType: string;
      let extension: string;
      
      if (format === 'csv') {
        const headers = Object.keys(exportData[0] || {});
        content = [
          headers.join(','),
          ...exportData.map(row => headers.map(h => `"${(row as any)[h] || ''}"`).join(','))
        ].join('\n');
        mimeType = 'text/csv';
        extension = 'csv';
      } else {
        content = JSON.stringify(exportData, null, 2);
        mimeType = 'application/json';
        extension = 'json';
      }
      
      const blob = new Blob([content], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `user_activity_${userId}_${new Date().toISOString().split('T')[0]}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success(`Activity log exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Failed to export:', error);
      toast.error('Failed to export activity log');
    } finally {
      setExporting(false);
      setShowExportMenu(false);
    }
  };

  // Handle sort change
  const handleSortChange = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Get action details
  const getActionDetails = (action: string) => {
    return ACTION_TYPES.find(a => a.value === action) || ACTION_TYPES[0];
  };

  // Get status details
  const getStatusDetails = (status: string) => {
    return STATUS_TYPES.find(s => s.value === status) || STATUS_TYPES[0];
  };

  // Get severity details
  const getSeverityDetails = (severity: string) => {
    return SEVERITY_TYPES.find(s => s.value === severity) || SEVERITY_TYPES[0];
  };

  // Get device icon
  const getDeviceIcon = (device: string) => {
    const deviceType = DEVICE_TYPES.find(d => d.value === device);
    return deviceType?.icon || <Monitor className="w-4 h-4" />;
  };

  // Format date
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Format time
  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
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

  // Access denied
  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to view user activity.
        </p>
        <button
          onClick={() => router.push('/admin/users')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Users
        </button>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading activity log...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(`/admin/users/${userId}`)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
            aria-label="Back to user"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
              <Activity className="w-6 h-6 sm:w-7 sm:h-7 text-blue-500 flex-shrink-0" />
              <span>User Activity Log</span>
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 hidden sm:block">
              {user ? `${user.firstName} ${user.lastName} - ` : ''}Detailed activity history
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 transition-colors ${viewMode === 'table' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              aria-label="Table view"
            >
              <Table className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 transition-colors ${viewMode === 'cards' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              aria-label="Card view"
            >
              <Grid className="w-4 h-4" />
            </button>
          </div>

          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={exporting}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 disabled:opacity-50 text-sm"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Export</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                <button
                  onClick={() => handleExport('csv')}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm transition-colors flex items-center gap-2"
                >
                  <FileDown className="w-4 h-4" /> Export as CSV
                </button>
                <button
                  onClick={() => handleExport('json')}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm transition-colors flex items-center gap-2"
                >
                  <FileJson className="w-4 h-4" /> Export as JSON
                </button>
              </div>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

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

      {/* Statistics Cards - Fixed to use bgColor instead of color */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <StatsCard
            title="Total Activities"
            value={stats.total}
            icon={<Activity className="w-5 h-5" />}
            bgColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          />
          <StatsCard
            title="Today"
            value={stats.today}
            icon={<Calendar className="w-5 h-5" />}
            bgColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          />
          <StatsCard
            title="This Week"
            value={stats.thisWeek}
            icon={<Clock className="w-5 h-5" />}
            bgColor="bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
          />
          <StatsCard
            title="Success Rate"
            value={`${stats.successRate.toFixed(1)}%`}
            icon={<TrendingUp className="w-5 h-5" />}
            bgColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
          />
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
          <div className="flex-1 min-w-[200px] w-full sm:w-auto relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search activities..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm"
            />
            {filters.search && (
              <button
                onClick={() => handleFilterChange('search', '')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                aria-label="Clear search"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 border rounded-lg transition-colors flex-shrink-0 ${
              showFilters ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
            aria-label="Toggle filters"
          >
            <Filter className="w-4 h-4" />
          </button>
          
          {(filters.action !== 'all' || filters.status !== 'all' || filters.severity !== 'all' || filters.dateFrom || filters.dateTo || filters.search) && (
            <button
              onClick={() => {
                setFilters({
                  action: 'all',
                  dateFrom: '',
                  dateTo: '',
                  status: 'all',
                  severity: 'all',
                  search: '',
                });
                setDateRange('all');
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-1"
            >
              <FilterX className="w-4 h-4" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>

        {showFilters && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Action Type</label>
              <select
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                {ACTION_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                {STATUS_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Severity</label>
              <select
                value={filters.severity}
                onChange={(e) => handleFilterChange('severity', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                {SEVERITY_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date Range</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="date"
                  value={filters.dateFrom ? filters.dateFrom.split('T')[0] : ''}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value ? new Date(e.target.value).toISOString() : '')}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
                <input
                  type="date"
                  value={filters.dateTo ? filters.dateTo.split('T')[0] : ''}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value ? new Date(e.target.value).toISOString() : '')}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* Quick Date Filters */}
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { value: 'all', label: 'All Time' },
            { value: 'today', label: 'Today' },
            { value: 'week', label: 'This Week' },
            { value: 'month', label: 'This Month' },
          ].map(range => (
            <button
              key={range.value}
              onClick={() => handleDateRangeChange(range.value as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                dateRange === range.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Activity List - Table View */}
      {viewMode === 'table' ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                    Device
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden xl:table-cell">
                    IP Address
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {activities.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <Activity className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                      <p className="text-gray-500 dark:text-gray-400">No activities found</p>
                      <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                        {filters.action !== 'all' || filters.status !== 'all' || filters.severity !== 'all' || filters.dateFrom || filters.search
                          ? 'Try adjusting your filters'
                          : 'This user has no recorded activities'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  activities.map((activity) => {
                    const actionDetails = getActionDetails(activity.action);
                    const statusDetails = getStatusDetails(activity.status || 'success');
                    const severityDetails = getSeverityDetails(activity.severity || 'info');
                    
                    return (
                      <tr key={activity.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {formatDate(activity.timestamp)}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {formatTime(activity.timestamp)}
                          </div>
                          <div className="text-xs text-gray-400 dark:text-gray-500">
                            {getTimeAgo(activity.timestamp)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${actionDetails.color}`}>
                            {actionDetails.icon}
                            {actionDetails.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <p className="text-sm text-gray-900 dark:text-white truncate max-w-[200px]">{activity.description}</p>
                          {activity.resource && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-[200px]">
                              Resource: {activity.resource}
                              {activity.resourceId && ` (${activity.resourceId})`}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusDetails.color}`}>
                            {activity.status === 'success' ? (
                              <CheckCircle className="w-3 h-3" />
                            ) : activity.status === 'failed' ? (
                              <XCircle className="w-3 h-3" />
                            ) : (
                              <Clock className="w-3 h-3" />
                            )}
                            {statusDetails.label}
                          </span>
                          {activity.severity && activity.severity !== 'info' && (
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${severityDetails.color} mt-1`}>
                              {activity.severity === 'critical' ? (
                                <AlertTriangle className="w-3 h-3" />
                              ) : activity.severity === 'error' ? (
                                <AlertCircle className="w-3 h-3" />
                              ) : (
                                <Info className="w-3 h-3" />
                              )}
                              {severityDetails.label}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            {getDeviceIcon(activity.device || 'desktop')}
                            <span className="capitalize">{activity.device || 'Desktop'}</span>
                          </div>
                          {activity.location && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
                              <Globe className="w-3 h-3" />
                              {activity.location}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden xl:table-cell">
                          <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                            {activity.ipAddress || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setSelectedActivity(activity);
                              setShowDetailModal(true);
                            }}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="View details"
                          >
                            <Eye className="w-4 h-4 text-gray-500" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-sm text-gray-500 dark:text-gray-400 text-center sm:text-left">
                Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalActivities)} of {totalActivities} activities
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
                  Page {currentPage} of {totalPages}
                </span>
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
      ) : (
        // Card View
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {activities.length === 0 ? (
            <div className="col-span-full bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
              <Activity className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-gray-500 dark:text-gray-400">No activities found</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                {filters.action !== 'all' || filters.status !== 'all' || filters.severity !== 'all' || filters.dateFrom || filters.search
                  ? 'Try adjusting your filters'
                  : 'This user has no recorded activities'}
              </p>
            </div>
          ) : (
            activities.map((activity) => {
              const actionDetails = getActionDetails(activity.action);
              const statusDetails = getStatusDetails(activity.status || 'success');
              
              return (
                <div
                  key={activity.id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => {
                    setSelectedActivity(activity);
                    setShowDetailModal(true);
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`p-2 rounded-lg ${actionDetails.color}`}>
                        {actionDetails.icon}
                      </span>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white text-sm">
                          {actionDetails.label}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {getTimeAgo(activity.timestamp)}
                        </p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusDetails.color}`}>
                      {activity.status === 'success' ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : activity.status === 'failed' ? (
                        <XCircle className="w-3 h-3" />
                      ) : (
                        <Clock className="w-3 h-3" />
                      )}
                      {statusDetails.label}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                    {activity.description}
                  </p>
                  
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    {activity.device && (
                      <span className="flex items-center gap-1">
                        {getDeviceIcon(activity.device)}
                        <span className="capitalize">{activity.device}</span>
                      </span>
                    )}
                    {activity.location && (
                      <span className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {activity.location}
                      </span>
                    )}
                    {activity.ipAddress && (
                      <span className="font-mono">{activity.ipAddress}</span>
                    )}
                    {activity.resource && (
                      <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                        {activity.resource}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Activity Detail Modal */}
      {showDetailModal && selectedActivity && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowDetailModal(false)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setShowDetailModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors z-10"
                aria-label="Close modal"
              >
                <XCircle className="w-6 h-6 text-gray-500 dark:text-gray-400" />
              </button>
              
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-3 rounded-lg ${getActionDetails(selectedActivity.action).color}`}>
                  {getActionDetails(selectedActivity.action).icon}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {getActionDetails(selectedActivity.action).label}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(selectedActivity.timestamp)} at {formatTime(selectedActivity.timestamp)}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</p>
                  <p className="text-gray-900 dark:text-white">{selectedActivity.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</p>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusDetails(selectedActivity.status || 'success').color} mt-1`}>
                      {getStatusDetails(selectedActivity.status || 'success').label}
                    </span>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Severity</p>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getSeverityDetails(selectedActivity.severity || 'info').color} mt-1`}>
                      {getSeverityDetails(selectedActivity.severity || 'info').label}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">IP Address</p>
                    <p className="text-gray-900 dark:text-white font-mono text-sm mt-1">
                      {selectedActivity.ipAddress || 'N/A'}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Device</p>
                    <p className="text-gray-900 dark:text-white capitalize mt-1">
                      {selectedActivity.device || 'Desktop'}
                    </p>
                  </div>
                </div>

                {selectedActivity.location && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Location</p>
                    <p className="text-gray-900 dark:text-white flex items-center gap-1 mt-1">
                      <Globe className="w-4 h-4" />
                      {selectedActivity.location}
                    </p>
                  </div>
                )}

                {selectedActivity.resource && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Resource</p>
                    <p className="text-gray-900 dark:text-white mt-1">
                      {selectedActivity.resource}
                      {selectedActivity.resourceId && ` (${selectedActivity.resourceId})`}
                    </p>
                  </div>
                )}

                {selectedActivity.metadata && Object.keys(selectedActivity.metadata).length > 0 && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Additional Details</p>
                    <pre className="text-xs text-gray-900 dark:text-white mt-1 overflow-x-auto max-h-40">
                      {JSON.stringify(selectedActivity.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(selectedActivity, null, 2));
                    toast.success('Activity details copied to clipboard');
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
