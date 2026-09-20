// D:\Projects\Kalwanga\packages\web\app\profile\edit\page.tsx

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
  Edit3,
  Save,
  X,
  Camera,
  Key,
  Bell,
  Lock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  Eye,
  EyeOff,
  Upload,
  Trash2,
  Image as ImageIcon,
  RefreshCw,
  Sparkles,
  Info,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../../../hooks/useAuth';
import { useThemeStore } from '../../../stores/themeStore';
import { authService, type User } from '../../../../services/authService';
import { toast } from '../../../../utils/toast-manager';

// ============================================
// TYPES
// ============================================

interface ProfileFormData {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  avatar: string;
}

interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

type SectionId = 'personal' | 'avatar' | 'password' | 'notifications' | 'danger';

interface Section {
  id: SectionId;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SECTIONS: Section[] = [
  {
    id: 'personal',
    label: 'Personal Information',
    description: 'Your name, email, and contact details',
    icon: UserIcon,
  },
  {
    id: 'avatar',
    label: 'Profile Picture',
    description: 'How you appear across the platform',
    icon: Camera,
  },
  {
    id: 'password',
    label: 'Password & Security',
    description: 'Change your password',
    icon: Lock,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Manage how we contact you',
    icon: Bell,
  },
  {
    id: 'danger',
    label: 'Danger Zone',
    description: 'Irreversible account actions',
    icon: AlertTriangle,
  },
];

// ============================================
// HELPERS
// ============================================

function getInitials(firstName?: string, lastName?: string): string {
  const f = (firstName || '').trim().charAt(0).toUpperCase();
  const l = (lastName || '').trim().charAt(0).toUpperCase();
  return `${f}${l}` || 'U';
}

function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;
  if (!password) return { score: 0, label: 'Empty', color: 'bg-gray-300' };

  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;

  if (score <= 1) return { score, label: 'Weak', color: 'bg-red-500' };
  if (score === 2) return { score, label: 'Fair', color: 'bg-orange-500' };
  if (score === 3) return { score, label: 'Good', color: 'bg-yellow-500' };
  if (score === 4) return { score, label: 'Strong', color: 'bg-emerald-500' };
  return { score, label: 'Very Strong', color: 'bg-emerald-600' };
}

// ============================================
// MAIN PAGE
// ============================================

