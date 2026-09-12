'use client';

import { useUser, useAuth } from '@clerk/nextjs';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '../../../../hooks/useToast';
import { useThemeStore } from '../../../stores/themeStore';

export default function SettingsPage() {
  const { user } = useUser();
  const { signOut } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const { isDark, toggleTheme } = useThemeStore();
  const [notifications, setNotifications] = useState(true);
  const [emailUpdates, setEmailUpdates] = useState(true);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
      showToast('Failed to sign out', 'error');
    }
  };

  const handleSaveSettings = () => {
    showToast('Settings saved successfully!', 'success');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 transition-colors duration-200">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your account and preferences.
          </p>
        </div>

        <div className="space-y-6">
          {/* Profile Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 transition-colors duration-200">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Profile Information
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Name
                </label>
                <p className="mt-1 text-gray-900 dark:text-white">
                  {user?.firstName} {user?.lastName}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email
                </label>
                <p className="mt-1 text-gray-900 dark:text-white">
                  {user?.emailAddresses[0]?.emailAddress}
                </p>
              </div>
              <button
                onClick={() => showToast('Edit profile coming soon', 'info')}
                className="mt-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium transition-colors"
              >
                Edit Profile →
              </button>
            </div>
          </div>

          {/* Preferences */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 transition-colors duration-200">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Preferences
            </h3>
            <div className="space-y-4">
              {/* Dark Mode */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Dark Mode
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Switch between light and dark theme
                  </p>
                </div>
                <button
                  onClick={toggleTheme}
                  aria-label="Toggle dark mode"
                  className={`relative w-12 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${
                    isDark ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
                      isDark ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Notifications */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Notifications
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Receive push notifications
                  </p>
                </div>
                <button
                  onClick={() => setNotifications(!notifications)}
                  aria-label="Toggle notifications"
                  className={`relative w-12 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${
                    notifications ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
                      notifications ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Email Updates */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Email Updates
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Receive email notifications
                  </p>
                </div>
                <button
                  onClick={() => setEmailUpdates(!emailUpdates)}
                  aria-label="Toggle email updates"
                  className={`relative w-12 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${
                    emailUpdates ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
                      emailUpdates ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Account */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 transition-colors duration-200">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Account
            </h3>
            <div className="space-y-3">
              <button
                onClick={handleSaveSettings}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 transition-colors duration-200 font-medium"
              >
                Save Settings
              </button>
              <button
                onClick={handleSignOut}
                className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 transition-colors duration-200 font-medium"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
