// D:\Projects\Kalwanga\packages\web\components\users\UserDetailTabs.tsx

'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  User, Shield, Key, Activity, Settings, 
  Users, Building, FileText, Clock, Mail,
  Phone, Calendar, Info, Edit, Trash2,
  UserCheck, UserX, Lock, Unlock
} from 'lucide-react';

interface TabItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  badge?: number;
}

interface UserDetailTabsProps {
  userId: string;
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  className?: string;
}

export function UserDetailTabs({ 
  userId, 
  activeTab = 'overview',
  onTabChange,
  className = ''
}: UserDetailTabsProps) {
  const router = useRouter();
  const pathname = usePathname();

  const tabs: TabItem[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <Info className="w-4 h-4" />,
      href: `/admin/users/${userId}`,
    },
    {
      id: 'permissions',
      label: 'Permissions',
      icon: <Key className="w-4 h-4" />,
      href: `/admin/users/${userId}/permissions`,
    },
    {
      id: 'activity',
      label: 'Activity',
      icon: <Activity className="w-4 h-4" />,
      href: `/admin/users/${userId}/activity`,
      badge: 5,
    },
    {
      id: 'groups',
      label: 'Groups',
      icon: <Users className="w-4 h-4" />,
      href: `/admin/users/${userId}/groups`,
    },
    {
      id: 'business-units',
      label: 'Business Units',
      icon: <Building className="w-4 h-4" />,
      href: `/admin/users/${userId}/business-units`,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="w-4 h-4" />,
      href: `/admin/users/${userId}/settings`,
    },
  ];

  const handleTabClick = (tab: TabItem) => {
    if (onTabChange) {
      onTabChange(tab.id);
    }
    router.push(tab.href);
  };

  // Determine active tab from pathname if not provided
  const getActiveTab = () => {
    if (activeTab) return activeTab;
    
    const path = pathname || '';
    if (path.includes('/permissions')) return 'permissions';
    if (path.includes('/activity')) return 'activity';
    if (path.includes('/groups')) return 'groups';
    if (path.includes('/business-units')) return 'business-units';
    if (path.includes('/settings')) return 'settings';
    return 'overview';
  };

  const currentActive = getActiveTab();

  return (
    <div className={`border-b border-gray-200 dark:border-gray-700 ${className}`}>
      <nav className="flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = currentActive === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 ${
                isActive
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                  isActive
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default UserDetailTabs;
