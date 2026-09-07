// D:\Projects\Kalwanga\packages\web\components\users\UserStatusBadge.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { 
  CheckCircle, XCircle, Clock, AlertCircle, AlertTriangle,
  Ban, PauseCircle, PlayCircle, StopCircle, Hourglass,
  Shield, ShieldCheck, ShieldAlert, ShieldX, UserCheck,
  UserX, UserPlus, UserCog, UserCircle, UserSquare,
  UserRound, UserRoundCheck, UserRoundCog, UserRoundPlus,
  UsersRound, Key, Lock, Unlock, Eye, EyeOff, Trash2,
  Edit, RefreshCw, MoreVertical, Info, Zap, Sparkles,
  Award, Medal, Trophy, Target, Crosshair, // ✅ Removed Aim, Bullseye
  CreditCard, DollarSign, Percent, Tag, Store, ClipboardList,
  Truck, Boxes, Layers, FolderTree, Database, Server, Cloud,
  Wifi, Bluetooth, Battery, Sun, Moon, Wind, Droplet, Flame,
  Leaf, TreePine, Mountain, Waves, Compass, Map, Navigation,
  Route, BadgeCheck, Star, Heart, ThumbsUp, MessageSquare,
  Share2, Bookmark, FileText, Download, Upload, Settings,
  Activity, Calendar, Globe, Hash, Link2, Unlink, Plus,
  Minus, RotateCcw, History, Filter, Search, ChevronDown,
  ChevronUp, ChevronLeft, ChevronRight, Copy, Check, X
} from 'lucide-react';
import { UserRole } from '../../types/enums';

export type UserStatus = 
  | 'active' 
  | 'inactive' 
  | 'suspended' 
  | 'pending' 
  | 'locked' 
  | 'expired' 
  | 'banned'
  | 'deactivated'
  | 'archived'
  | 'verified'
  | 'unverified'
  | 'premium'
  | 'trial'
  | 'probation'
  | 'on_leave'
  | 'terminated';

interface UserStatusBadgeProps {
  status: UserStatus;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'solid' | 'outline' | 'soft' | 'dot';
  showIcon?: boolean;
  showLabel?: boolean;
  showTooltip?: boolean;
  tooltipContent?: React.ReactNode;
  showDetails?: boolean;
  details?: {
    reason?: string;
    since?: string;
    until?: string;
    by?: string;
    notes?: string;
  };
  className?: string;
  style?: React.CSSProperties;
  animated?: boolean;
  pulseAnimation?: boolean;
  onClick?: () => void;
  onStatusChange?: (newStatus: UserStatus) => void;
  editable?: boolean;
  availableStatuses?: UserStatus[];
  showDropdown?: boolean;
}

interface StatusConfig {
  label: string;
  color: string;
  backgroundColor: string;
  borderColor: string;
  icon: React.ReactNode;
  description: string;
  severity: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  animation?: 'pulse' | 'spin' | 'bounce' | 'none';
}

