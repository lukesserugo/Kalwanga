// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\users\settings\page.tsx

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../../hooks/useAuth';
import { toast } from 'react-hot-toast';
import { 
  ArrowLeft, Settings, Shield, Key, Lock,
  Users, User, Clock, Save, Loader2, AlertCircle,
  CheckCircle, XCircle, RefreshCw, History, AlertTriangle,
  ChevronDown, ChevronUp, X, Bell, Info, Search,
  Globe, Database, Server, Cloud, Wifi, Smartphone,
  Monitor, Tablet, Laptop, Mail, Phone,
  Calendar, Hash, Tag, Star, Heart, ThumbsUp,
  MessageSquare, Share2, Bookmark, FileText,
  Download, Upload, Printer, Send, Link2,
  Plus, Minus, RotateCcw, Zap, Sparkles,
  Award, Medal, Trophy, Target, Crosshair,
  CreditCard, DollarSign, Percent, TrendingUp,
  TrendingDown, BarChart3, PieChart, Activity,
  LayoutDashboard, UsersRound, ShieldCheck,
  ShieldAlert, ShieldX, BadgeCheck, Ban,
  UserCheck, UserX, UserPlus, UserMinus
} from 'lucide-react';
import { PERMISSIONS } from '../../../../../types/permissions';
import { UserRole } from '../../../../../types/enums';

interface UserSettings {
  defaultRole: UserRole;
  defaultBusinessUnitId: string;
  defaultCompanyId: string;
  defaultPermissions: string[];
  autoActivateUsers: boolean;
  sendWelcomeEmail: boolean;
  requireEmailVerification: boolean;
  minPasswordLength: number;
  maxPasswordLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialCharacters: boolean;
  passwordExpiryDays: number;
  preventPasswordReuse: number;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
  sessionTimeoutMinutes: number;
  maxConcurrentSessions: number;
  rememberMeEnabled: boolean;
  rememberMeDurationDays: number;
  forceLogoutOnPasswordChange: boolean;
  trackLoginHistory: boolean;
  allowedIPAddresses: string[];
  blockedIPAddresses: string[];
  allowedDomains: string[];
  blockedDomains: string[];
  requireTwoFactor: boolean;
  twoFactorMethods: string[];
  loginAlertsEnabled: boolean;
  loginAlertEmail: string;
  restrictLoginTimes: boolean;
  allowedLoginStartTime: string;
  allowedLoginEndTime: string;
  restrictLoginDays: boolean;
  allowedLoginDays: string[];
  emailNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
  notificationEmail: string;
  enableCaptcha: boolean;
  enableRateLimiting: boolean;
  rateLimitRequests: number;
  rateLimitWindowMinutes: number;
  enableAuditLogging: boolean;
  auditLogRetentionDays: number;
}

interface SettingsSection {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  badge?: number;
}

interface SettingsHistory {
  id: string;
  changedAt: string;
  changedBy: string;
  section: string;
  field: string;
  oldValue: string;
  newValue: string;
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

const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: 'defaults',
    label: 'Default User Settings',
    description: 'Configure default settings for new users',
    icon: <User className="w-5 h-5" />,
    color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  },
  {
    id: 'password',
    label: 'Password Policies',
    description: 'Configure password requirements and policies',
    icon: <Key className="w-5 h-5" />,
    color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  },
  {
    id: 'session',
    label: 'Session Settings',
    description: 'Configure session timeout and management',
    icon: <Clock className="w-5 h-5" />,
    color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  },
  {
    id: 'login',
    label: 'Login Restrictions',
    description: 'Configure login security and restrictions',
    icon: <Lock className="w-5 h-5" />,
    color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  },
  {
    id: 'notifications',
    label: 'Notification Settings',
    description: 'Configure notification preferences',
    icon: <Bell className="w-5 h-5" />,
    color: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  {
    id: 'security',
    label: 'Security Settings',
    description: 'Configure security features and protections',
    icon: <Shield className="w-5 h-5" />,
    color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  },
];

