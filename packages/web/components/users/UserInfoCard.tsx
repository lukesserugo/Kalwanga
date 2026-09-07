// D:\Projects\Kalwanga\packages\web\components\users\UserInfoCard.tsx

'use client';

import React from 'react';
import { 
  Mail, Phone, Building, Calendar, Clock, 
  MapPin, Globe, Link2, User, Briefcase,
  Hash, Copy, Check, Shield, Users, UserCheck,
  UserX, BadgeCheck, AlertCircle, Star, Heart
} from 'lucide-react';
import { UserAvatar } from './UserAvatar';
import { UserStatusBadge } from './UserStatusBadge';
import { UserRole } from '../../types/enums';

interface UserInfoCardProps {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber?: string;
    role: UserRole;
    isActive: boolean;
    avatar?: string;
    createdAt: string;
    lastLoginAt?: string;
    company?: {
      id: string;
      name: string;
    };
    businessUnits?: Array<{
      id: string;
      name: string;
      code: string;
    }>;
    permissions?: string[];
  };
  onCopy?: () => void;
  className?: string;
}

export function UserInfoCard({ user, onCopy, className = '' }: UserInfoCardProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    if (onCopy) {
      onCopy();
    } else {
      navigator.clipboard.writeText(user.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getFullName = () => {
    return `${user.firstName} ${user.lastName}`.trim() || user.email;
  };

  const getInitials = () => {
    return `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || '?';
  };

  const getRoleLabel = (role: string) => {
    return role.replace('_', ' ');
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

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

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}>
      {/* Header with Avatar */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <UserAvatar
            firstName={user.firstName}
            lastName={user.lastName}
            email={user.email}
            avatarUrl={user.avatar}
            role={user.role}
            isActive={user.isActive}
            size="lg"
            showRoleBadge
            showStatus
            status={user.isActive ? 'online' : 'offline'}
          />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                {getFullName()}
              </h3>
              {user.isActive ? (
                <BadgeCheck className="w-5 h-5 text-blue-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-500" />
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Mail className="w-4 h-4" />
                {user.email}
              </span>
              <button
                onClick={handleCopy}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-gray-400" />}
              </button>
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <UserStatusBadge 
                status={user.isActive ? 'active' : 'inactive'} 
                size="sm"
                showLabel
              />
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                {getRoleLabel(user.role)}
              </span>
              {user.permissions && user.permissions.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-400">
                  {user.permissions.length} permissions
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* User Details */}
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Contact Information */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Contact Information</h4>
            {user.phoneNumber && (
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <Phone className="w-4 h-4 text-gray-400" />
                <span>{user.phoneNumber}</span>
              </div>
            )}
            {user.company && (
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <Building className="w-4 h-4 text-gray-400" />
                <span>{user.company.name}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <Hash className="w-4 h-4 text-gray-400" />
              <span className="font-mono text-xs">ID: {user.id.slice(0, 12)}...</span>
            </div>
          </div>

          {/* Account Information */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Account Information</h4>
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span>Joined: {formatDate(user.createdAt)}</span>
            </div>
            {user.lastLoginAt && (
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <Clock className="w-4 h-4 text-gray-400" />
                <span>Last login: {getTimeAgo(user.lastLoginAt)}</span>
              </div>
            )}
            {user.businessUnits && user.businessUnits.length > 0 && (
              <div className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <Building className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium">Business Units:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {user.businessUnits.map((bu) => (
                      <span key={bu.id} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">
                        {bu.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Role Badge */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm">
            <Shield className="w-4 h-4 text-gray-400" />
            <span className="text-gray-500 dark:text-gray-400">Role:</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              user.role === 'SUPER_ADMIN' 
                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                : user.role === 'ADMIN'
                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                : user.role === 'MANAGER'
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-400'
            }`}>
              {getRoleLabel(user.role)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserInfoCard;
