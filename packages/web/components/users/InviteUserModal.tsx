// D:\Projects\Kalwanga\packages\web\components\users\InviteUserModal.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import { toast } from 'react-hot-toast';
import { 
  X, Mail, Send, UserPlus, Users, Building, Shield,
  Loader2, AlertCircle, CheckCircle, XCircle, Plus,
  Minus, Copy, Check, Clock, Calendar, Globe, Phone,
  Key, Lock, Unlock, Eye, EyeOff, Search, Filter,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  MoreVertical, Star, Heart, ThumbsUp, MessageSquare,
  Share2, Bookmark, FileText, Download, Upload,
  RefreshCw, Settings, Info, AlertTriangle, Zap,
  Sparkles, Award, Crown, Medal, Trophy, Target,
  Crosshair, Gauge, // ✅ Removed Aim, Bullseye, Speedometer
  CreditCard, DollarSign, Percent, Tag, Store,
  ClipboardList, Truck, Boxes, Layers, FolderTree,
  Database, Server, Cloud, Wifi, Bluetooth, Battery,
  Sun, Moon, Wind, Droplet, Flame, Leaf, TreePine,
  Mountain, Waves, Compass, Map, Navigation, Route,
  UserPlus as UserPlusIcon, UserCheck, UserX,
  BadgeCheck, Ban, RotateCcw, History
} from 'lucide-react';
import { PERMISSIONS } from '../../types/permissions';
import { UserRole } from '../../types/enums';

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite?: (invitations: InvitationData[]) => void;
  businessUnits?: BusinessUnit[];
  availableRoles?: RoleOption[];
  defaultRole?: UserRole;
}

interface InvitationData {
  id: string;
  email: string;
  role: UserRole;
  businessUnitId?: string;
  message?: string;
  expiresIn?: number;
  status: 'pending' | 'sent' | 'accepted' | 'expired' | 'cancelled';
  sentAt?: string;
  expiresAt?: string;
  acceptedAt?: string;
  invitationToken?: string;
  invitedBy?: string;
}

interface BusinessUnit {
  id: string;
  name: string;
  code: string;
  isActive?: boolean;
}

interface RoleOption {
  value: UserRole;
  label: string;
  description: string;
  icon?: React.ReactNode;
  color?: string;
}

interface InvitationTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  role: UserRole;
}

interface InvitationStats {
  total: number;
  pending: number;
  accepted: number;
  expired: number;
  cancelled: number;
}

const DEFAULT_ROLES: RoleOption[] = [
  { 
    value: UserRole.SUPER_ADMIN, 
    label: 'Super Admin', 
    description: 'Full system access with all permissions',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
  },
  { 
    value: UserRole.ADMIN, 
    label: 'Admin', 
    description: 'Administrative access with user management',
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
  },
  { 
    value: UserRole.MANAGER, 
    label: 'Manager', 
    description: 'Manage business units and teams',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
  },
  { 
    value: UserRole.EDITOR, 
    label: 'Editor', 
    description: 'Create and edit content',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
  },
  { 
    value: UserRole.VIEWER, 
    label: 'Viewer', 
    description: 'View-only access',
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-400'
  },
  { 
    value: UserRole.EMPLOYEE, 
    label: 'Employee', 
    description: 'Basic employee access',
    color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400'
  },
  { 
    value: UserRole.CASHIER, 
    label: 'Cashier', 
    description: 'POS and transaction access',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
  },
  { 
    value: UserRole.USER, 
    label: 'User', 
    description: 'Basic user access',
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-400'
  },
];

const INVITATION_TEMPLATES: InvitationTemplate[] = [
  {
    id: 'standard',
    name: 'Standard Invitation',
    subject: 'You\'ve been invited to join our platform',
    body: 'Hello,\n\nYou have been invited to join our platform. Click the link below to get started:\n\n[Invitation Link]\n\nBest regards,\nThe Team',
    role: UserRole.USER,
  },
  {
    id: 'welcome',
    name: 'Welcome Message',
    subject: 'Welcome to our team!',
    body: 'Welcome aboard!\n\nWe\'re excited to have you join our team. Your account has been set up with the following role: [Role].\n\nClick here to complete your registration:\n[Invitation Link]\n\nSee you soon!',
    role: UserRole.EMPLOYEE,
  },
  {
    id: 'admin',
    name: 'Admin Invitation',
    subject: 'You\'ve been granted administrative access',
    body: 'Hello,\n\nYou have been granted administrative access to our platform. Please use the link below to set up your account:\n\n[Invitation Link]\n\nThis invitation will expire in [Expiry Time].\n\nRegards,\nThe Team',
    role: UserRole.ADMIN,
  },
];