export default function UserSettingsPage() {
  const router = useRouter();
  const { can, isSuperAdmin, isAdmin } = useAuth();
  
  // State management
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState('defaults');
  const [settings, setSettings] = useState<UserSettings>({
    defaultRole: UserRole.USER,
    defaultBusinessUnitId: '',
    defaultCompanyId: '',
    defaultPermissions: [],
    autoActivateUsers: true,
    sendWelcomeEmail: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 64,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialCharacters: true,
    passwordExpiryDays: 90,
    preventPasswordReuse: 5,
    maxLoginAttempts: 5,
    lockoutDurationMinutes: 30,
    sessionTimeoutMinutes: 30,
    maxConcurrentSessions: 3,
    rememberMeEnabled: true,
    rememberMeDurationDays: 30,
    forceLogoutOnPasswordChange: true,
    trackLoginHistory: true,
    allowedIPAddresses: [],
    blockedIPAddresses: [],
    allowedDomains: [],
    blockedDomains: [],
    requireTwoFactor: false,
    twoFactorMethods: ['app', 'email'],
    loginAlertsEnabled: true,
    loginAlertEmail: '',
    restrictLoginTimes: false,
    allowedLoginStartTime: '08:00',
    allowedLoginEndTime: '18:00',
    restrictLoginDays: false,
    allowedLoginDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    emailNotificationsEnabled: true,
    pushNotificationsEnabled: true,
    smsNotificationsEnabled: false,
    notificationEmail: '',
    enableCaptcha: true,
    enableRateLimiting: true,
    rateLimitRequests: 100,
    rateLimitWindowMinutes: 15,
    enableAuditLogging: true,
    auditLogRetentionDays: 90,
  });
  const [originalSettings, setOriginalSettings] = useState<UserSettings>(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [settingsHistory, setSettingsHistory] = useState<SettingsHistory[]>([]);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [newIPAddress, setNewIPAddress] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(SETTINGS_SECTIONS.map(s => s.id)));
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSection, setFilterSection] = useState<string>('all');
  
  const settingsTimerRef = useRef<NodeJS.Timeout | null>(null);

  const hasAccess = isSuperAdmin || isAdmin || can(PERMISSIONS.USER_MANAGE);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (typeof window !== 'undefined') {
        const savedSettings = localStorage.getItem('userSettings');
        if (savedSettings) {
          const parsedSettings = JSON.parse(savedSettings);
          setSettings(parsedSettings);
          setOriginalSettings(parsedSettings);
        }
        
        const savedHistory = localStorage.getItem('userSettingsHistory');
        if (savedHistory) {
          setSettingsHistory(JSON.parse(savedHistory));
        }
      }
      
    } catch (error: any) {
      console.error('Failed to load settings:', error);
      setError(error?.message || 'Failed to load settings');
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasAccess) {
      loadSettings();
    } else {
      setLoading(false);
    }
  }, [hasAccess, loadSettings]);

  useEffect(() => {
    const settingsChanged = JSON.stringify(settings) !== JSON.stringify(originalSettings);
    setHasChanges(settingsChanged);
  }, [settings, originalSettings]);

  useEffect(() => {
    if (successMessage) {
      settingsTimerRef.current = setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    }
    
    return () => {
      if (settingsTimerRef.current) {
        clearTimeout(settingsTimerRef.current);
      }
    };
  }, [successMessage]);

  const handleSettingsChange = useCallback((section: string, field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const handleSaveSettings = useCallback(async () => {
    try {
      setSaving(true);
      setError(null);
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('userSettings', JSON.stringify(settings));
        
        const changes: SettingsHistory[] = [];
        Object.keys(settings).forEach(key => {
          if (settings[key as keyof UserSettings] !== originalSettings[key as keyof UserSettings]) {
            changes.push({
              id: `change_${Date.now()}_${key}`,
              changedAt: new Date().toISOString(),
              changedBy: 'Current User',
              section: activeSection,
              field: key,
              oldValue: String(originalSettings[key as keyof UserSettings]),
              newValue: String(settings[key as keyof UserSettings]),
            });
          }
        });
        
        if (changes.length > 0) {
          const updatedHistory = [...changes, ...settingsHistory];
          setSettingsHistory(updatedHistory);
          localStorage.setItem('userSettingsHistory', JSON.stringify(updatedHistory));
        }
      }
      
      setOriginalSettings(settings);
      setHasChanges(false);
      setSuccessMessage('Settings saved successfully');
      toast.success('Settings saved successfully');
      
    } catch (error: any) {
      console.error('Failed to save settings:', error);
      setError(error?.message || 'Failed to save settings');
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, [settings, originalSettings, activeSection, settingsHistory]);

  const handleResetSettings = useCallback(() => {
    setSettings(originalSettings);
    setHasChanges(false);
    setShowConfirmReset(false);
    toast.success('Settings reset to saved values');
  }, [originalSettings]);

  const handleResetToDefaults = useCallback(() => {
    const defaultSettings: UserSettings = {
      defaultRole: UserRole.USER,
      defaultBusinessUnitId: '',
      defaultCompanyId: '',
      defaultPermissions: [],
      autoActivateUsers: true,
      sendWelcomeEmail: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      maxPasswordLength: 64,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialCharacters: true,
      passwordExpiryDays: 90,
      preventPasswordReuse: 5,
      maxLoginAttempts: 5,
      lockoutDurationMinutes: 30,
      sessionTimeoutMinutes: 30,
      maxConcurrentSessions: 3,
      rememberMeEnabled: true,
      rememberMeDurationDays: 30,
      forceLogoutOnPasswordChange: true,
      trackLoginHistory: true,
      allowedIPAddresses: [],
      blockedIPAddresses: [],
      allowedDomains: [],
      blockedDomains: [],
      requireTwoFactor: false,
      twoFactorMethods: ['app', 'email'],
      loginAlertsEnabled: true,
      loginAlertEmail: '',
      restrictLoginTimes: false,
      allowedLoginStartTime: '08:00',
      allowedLoginEndTime: '18:00',
      restrictLoginDays: false,
      allowedLoginDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      emailNotificationsEnabled: true,
      pushNotificationsEnabled: true,
      smsNotificationsEnabled: false,
      notificationEmail: '',
      enableCaptcha: true,
      enableRateLimiting: true,
      rateLimitRequests: 100,
      rateLimitWindowMinutes: 15,
      enableAuditLogging: true,
      auditLogRetentionDays: 90,
    };
    
    setSettings(defaultSettings);
    setShowConfirmReset(false);
    toast.success('Settings reset to defaults');
  }, []);

  const handleAddIPAddress = useCallback((type: 'allowed' | 'blocked') => {
    if (!newIPAddress.trim()) return;
    
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(newIPAddress.trim())) {
      toast.error('Invalid IP address format');
      return;
    }
    
    if (type === 'allowed') {
      setSettings(prev => ({
        ...prev,
        allowedIPAddresses: [...prev.allowedIPAddresses, newIPAddress.trim()],
      }));
    } else {
      setSettings(prev => ({
        ...prev,
        blockedIPAddresses: [...prev.blockedIPAddresses, newIPAddress.trim()],
      }));
    }
    
    setNewIPAddress('');
    toast.success(`IP address added to ${type} list`);
  }, [newIPAddress]);

  const handleRemoveIPAddress = useCallback((type: 'allowed' | 'blocked', ip: string) => {
    if (type === 'allowed') {
      setSettings(prev => ({
        ...prev,
        allowedIPAddresses: prev.allowedIPAddresses.filter(addr => addr !== ip),
      }));
    } else {
      setSettings(prev => ({
        ...prev,
        blockedIPAddresses: prev.blockedIPAddresses.filter(addr => addr !== ip),
      }));
    }
  }, []);

  const handleAddDomain = useCallback((type: 'allowed' | 'blocked') => {
    if (!newDomain.trim()) return;
    
    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(newDomain.trim())) {
      toast.error('Invalid domain format');
      return;
    }
    
    if (type === 'allowed') {
      setSettings(prev => ({
        ...prev,
        allowedDomains: [...prev.allowedDomains, newDomain.trim()],
      }));
    } else {
      setSettings(prev => ({
        ...prev,
        blockedDomains: [...prev.blockedDomains, newDomain.trim()],
      }));
    }
    
    setNewDomain('');
    toast.success(`Domain added to ${type} list`);
  }, [newDomain]);

  const handleRemoveDomain = useCallback((type: 'allowed' | 'blocked', domain: string) => {
    if (type === 'allowed') {
      setSettings(prev => ({
        ...prev,
        allowedDomains: prev.allowedDomains.filter(d => d !== domain),
      }));
    } else {
      setSettings(prev => ({
        ...prev,
        blockedDomains: prev.blockedDomains.filter(d => d !== domain),
      }));
    }
  }, []);

  const handleToggleSection = useCallback((sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  }, []);

  // Filter sections based on search
  const filteredSections = SETTINGS_SECTIONS.filter(section => {
    if (filterSection !== 'all' && section.id !== filterSection) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return section.label.toLowerCase().includes(query) ||
             section.description.toLowerCase().includes(query);
    }
    return true;
  });

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to manage user settings.
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading settings...</p>
      </div>
    );
  }

  const getSectionIcon = (sectionId: string) => {
    const section = SETTINGS_SECTIONS.find(s => s.id === sectionId);
    return section?.icon || <Settings className="w-5 h-5" />;
  };

  const getSectionColor = (sectionId: string) => {
    const section = SETTINGS_SECTIONS.find(s => s.id === sectionId);
    return section?.color || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <button
            onClick={() => router.push('/admin/users')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
            aria-label="Back to users"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
              <Settings className="w-6 h-6 sm:w-7 sm:h-7 text-blue-500 flex-shrink-0" />
              <span>User Settings</span>
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 hidden sm:block">
              Configure default user settings, password policies, and security options
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {hasChanges && (
            <>
              <button
                onClick={() => setShowConfirmReset(true)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 text-sm"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Save Changes</span>
              </button>
            </>
          )}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-sm"
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">History</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <StatsCard
          title="Total Settings"
          value={Object.keys(settings).length}
          icon={<Settings className="w-5 h-5" />}
          bgColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
        />
        <StatsCard
          title="Security"
          value="High"
          icon={<Shield className="w-5 h-5" />}
          bgColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          subtitle="All policies active"
        />
        <StatsCard
          title="Password Policy"
          value="Strong"
          icon={<Key className="w-5 h-5" />}
          bgColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
        />
        <StatsCard
          title="Sessions"
          value="Active"
          icon={<Clock className="w-5 h-5" />}
          bgColor="bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
        />
        <StatsCard
          title="Login Restrictions"
          value="Enabled"
          icon={<Lock className="w-5 h-5" />}
          bgColor="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
        />
        <StatsCard
          title="Audit Logging"
          value={settings.enableAuditLogging ? 'Enabled' : 'Disabled'}
          icon={<Activity className="w-5 h-5" />}
          bgColor="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
        />
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2 animate-slideIn">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          <span className="text-green-700 dark:text-green-300 text-sm flex-1">{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="p-1 hover:bg-green-100 dark:hover:bg-green-800 rounded transition-colors flex-shrink-0"
            aria-label="Dismiss"
          >
            <XCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          </button>
        </div>
      )}

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

      {/* Settings History */}
      {showHistory && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-blue-500" />
            Settings History
          </h3>
          {settingsHistory.length === 0 ? (
            <div className="text-center py-8">
              <History className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-gray-500 dark:text-gray-400">No settings changes recorded</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {settingsHistory.map(change => (
                <div key={change.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <Clock className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-white">
                      <span className="font-medium">{change.field}</span> changed
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      From: <span className="text-red-600 font-mono">{change.oldValue}</span> → To: <span className="text-green-600 font-mono">{change.newValue}</span>
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {change.changedBy} • {new Date(change.changedAt).toLocaleString()}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getSectionColor(change.section)}`}>
                    {change.section}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search and Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
          <div className="flex-1 min-w-[200px] w-full sm:w-auto relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search settings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm"
            />
          </div>
          <select
            value={filterSection}
            onChange={(e) => setFilterSection(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Sections</option>
            {SETTINGS_SECTIONS.map(section => (
              <option key={section.id} value={section.id}>{section.label}</option>
            ))}
          </select>
          <button
            onClick={() => {
              setSearchQuery('');
              setFilterSection('all');
            }}
            className="px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-1"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="space-y-4">
        {filteredSections.map((section) => {
          const isExpanded = expandedSections.has(section.id);
          const isActive = activeSection === section.id;
          
          return (
            <div 
              key={section.id} 
              className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border transition-all overflow-hidden ${
                isActive ? 'border-blue-500 dark:border-blue-400' : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              {/* Section Header */}
              <div 
                className={`flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                  isActive ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
                onClick={() => handleToggleSection(section.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2 rounded-lg flex-shrink-0 ${section.color}`}>
                    {section.icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-medium text-gray-900 dark:text-white truncate">{section.label}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate hidden sm:block">{section.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {section.badge !== undefined && section.badge > 0 && (
                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-medium">
                      {section.badge}
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveSection(isActive ? '' : section.id);
                    }}
                    className={`p-1.5 rounded-lg transition-colors ${
                      isActive ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>
              
              {/* Section Content */}
              {isExpanded && (
                <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700">
                  {section.id === 'defaults' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Default Role <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={settings.defaultRole}
                            onChange={(e) => handleSettingsChange('defaults', 'defaultRole', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            {Object.values(UserRole).map(role => (
                              <option key={role} value={role}>{role.replace('_', ' ')}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Default Business Unit
                          </label>
                          <select
                            value={settings.defaultBusinessUnitId}
                            onChange={(e) => handleSettingsChange('defaults', 'defaultBusinessUnitId', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="">No Default Unit</option>
                            <option value="1">Headquarters</option>
                            <option value="2">Branch 1</option>
                            <option value="3">Branch 2</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.autoActivateUsers}
                            onChange={(e) => handleSettingsChange('defaults', 'autoActivateUsers', e.target.checked)}
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Auto-activate new users</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.sendWelcomeEmail}
                            onChange={(e) => handleSettingsChange('defaults', 'sendWelcomeEmail', e.target.checked)}
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Send welcome email</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.requireEmailVerification}
                            onChange={(e) => handleSettingsChange('defaults', 'requireEmailVerification', e.target.checked)}
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Require email verification</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {section.id === 'password' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Minimum Length
                          </label>
                          <input
                            type="number"
                            value={settings.minPasswordLength}
                            onChange={(e) => handleSettingsChange('password', 'minPasswordLength', Number(e.target.value))}
                            min={6}
                            max={32}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Maximum Length
                          </label>
                          <input
                            type="number"
                            value={settings.maxPasswordLength}
                            onChange={(e) => handleSettingsChange('password', 'maxPasswordLength', Number(e.target.value))}
                            min={8}
                            max={128}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Expiry (Days)
                          </label>
                          <input
                            type="number"
                            value={settings.passwordExpiryDays}
                            onChange={(e) => handleSettingsChange('password', 'passwordExpiryDays', Number(e.target.value))}
                            min={0}
                            max={365}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.requireUppercase}
                            onChange={(e) => handleSettingsChange('password', 'requireUppercase', e.target.checked)}
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Require uppercase letters</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.requireLowercase}
                            onChange={(e) => handleSettingsChange('password', 'requireLowercase', e.target.checked)}
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Require lowercase letters</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.requireNumbers}
                            onChange={(e) => handleSettingsChange('password', 'requireNumbers', e.target.checked)}
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Require numbers</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.requireSpecialCharacters}
                            onChange={(e) => handleSettingsChange('password', 'requireSpecialCharacters', e.target.checked)}
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Require special characters</span>
                        </label>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Prevent Password Reuse
                          </label>
                          <input
                            type="number"
                            value={settings.preventPasswordReuse}
                            onChange={(e) => handleSettingsChange('password', 'preventPasswordReuse', Number(e.target.value))}
                            min={0}
                            max={20}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Max Login Attempts
                          </label>
                          <input
                            type="number"
                            value={settings.maxLoginAttempts}
                            onChange={(e) => handleSettingsChange('password', 'maxLoginAttempts', Number(e.target.value))}
                            min={1}
                            max={20}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Lockout Duration (Minutes)
                          </label>
                          <input
                            type="number"
                            value={settings.lockoutDurationMinutes}
                            onChange={(e) => handleSettingsChange('password', 'lockoutDurationMinutes', Number(e.target.value))}
                            min={1}
                            max={1440}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {section.id === 'session' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Session Timeout (Minutes)
                          </label>
                          <input
                            type="number"
                            value={settings.sessionTimeoutMinutes}
                            onChange={(e) => handleSettingsChange('session', 'sessionTimeoutMinutes', Number(e.target.value))}
                            min={5}
                            max={1440}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Max Concurrent Sessions
                          </label>
                          <input
                            type="number"
                            value={settings.maxConcurrentSessions}
                            onChange={(e) => handleSettingsChange('session', 'maxConcurrentSessions', Number(e.target.value))}
                            min={1}
                            max={10}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Remember Me Duration (Days)
                          </label>
                          <input
                            type="number"
                            value={settings.rememberMeDurationDays}
                            onChange={(e) => handleSettingsChange('session', 'rememberMeDurationDays', Number(e.target.value))}
                            min={1}
                            max={365}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.rememberMeEnabled}
                            onChange={(e) => handleSettingsChange('session', 'rememberMeEnabled', e.target.checked)}
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Enable "Remember Me" option</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.forceLogoutOnPasswordChange}
                            onChange={(e) => handleSettingsChange('session', 'forceLogoutOnPasswordChange', e.target.checked)}
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Force logout on password change</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.trackLoginHistory}
                            onChange={(e) => handleSettingsChange('session', 'trackLoginHistory', e.target.checked)}
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Track login history</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {section.id === 'login' && (
                    <div className="space-y-4">
                      {/* Allowed IP Addresses */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Allowed IP Addresses
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2 mb-2">
                          <input
                            type="text"
                            value={newIPAddress}
                            onChange={(e) => setNewIPAddress(e.target.value)}
                            placeholder="192.168.1.1"
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          />
                          <button
                            onClick={() => handleAddIPAddress('allowed')}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                          >
                            Add
                          </button>
                        </div>
                        {settings.allowedIPAddresses.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {settings.allowedIPAddresses.map(ip => (
                              <span key={ip} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-xs">
                                {ip}
                                <button onClick={() => handleRemoveIPAddress('allowed', ip)} className="text-blue-500 hover:text-blue-700">
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Blocked IP Addresses */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Blocked IP Addresses
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2 mb-2">
                          <input
                            type="text"
                            value={newIPAddress}
                            onChange={(e) => setNewIPAddress(e.target.value)}
                            placeholder="10.0.0.1"
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          />
                          <button
                            onClick={() => handleAddIPAddress('blocked')}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                          >
                            Block
                          </button>
                        </div>
                        {settings.blockedIPAddresses.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {settings.blockedIPAddresses.map(ip => (
                              <span key={ip} className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-xs">
                                {ip}
                                <button onClick={() => handleRemoveIPAddress('blocked', ip)} className="text-red-500 hover:text-red-700">
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Allowed Domains */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Allowed Domains
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2 mb-2">
                          <input
                            type="text"
                            value={newDomain}
                            onChange={(e) => setNewDomain(e.target.value)}
                            placeholder="company.com"
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          />
                          <button
                            onClick={() => handleAddDomain('allowed')}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                          >
                            Add
                          </button>
                        </div>
                        {settings.allowedDomains.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {settings.allowedDomains.map(domain => (
                              <span key={domain} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-xs">
                                {domain}
                                <button onClick={() => handleRemoveDomain('allowed', domain)} className="text-blue-500 hover:text-blue-700">
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Blocked Domains */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Blocked Domains
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2 mb-2">
                          <input
                            type="text"
                            value={newDomain}
                            onChange={(e) => setNewDomain(e.target.value)}
                            placeholder="spam.com"
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          />
                          <button
                            onClick={() => handleAddDomain('blocked')}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                          >
                            Block
                          </button>
                        </div>
                        {settings.blockedDomains.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {settings.blockedDomains.map(domain => (
                              <span key={domain} className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-xs">
                                {domain}
                                <button onClick={() => handleRemoveDomain('blocked', domain)} className="text-red-500 hover:text-red-700">
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Two-Factor Authentication */}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.requireTwoFactor}
                          onChange={(e) => handleSettingsChange('login', 'requireTwoFactor', e.target.checked)}
                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Require two-factor authentication</span>
                      </label>

                      {/* Login Time Restrictions */}
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.restrictLoginTimes}
                            onChange={(e) => handleSettingsChange('login', 'restrictLoginTimes', e.target.checked)}
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Restrict login times</span>
                        </label>
                        {settings.restrictLoginTimes && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-6">
                            <div>
                              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Start Time</label>
                              <input
                                type="time"
                                value={settings.allowedLoginStartTime}
                                onChange={(e) => handleSettingsChange('login', 'allowedLoginStartTime', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">End Time</label>
                              <input
                                type="time"
                                value={settings.allowedLoginEndTime}
                                onChange={(e) => handleSettingsChange('login', 'allowedLoginEndTime', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {section.id === 'notifications' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.emailNotificationsEnabled}
                            onChange={(e) => handleSettingsChange('notifications', 'emailNotificationsEnabled', e.target.checked)}
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Enable email notifications</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.pushNotificationsEnabled}
                            onChange={(e) => handleSettingsChange('notifications', 'pushNotificationsEnabled', e.target.checked)}
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Enable push notifications</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.smsNotificationsEnabled}
                            onChange={(e) => handleSettingsChange('notifications', 'smsNotificationsEnabled', e.target.checked)}
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Enable SMS notifications</span>
                        </label>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Notification Email
                        </label>
                        <input
                          type="email"
                          value={settings.notificationEmail}
                          onChange={(e) => handleSettingsChange('notifications', 'notificationEmail', e.target.value)}
                          placeholder="notifications@company.com"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  )}

                  {section.id === 'security' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.enableCaptcha}
                            onChange={(e) => handleSettingsChange('security', 'enableCaptcha', e.target.checked)}
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Enable CAPTCHA</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.enableRateLimiting}
                            onChange={(e) => handleSettingsChange('security', 'enableRateLimiting', e.target.checked)}
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Enable rate limiting</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.enableAuditLogging}
                            onChange={(e) => handleSettingsChange('security', 'enableAuditLogging', e.target.checked)}
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Enable audit logging</span>
                        </label>
                      </div>
                      
                      {settings.enableRateLimiting && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Rate Limit Requests
                            </label>
                            <input
                              type="number"
                              value={settings.rateLimitRequests}
                              onChange={(e) => handleSettingsChange('security', 'rateLimitRequests', Number(e.target.value))}
                              min={10}
                              max={10000}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Window (Minutes)
                            </label>
                            <input
                              type="number"
                              value={settings.rateLimitWindowMinutes}
                              onChange={(e) => handleSettingsChange('security', 'rateLimitWindowMinutes', Number(e.target.value))}
                              min={1}
                              max={1440}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                      )}
                      
                      {settings.enableAuditLogging && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Audit Log Retention (Days)
                          </label>
                          <input
                            type="number"
                            value={settings.auditLogRetentionDays}
                            onChange={(e) => handleSettingsChange('security', 'auditLogRetentionDays', Number(e.target.value))}
                            min={1}
                            max={3650}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Reset Confirmation Modal */}
      {showConfirmReset && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowConfirmReset(false)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <button
                onClick={() => setShowConfirmReset(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="text-center">
                <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8 text-yellow-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Reset Settings</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Choose how you want to reset the settings:
                </p>
                <div className="space-y-3">
                  <button
                    onClick={handleResetSettings}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
                  >
                    Reset to Saved Values
                  </button>
                  <button
                    onClick={handleResetToDefaults}
                    className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm"
                  >
                    Reset to Defaults
                  </button>
                  <button
                    onClick={() => setShowConfirmReset(false)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
                  >
                    Cancel
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