const STATUS_CONFIGS: Record<UserStatus, StatusConfig> = {
  active: {
    label: 'Active',
    color: 'text-green-700 dark:text-green-400',
    backgroundColor: 'bg-green-100 dark:bg-green-900/30',
    borderColor: 'border-green-200 dark:border-green-700',
    icon: <CheckCircle className="w-3 h-3" />,
    description: 'User account is active and can access the system',
    severity: 'success',
    animation: 'none',
  },
  inactive: {
    label: 'Inactive',
    color: 'text-gray-600 dark:text-gray-400',
    backgroundColor: 'bg-gray-100 dark:bg-gray-700/50',
    borderColor: 'border-gray-200 dark:border-gray-600',
    icon: <XCircle className="w-3 h-3" />,
    description: 'User account is inactive and cannot access the system',
    severity: 'neutral',
    animation: 'none',
  },
  suspended: {
    label: 'Suspended',
    color: 'text-orange-700 dark:text-orange-400',
    backgroundColor: 'bg-orange-100 dark:bg-orange-900/30',
    borderColor: 'border-orange-200 dark:border-orange-700',
    icon: <PauseCircle className="w-3 h-3" />,
    description: 'User account has been temporarily suspended',
    severity: 'warning',
    animation: 'pulse',
  },
  pending: {
    label: 'Pending',
    color: 'text-yellow-700 dark:text-yellow-400',
    backgroundColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    borderColor: 'border-yellow-200 dark:border-yellow-700',
    icon: <Hourglass className="w-3 h-3" />,
    description: 'User account is pending activation',
    severity: 'warning',
    animation: 'pulse',
  },
  locked: {
    label: 'Locked',
    color: 'text-red-700 dark:text-red-400',
    backgroundColor: 'bg-red-100 dark:bg-red-900/30',
    borderColor: 'border-red-200 dark:border-red-700',
    icon: <Lock className="w-3 h-3" />,
    description: 'User account has been locked due to security concerns',
    severity: 'error',
    animation: 'none',
  },
  expired: {
    label: 'Expired',
    color: 'text-purple-700 dark:text-purple-400',
    backgroundColor: 'bg-purple-100 dark:bg-purple-900/30',
    borderColor: 'border-purple-200 dark:border-purple-700',
    icon: <Clock className="w-3 h-3" />,
    description: 'User account has expired',
    severity: 'warning',
    animation: 'none',
  },
  banned: {
    label: 'Banned',
    color: 'text-red-700 dark:text-red-400',
    backgroundColor: 'bg-red-100 dark:bg-red-900/30',
    borderColor: 'border-red-200 dark:border-red-700',
    icon: <Ban className="w-3 h-3" />,
    description: 'User has been permanently banned from the system',
    severity: 'error',
    animation: 'none',
  },
  deactivated: {
    label: 'Deactivated',
    color: 'text-gray-600 dark:text-gray-400',
    backgroundColor: 'bg-gray-100 dark:bg-gray-700/50',
    borderColor: 'border-gray-200 dark:border-gray-600',
    icon: <StopCircle className="w-3 h-3" />,
    description: 'User account has been deactivated',
    severity: 'neutral',
    animation: 'none',
  },
  archived: {
    label: 'Archived',
    color: 'text-gray-500 dark:text-gray-400',
    backgroundColor: 'bg-gray-50 dark:bg-gray-800/50',
    borderColor: 'border-gray-200 dark:border-gray-700',
    icon: <ShieldX className="w-3 h-3" />,
    description: 'User account has been archived',
    severity: 'neutral',
    animation: 'none',
  },
  verified: {
    label: 'Verified',
    color: 'text-blue-700 dark:text-blue-400',
    backgroundColor: 'bg-blue-100 dark:bg-blue-900/30',
    borderColor: 'border-blue-200 dark:border-blue-700',
    icon: <BadgeCheck className="w-3 h-3" />,
    description: 'User account has been verified',
    severity: 'success',
    animation: 'none',
  },
  unverified: {
    label: 'Unverified',
    color: 'text-gray-600 dark:text-gray-400',
    backgroundColor: 'bg-gray-100 dark:bg-gray-700/50',
    borderColor: 'border-gray-200 dark:border-gray-600',
    icon: <AlertCircle className="w-3 h-3" />,
    description: 'User account has not been verified yet',
    severity: 'neutral',
    animation: 'none',
  },
  premium: {
    label: 'Premium',
    color: 'text-yellow-700 dark:text-yellow-400',
    backgroundColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    borderColor: 'border-yellow-200 dark:border-yellow-700',
    icon: <Star className="w-3 h-3" />,
    description: 'User has premium account status',
    severity: 'success',
    animation: 'none',
  },
  trial: {
    label: 'Trial',
    color: 'text-cyan-700 dark:text-cyan-400',
    backgroundColor: 'bg-cyan-100 dark:bg-cyan-900/30',
    borderColor: 'border-cyan-200 dark:border-cyan-700',
    icon: <Zap className="w-3 h-3" />,
    description: 'User is on a trial period',
    severity: 'info',
    animation: 'none',
  },
  probation: {
    label: 'Probation',
    color: 'text-orange-700 dark:text-orange-400',
    backgroundColor: 'bg-orange-100 dark:bg-orange-900/30',
    borderColor: 'border-orange-200 dark:border-orange-700',
    icon: <AlertTriangle className="w-3 h-3" />,
    description: 'User account is on probation',
    severity: 'warning',
    animation: 'pulse',
  },
  on_leave: {
    label: 'On Leave',
    color: 'text-blue-700 dark:text-blue-400',
    backgroundColor: 'bg-blue-100 dark:bg-blue-900/30',
    borderColor: 'border-blue-200 dark:border-blue-700',
    icon: <Clock className="w-3 h-3" />,
    description: 'User is currently on leave',
    severity: 'info',
    animation: 'none',
  },
  terminated: {
    label: 'Terminated',
    color: 'text-red-700 dark:text-red-400',
    backgroundColor: 'bg-red-100 dark:bg-red-900/30',
    borderColor: 'border-red-200 dark:border-red-700',
    icon: <XCircle className="w-3 h-3" />,
    description: 'User account has been terminated',
    severity: 'error',
    animation: 'none',
  },
};

