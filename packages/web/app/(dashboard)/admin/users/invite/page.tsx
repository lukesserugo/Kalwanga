// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\users\invite\page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../../hooks/useAuth';
import { InviteUserModal } from '../../../../../components/users/InviteUserModal';
import { 
  ArrowLeft, Lock, Send, Users, Mail, Shield, Building,
  Loader2, AlertCircle, CheckCircle, XCircle, Info,
  TrendingUp, TrendingDown, Calendar, Clock, BarChart3
} from 'lucide-react';
import { PERMISSIONS } from '../../../../../types/permissions';
import { UserRole } from '../../../../../types/enums';
import { toast } from 'react-hot-toast';

export default function InviteUsersPage() {
  const router = useRouter();
  const { can, isSuperAdmin, isAdmin, user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    accepted: 0,
    expired: 0,
    cancelled: 0,
    acceptanceRate: 0,
  });

  const hasAccess = isSuperAdmin || isAdmin || can(PERMISSIONS.USER_CREATE);

  // Load invitation stats
  useEffect(() => {
    if (hasAccess) {
      // Simulate loading stats
      setTimeout(() => {
        setStats({
          total: 24,
          pending: 5,
          accepted: 15,
          expired: 3,
          cancelled: 1,
          acceptanceRate: 62.5,
        });
        setLoading(false);
      }, 500);
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
          You don't have permission to invite users.
        </p>
        <button
          onClick={() => router.push('/admin/users')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
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
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading invitation stats...</p>
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
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Back to users"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Send className="w-6 h-6 text-blue-500" />
              Invite Users
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Send email invitations to new users to join your organization
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50 px-3 py-1.5 rounded-lg">
            <Users className="w-4 h-4" />
            <span>Invite multiple users at once</span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Invitations</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Pending</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.pending}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Accepted</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.accepted}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Acceptance Rate</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.acceptanceRate}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300">How Invitations Work</h4>
            <ul className="mt-2 space-y-1 text-sm text-blue-700 dark:text-blue-400">
              <li>• Invitations are sent via email with a unique link</li>
              <li>• Users can accept or decline the invitation</li>
              <li>• Invitations expire after the specified period</li>
              <li>• You can resend or cancel invitations at any time</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Recent Invitations */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Invitations</h3>
          <button className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400">
            View All
          </button>
        </div>
        <div className="space-y-3">
          {[
            { email: 'john.doe@example.com', role: 'Manager', status: 'pending', date: '2 hours ago' },
            { email: 'jane.smith@example.com', role: 'Editor', status: 'accepted', date: '1 day ago' },
            { email: 'bob.wilson@example.com', role: 'Viewer', status: 'expired', date: '3 days ago' },
          ].map((invitation, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${
                  invitation.status === 'pending' ? 'bg-yellow-500' :
                  invitation.status === 'accepted' ? 'bg-green-500' :
                  'bg-red-500'
                }`} />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{invitation.email}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                      {invitation.role}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      invitation.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                      invitation.status === 'accepted' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                      'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {invitation.status.charAt(0).toUpperCase() + invitation.status.slice(1)}
                    </span>
                  </div>
                </div>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">{invitation.date}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Invite Modal */}
      <InviteUserModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          router.push('/admin/users');
        }}
        availableRoles={[
          { value: UserRole.SUPER_ADMIN, label: 'Super Admin', description: 'Full system access' },
          { value: UserRole.ADMIN, label: 'Admin', description: 'Administrative access' },
          { value: UserRole.MANAGER, label: 'Manager', description: 'Manage teams and operations' },
          { value: UserRole.EDITOR, label: 'Editor', description: 'Create and edit content' },
          { value: UserRole.VIEWER, label: 'Viewer', description: 'Read-only access' },
          { value: UserRole.EMPLOYEE, label: 'Employee', description: 'Basic employee access' },
          { value: UserRole.CASHIER, label: 'Cashier', description: 'POS and transactions' },
          { value: UserRole.USER, label: 'User', description: 'Basic user access' },
        ]}
        defaultRole={UserRole.USER}
      />
    </div>
  );
}
