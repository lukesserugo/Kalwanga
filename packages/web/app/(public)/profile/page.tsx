// D:\Projects\Kalwanga\packages\web\app\profile\page.tsx

'use client';

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User as UserIcon,
  Mail,
  Phone,
  Building2,
  Shield,
  Calendar,
  Clock,
  Edit3,
  X,
  Camera,
  Key,
  Bell,
  Lock,
  LogOut,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Activity,
  ShoppingBag,
  Package,
  Settings,
  Users,
  Award,
  Briefcase,
  Fingerprint,
  Eye,
  EyeOff,
  RefreshCw,
  Home,
  LayoutDashboard,
  ArrowRight,
  Sparkles,
  Crown,
  Wallet,
  Heart,
  Clock3,
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { useThemeStore } from '../../stores/themeStore';
import { authService, type User } from '../../../services/authService';
import { userService } from '../../../services/userService';
import { toast } from '../../../utils/toast-manager';

// ============================================
// TYPES
// ============================================

interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface ActivityEntry {
  id: string;
  action: string;
  entityType: string;
  entityName?: string;
  createdAt: string;
  severity?: string;
}

interface UserStats {
  totalOrders: number;
  totalSpent: number;
  loyaltyPoints: number;
  memberSince: string;
  reviewsCount: number;
  wishlistCount: number;
}

type TabId = 'overview' | 'orders' | 'activity' | 'security' | 'preferences';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: Tab[] = [
  { id: 'overview', label: 'Overview', icon: UserIcon },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'preferences', label: 'Preferences', icon: Settings },
];

// ============================================
// HELPERS
// ============================================

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 30) return `${days}d ago`;
    return formatDate(dateStr);
  } catch {
    return '—';
  }
}

function getInitials(firstName?: string, lastName?: string): string {
  const f = (firstName || '').trim().charAt(0).toUpperCase();
  const l = (lastName || '').trim().charAt(0).toUpperCase();
  return `${f}${l}` || 'U';
}

function getRoleBadge(role?: string): {
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
} {
  switch (role) {
    case 'SUPER_ADMIN':
      return {
        label: 'Super Admin',
        color: 'from-red-500 to-rose-600',
        icon: Crown,
      };
    case 'ADMIN':
      return {
        label: 'Admin',
        color: 'from-orange-500 to-red-500',
        icon: Shield,
      };
    case 'MANAGER':
      return {
        label: 'Manager',
        color: 'from-blue-500 to-sky-600',
        icon: Briefcase,
      };
    case 'EDITOR':
      return {
        label: 'Editor',
        color: 'from-emerald-500 to-green-600',
        icon: Edit3,
      };
    case 'VIEWER':
      return {
        label: 'Viewer',
        color: 'from-purple-500 to-violet-600',
        icon: Eye,
      };
    case 'EMPLOYEE':
      return {
        label: 'Employee',
        color: 'from-teal-500 to-cyan-600',
        icon: Users,
      };
    case 'CASHIER':
      return {
        label: 'Cashier',
        color: 'from-amber-500 to-orange-600',
        icon: Wallet,
      };
    default:
      return {
        label: 'User',
        color: 'from-gray-500 to-slate-600',
        icon: UserIcon,
      };
  }
}

// ============================================
// SUB-COMPONENTS
// ============================================

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  accent: string;
  isDark: boolean;
}