export default function EditProfilePage() {
  const router = useRouter();
  const { isDark } = useThemeStore();
  const { user: authUser, isAuthenticated, isLoading: authLoading } =
    useAuth() as {
      user: User | null;
      isAuthenticated: boolean;
      isLoading: boolean;
    };

  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] =
    useState<SectionId>('personal');

  const [formData, setFormData] = useState<ProfileFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    avatar: '',
  });

  const [passwordForm, setPasswordForm] = useState<PasswordFormData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const [notifications, setNotifications] = useState({
    email: true,
    promotions: false,
    sms: false,
    orderUpdates: true,
  });

  const [dangerConfirm, setDangerConfirm] = useState('');

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

      let data: User | null = null;

      try {
        data = await authService.getCurrentUser();
      } catch {
        data = authUser;
      }

      if (!isMountedRef.current) return;

      const resolved = data || authUser;

      if (resolved) {
        setProfile(resolved);
        setFormData({
          firstName: resolved.firstName || '',
          lastName: resolved.lastName || '',
          email: resolved.email || '',
          phoneNumber: resolved.phoneNumber || '',
          avatar: resolved.avatar || '',
        });
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
      router.push('/login?redirect_url=/profile/edit');
      return;
    }
    if (isAuthenticated) {
      loadProfile();
    }
  }, [authLoading, isAuthenticated, router, loadProfile]);

  // ============================================
  // TRACK CHANGES
  // ============================================

  useEffect(() => {
    if (!profile) return;

    const changed =
      formData.firstName !== (profile.firstName || '') ||
      formData.lastName !== (profile.lastName || '') ||
      formData.email !== (profile.email || '') ||
      formData.phoneNumber !== (profile.phoneNumber || '') ||
      formData.avatar !== (profile.avatar || '');

    setHasChanges(changed);
  }, [formData, profile]);

  // ============================================
  // COMPUTED
  // ============================================

  const passwordStrength = useMemo(
    () => getPasswordStrength(passwordForm.newPassword),
    [passwordForm.newPassword],
  );

  // ============================================
  // VALIDATION
  // ============================================

  const validateProfile = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    } else if (formData.firstName.trim().length > 50) {
      newErrors.firstName = 'First name must be 50 characters or fewer';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    } else if (formData.lastName.trim().length > 50) {
      newErrors.lastName = 'Last name must be 50 characters or fewer';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (
      formData.phoneNumber &&
      !/^[+]?[\d\s()-]{7,20}$/.test(formData.phoneNumber)
    ) {
      newErrors.phoneNumber = 'Invalid phone number format';
    }

    if (formData.avatar) {
      try {
        new URL(formData.avatar);
      } catch {
        newErrors.avatar = 'Avatar must be a valid URL';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePassword = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!passwordForm.currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }

    if (!passwordForm.newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (passwordForm.newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters';
    } else if (passwordForm.newPassword === passwordForm.currentPassword) {
      newErrors.newPassword = 'New password must differ from current';
    }

    if (!passwordForm.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your new password';
    } else if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ============================================
  // HANDLERS
  // ============================================

  const handleSaveProfile = useCallback(async () => {
    if (!profile?.id) return;
    if (!validateProfile()) {
      toast.error('Please fix the errors before saving');
      return;
    }

    try {
      setSaving(true);

      const updated = await authService.updateUser(profile.id, {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        phoneNumber: formData.phoneNumber.trim() || undefined,
        avatar: formData.avatar || undefined,
      });

      if (!isMountedRef.current) return;

      setProfile((prev) => (prev ? { ...prev, ...updated } : updated));
      setFormData({
        firstName: updated.firstName || '',
        lastName: updated.lastName || '',
        email: updated.email || '',
        phoneNumber: updated.phoneNumber || '',
        avatar: updated.avatar || '',
      });
      setHasChanges(false);
      setErrors({});
      toast.success('Profile updated successfully');
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      toast.error(
        error?.response?.data?.message || 'Failed to update profile',
      );
    } finally {
      if (isMountedRef.current) setSaving(false);
    }
  }, [profile?.id, formData]);

  const handleSaveAvatar = useCallback(async () => {
    if (!profile?.id) return;

    if (formData.avatar) {
      try {
        new URL(formData.avatar);
      } catch {
        setErrors({ avatar: 'Avatar must be a valid URL' });
        toast.error('Please enter a valid image URL');
        return;
      }
    }

    try {
      setSaving(true);

      const updated = await authService.updateUser(profile.id, {
        avatar: formData.avatar || undefined,
      });

      if (!isMountedRef.current) return;

      setProfile((prev) => (prev ? { ...prev, ...updated } : updated));
      toast.success(
        formData.avatar ? 'Avatar updated successfully' : 'Avatar removed',
      );
    } catch (error: any) {
      console.error('Failed to update avatar:', error);
      toast.error(
        error?.response?.data?.message || 'Failed to update avatar',
      );
    } finally {
      if (isMountedRef.current) setSaving(false);
    }
  }, [profile?.id, formData.avatar]);

  const handleChangePassword = useCallback(async () => {
    if (!profile?.id) return;
    if (!validatePassword()) {
      toast.error('Please fix the errors before saving');
      return;
    }

    try {
      setSaving(true);

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

  const handleSaveNotifications = useCallback(async () => {
    try {
      setSaving(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          'notification_preferences',
          JSON.stringify(notifications),
        );
      }
      toast.success('Notification preferences saved');
    } finally {
      if (isMountedRef.current) setSaving(false);
    }
  }, [notifications]);

  const handleCancel = useCallback(() => {
    router.push('/profile');
  }, [router]);

  const handleResetForm = useCallback(() => {
    if (!profile) return;
    setFormData({
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      email: profile.email || '',
      phoneNumber: profile.phoneNumber || '',
      avatar: profile.avatar || '',
    });
    setErrors({});
    setHasChanges(false);
    toast.success('Form reset');
  }, [profile]);

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
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 pt-24 md:pt-28 pb-16">
          <div className="animate-pulse space-y-6">
            <div className="h-10 w-48 rounded-lg bg-white dark:bg-gray-900" />
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="h-96 rounded-2xl bg-white dark:bg-gray-900" />
              <div className="lg:col-span-3 h-96 rounded-2xl bg-white dark:bg-gray-900" />
            </div>
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
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Profile
          </Link>
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
          COMPACT HEADER
          ============================================ */}
      <div className="relative overflow-hidden bg-gradient-to-br from-orange-600 via-red-500 to-rose-600 pt-24 md:pt-28">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-yellow-300 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-orange-200 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 pb-8">
          <Link
            href="/profile"
            className="inline-flex items-center gap-1.5 text-sm text-orange-100 hover:text-white transition-colors mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Profile
          </Link>

          <div className="flex items-center gap-4">
            <span className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 shrink-0">
              <Edit3 className="w-6 h-6 text-yellow-200" />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-white truncate">
                Edit Profile
              </h1>
              <p className="text-orange-100 text-sm mt-0.5">
                Manage your personal information and account settings
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================
          LAYOUT: SIDEBAR + CONTENT
          ============================================ */}
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* ---------- SIDEBAR ---------- */}
          <aside className="lg:col-span-1">
            <div
              className={`lg:sticky lg:top-24 rounded-2xl border p-2 ${
                isDark
                  ? 'bg-gray-900 border-gray-800'
                  : 'bg-white border-orange-100'
              }`}
            >
              {/* Mini profile card */}
              <div className="p-4 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {formData.avatar ? (
                    <img
                      src={formData.avatar}
                      alt={`${formData.firstName} ${formData.lastName}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    getInitials(formData.firstName, formData.lastName)
                  )}
                </div>
                <div className="min-w-0">
                  <p
                    className={`text-sm font-semibold truncate ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {formData.firstName} {formData.lastName}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {formData.email}
                  </p>
                </div>
              </div>

              {/* Section nav */}
              <nav className="p-2 space-y-0.5">
                {SECTIONS.map((section) => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.id;
                  const isDanger = section.id === 'danger';
                  return (
                    <button
                      key={section.id}
                      onClick={() => {
                        setActiveSection(section.id);
                        setErrors({});
                      }}
                      className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 ${
                        isActive
                          ? isDanger
                            ? 'bg-red-500 text-white shadow-md'
                            : 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md'
                          : isDanger
                            ? isDark
                              ? 'text-red-300 hover:bg-red-950/30'
                              : 'text-red-600 hover:bg-red-50'
                            : isDark
                              ? 'text-gray-400 hover:text-white hover:bg-gray-800'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-orange-50'
                      }`}
                    >
                      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate">
                          {section.label}
                        </p>
                        <p
                          className={`text-[10px] truncate mt-0.5 ${
                            isActive
                              ? 'text-white/80'
                              : 'text-gray-400'
                          }`}
                        >
                          {section.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* ---------- CONTENT ---------- */}
          <main className="lg:col-span-3">
            <AnimatePresence mode="wait">
              {/* ============================================
                  PERSONAL INFORMATION
                  ============================================ */}
              {activeSection === 'personal' && (
                <motion.div
                  key="personal"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className={`rounded-2xl border p-6 ${
                    isDark
                      ? 'bg-gray-900 border-gray-800'
                      : 'bg-white border-orange-100'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-6">
                    <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-white shrink-0">
                      <UserIcon className="w-5 h-5" />
                    </span>
                    <div>
                      <h2
                        className={`text-base font-bold ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}
                      >
                        Personal Information
                      </h2>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Update your name, email, and contact details
                      </p>
                    </div>
                  </div>

                  <div className="space-y-5">
                    {/* Names */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          className={`block text-xs font-medium mb-1.5 ${
                            isDark ? 'text-gray-400' : 'text-gray-600'
                          }`}
                        >
                          First Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.firstName}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              firstName: e.target.value,
                            });
                            if (errors.firstName) {
                              setErrors({ ...errors, firstName: '' });
                            }
                          }}
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${
                            errors.firstName
                              ? 'border-red-400 focus:ring-red-400/40'
                              : 'border-transparent focus:border-orange-400 focus:ring-2 focus:ring-orange-500/30'
                          } ${
                            isDark
                              ? 'bg-gray-800 text-white placeholder-gray-500'
                              : 'bg-orange-50 text-gray-900 placeholder-gray-400'
                          }`}
                        />
                        {errors.firstName && (
                          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {errors.firstName}
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          className={`block text-xs font-medium mb-1.5 ${
                            isDark ? 'text-gray-400' : 'text-gray-600'
                          }`}
                        >
                          Last Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.lastName}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              lastName: e.target.value,
                            });
                            if (errors.lastName) {
                              setErrors({ ...errors, lastName: '' });
                            }
                          }}
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${
                            errors.lastName
                              ? 'border-red-400 focus:ring-red-400/40'
                              : 'border-transparent focus:border-orange-400 focus:ring-2 focus:ring-orange-500/30'
                          } ${
                            isDark
                              ? 'bg-gray-800 text-white placeholder-gray-500'
                              : 'bg-orange-50 text-gray-900 placeholder-gray-400'
                          }`}
                        />
                        {errors.lastName && (
                          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {errors.lastName}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label
                        className={`block text-xs font-medium mb-1.5 ${
                          isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}
                      >
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              email: e.target.value,
                            });
                            if (errors.email) {
                              setErrors({ ...errors, email: '' });
                            }
                          }}
                          className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${
                            errors.email
                              ? 'border-red-400 focus:ring-red-400/40'
                              : 'border-transparent focus:border-orange-400 focus:ring-2 focus:ring-orange-500/30'
                          } ${
                            isDark
                              ? 'bg-gray-800 text-white placeholder-gray-500'
                              : 'bg-orange-50 text-gray-900 placeholder-gray-400'
                          }`}
                        />
                      </div>
                      {errors.email && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors.email}
                        </p>
                      )}
                    </div>

                    {/* Phone */}
                    <div>
                      <label
                        className={`block text-xs font-medium mb-1.5 ${
                          isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}
                      >
                        Phone Number
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <input
                          type="tel"
                          value={formData.phoneNumber}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              phoneNumber: e.target.value,
                            });
                            if (errors.phoneNumber) {
                              setErrors({ ...errors, phoneNumber: '' });
                            }
                          }}
                          placeholder="+1 555 123 4567"
                          className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${
                            errors.phoneNumber
                              ? 'border-red-400 focus:ring-red-400/40'
                              : 'border-transparent focus:border-orange-400 focus:ring-2 focus:ring-orange-500/30'
                          } ${
                            isDark
                              ? 'bg-gray-800 text-white placeholder-gray-500'
                              : 'bg-orange-50 text-gray-900 placeholder-gray-400'
                          }`}
                        />
                      </div>
                      {errors.phoneNumber && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors.phoneNumber}
                        </p>
                      )}
                      <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        Include your country code, e.g. +1 for USA
                      </p>
                    </div>

                    {/* Read-only fields */}
                    <div
                      className={`rounded-xl p-4 space-y-3 ${
                        isDark ? 'bg-gray-800/50' : 'bg-gray-50'
                      }`}
                    >
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Account Details
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <p className="text-[11px] text-gray-400">
                            User ID
                          </p>
                          <p
                            className={`font-mono text-xs break-all mt-0.5 ${
                              isDark ? 'text-gray-300' : 'text-gray-700'
                            }`}
                          >
                            {profile.id}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-gray-400">
                            Role
                          </p>
                          <p
                            className={`text-xs font-medium mt-0.5 ${
                              isDark ? 'text-gray-300' : 'text-gray-700'
                            }`}
                          >
                            {profile.role}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
                    <button
                      onClick={handleSaveProfile}
                      disabled={saving || !hasChanges}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl text-sm font-medium shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>

                    {hasChanges && (
                      <button
                        onClick={handleResetForm}
                        disabled={saving}
                        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                          isDark
                            ? 'text-gray-300 hover:bg-gray-800'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <RefreshCw className="w-4 h-4" />
                        Reset
                      </button>
                    )}

                    <button
                      onClick={handleCancel}
                      disabled={saving}
                      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ml-auto ${
                        isDark
                          ? 'text-gray-300 hover:bg-gray-800'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ============================================
                  AVATAR
                  ============================================ */}
              {activeSection === 'avatar' && (
                <motion.div
                  key="avatar"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className={`rounded-2xl border p-6 ${
                    isDark
                      ? 'bg-gray-900 border-gray-800'
                      : 'bg-white border-orange-100'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-6">
                    <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-white shrink-0">
                      <Camera className="w-5 h-5" />
                    </span>
                    <div>
                      <h2
                        className={`text-base font-bold ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}
                      >
                        Profile Picture
                      </h2>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Choose an image that represents you
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                    {/* Preview */}
                    <div className="shrink-0">
                      <div className="w-32 h-32 rounded-2xl overflow-hidden bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-bold text-3xl shadow-lg">
                        {formData.avatar ? (
                          <img
                            src={formData.avatar}
                            alt="Avatar preview"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                'none';
                            }}
                          />
                        ) : (
                          getInitials(
                            formData.firstName,
                            formData.lastName,
                          )
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 text-center mt-2">
                        Preview
                      </p>
                    </div>

                    {/* Inputs */}
                    <div className="flex-1 w-full space-y-4">
                      <div>
                        <label
                          className={`block text-xs font-medium mb-1.5 ${
                            isDark ? 'text-gray-400' : 'text-gray-600'
                          }`}
                        >
                          Avatar URL
                        </label>
                        <div className="relative">
                          <ImageIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                          <input
                            type="url"
                            value={formData.avatar}
                            onChange={(e) => {
                              setFormData({
                                ...formData,
                                avatar: e.target.value,
                              });
                              if (errors.avatar) {
                                setErrors({ ...errors, avatar: '' });
                              }
                            }}
                            placeholder="https://example.com/avatar.jpg"
                            className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${
                              errors.avatar
                                ? 'border-red-400 focus:ring-red-400/40'
                                : 'border-transparent focus:border-orange-400 focus:ring-2 focus:ring-orange-500/30'
                            } ${
                              isDark
                                ? 'bg-gray-800 text-white placeholder-gray-500'
                                : 'bg-orange-50 text-gray-900 placeholder-gray-400'
                            }`}
                          />
                        </div>
                        {errors.avatar && (
                          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {errors.avatar}
                          </p>
                        )}
                        <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1">
                          <Info className="w-3 h-3" />
                          Paste a direct link to your image (JPG, PNG, WebP)
                        </p>
                      </div>

                      {/* Upload placeholder */}
                      <div
                        className={`border-2 border-dashed rounded-xl p-4 text-center ${
                          isDark ? 'border-gray-700' : 'border-orange-200'
                        }`}
                      >
                        <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                        <p className="text-xs text-gray-400">
                          File upload coming soon
                        </p>
                        <p className="text-[10px] text-gray-500 mt-1">
                          For now, use an image URL
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
                    <button
                      onClick={handleSaveAvatar}
                      disabled={saving}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl text-sm font-medium shadow-md transition-all disabled:opacity-50"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      {saving ? 'Saving...' : 'Save Avatar'}
                    </button>

                    {formData.avatar && (
                      <button
                        onClick={() => {
                          setFormData({ ...formData, avatar: '' });
                          toast.success('Avatar cleared');
                        }}
                        disabled={saving}
                        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                          isDark
                            ? 'text-red-300 hover:bg-red-950/30'
                            : 'text-red-600 hover:bg-red-50'
                        }`}
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove
                      </button>
                    )}

                    <button
                      onClick={handleCancel}
                      disabled={saving}
                      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ml-auto ${
                        isDark
                          ? 'text-gray-300 hover:bg-gray-800'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ============================================
                  PASSWORD
                  ============================================ */}
              {activeSection === 'password' && (
                <motion.div
                  key="password"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className={`rounded-2xl border p-6 ${
                    isDark
                      ? 'bg-gray-900 border-gray-800'
                      : 'bg-white border-orange-100'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-6">
                    <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-white shrink-0">
                      <Lock className="w-5 h-5" />
                    </span>
                    <div>
                      <h2
                        className={`text-base font-bold ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}
                      >
                        Password & Security
                      </h2>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Choose a strong password to protect your account
                      </p>
                    </div>
                  </div>

                  <div className="space-y-5">
                    {/* Current password */}
                    <div>
                      <label
                        className={`block text-xs font-medium mb-1.5 ${
                          isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}
                      >
                        Current Password{' '}
                        <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <input
                          type={showCurrentPassword ? 'text' : 'password'}
                          value={passwordForm.currentPassword}
                          onChange={(e) => {
                            setPasswordForm({
                              ...passwordForm,
                              currentPassword: e.target.value,
                            });
                            if (errors.currentPassword) {
                              setErrors({ ...errors, currentPassword: '' });
                            }
                          }}
                          className={`w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm outline-none transition-all ${
                            errors.currentPassword
                              ? 'border-red-400 focus:ring-red-400/40'
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
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                          aria-label={
                            showCurrentPassword
                              ? 'Hide password'
                              : 'Show password'
                          }
                        >
                          {showCurrentPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      {errors.currentPassword && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors.currentPassword}
                        </p>
                      )}
                    </div>

                    {/* New password */}
                    <div>
                      <label
                        className={`block text-xs font-medium mb-1.5 ${
                          isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}
                      >
                        New Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={passwordForm.newPassword}
                          onChange={(e) => {
                            setPasswordForm({
                              ...passwordForm,
                              newPassword: e.target.value,
                            });
                            if (errors.newPassword) {
                              setErrors({ ...errors, newPassword: '' });
                            }
                          }}
                          className={`w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm outline-none transition-all ${
                            errors.newPassword
                              ? 'border-red-400 focus:ring-red-400/40'
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
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                          aria-label={
                            showNewPassword
                              ? 'Hide password'
                              : 'Show password'
                          }
                        >
                          {showNewPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      {errors.newPassword && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors.newPassword}
                        </p>
                      )}

                      {/* Strength meter */}
                      {passwordForm.newPassword && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] text-gray-400">
                              Strength
                            </span>
                            <span
                              className={`text-[11px] font-semibold ${
                                passwordStrength.score >= 4
                                  ? 'text-emerald-500'
                                  : passwordStrength.score === 3
                                    ? 'text-yellow-500'
                                    : passwordStrength.score === 2
                                      ? 'text-orange-500'
                                      : 'text-red-500'
                              }`}
                            >
                              {passwordStrength.label}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${passwordStrength.color}`}
                              style={{
                                width: `${(passwordStrength.score / 5) * 100}%`,
                              }}
                            />
                          </div>
                          <ul className="mt-3 grid grid-cols-2 gap-1.5">
                            {[
                              {
                                label: 'At least 8 characters',
                                met: passwordForm.newPassword.length >= 8,
                              },
                              {
                                label: 'Upper & lowercase',
                                met:
                                  /[a-z]/.test(passwordForm.newPassword) &&
                                  /[A-Z]/.test(passwordForm.newPassword),
                              },
                              {
                                label: 'Contains a number',
                                met: /\d/.test(passwordForm.newPassword),
                              },
                              {
                                label: 'Contains a symbol',
                                met: /[^a-zA-Z0-9]/.test(
                                  passwordForm.newPassword,
                                ),
                              },
                            ].map((req, idx) => (
                              <li
                                key={idx}
                                className={`flex items-center gap-1.5 text-[11px] ${
                                  req.met
                                    ? 'text-emerald-500'
                                    : 'text-gray-400'
                                }`}
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                {req.label}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Confirm password */}
                    <div>
                      <label
                        className={`block text-xs font-medium mb-1.5 ${
                          isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}
                      >
                        Confirm New Password{' '}
                        <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={passwordForm.confirmPassword}
                          onChange={(e) => {
                            setPasswordForm({
                              ...passwordForm,
                              confirmPassword: e.target.value,
                            });
                            if (errors.confirmPassword) {
                              setErrors({
                                ...errors,
                                confirmPassword: '',
                              });
                            }
                          }}
                          className={`w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm outline-none transition-all ${
                            errors.confirmPassword
                              ? 'border-red-400 focus:ring-red-400/40'
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
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                          aria-label={
                            showConfirmPassword
                              ? 'Hide password'
                              : 'Show password'
                          }
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      {errors.confirmPassword && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors.confirmPassword}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
                    <button
                      onClick={handleChangePassword}
                      disabled={
                        saving ||
                        !passwordForm.currentPassword ||
                        !passwordForm.newPassword ||
                        !passwordForm.confirmPassword
                      }
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl text-sm font-medium shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                        setPasswordForm({
                          currentPassword: '',
                          newPassword: '',
                          confirmPassword: '',
                        });
                        setErrors({});
                      }}
                      disabled={saving}
                      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        isDark
                          ? 'text-gray-300 hover:bg-gray-800'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <RefreshCw className="w-4 h-4" />
                      Clear
                    </button>

                    <button
                      onClick={handleCancel}
                      disabled={saving}
                      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ml-auto ${
                        isDark
                          ? 'text-gray-300 hover:bg-gray-800'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ============================================
                  NOTIFICATIONS
                  ============================================ */}
              {activeSection === 'notifications' && (
                <motion.div
                  key="notifications"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className={`rounded-2xl border p-6 ${
                    isDark
                      ? 'bg-gray-900 border-gray-800'
                      : 'bg-white border-orange-100'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-6">
                    <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shrink-0">
                      <Bell className="w-5 h-5" />
                    </span>
                    <div>
                      <h2
                        className={`text-base font-bold ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}
                      >
                        Notification Preferences
                      </h2>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Control which notifications you receive
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {[
                      {
                        key: 'email' as const,
                        label: 'Email Notifications',
                        description:
                          'Receive account and security alerts by email',
                        icon: Mail,
                      },
                      {
                        key: 'orderUpdates' as const,
                        label: 'Order Updates',
                        description:
                          'Get notified when your orders are shipped or delivered',
                        icon: Sparkles,
                      },
                      {
                        key: 'promotions' as const,
                        label: 'Promotional Emails',
                        description:
                          'Sales, new products, and special offers',
                        icon: Bell,
                      },
                      {
                        key: 'sms' as const,
                        label: 'SMS Notifications',
                        description:
                          'Receive critical updates via text message',
                        icon: Phone,
                      },
                    ].map((pref) => {
                      const Icon = pref.icon;
                      const isOn = notifications[pref.key];
                      return (
                        <label
                          key={pref.key}
                          className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                            isDark
                              ? 'hover:bg-gray-800'
                              : 'hover:bg-orange-50'
                          }`}
                        >
                          <span
                            className={`inline-flex items-center justify-center w-9 h-9 rounded-lg shrink-0 transition-colors ${
                              isOn
                                ? isDark
                                  ? 'bg-orange-950/40 text-orange-400'
                                  : 'bg-orange-100 text-orange-600'
                                : isDark
                                  ? 'bg-gray-800 text-gray-500'
                                  : 'bg-gray-100 text-gray-400'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </span>
                          <div className="flex-1 min-w-0">
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
                          <button
                            type="button"
                            role="switch"
                            aria-checked={isOn}
                            onClick={(e) => {
                              e.preventDefault();
                              setNotifications({
                                ...notifications,
                                [pref.key]: !isOn,
                              });
                            }}
                            className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors shrink-0 ${
                              isOn
                                ? 'bg-gradient-to-r from-orange-500 to-red-500'
                                : isDark
                                  ? 'bg-gray-700'
                                  : 'bg-gray-300'
                            }`}
                          >
                            <span
                              className={`inline-block w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform ${
                                isOn ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </label>
                      );
                    })}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
                    <button
                      onClick={handleSaveNotifications}
                      disabled={saving}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl text-sm font-medium shadow-md transition-all disabled:opacity-50"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      {saving ? 'Saving...' : 'Save Preferences'}
                    </button>

                    <button
                      onClick={handleCancel}
                      disabled={saving}
                      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ml-auto ${
                        isDark
                          ? 'text-gray-300 hover:bg-gray-800'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ============================================
                  DANGER ZONE
                  ============================================ */}
              {activeSection === 'danger' && (
                <motion.div
                  key="danger"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  {/* Deactivate */}
                  <div
                    className={`rounded-2xl border-2 p-6 ${
                      isDark
                        ? 'bg-red-950/20 border-red-900/50'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-4">
                      <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shrink-0">
                        <AlertTriangle className="w-5 h-5" />
                      </span>
                      <div>
                        <h3
                          className={`text-base font-bold ${
                            isDark ? 'text-white' : 'text-gray-900'
                          }`}
                        >
                          Deactivate Account
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Your account will be hidden but data is preserved.
                          You can reactivate anytime by signing back in.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        toast.info(
                          'Account deactivation is handled by the admin console',
                        );
                      }}
                      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        isDark
                          ? 'bg-amber-950/40 text-amber-300 hover:bg-amber-950/60'
                          : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                      }`}
                    >
                      <AlertTriangle className="w-4 h-4" />
                      Deactivate Account
                    </button>
                  </div>

                  {/* Delete */}
                  <div
                    className={`rounded-2xl border-2 p-6 ${
                      isDark
                        ? 'bg-red-950/30 border-red-900'
                        : 'bg-red-50 border-red-300'
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-4">
                      <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-700 text-white shrink-0">
                        <Trash2 className="w-5 h-5" />
                      </span>
                      <div>
                        <h3
                          className={`text-base font-bold ${
                            isDark ? 'text-white' : 'text-gray-900'
                          }`}
                        >
                          Delete Account
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          This action is permanent and cannot be undone. All
                          your data, orders, and history will be erased.
                        </p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <label
                        className={`block text-xs font-medium mb-1.5 ${
                          isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}
                      >
                        Type{' '}
                        <span className="font-mono font-bold text-red-500">
                          DELETE
                        </span>{' '}
                        to confirm
                      </label>
                      <input
                        type="text"
                        value={dangerConfirm}
                        onChange={(e) => setDangerConfirm(e.target.value)}
                        placeholder="DELETE"
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${
                          dangerConfirm === 'DELETE'
                            ? 'border-red-500 focus:ring-red-500/40'
                            : 'border-transparent focus:border-red-400 focus:ring-2 focus:ring-red-500/30'
                        } ${
                          isDark
                            ? 'bg-gray-900 text-white placeholder-gray-600'
                            : 'bg-white text-gray-900 placeholder-gray-400'
                        }`}
                      />
                    </div>

                    <button
                      onClick={() => {
                        if (dangerConfirm !== 'DELETE') {
                          toast.error('Please type DELETE to confirm');
                          return;
                        }
                        toast.info(
                          'Account deletion is handled by the admin console',
                        );
                      }}
                      disabled={dangerConfirm !== 'DELETE'}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white rounded-xl text-sm font-medium shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete My Account
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ============================================
                STICKY SAVE BAR (personal section only)
                ============================================ */}
            <AnimatePresence>
              {activeSection === 'personal' && hasChanges && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-lg w-[calc(100%-2rem)]"
                >
                  <div
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border ${
                      isDark
                        ? 'bg-gray-900 border-gray-700'
                        : 'bg-white border-orange-200'
                    }`}
                  >
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 shrink-0">
                      <Info className="w-4 h-4" />
                    </span>
                    <p
                      className={`text-sm flex-1 ${
                        isDark ? 'text-gray-300' : 'text-gray-700'
                      }`}
                    >
                      You have unsaved changes
                    </p>
                    <button
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl text-sm font-medium shadow-md transition-all disabled:opacity-50"
                    >
                      {saving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      Save
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}