const SIZE_MAP: Record<string, string> = {
  xs: 'px-1.5 py-0.5 text-[10px]',
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
};

const ICON_SIZE_MAP: Record<string, string> = {
  xs: 'w-2.5 h-2.5',
  sm: 'w-3 h-3',
  md: 'w-3.5 h-3.5',
  lg: 'w-4 h-4',
};

const DOT_SIZE_MAP: Record<string, string> = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
};

export function UserStatusBadge({
  status,
  size = 'md',
  variant = 'soft',
  showIcon = true,
  showLabel = true,
  showTooltip = false,
  tooltipContent,
  showDetails = false,
  details,
  className = '',
  style,
  animated = false,
  pulseAnimation = false,
  onClick,
  onStatusChange,
  editable = false,
  availableStatuses,
  showDropdown = false,
}: UserStatusBadgeProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
  
  const badgeRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const config = STATUS_CONFIGS[status] || STATUS_CONFIGS.inactive;
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.md;
  const iconSize = ICON_SIZE_MAP[size] || ICON_SIZE_MAP.md;
  const dotSize = DOT_SIZE_MAP[size] || DOT_SIZE_MAP.md;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Get variant classes
  const getVariantClasses = useCallback(() => {
    switch (variant) {
      case 'solid':
        return `${config.backgroundColor} ${config.color} border ${config.borderColor}`;
      case 'outline':
        return `bg-transparent ${config.color} border ${config.borderColor}`;
      case 'soft':
        return `${config.backgroundColor} ${config.color} border ${config.borderColor}`;
      case 'dot':
        return `bg-transparent ${config.color}`;
      default:
        return `${config.backgroundColor} ${config.color} border ${config.borderColor}`;
    }
  }, [variant, config]);

  // Get animation class
  const getAnimationClass = useCallback(() => {
    if (pulseAnimation || (animated && config.animation === 'pulse')) {
      return 'animate-pulse';
    }
    if (animated && config.animation === 'spin') {
      return 'animate-spin';
    }
    if (animated && config.animation === 'bounce') {
      return 'animate-bounce';
    }
    return '';
  }, [animated, pulseAnimation, config.animation]);

  // Handle status change
  const handleStatusChange = useCallback((newStatus: UserStatus) => {
    onStatusChange?.(newStatus);
    setShowStatusDropdown(false);
  }, [onStatusChange]);

  // Render dot variant
  if (variant === 'dot') {
    return (
      <div
        ref={badgeRef}
        className={`relative inline-flex items-center ${className}`}
        style={style}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <span
          className={`${dotSize} rounded-full ${config.backgroundColor} ${getAnimationClass()}`}
          title={showTooltip ? config.description : undefined}
        />
        {showTooltip && isHovering && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50">
            {tooltipContent || config.description}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={badgeRef}
      className={`relative inline-flex items-center ${className}`}
      style={style}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div
        className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClass} ${getVariantClasses()} ${getAnimationClass()} ${
          onClick || editable ? 'cursor-pointer' : ''
        }`}
        onClick={() => {
          if (editable && showDropdown) {
            setShowStatusDropdown(!showStatusDropdown);
          }
          onClick?.();
        }}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onClick) {
            onClick();
          }
        }}
      >
        {showIcon && (
          <span className={`${iconSize} flex-shrink-0`}>
            {config.icon}
          </span>
        )}
        {showLabel && (
          <span className="whitespace-nowrap">{config.label}</span>
        )}
        {editable && showDropdown && (
          <ChevronDown className={`${iconSize} flex-shrink-0`} />
        )}
      </div>

      {/* Status dropdown */}
      {showStatusDropdown && editable && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50"
        >
          {(availableStatuses || Object.keys(STATUS_CONFIGS) as UserStatus[]).map((availableStatus) => {
            const statusConfig = STATUS_CONFIGS[availableStatus];
            if (!statusConfig) return null;
            
            return (
              <button
                key={availableStatus}
                onClick={() => handleStatusChange(availableStatus)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                  status === availableStatus ? 'bg-gray-50 dark:bg-gray-700/50' : ''
                }`}
              >
                <span className={statusConfig.color}>{statusConfig.icon}</span>
                <span className={statusConfig.color}>{statusConfig.label}</span>
                {status === availableStatus && (
                  <Check className="w-4 h-4 ml-auto text-green-500" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Tooltip */}
      {showTooltip && isHovering && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-50">
          <div className="font-medium">{config.label}</div>
          <div className="text-gray-300 mt-0.5">{tooltipContent || config.description}</div>
          {details?.since && (
            <div className="text-gray-400 mt-0.5">Since: {details.since}</div>
          )}
          {details?.until && (
            <div className="text-gray-400 mt-0.5">Until: {details.until}</div>
          )}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}

      {/* Details panel */}
      {showDetails && details && isHovering && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          <div className="flex items-center gap-2 mb-2">
            <span className={config.color}>{config.icon}</span>
            <span className={`font-medium ${config.color}`}>{config.label}</span>
          </div>
          {details.reason && (
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              <span className="font-medium">Reason:</span> {details.reason}
            </div>
          )}
          {details.since && (
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              <span className="font-medium">Since:</span> {details.since}
            </div>
          )}
          {details.until && (
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              <span className="font-medium">Until:</span> {details.until}
            </div>
          )}
          {details.by && (
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              <span className="font-medium">By:</span> {details.by}
            </div>
          )}
          {details.notes && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">Notes:</span> {details.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Status badge group component
export function UserStatusBadgeGroup({
  statuses,
  size = 'md',
  variant = 'soft',
  className = '',
  max = 3,
}: {
  statuses: Array<{ status: UserStatus; label?: string }>;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'solid' | 'outline' | 'soft' | 'dot';
  className?: string;
  max?: number;
}) {
  const visibleStatuses = statuses.slice(0, max);
  const extraCount = statuses.length - visibleStatuses.length;
  
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {visibleStatuses.map((statusItem, index) => (
        <UserStatusBadge
          key={index}
          status={statusItem.status}
          size={size}
          variant={variant}
          showLabel={true}
        />
      ))}
      {extraCount > 0 && (
        <span className={`px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full`}>
          +{extraCount} more
        </span>
      )}
    </div>
  );
}

// Editable status badge component
export function EditableUserStatusBadge({
  status,
  onStatusChange,
  availableStatuses,
  size = 'md',
  variant = 'soft',
  className = '',
}: {
  status: UserStatus;
  onStatusChange: (newStatus: UserStatus) => void;
  availableStatuses?: UserStatus[];
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'solid' | 'outline' | 'soft' | 'dot';
  className?: string;
}) {
  return (
    <UserStatusBadge
      status={status}
      size={size}
      variant={variant}
      editable
      showDropdown
      onStatusChange={onStatusChange}
      availableStatuses={availableStatuses}
      className={className}
    />
  );
}

// Status indicator dot component
export function UserStatusDot({
  status,
  size = 'md',
  className = '',
  showTooltip = false,
}: {
  status: UserStatus;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  showTooltip?: boolean;
}) {
  return (
    <UserStatusBadge
      status={status}
      size={size}
      variant="dot"
      showLabel={false}
      showTooltip={showTooltip}
      className={className}
    />
  );
}

export default UserStatusBadge;
