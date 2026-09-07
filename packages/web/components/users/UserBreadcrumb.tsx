// D:\Projects\Kalwanga\packages\web\components\users\UserBreadcrumb.tsx

'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ChevronRight, Users } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

export function UserBreadcrumb() {
  const pathname = usePathname();
  
  const getBreadcrumbs = (): BreadcrumbItem[] => {
    const paths = pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [];
    
    // Always include home
    breadcrumbs.push({
      label: 'Home',
      href: '/dashboard',
      icon: <Home className="w-4 h-4" />,
    });
    
    // Build breadcrumbs from path
    let currentPath = '';
    for (let i = 0; i < paths.length; i++) {
      const segment = paths[i];
      currentPath += `/${segment}`;
      
      let label = segment.charAt(0).toUpperCase() + segment.slice(1);
      
      // Special handling for user IDs
      if (segment === 'users' && i === paths.length - 1) {
        label = 'User Management';
      } else if (segment === 'users' && i < paths.length - 1) {
        // Check if next segment is an ID
        const nextSegment = paths[i + 1];
        if (nextSegment && !['add', 'import', 'invite', 'groups', 'roles', 'settings'].includes(nextSegment)) {
          label = 'Users';
        }
      } else if (segment === 'add') {
        label = 'Add User';
      } else if (segment === 'import') {
        label = 'Import Users';
      } else if (segment === 'invite') {
        label = 'Invite Users';
      } else if (segment === 'groups') {
        label = 'Groups';
      } else if (segment === 'roles') {
        label = 'Roles';
      } else if (segment === 'settings') {
        label = 'Settings';
      } else if (segment === 'permissions') {
        label = 'Permissions';
      } else if (segment === 'activity') {
        label = 'Activity';
      } else if (segment === 'edit') {
        label = 'Edit';
      } else if (segment.match(/^[a-zA-Z0-9_-]+$/)) {
        // This is likely an ID
        label = 'User Details';
        // Check if there are more segments after
        if (i < paths.length - 1) {
          const nextSegment = paths[i + 1];
          if (nextSegment === 'edit') {
            label = 'Edit User';
          } else if (nextSegment === 'permissions') {
            label = 'User Permissions';
          } else if (nextSegment === 'activity') {
            label = 'User Activity';
          }
        }
      }
      
      breadcrumbs.push({
        label,
        href: currentPath,
      });
    }
    
    return breadcrumbs;
  };
  
  const breadcrumbs = getBreadcrumbs();
  
  return (
    <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 overflow-x-auto py-2">
      {breadcrumbs.map((item, index) => (
        <React.Fragment key={item.href}>
          {index > 0 && <ChevronRight className="w-4 h-4 flex-shrink-0" />}
          {index === breadcrumbs.length - 1 ? (
            <span className="text-gray-900 dark:text-white font-medium whitespace-nowrap">
              {item.icon && <span className="inline-flex items-center gap-1">{item.icon} {item.label}</span>}
              {!item.icon && item.label}
            </span>
          ) : (
            <Link
              href={item.href}
              className="hover:text-gray-700 dark:hover:text-gray-300 whitespace-nowrap flex items-center gap-1"
            >
              {item.icon && item.icon}
              {item.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

export default UserBreadcrumb;
