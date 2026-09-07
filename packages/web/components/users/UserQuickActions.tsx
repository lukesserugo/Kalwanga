// D:\Projects\Kalwanga\packages\web\components\users\UserQuickActions.tsx

'use client';

import React from 'react';
import { 
  Mail, Send, Edit, Trash2, UserCheck, UserX,
  Key, Shield, Activity, Copy, Check, Download,
  Printer, FileText, Settings, UserPlus, UserMinus,
  Lock, Unlock, RefreshCw, MoreVertical
} from 'lucide-react';
import { PermissionGuard } from '../common/PermissionGuard';
import { PERMISSIONS } from '../../types/permissions';

interface UserQuickActionsProps {
  userId: string;
  isActive?: boolean;
  isSuperAdmin?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onActivate?: () => void;
  onDeactivate?: () => void;
  onCopyId?: () => void;
  onExport?: () => void;
  onSendInvite?: () => void;
  onViewPermissions?: () => void;
  onViewActivity?: () => void;
  className?: string;
}

export function UserQuickActions({
  userId,
  isActive = true,
  isSuperAdmin = false,
  onEdit,
  onDelete,
  onActivate,
  onDeactivate,
  onCopyId,
  onExport,
  onSendInvite,
  onViewPermissions,
  onViewActivity,
  className = '',
}: UserQuickActionsProps) {
  const [showMore, setShowMore] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const handleCopyId = () => {
    if (onCopyId) {
      onCopyId();
    } else {
      navigator.clipboard.writeText(userId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {/* Primary Actions */}
      <PermissionGuard permission={PERMISSIONS.USER_EDIT}>
        <button
          onClick={onEdit}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
        >
          <Edit className="w-4 h-4" />
          Edit
        </button>
      </PermissionGuard>

      {onSendInvite && (
        <button
          onClick={onSendInvite}
          className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm"
        >
          <Send className="w-4 h-4" />
          Invite
        </button>
      )}

      {!isSuperAdmin && (
        <PermissionGuard permission={PERMISSIONS.USER_EDIT}>
          {isActive ? (
            <button
              onClick={onDeactivate}
              className="px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors flex items-center gap-2 text-sm"
            >
              <UserX className="w-4 h-4" />
              Deactivate
            </button>
          ) : (
            <button
              onClick={onActivate}
              className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm"
            >
              <UserCheck className="w-4 h-4" />
              Activate
            </button>
          )}
        </PermissionGuard>
      )}

      {!isSuperAdmin && (
        <PermissionGuard permission={PERMISSIONS.USER_DELETE}>
          <button
            onClick={onDelete}
            className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 text-sm"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </PermissionGuard>
      )}

      {/* More Actions Dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowMore(!showMore)}
          className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <MoreVertical className="w-4 h-4 text-gray-500" />
        </button>

        {showMore && (
          <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10 py-1">
            <button
              onClick={handleCopyId}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy ID'}
            </button>

            {onViewPermissions && (
              <button
                onClick={onViewPermissions}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
              >
                <Key className="w-4 h-4" />
                View Permissions
              </button>
            )}

            {onViewActivity && (
              <button
                onClick={onViewActivity}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
              >
                <Activity className="w-4 h-4" />
                View Activity
              </button>
            )}

            {onExport && (
              <button
                onClick={onExport}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
              >
                <Download className="w-4 h-4" />
                Export Data
              </button>
            )}

            <hr className="my-1 border-gray-200 dark:border-gray-700" />

            <button
              className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>

            <button
              className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default UserQuickActions;
