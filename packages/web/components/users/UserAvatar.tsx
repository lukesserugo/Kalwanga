// D:\Projects\Kalwanga\packages\web\components\users\UserAvatar.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import { toast } from 'react-hot-toast';
import { 
  User, Camera, Upload, X, Check, Loader2, 
  AlertCircle, CheckCircle, XCircle, Star, Heart,
  Crown, Shield, BadgeCheck, Users, UserCheck,
  UserX, UserPlus, UserCog, UserCircle, UserSquare,
  UserRound, UserRoundCheck, UserRoundCog, UserRoundPlus,
  UsersRound, Key, Lock, Unlock, Eye, EyeOff,
  Trash2, Edit, RefreshCw, MoreVertical, Info,
  AlertTriangle, Zap, Sparkles, Award, Medal,
  Trophy, Target, Crosshair, // ✅ Removed Aim, Bullseye
  CreditCard // ✅ Added missing CreditCard import
} from 'lucide-react';
import { UserRole } from '../../types/enums';

interface UserAvatarProps {
  userId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  avatarUrl?: string;
  role?: UserRole;
  isActive?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  shape?: 'circle' | 'square' | 'rounded';
  showStatus?: boolean;
  status?: 'online' | 'offline' | 'away' | 'busy' | 'invisible';
  showRoleBadge?: boolean;
  showUploadButton?: boolean;
  editable?: boolean;
  onAvatarChange?: (avatarUrl: string) => void;
  onAvatarRemove?: () => void;
  onAvatarUpload?: (file: File) => Promise<string>;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  alt?: string;
  priority?: boolean;
  loading?: 'lazy' | 'eager';
  showTooltip?: boolean;
  tooltipContent?: React.ReactNode;
  showInitials?: boolean;
  initialsClassName?: string;
  showBorder?: boolean;
  borderColor?: string;
  showShadow?: boolean;
  showOnlineIndicator?: boolean;
  onlineIndicatorColor?: string;
  showVerifiedBadge?: boolean;
  isVerified?: boolean;
  showPremiumBadge?: boolean;
  isPremium?: boolean;
  groupAvatar?: boolean;
  groupMembers?: Array<{ id: string; firstName?: string; lastName?: string; avatarUrl?: string }>;
  maxGroupMembers?: number;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

const SIZE_MAP: Record<string, string> = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-16 h-16 text-xl',
  '2xl': 'w-24 h-24 text-2xl',
};

const SHAPE_MAP: Record<string, string> = {
  circle: 'rounded-full',
  square: 'rounded-none',
  rounded: 'rounded-lg',
};

const STATUS_COLORS: Record<string, string> = {
  online: 'bg-green-500',
  offline: 'bg-gray-400',
  away: 'bg-yellow-500',
  busy: 'bg-red-500',
  invisible: 'bg-gray-300',
};

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-500',
  ADMIN: 'bg-red-500',
  MANAGER: 'bg-blue-500',
  EDITOR: 'bg-green-500',
  VIEWER: 'bg-gray-500',
  EMPLOYEE: 'bg-cyan-500',
  CASHIER: 'bg-yellow-500',
  USER: 'bg-gray-400',
};

const ROLE_ICONS: Record<string, React.ReactNode> = {
  SUPER_ADMIN: <Crown className="w-3 h-3" />,
  ADMIN: <Shield className="w-3 h-3" />,
  MANAGER: <Users className="w-3 h-3" />,
  EDITOR: <Edit className="w-3 h-3" />,
  VIEWER: <Eye className="w-3 h-3" />,
  EMPLOYEE: <UserCheck className="w-3 h-3" />,
  CASHIER: <CreditCard className="w-3 h-3" />,
  USER: <User className="w-3 h-3" />,
};