export function InviteUserModal({ 
  isOpen, 
  onClose, 
  onInvite,
  businessUnits = [],
  availableRoles = DEFAULT_ROLES,
  defaultRole = UserRole.USER,
}: InviteUserModalProps) {
  const router = useRouter();
  const { can, isSuperAdmin, isAdmin } = useAuth();
  
  // State management
  const [emails, setEmails] = useState<string[]>(['']);
  const [selectedRole, setSelectedRole] = useState<UserRole>(defaultRole);
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string>('');
  const [customMessage, setCustomMessage] = useState('');
  const [expiryDays, setExpiryDays] = useState(7);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('standard');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<InvitationData[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [invitationStats, setInvitationStats] = useState<InvitationStats>({
    total: 0,
    pending: 0,
    accepted: 0,
    expired: 0,
    cancelled: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'sent' | 'accepted' | 'expired' | 'cancelled'>('all');
  const [selectedInvitations, setSelectedInvitations] = useState<Set<string>>(new Set());
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [showInvitationDetails, setShowInvitationDetails] = useState(false);
  const [selectedInvitation, setSelectedInvitation] = useState<InvitationData | null>(null);
  
  // Refs
  const modalRef = useRef<HTMLDivElement>(null);
  const emailInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const canInviteUsers = isSuperAdmin || isAdmin || can(PERMISSIONS.USER_CREATE);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setEmails(['']);
      setSelectedRole(defaultRole);
      setSelectedBusinessUnit('');
      setCustomMessage('');
      setExpiryDays(7);
      setSelectedTemplate('standard');
      setError(null);
      setSuccessMessage(null);
      setShowHistory(false);
      setShowTemplates(false);
      setShowAdvancedOptions(false);
      setSelectedInvitations(new Set());
      setSearchQuery('');
      setFilterStatus('all');
      
      // Load mock invitation history
      loadInvitationHistory();
    }
  }, [isOpen, defaultRole]);

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose]);

  // Focus first email input when modal opens
  useEffect(() => {
    if (isOpen && emailInputRefs.current[0]) {
      setTimeout(() => {
        emailInputRefs.current[0]?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Load invitation history (mock data)
  const loadInvitationHistory = useCallback(() => {
    const mockInvitations: InvitationData[] = [
      {
        id: 'inv_1',
        email: 'john.doe@example.com',
        role: UserRole.MANAGER,
        businessUnitId: '1',
        message: 'Welcome to the team!',
        expiresIn: 7,
        status: 'accepted',
        sentAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        acceptedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        invitationToken: 'token_123',
        invitedBy: 'Admin',
      },
      {
        id: 'inv_2',
        email: 'jane.smith@example.com',
        role: UserRole.EDITOR,
        businessUnitId: '2',
        message: 'Looking forward to working with you!',
        expiresIn: 7,
        status: 'pending',
        sentAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
        invitationToken: 'token_456',
        invitedBy: 'Admin',
      },
      {
        id: 'inv_3',
        email: 'bob.wilson@example.com',
        role: UserRole.VIEWER,
        businessUnitId: '1',
        message: '',
        expiresIn: 7,
        status: 'expired',
        sentAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        invitationToken: 'token_789',
        invitedBy: 'Admin',
      },
    ];
    
    setInvitations(mockInvitations);
    updateInvitationStats(mockInvitations);
  }, []);

  // Update invitation stats
  const updateInvitationStats = useCallback((invites: InvitationData[]) => {
    setInvitationStats({
      total: invites.length,
      pending: invites.filter(i => i.status === 'pending').length,
      accepted: invites.filter(i => i.status === 'accepted').length,
      expired: invites.filter(i => i.status === 'expired').length,
      cancelled: invites.filter(i => i.status === 'cancelled').length,
    });
  }, []);

  // Handle email change
  const handleEmailChange = useCallback((index: number, value: string) => {
    setEmails(prev => {
      const newEmails = [...prev];
      newEmails[index] = value;
      return newEmails;
    });
  }, []);

  // Add email field
  const handleAddEmail = useCallback(() => {
    setEmails(prev => [...prev, '']);
    // Focus new input after render
    setTimeout(() => {
      const newIndex = emails.length;
      emailInputRefs.current[newIndex]?.focus();
    }, 100);
  }, [emails.length]);

  // Remove email field
  const handleRemoveEmail = useCallback((index: number) => {
    setEmails(prev => {
      if (prev.length <= 1) return prev;
      const newEmails = prev.filter((_, i) => i !== index);
      return newEmails;
    });
  }, []);

  // Validate emails
  const validateEmails = useCallback((): string[] => {
    const validEmails: string[] = [];
    const invalidEmails: string[] = [];
    
    emails.forEach(email => {
      const trimmedEmail = email.trim();
      if (!trimmedEmail) return;
      
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        if (!validEmails.includes(trimmedEmail.toLowerCase())) {
          validEmails.push(trimmedEmail.toLowerCase());
        }
      } else {
        invalidEmails.push(trimmedEmail);
      }
    });
    
    return validEmails;
  }, [emails]);

  // Handle send invitations
  const handleSendInvitations = useCallback(async () => {
    try {
      setSending(true);
      setError(null);
      setSuccessMessage(null);
      
      const validEmails = validateEmails();
      
      if (validEmails.length === 0) {
        setError('Please enter at least one valid email address');
        toast.error('Please enter at least one valid email address');
        return;
      }
      
      // Create invitation data
      const newInvitations: InvitationData[] = validEmails.map((email, index) => ({
        id: `inv_${Date.now()}_${index}`,
        email,
        role: selectedRole,
        businessUnitId: selectedBusinessUnit || undefined,
        message: customMessage || undefined,
        expiresIn: expiryDays,
        status: 'sent',
        sentAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString(),
        invitationToken: `token_${Math.random().toString(36).substring(2)}`,
        invitedBy: 'Current User',
      }));
      
      // Send invitations (mock API call)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Update invitations list
      setInvitations(prev => [...newInvitations, ...prev]);
      updateInvitationStats([...newInvitations, ...invitations]);
      
      // Show success message
      const successMsg = `Successfully sent ${newInvitations.length} invitation${newInvitations.length !== 1 ? 's' : ''}`;
      setSuccessMessage(successMsg);
      toast.success(successMsg);
      
      // Call onInvite callback
      if (onInvite) {
        onInvite(newInvitations);
      }
      
      // Reset form
      setEmails(['']);
      setCustomMessage('');
      
      // Show history
      setShowHistory(true);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
      
    } catch (error: any) {
      console.error('Failed to send invitations:', error);
      setError(error?.message || 'Failed to send invitations');
      toast.error('Failed to send invitations');
    } finally {
      setSending(false);
    }
  }, [emails, selectedRole, selectedBusinessUnit, customMessage, expiryDays, validateEmails, onInvite, invitations, updateInvitationStats]);

  // Handle resend invitation
  const handleResendInvitation = useCallback(async (invitation: InvitationData) => {
    try {
      setError(null);
      
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setInvitations(prev => prev.map(inv => 
        inv.id === invitation.id 
          ? { 
              ...inv, 
              status: 'sent', 
              sentAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + (inv.expiresIn || 7) * 24 * 60 * 60 * 1000).toISOString(),
            }
          : inv
      ));
      
      toast.success(`Invitation resent to ${invitation.email}`);
    } catch (error: any) {
      console.error('Failed to resend invitation:', error);
      toast.error('Failed to resend invitation');
    }
  }, []);

  // Handle cancel invitation
  const handleCancelInvitation = useCallback(async (invitation: InvitationData) => {
    try {
      setError(null);
      
      if (!confirm(`Are you sure you want to cancel the invitation to ${invitation.email}?`)) return;
      
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setInvitations(prev => prev.map(inv => 
        inv.id === invitation.id 
          ? { ...inv, status: 'cancelled' }
          : inv
      ));
      
      updateInvitationStats(invitations.map(inv => 
        inv.id === invitation.id ? { ...inv, status: 'cancelled' } : inv
      ));
      
      toast.success('Invitation cancelled');
    } catch (error: any) {
      console.error('Failed to cancel invitation:', error);
      toast.error('Failed to cancel invitation');
    }
  }, [invitations, updateInvitationStats]);

  // Handle copy invitation link
  const handleCopyInvitationLink = useCallback((invitation: InvitationData) => {
    const link = `https://example.com/invite/${invitation.invitationToken}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedEmail(invitation.email);
      toast.success('Invitation link copied to clipboard');
      setTimeout(() => setCopiedEmail(null), 2000);
    });
  }, []);

  // Handle copy email
  const handleCopyEmail = useCallback((email: string) => {
    navigator.clipboard.writeText(email).then(() => {
      setCopiedEmail(email);
      toast.success('Email copied to clipboard');
      setTimeout(() => setCopiedEmail(null), 2000);
    });
  }, []);

  // Handle apply template
  const handleApplyTemplate = useCallback((template: InvitationTemplate) => {
    setSelectedTemplate(template.id);
    setCustomMessage(template.body);
    setSelectedRole(template.role);
    setShowTemplates(false);
    toast.success(`Applied ${template.name}`);
  }, []);

  // Filter invitations
  const filteredInvitations = useMemo(() => {
    let filtered = invitations;
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(inv => inv.status === filterStatus);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(inv => 
        inv.email.toLowerCase().includes(query) ||
        inv.role.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [invitations, filterStatus, searchQuery]);

  // Get status badge
  const getStatusBadge = useCallback((status: InvitationData['status']) => {
    const badges = {
      pending: { icon: <Clock className="w-3 h-3" />, label: 'Pending', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
      sent: { icon: <Send className="w-3 h-3" />, label: 'Sent', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
      accepted: { icon: <CheckCircle className="w-3 h-3" />, label: 'Accepted', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
      expired: { icon: <AlertCircle className="w-3 h-3" />, label: 'Expired', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
      cancelled: { icon: <XCircle className="w-3 h-3" />, label: 'Cancelled', className: 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-400' },
    };
    
    const badge = badges[status];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.className}`}>
        {badge.icon}
        {badge.label}
      </span>
    );
  }, []);

  // Get role badge color
  const getRoleBadgeColor = useCallback((role: UserRole) => {
    const roleOption = availableRoles.find(r => r.value === role);
    return roleOption?.color || 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-400';
  }, [availableRoles]);

  // Format date
  const formatDate = useCallback((date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, []);

  // Get time ago
  const getTimeAgo = useCallback((date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }, []);

  // ✅ FIXED: Proper ref callback that returns void
  const setEmailInputRef = useCallback((el: HTMLInputElement | null, index: number) => {
    emailInputRefs.current[index] = el;
  }, []);

  // If modal is not open, return null
  if (!isOpen) return null;

  // If user doesn't have permission
  if (!canInviteUsers) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="fixed inset-0 bg-black/50" onClick={onClose} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Access Restricted</h3>
              <p className="text-gray-500 dark:text-gray-400 mt-2">
                You don't have permission to invite users.
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        
        <div ref={modalRef} className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <UserPlus className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Invite Users</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Send email invitations to new users
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Success Message */}
            {successMessage && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                <span className="text-green-700 dark:text-green-300 text-sm flex-1">{successMessage}</span>
                <button
                  onClick={() => setSuccessMessage(null)}
                  className="p-1 hover:bg-green-100 dark:hover:bg-green-800 rounded transition-colors"
                >
                  <XCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
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
                >
                  <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </button>
              </div>
            )}

            {/* Email Inputs */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Addresses <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {emails.map((email, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        ref={(el) => setEmailInputRef(el, index)}
                        type="email"
                        value={email}
                        onChange={(e) => handleEmailChange(index, e.target.value)}
                        placeholder="user@example.com"
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    {emails.length > 1 && (
                      <button
                        onClick={() => handleRemoveEmail(index)}
                        className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        aria-label="Remove email"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={handleAddEmail}
                className="mt-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add another email
              </button>
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Role <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {availableRoles.map(role => (
                  <button
                    key={role.value}
                    onClick={() => setSelectedRole(role.value)}
                    className={`p-3 rounded-lg border transition-all text-left ${
                      selectedRole === role.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-1 ${role.color}`}>
                      {role.label}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{role.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Business Unit Selection */}
            {businessUnits.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Business Unit
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    value={selectedBusinessUnit}
                    onChange={(e) => setSelectedBusinessUnit(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">No Business Unit</option>
                    {businessUnits.map(bu => (
                      <option key={bu.id} value={bu.id}>
                        {bu.name} ({bu.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Advanced Options */}
            <div>
              <button
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                {showAdvancedOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Advanced Options
              </button>
              
              {showAdvancedOptions && (
                <div className="mt-3 space-y-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Expiry Period
                    </label>
                    <select
                      value={expiryDays}
                      onChange={(e) => setExpiryDays(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    >
                      <option value={1}>1 day</option>
                      <option value={3}>3 days</option>
                      <option value={7}>7 days</option>
                      <option value={14}>14 days</option>
                      <option value={30}>30 days</option>
                      <option value={0}>Never expires</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Custom Message
                    </label>
                    <textarea
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      rows={3}
                      placeholder="Add a personal message to the invitation..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Templates
                    </label>
                    <div className="space-y-2">
                      {INVITATION_TEMPLATES.map(template => (
                        <button
                          key={template.id}
                          onClick={() => handleApplyTemplate(template)}
                          className={`w-full text-left p-3 rounded-lg border transition-all ${
                            selectedTemplate === template.id
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                        >
                          <p className="font-medium text-gray-900 dark:text-white text-sm">{template.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{template.subject}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Invitation History Toggle */}
            <div>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <History className="w-4 h-4" />
                {showHistory ? 'Hide History' : 'Show History'}
                {invitations.length > 0 && (
                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs">
                    {invitations.length}
                  </span>
                )}
              </button>
            </div>

            {/* Invitation History */}
            {showHistory && invitations.length > 0 && (
              <div className="space-y-3">
                {/* Stats */}
                <div className="grid grid-cols-5 gap-2">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{invitationStats.total}</p>
                    <p className="text-xs text-gray-500">Total</p>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-yellow-600">{invitationStats.pending}</p>
                    <p className="text-xs text-yellow-600">Pending</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-green-600">{invitationStats.accepted}</p>
                    <p className="text-xs text-green-600">Accepted</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-red-600">{invitationStats.expired}</p>
                    <p className="text-xs text-red-600">Expired</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-gray-600">{invitationStats.cancelled}</p>
                    <p className="text-xs text-gray-500">Cancelled</p>
                  </div>
                </div>

                {/* Search and Filter */}
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search invitations..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="sent">Sent</option>
                    <option value="accepted">Accepted</option>
                    <option value="expired">Expired</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                {/* Invitation List */}
                <div className="space-y-2">
                  {filteredInvitations.map(invitation => (
                    <div key={invitation.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Mail className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate">{invitation.email}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(invitation.role)}`}>
                              {invitation.role.replace('_', ' ')}
                            </span>
                            {getStatusBadge(invitation.status)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleCopyInvitationLink(invitation)}
                          className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                          title="Copy invitation link"
                        >
                          {copiedEmail === invitation.email ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                        {invitation.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleResendInvitation(invitation)}
                              className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                              title="Resend invitation"
                            >
                              <Send className="w-4 h-4 text-blue-500" />
                            </button>
                            <button
                              onClick={() => handleCancelInvitation(invitation)}
                              className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                              title="Cancel invitation"
                            >
                              <XCircle className="w-4 h-4 text-red-500" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {emails.filter(e => e.trim()).length} email{emails.filter(e => e.trim()).length !== 1 ? 's' : ''} entered
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendInvitations}
                disabled={sending || emails.filter(e => e.trim()).length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Invitations
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InviteUserModal;
