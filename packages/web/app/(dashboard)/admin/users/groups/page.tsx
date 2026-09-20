// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\users\groups\page.tsx

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../../hooks/useAuth';
import { UserGroupManager } from '../../../../../components/users/UserGroupManager';
import {
  ArrowLeft, Lock, UsersRound, Plus, Search,
  RefreshCw, Loader2, AlertCircle, Filter,
  ChevronDown, ChevronUp, Grid, List,
  Download, Upload, Settings, Trash2
} from 'lucide-react';
import { PERMISSIONS } from '../../../../../types/permissions';
import { toast } from 'react-hot-toast';

export default function GroupsManagementPage() {
  const router = useRouter();
  const { can, isSuperAdmin, isAdmin, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  const hasAccess = isSuperAdmin || isAdmin || can(PERMISSIONS.USER_MANAGE);

  useEffect(() => {
    if (hasAccess) {
      setLoading(false);
    }
  }, [hasAccess]);

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to manage user groups.
        </p>
        <button
          onClick={() => router.push('/admin/users')}
          className="mt-4 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors flex items-center gap-2 focus-ring"
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
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading groups...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/admin/users')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
            aria-label="Back to users"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <UsersRound className="w-6 h-6 text-brand-500" />
              User Groups
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Manage user groups, assign members, and configure permissions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring"
            title={viewMode === 'grid' ? 'List view' : 'Grid view'}
          >
            {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
          </button>
          <button
            onClick={() => toast.success('Groups refreshed')}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card-brand p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-100 dark:bg-brand-900/30 rounded-lg">
              <UsersRound className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Groups</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">0</p>
            </div>
          </div>
        </div>
        <div className="card-brand p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success-100 dark:bg-success-900/30 rounded-lg">
              <UsersRound className="w-5 h-5 text-success-600 dark:text-success-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Members</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">0</p>
            </div>
          </div>
        </div>
        <div className="card-brand p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success-100 dark:bg-success-900/30 rounded-lg">
              <CheckCircle className="w-5 h-5 text-success-600 dark:text-success-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Active Groups</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">0</p>
            </div>
          </div>
        </div>
        <div className="card-brand p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning-100 dark:bg-warning-900/30 rounded-lg">
              <Shield className="w-5 h-5 text-warning-600 dark:text-warning-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Permissions</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">0</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="card-brand p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>
          <button className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Group Manager */}
      <UserGroupManager />
    </div>
  );
}

// Missing imports
import { CheckCircle, Shield } from 'lucide-react';