export function UserAvatar({
  userId,
  firstName = '',
  lastName = '',
  email = '',
  avatarUrl,
  role,
  isActive = true,
  size = 'md',
  shape = 'circle',
  showStatus = false,
  status = 'offline',
  showRoleBadge = false,
  showUploadButton = false,
  editable = false,
  onAvatarChange,
  onAvatarRemove,
  onAvatarUpload,
  className = '',
  style,
  title,
  alt,
  priority = false,
  loading = 'lazy',
  showTooltip = false,
  tooltipContent,
  showInitials = true,
  initialsClassName = '',
  showBorder = false,
  borderColor = 'border-white dark:border-gray-800',
  showShadow = true,
  showOnlineIndicator = false,
  onlineIndicatorColor,
  showVerifiedBadge = false,
  isVerified = false,
  showPremiumBadge = false,
  isPremium = false,
  groupAvatar = false,
  groupMembers = [],
  maxGroupMembers = 3,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showUploadOverlay, setShowUploadOverlay] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isHovering, setIsHovering] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);

  // Reset image error when avatarUrl changes
  useEffect(() => {
    setImageError(false);
    setPreviewUrl(avatarUrl || '');
  }, [avatarUrl]);

  // Get initials from name
  const getInitials = useCallback(() => {
    const first = firstName?.charAt(0)?.toUpperCase() || '';
    const last = lastName?.charAt(0)?.toUpperCase() || '';
    
    if (first || last) {
      return `${first}${last}`;
    }
    
    // Fallback to email initial
    if (email) {
      return email.charAt(0).toUpperCase();
    }
    
    return '?';
  }, [firstName, lastName, email]);

  // Get display name
  const getDisplayName = useCallback(() => {
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    }
    if (firstName) return firstName;
    if (lastName) return lastName;
    if (email) return email;
    return 'Unknown User';
  }, [firstName, lastName, email]);

  // Get size class
  const getSizeClass = useCallback(() => {
    return SIZE_MAP[size] || SIZE_MAP.md;
  }, [size]);

  // Get shape class
  const getShapeClass = useCallback(() => {
    return SHAPE_MAP[shape] || SHAPE_MAP.circle;
  }, [shape]);

  // Get status color
  const getStatusColor = useCallback(() => {
    return onlineIndicatorColor || STATUS_COLORS[status] || STATUS_COLORS.offline;
  }, [status, onlineIndicatorColor]);

  // Get status size
  const getStatusSize = useCallback(() => {
    const sizeMap: Record<string, string> = {
      xs: 'w-1.5 h-1.5',
      sm: 'w-2 h-2',
      md: 'w-2.5 h-2.5',
      lg: 'w-3 h-3',
      xl: 'w-3.5 h-3.5',
      '2xl': 'w-4 h-4',
    };
    return sizeMap[size] || sizeMap.md;
  }, [size]);

  // Get role badge size
  const getRoleBadgeSize = useCallback(() => {
    const sizeMap: Record<string, string> = {
      xs: 'w-3 h-3',
      sm: 'w-4 h-4',
      md: 'w-5 h-5',
      lg: 'w-6 h-6',
      xl: 'w-7 h-7',
      '2xl': 'w-8 h-8',
    };
    return sizeMap[size] || sizeMap.md;
  }, [size]);

  // Handle file upload
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);

      // Create local preview
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreviewUrl(event.target?.result as string);
        setUploadProgress(50);
      };
      reader.readAsDataURL(file);

      // Upload via provided callback or simulate
      if (onAvatarUpload) {
        const url = await onAvatarUpload(file);
        setPreviewUrl(url);
        setUploadProgress(100);
        onAvatarChange?.(url);
        toast.success('Avatar uploaded successfully');
      } else {
        // Simulate upload
        await new Promise(resolve => setTimeout(resolve, 1000));
        setUploadProgress(100);
        onAvatarChange?.(previewUrl);
        toast.success('Avatar updated successfully');
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Failed to upload avatar:', error);
      toast.error(error?.message || 'Failed to upload avatar');
      setImageError(true);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [onAvatarUpload, onAvatarChange, previewUrl]);

  // Handle avatar remove
  const handleRemove = useCallback(() => {
    setPreviewUrl('');
    setImageError(true);
    onAvatarRemove?.();
    onAvatarChange?.('');
    toast.success('Avatar removed');
  }, [onAvatarRemove, onAvatarChange]);

  // Handle click
  const handleClick = useCallback(() => {
    if (editable && showUploadButton) {
      fileInputRef.current?.click();
    }
    onClick?.();
  }, [editable, showUploadButton, onClick]);

  // Get role color
  const getRoleColor = useCallback(() => {
    return ROLE_COLORS[role || 'USER'] || ROLE_COLORS.USER;
  }, [role]);

  // Get role icon
  const getRoleIcon = useCallback(() => {
    return ROLE_ICONS[role || 'USER'] || ROLE_ICONS.USER;
  }, [role]);

  // Render group avatar
  if (groupAvatar && groupMembers.length > 0) {
    const visibleMembers = groupMembers.slice(0, maxGroupMembers);
    const extraCount = groupMembers.length - visibleMembers.length;
    
    return (
      <div
        ref={avatarRef}
        className={`relative inline-flex items-center justify-center ${getSizeClass()} ${className}`}
        style={style}
        title={title || getDisplayName()}
        onClick={handleClick}
        onMouseEnter={() => {
          setIsHovering(true);
          onMouseEnter?.();
        }}
        onMouseLeave={() => {
          setIsHovering(false);
          onMouseLeave?.();
        }}
      >
        <div className="relative w-full h-full">
          {visibleMembers.map((member, index) => {
            const memberInitials = `${member.firstName?.charAt(0) || ''}${member.lastName?.charAt(0) || ''}`.toUpperCase();
            const offset = index * (100 / Math.min(maxGroupMembers, 3));
            
            return (
              <div
                key={member.id}
                className={`absolute ${getShapeClass()} overflow-hidden border-2 ${borderColor} ${showShadow ? 'shadow-sm' : ''}`}
                style={{
                  width: '60%',
                  height: '60%',
                  left: index === 0 ? '0%' : index === 1 ? '40%' : '20%',
                  top: index === 0 ? '0%' : index === 1 ? '0%' : '40%',
                  zIndex: visibleMembers.length - index,
                }}
                title={`${member.firstName} ${member.lastName}`}
              >
                {member.avatarUrl && !imageError ? (
                  <Image
                    src={member.avatarUrl}
                    alt={`${member.firstName} ${member.lastName}`}
                    fill
                    className="object-cover"
                    onError={() => setImageError(true)}
                    priority={priority}
                    loading={loading}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-500 text-white font-medium" style={{ fontSize: '0.6em' }}>
                    {memberInitials || '?'}
                  </div>
                )}
              </div>
            );
          })}
          
          {extraCount > 0 && (
            <div
              className="absolute bottom-0 right-0 rounded-full bg-gray-600 text-white flex items-center justify-center border-2 border-white dark:border-gray-800"
              style={{
                width: '40%',
                height: '40%',
                fontSize: '0.5em',
                zIndex: visibleMembers.length + 1,
              }}
            >
              +{extraCount}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={avatarRef}
      className={`relative inline-flex ${getSizeClass()} ${className}`}
      style={style}
      title={title || getDisplayName()}
      onClick={handleClick}
      onMouseEnter={() => {
        setIsHovering(true);
        onMouseEnter?.();
      }}
      onMouseLeave={() => {
        setIsHovering(false);
        onMouseLeave?.();
      }}
    >
      {/* Hidden file input */}
      {editable && showUploadButton && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
      )}

      {/* Main avatar container */}
      <div
        className={`w-full h-full ${getShapeClass()} overflow-hidden ${
          showBorder ? `border-2 ${borderColor}` : ''
        } ${showShadow ? 'shadow-md' : ''} ${
          editable && showUploadButton ? 'cursor-pointer' : ''
        }`}
      >
        {/* Avatar image or initials */}
        {previewUrl && !imageError ? (
          <div className="relative w-full h-full">
            <Image
              src={previewUrl}
              alt={alt || getDisplayName()}
              fill
              className="object-cover"
              onError={() => setImageError(true)}
              priority={priority}
              loading={loading}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          </div>
        ) : (
          <div
            className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-500 text-white font-semibold ${
              initialsClassName || ''
            }`}
          >
            {showInitials ? getInitials() : <User className="w-1/2 h-1/2" />}
          </div>
        )}

        {/* Upload overlay */}
        {isHovering && editable && showUploadButton && !isUploading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity">
            <Camera className="w-1/3 h-1/3 text-white" />
          </div>
        )}

        {/* Upload progress overlay */}
        {isUploading && (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
            <Loader2 className="w-1/3 h-1/3 text-white animate-spin" />
            <span className="text-white text-xs mt-1">{uploadProgress}%</span>
          </div>
        )}
      </div>

      {/* Status indicator */}
      {showStatus && (
        <span
          className={`absolute bottom-0 right-0 ${getStatusSize()} ${getStatusColor()} rounded-full border-2 border-white dark:border-gray-800`}
          title={status}
        />
      )}

      {/* Online indicator */}
      {showOnlineIndicator && (
        <span
          className={`absolute top-0 right-0 ${getStatusSize()} ${getStatusColor()} rounded-full border-2 border-white dark:border-gray-800 animate-pulse`}
        />
      )}

      {/* Role badge */}
      {showRoleBadge && role && (
        <span
          className={`absolute -bottom-1 -right-1 ${getRoleBadgeSize()} ${getRoleColor()} rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center text-white`}
          title={role.replace('_', ' ')}
        >
          {getRoleIcon()}
        </span>
      )}

      {/* Verified badge */}
      {showVerifiedBadge && isVerified && (
        <span
          className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center"
          title="Verified"
        >
          <BadgeCheck className="w-2.5 h-2.5 text-white" />
        </span>
      )}

      {/* Premium badge */}
      {showPremiumBadge && isPremium && (
        <span
          className="absolute -top-1 -left-1 w-4 h-4 bg-yellow-500 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center"
          title="Premium"
        >
          <Star className="w-2.5 h-2.5 text-white" />
        </span>
      )}

      {/* Remove button */}
      {editable && showUploadButton && previewUrl && isHovering && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleRemove();
          }}
          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center hover:bg-red-600 transition-colors"
          title="Remove avatar"
        >
          <X className="w-3 h-3 text-white" />
        </button>
      )}

      {/* Tooltip */}
      {showTooltip && isHovering && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50">
          {tooltipContent || getDisplayName()}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}

// Avatar group component
export function UserAvatarGroup({
  users,
  max = 5,
  size = 'md',
  shape = 'circle',
  showStatus = false,
  showTooltip = false,
  className = '',
  onUserClick,
}: {
  users: Array<{
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    avatarUrl?: string;
    role?: UserRole;
    isActive?: boolean;
    status?: 'online' | 'offline' | 'away' | 'busy' | 'invisible';
  }>;
  max?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  shape?: 'circle' | 'square' | 'rounded';
  showStatus?: boolean;
  showTooltip?: boolean;
  className?: string;
  onUserClick?: (user: any) => void;
}) {
  const visibleUsers = users.slice(0, max);
  const extraCount = users.length - visibleUsers.length;
  
  return (
    <div className={`flex items-center -space-x-2 ${className}`}>
      {visibleUsers.map((user, index) => (
        <UserAvatar
          key={user.id}
          firstName={user.firstName}
          lastName={user.lastName}
          email={user.email}
          avatarUrl={user.avatarUrl}
          role={user.role}
          isActive={user.isActive}
          size={size}
          shape={shape}
          showStatus={showStatus}
          status={user.status}
          showTooltip={showTooltip}
          tooltipContent={`${user.firstName} ${user.lastName}`}
          className="ring-2 ring-white dark:ring-gray-800"
          onClick={() => onUserClick?.(user)}
        />
      ))}
      {extraCount > 0 && (
        <div
          className={`${SIZE_MAP[size]} ${SHAPE_MAP[shape]} bg-gray-500 text-white flex items-center justify-center text-xs font-medium ring-2 ring-white dark:ring-gray-800 cursor-pointer`}
          title={`${extraCount} more`}
        >
          +{extraCount}
        </div>
      )}
    </div>
  );
}

// Avatar with online status component
export function UserAvatarWithStatus({
  firstName,
  lastName,
  email,
  avatarUrl,
  role,
  isActive = true,
  status = 'online',
  size = 'md',
  shape = 'circle',
  showTooltip = true,
  className = '',
  onClick,
}: {
  firstName?: string;
  lastName?: string;
  email?: string;
  avatarUrl?: string;
  role?: UserRole;
  isActive?: boolean;
  status?: 'online' | 'offline' | 'away' | 'busy' | 'invisible';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  shape?: 'circle' | 'square' | 'rounded';
  showTooltip?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  const statusLabels: Record<string, string> = {
    online: 'Online',
    offline: 'Offline',
    away: 'Away',
    busy: 'Busy',
    invisible: 'Invisible',
  };
  
  return (
    <UserAvatar
      firstName={firstName}
      lastName={lastName}
      email={email}
      avatarUrl={avatarUrl}
      role={role}
      isActive={isActive}
      size={size}
      shape={shape}
      showStatus
      status={status}
      showTooltip={showTooltip}
      tooltipContent={`${firstName} ${lastName} - ${statusLabels[status]}`}
      className={className}
      onClick={onClick}
    />
  );
}

// Editable avatar component
export function EditableUserAvatar({
  firstName,
  lastName,
  email,
  avatarUrl,
  role,
  isActive = true,
  size = 'lg',
  shape = 'circle',
  onAvatarChange,
  onAvatarRemove,
  onAvatarUpload,
  className = '',
}: {
  firstName?: string;
  lastName?: string;
  email?: string;
  avatarUrl?: string;
  role?: UserRole;
  isActive?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  shape?: 'circle' | 'square' | 'rounded';
  onAvatarChange?: (avatarUrl: string) => void;
  onAvatarRemove?: () => void;
  onAvatarUpload?: (file: File) => Promise<string>;
  className?: string;
}) {
  return (
    <UserAvatar
      firstName={firstName}
      lastName={lastName}
      email={email}
      avatarUrl={avatarUrl}
      role={role}
      isActive={isActive}
      size={size}
      shape={shape}
      showUploadButton
      editable
      showRoleBadge={!!role}
      onAvatarChange={onAvatarChange}
      onAvatarRemove={onAvatarRemove}
      onAvatarUpload={onAvatarUpload}
      className={className}
    />
  );
}

export default UserAvatar;