function StatCard({ icon: Icon, label, value, accent, isDark }: StatCardProps) {
  return (
    <div
      className={`rounded-2xl p-4 border transition-all duration-200 hover:shadow-md ${
        isDark
          ? 'bg-gray-900 border-gray-800'
          : 'bg-white border-orange-100'
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${accent} text-white shadow-sm shrink-0`}
        >
          <Icon className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <p
            className={`text-xl font-bold tabular-nums truncate ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            {value}
          </p>
          <p
            className={`text-xs truncate ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}

interface InfoRowProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  isDark: boolean;
}

function InfoRow({ icon: Icon, label, value, isDark }: InfoRowProps) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span
        className={`inline-flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${
          isDark
            ? 'bg-gray-800 text-gray-400'
            : 'bg-orange-50 text-orange-500'
        }`}
      >
        <Icon className="w-4 h-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={`text-xs font-medium ${
            isDark ? 'text-gray-500' : 'text-gray-500'
          }`}
        >
          {label}
        </p>
        <div
          className={`text-sm font-medium mt-0.5 break-words ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}
        >
          {value || '—'}
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function ProfilePage() {
  const router = useRouter();
  const { isDark } = useThemeStore();
  const { user: authUser, isAuthenticated, isLoading: authLoading, logout } =
    useAuth() as {
      user: User | null;
      isAuthenticated: boolean;
      isLoading: boolean;
      logout?: () => Promise<void> | void;
    };

  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const [passwordForm, setPasswordForm] = useState<PasswordFormData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ============================================
  // LOAD PROFILE
  // ============================================

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);

      // Prefer the auth-provided user, but refresh from the backend to
      // get the latest fields (avatar, phone, lastLoginAt).
      let data: User | null = null;

      try {
        data = await authService.getCurrentUser();
      } catch {
        // Fall back to the auth context user if the API call fails.
        data = authUser;
      }

      if (!isMountedRef.current) return;

      if (data) {
        setProfile(data);
      } else if (authUser) {
        setProfile(authUser);
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
      if (isMountedRef.current) {
        toast.error('Failed to load profile');
      }
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [authUser]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect_url=/profile');
      return;
    }
    if (isAuthenticated) {
      loadProfile();
    }
  }, [authLoading, isAuthenticated, router, loadProfile]);

  // ============================================
  // LOAD ACTIVITY
  // ============================================

  const loadActivity = useCallback(async () => {
    if (!profile?.id) return;
    try {
      setActivityLoading(true);
      const result = await userService.getUserActivity(profile.id, {
        page: 1,
        limit: 20,
      });
      if (!isMountedRef.current) return;
      setActivity((result.data as ActivityEntry[]) || []);
    } catch (error) {
      console.error('Failed to load activity:', error);
      if (isMountedRef.current) setActivity([]);
    } finally {
      if (isMountedRef.current) setActivityLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (activeTab === 'activity' && profile?.id) {
      loadActivity();
    }
  }, [activeTab, profile?.id, loadActivity]);

  // ============================================
  // COMPUTED
  // ============================================

  const roleBadge = useMemo(() => getRoleBadge(profile?.role), [profile?.role]);
  const RoleIcon = roleBadge.icon;

  const stats: UserStats = useMemo(
    () => ({
      totalOrders: 0,
      totalSpent: 0,
      loyaltyPoints: 0,
      memberSince: profile?.createdAt || '',
      reviewsCount: 0,
      wishlistCount: 0,
    }),
    [profile?.createdAt],
  );

  const permissionsCount = profile?.permissions?.length || 0;
  const businessUnitsCount = profile?.businessUnits?.length || 0;

  // ============================================
  // VALIDATION
  // ============================================

  const validatePassword = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!passwordForm.currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }
    if (!passwordForm.newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (passwordForm.newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters';
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ============================================
  // HANDLERS
  // ============================================

  const handleEditProfile = useCallback(() => {
    router.push('/profile/edit');
  }, [router]);

  const handleChangePassword = useCallback(async () => {
    if (!profile?.id) return;
    if (!validatePassword()) return;

    try {
      setSaving(true);

      // The backend's `/auth/users/:userId` PUT accepts a `password` field.
      await authService.updateUser(profile.id, {
        password: passwordForm.newPassword,
      } as any);

      if (!isMountedRef.current) return;

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setErrors({});
      setIsChangingPassword(false);
      toast.success('Password changed successfully');
    } catch (error: any) {
      console.error('Failed to change password:', error);
      toast.error(
        error?.response?.data?.message || 'Failed to change password',
      );
    } finally {
      if (isMountedRef.current) setSaving(false);
    }
  }, [profile?.id, passwordForm]);

  const handleSignOut = useCallback(async () => {
    try {
      if (logout) {
        await logout();
      } else {
        await authService.logout();
      }
      router.push('/');
    } catch (error) {
      console.error('Sign-out failed:', error);
      toast.error('Failed to sign out');
    }
  }, [logout, router]);

  // ============================================
  // RENDER — loading
  // ============================================

  if (authLoading || loading) {
    return (
      <div
        className={`min-h-screen ${
          isDark ? 'dark bg-gray-950' : 'bg-orange-50'
        } transition-colors duration-300`}
      >
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-24 md:pt-28 pb-16">
          <div className="animate-pulse space-y-6">
            <div className="h-48 rounded-2xl bg-white dark:bg-gray-900" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-24 rounded-2xl bg-white dark:bg-gray-900"
                />
              ))}
            </div>
            <div className="h-64 rounded-2xl bg-white dark:bg-gray-900" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div
        className={`min-h-screen ${
          isDark ? 'dark bg-gray-950' : 'bg-orange-50'
        } transition-colors duration-300`}
      >
        <div className="max-w-3xl mx-auto px-4 pt-32 pb-16 text-center">
          <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
          <h1
            className={`text-2xl font-bold mb-2 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            Profile Not Found
          </h1>
          <p
            className={`mb-6 ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            We could not load your profile information.
          </p>
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all"
          >
            <Home className="w-4 h-4" />
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER — main
  // ============================================

  return (
    <div
      className={`min-h-screen ${
        isDark
          ? 'dark bg-gray-950'
          : 'bg-gradient-to-b from-orange-50 via-white to-amber-50'
      } transition-colors duration-300`}
    >
      {/* ============================================
          HERO BANNER
          ============================================ */}
      <div className="relative overflow-hidden bg-gradient-to-br from-orange-600 via-red-500 to-rose-600 pt-24 md:pt-28">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-yellow-300 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-orange-200 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white/20 backdrop-blur-md border-4 border-white/30 flex items-center justify-center overflow-hidden shadow-xl">
                {profile.avatar ? (
                  <img
                    src={profile.avatar}
                    alt={`${profile.firstName} ${profile.lastName}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl sm:text-4xl font-bold text-white">
                    {getInitials(profile.firstName, profile.lastName)}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleEditProfile}
                className="absolute -bottom-1 -right-1 p-2 rounded-full bg-white text-orange-600 shadow-lg hover:scale-105 transition-transform"
                aria-label="Change avatar"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>

            {/* Name + badges */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-white truncate">
                {profile.firstName} {profile.lastName}
              </h1>
              <p className="text-orange-100 text-sm mt-1 truncate">
                {profile.email}
              </p>

              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-white bg-gradient-to-r ${roleBadge.color} shadow-sm`}
                >
                  <RoleIcon className="w-3.5 h-3.5" />
                  {roleBadge.label}
                </span>
                {profile.isActive !== false && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-emerald-900 bg-emerald-300/90 shadow-sm">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Active
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-white/90 bg-white/20 backdrop-blur-sm border border-white/30">
                  <Calendar className="w-3.5 h-3.5" />
                  Member since {formatDate(profile.createdAt)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleEditProfile}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/20 backdrop-blur-md border border-white/30 text-white rounded-xl text-sm font-medium hover:bg-white/30 transition-all"
              >
                <Edit3 className="w-4 h-4" />
                Edit Profile
              </button>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-500/90 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-all shadow-md"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================
          STAT CARDS (overlap the hero)
          ============================================ */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 -mt-16 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Shield}
            label="Permissions"
            value={permissionsCount}
            accent="from-orange-500 to-red-500"
            isDark={isDark}
          />
          <StatCard
            icon={Building2}
            label="Business Units"
            value={businessUnitsCount}
            accent="from-blue-500 to-sky-600"
            isDark={isDark}
          />
          <StatCard
            icon={Award}
            label="Loyalty Points"
            value={stats.loyaltyPoints}
            accent="from-amber-500 to-yellow-600"
            isDark={isDark}
          />
          <StatCard
            icon={Clock3}
            label="Last Login"
            value={formatRelativeTime(profile.lastLoginAt)}
            accent="from-emerald-500 to-green-600"
            isDark={isDark}
          />
        </div>
      </div>

      {/* ============================================
          TABS
          ============================================ */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div
          className={`flex items-center gap-1 overflow-x-auto pb-1 rounded-2xl p-1 border ${
            isDark
              ? 'bg-gray-900 border-gray-800'
              : 'bg-white border-orange-100'
          }`}
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md'
                    : isDark
                      ? 'text-gray-400 hover:text-white hover:bg-gray-800'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-orange-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ============================================
          TAB CONTENT
          ============================================ */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {/* ---------- OVERVIEW ---------- */}
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Personal Info */}
              <div
                className={`lg:col-span-2 rounded-2xl border p-6 ${
                  isDark
                    ? 'bg-gray-900 border-gray-800'
                    : 'bg-white border-orange-100'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2
                    className={`text-lg font-bold ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    Personal Information
                  </h2>
                  <button
                    onClick={handleEditProfile}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                </div>

                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  <InfoRow
                    icon={UserIcon}
                    label="Full Name"
                    value={`${profile.firstName} ${profile.lastName}`}
                    isDark={isDark}
                  />
                  <InfoRow
                    icon={Mail}
                    label="Email Address"
                    value={profile.email}
                    isDark={isDark}
                  />
                  <InfoRow
                    icon={Phone}
                    label="Phone Number"
                    value={profile.phoneNumber || 'Not provided'}
                    isDark={isDark}
                  />
                  <InfoRow
                    icon={Fingerprint}
                    label="User ID"
                    value={
                      <span className="font-mono text-xs break-all">
                        {profile.id}
                      </span>
                    }
                    isDark={isDark}
                  />
                  <InfoRow
                    icon={Calendar}
                    label="Member Since"
                    value={formatDate(profile.createdAt)}
                    isDark={isDark}
                  />
                  <InfoRow
                    icon={Clock}
                    label="Last Login"
                    value={
                      profile.lastLoginAt
                        ? formatDate(profile.lastLoginAt)
                        : 'No login recorded'
                    }
                    isDark={isDark}
                  />
                </div>

                {/* Edit CTA */}
                <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
                  <button
                    onClick={handleEditProfile}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl text-sm font-medium shadow-md transition-all"
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit Personal Information
                  </button>
                </div>
              </div>

              {/* Permissions & Business Units */}
              <div className="space-y-6">
                <div
                  className={`rounded-2xl border p-6 ${
                    isDark
                      ? 'bg-gray-900 border-gray-800'
                      : 'bg-white border-orange-100'
                  }`}
                >
                  <h3
                    className={`text-sm font-bold mb-3 flex items-center gap-2 ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    <Shield className="w-4 h-4 text-orange-500" />
                    Permissions
                    <span className="ml-auto text-xs font-normal text-gray-400">
                      {permissionsCount}
                    </span>
                  </h3>
                  {permissionsCount === 0 ? (
                    <p className="text-xs text-gray-400">
                      No permissions assigned
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                      {profile.permissions?.slice(0, 12).map((perm) => (
                        <span
                          key={perm}
                          className={`inline-block px-2 py-1 rounded-md text-[10px] font-medium ${
                            isDark
                              ? 'bg-gray-800 text-gray-300'
                              : 'bg-orange-50 text-orange-700'
                          }`}
                        >
                          {perm}
                        </span>
                      ))}
                      {permissionsCount > 12 && (
                        <span className="inline-block px-2 py-1 rounded-md text-[10px] font-medium text-gray-400">
                          +{permissionsCount - 12} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div
                  className={`rounded-2xl border p-6 ${
                    isDark
                      ? 'bg-gray-900 border-gray-800'
                      : 'bg-white border-orange-100'
                  }`}
                >
                  <h3
                    className={`text-sm font-bold mb-3 flex items-center gap-2 ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    <Building2 className="w-4 h-4 text-blue-500" />
                    Business Units
                    <span className="ml-auto text-xs font-normal text-gray-400">
                      {businessUnitsCount}
                    </span>
                  </h3>
                  {businessUnitsCount === 0 ? (
                    <p className="text-xs text-gray-400">
                      No business units assigned
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {profile.businessUnits?.map((bu, idx) => (
                        <li
                          key={`${bu.businessUnitId}-${idx}`}
                          className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs ${
                            isDark ? 'bg-gray-800' : 'bg-blue-50'
                          }`}
                        >
                          <span className="truncate font-mono text-[10px]">
                            {bu.businessUnitId}
                          </span>
                          <span className="shrink-0 px-2 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-semibold">
                            {bu.role}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ---------- ORDERS ---------- */}
          {activeTab === 'orders' && (
            <motion.div
              key="orders"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className={`rounded-2xl border p-8 text-center ${
                isDark
                  ? 'bg-gray-900 border-gray-800'
                  : 'bg-white border-orange-100'
              }`}
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/20 dark:to-amber-900/20 mb-4">
                <ShoppingBag className="w-8 h-8 text-orange-500" />
              </div>
              <h2
                className={`text-xl font-bold mb-2 ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                Your Orders
              </h2>
              <p
                className={`max-w-md mx-auto mb-6 text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                Browse your order history, track shipments, and manage returns
                from your personal dashboard.
              </p>
              <Link
                href="/orders"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-medium shadow-lg transition-all"
              >
                <Package className="w-4 h-4" />
                View All Orders
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          )}

          {/* ---------- ACTIVITY ---------- */}
          {activeTab === 'activity' && (
            <motion.div
              key="activity"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className={`rounded-2xl border overflow-hidden ${
                isDark
                  ? 'bg-gray-900 border-gray-800'
                  : 'bg-white border-orange-100'
              }`}
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
                <div>
                  <h2
                    className={`text-lg font-bold ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    Recent Activity
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Your last {activity.length} actions on the platform
                  </p>
                </div>
                <button
                  onClick={loadActivity}
                  disabled={activityLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      activityLoading ? 'animate-spin' : ''
                    }`}
                  />
                  Refresh
                </button>
              </div>

              {activityLoading ? (
                <div className="p-12 text-center">
                  <Loader2 className="w-8 h-8 text-orange-500 animate-spin mx-auto" />
                  <p className="text-xs text-gray-400 mt-3">
                    Loading activity...
                  </p>
                </div>
              ) : activity.length === 0 ? (
                <div className="p-12 text-center">
                  <Activity className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">
                    No activity recorded yet
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {activity.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-start gap-3 px-6 py-4 hover:bg-orange-50/50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <span
                        className={`inline-flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${
                          isDark
                            ? 'bg-gray-800 text-gray-400'
                            : 'bg-orange-50 text-orange-500'
                        }`}
                      >
                        <Activity className="w-4 h-4" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-sm font-semibold ${
                              isDark ? 'text-white' : 'text-gray-900'
                            }`}
                          >
                            {entry.action}
                          </span>
                          {entry.entityType && (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                isDark
                                  ? 'bg-gray-800 text-gray-400'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {entry.entityType}
                            </span>
                          )}
                        </div>
                        {entry.entityName && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate">
                            {entry.entityName}
                          </p>
                        )}
                      </div>
                      <span className="text-[11px] text-gray-400 shrink-0">
                        {formatRelativeTime(entry.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          )}

          {/* ---------- SECURITY ---------- */}
          {activeTab === 'security' && (
            <motion.div
              key="security"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Password */}
              <div
                className={`rounded-2xl border p-6 ${
                  isDark
                    ? 'bg-gray-900 border-gray-800'
                    : 'bg-white border-orange-100'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-white">
                      <Lock className="w-5 h-5" />
                    </span>
                    <div>
                      <h3
                        className={`text-sm font-bold ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}
                      >
                        Password
                      </h3>
                      <p className="text-xs text-gray-400">
                        Change your account password
                      </p>
                    </div>
                  </div>
                  {!isChangingPassword && (
                    <button
                      onClick={() => setIsChangingPassword(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <Key className="w-3.5 h-3.5" />
                      Change
                    </button>
                  )}
                </div>

                {isChangingPassword && (
                  <div className="space-y-4 mt-4">
                    <div>
                      <label
                        className={`block text-xs font-medium mb-1.5 ${
                          isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}
                      >
                        Current Password
                      </label>
                      <div className="relative">
                        <input
                          type={showCurrentPassword ? 'text' : 'password'}
                          value={passwordForm.currentPassword}
                          onChange={(e) =>
                            setPasswordForm({
                              ...passwordForm,
                              currentPassword: e.target.value,
                            })
                          }
                          className={`w-full px-3.5 pr-10 py-2.5 rounded-xl border text-sm outline-none transition-all ${
                            errors.currentPassword
                              ? 'border-red-400'
                              : 'border-transparent focus:border-orange-400 focus:ring-2 focus:ring-orange-500/30'
                          } ${
                            isDark
                              ? 'bg-gray-800 text-white'
                              : 'bg-orange-50 text-gray-900'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowCurrentPassword((v) => !v)
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showCurrentPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      {errors.currentPassword && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors.currentPassword}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        className={`block text-xs font-medium mb-1.5 ${
                          isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}
                      >
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={passwordForm.newPassword}
                          onChange={(e) =>
                            setPasswordForm({
                              ...passwordForm,
                              newPassword: e.target.value,
                            })
                          }
                          className={`w-full px-3.5 pr-10 py-2.5 rounded-xl border text-sm outline-none transition-all ${
                            errors.newPassword
                              ? 'border-red-400'
                              : 'border-transparent focus:border-orange-400 focus:ring-2 focus:ring-orange-500/30'
                          } ${
                            isDark
                              ? 'bg-gray-800 text-white'
                              : 'bg-orange-50 text-gray-900'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showNewPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      {errors.newPassword && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors.newPassword}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        className={`block text-xs font-medium mb-1.5 ${
                          isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}
                      >
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={passwordForm.confirmPassword}
                          onChange={(e) =>
                            setPasswordForm({
                              ...passwordForm,
                              confirmPassword: e.target.value,
                            })
                          }
                          className={`w-full px-3.5 pr-10 py-2.5 rounded-xl border text-sm outline-none transition-all ${
                            errors.confirmPassword
                              ? 'border-red-400'
                              : 'border-transparent focus:border-orange-400 focus:ring-2 focus:ring-orange-500/30'
                          } ${
                            isDark
                              ? 'bg-gray-800 text-white'
                              : 'bg-orange-50 text-gray-900'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowConfirmPassword((v) => !v)
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      {errors.confirmPassword && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors.confirmPassword}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={handleChangePassword}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl text-sm font-medium shadow-md transition-all disabled:opacity-60"
                      >
                        {saving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Key className="w-4 h-4" />
                        )}
                        {saving ? 'Updating...' : 'Update Password'}
                      </button>
                      <button
                        onClick={() => {
                          setIsChangingPassword(false);
                          setPasswordForm({
                            currentPassword: '',
                            newPassword: '',
                            confirmPassword: '',
                          });
                          setErrors({});
                        }}
                        disabled={saving}
                        className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                          isDark
                            ? 'text-gray-300 hover:bg-gray-800'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Sign out everywhere */}
              <div
                className={`rounded-2xl border p-6 ${
                  isDark
                    ? 'bg-gray-900 border-gray-800'
                    : 'bg-white border-orange-100'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 text-white">
                      <LogOut className="w-5 h-5" />
                    </span>
                    <div>
                      <h3
                        className={`text-sm font-bold ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}
                      >
                        Sign Out
                      </h3>
                      <p className="text-xs text-gray-400">
                        End your current session
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-all shadow-md"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ---------- PREFERENCES ---------- */}
          {activeTab === 'preferences' && (
            <motion.div
              key="preferences"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div
                className={`rounded-2xl border p-6 ${
                  isDark
                    ? 'bg-gray-900 border-gray-800'
                    : 'bg-white border-orange-100'
                }`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                    <Bell className="w-5 h-5" />
                  </span>
                  <div>
                    <h3
                      className={`text-sm font-bold ${
                        isDark ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      Notification Preferences
                    </h3>
                    <p className="text-xs text-gray-400">
                      Manage how we contact you
                    </p>
                  </div>
                </div>

                <div className="space-y-3 mt-4">
                  {[
                    {
                      id: 'email-notifications',
                      label: 'Email notifications',
                      description:
                        'Receive order updates and account alerts by email',
                      defaultChecked: true,
                    },
                    {
                      id: 'promotional-emails',
                      label: 'Promotional emails',
                      description:
                        'Get notified about sales, new products, and offers',
                      defaultChecked: false,
                    },
                    {
                      id: 'sms-notifications',
                      label: 'SMS notifications',
                      description: 'Receive critical updates via text message',
                      defaultChecked: false,
                    },
                  ].map((pref) => (
                    <label
                      key={pref.id}
                      className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                        isDark
                          ? 'hover:bg-gray-800'
                          : 'hover:bg-orange-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        defaultChecked={pref.defaultChecked}
                        className="mt-1 w-4 h-4 text-orange-500 border-gray-300 dark:border-gray-600 rounded focus:ring-orange-500"
                      />
                      <div>
                        <p
                          className={`text-sm font-medium ${
                            isDark ? 'text-white' : 'text-gray-900'
                          }`}
                        >
                          {pref.label}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {pref.description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Quick links */}
              <div
                className={`rounded-2xl border p-6 ${
                  isDark
                    ? 'bg-gray-900 border-gray-800'
                    : 'bg-white border-orange-100'
                }`}
              >
                <h3
                  className={`text-sm font-bold mb-4 flex items-center gap-2 ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-orange-500" />
                  Quick Links
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      href: '/orders',
                      label: 'My Orders',
                      icon: ShoppingBag,
                    },
                    {
                      href: '/wishlist',
                      label: 'Wishlist',
                      icon: Heart,
                    },
                    {
                      href: '/cart',
                      label: 'Shopping Cart',
                      icon: ShoppingBag,
                    },
                    {
                      href: '/dashboard',
                      label: 'Dashboard',
                      icon: LayoutDashboard,
                    },
                  ].map((link) => {
                    const Icon = link.icon;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`group flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                          isDark
                            ? 'border-gray-800 hover:bg-gray-800'
                            : 'border-orange-100 hover:bg-orange-50'
                        }`}
                      >
                        <span
                          className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${
                            isDark
                              ? 'bg-gray-800 text-orange-400'
                              : 'bg-orange-100 text-orange-600'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </span>
                        <span
                          className={`flex-1 text-sm font-medium ${
                            isDark ? 'text-white' : 'text-gray-900'
                          }`}
                        >
                          {link.label}
                        </span>
                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
