// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\users\import\page.tsx

'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../../hooks/useAuth';
import { userService } from '../../../../../services/userService';
import { toast } from 'react-hot-toast';
import {
  ArrowLeft, Upload, Download, FileSpreadsheet, FileText,
  Loader2, AlertCircle, CheckCircle, XCircle, Save,
  RefreshCw, Copy, Check, X, Info, AlertTriangle,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Eye, EyeOff, Settings, Users, User, Building,
  Package, FolderTree, FileText as FileIcon, DollarSign,
  ShoppingCart, ClipboardList, Truck, Boxes, Layers,
  Store, Globe, Hash, Tag, Star, Heart, ThumbsUp,
  MessageSquare, Share2, Bookmark, FileDown, FileJson,
  MoreVertical, SlidersHorizontal, BarChart3, TrendingUp,
  PieChart, Activity, Calendar, Clock, Mail, Phone,
  Database, Server, Cloud, Wifi, Bluetooth, Battery,
  Sun, Moon, Wind, Droplet, Flame, Leaf, TreePine,
  Mountain, Waves, Compass, Map, Navigation, Route,
  Target, Crosshair, CreditCard, Percent, Printer, Send,
  Link2, Unlink, Plus, Minus, RotateCcw, History, Zap,
  Sparkles, FileUp, FilePlus, Table, List, Grid, Rows,
  Columns, Filter, SortAsc, SortDesc, Trash2,
  Edit, UserPlus, UserCheck, UserX, Shield,
  Key, Lock, Unlock, Play, Pause, StopCircle,
  SkipForward, SkipBack, FastForward, Rewind,
  StepForward, StepBack, Maximize, Minimize,
  ZoomIn, ZoomOut, Move, CopyPlus,
  ClipboardCopy, ClipboardPaste, Scissors, Eraser,
  LayoutDashboard, UsersRound, ShieldCheck, ShieldAlert,
  BadgeCheck, Ban, UserCog2, FileDigit, FileCheck,
  FileWarning, FileX, FileClock, FileSearch
} from 'lucide-react';
import { PERMISSIONS } from '../../../../../types/permissions';
import { UserRole } from '../../../../../types/enums';

// Types
interface ImportUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  role: UserRole;
  businessUnitId?: string;
  isActive: boolean;
  password?: string;
  permissions?: string[];
  companyId?: string;
  avatar?: string;
  status: 'valid' | 'invalid' | 'warning' | 'duplicate';
  errors: string[];
  warnings: string[];
  originalData: Record<string, any>;
  rowNumber?: number;
}

interface ImportSummary {
  total: number;
  valid: number;
  invalid: number;
  warnings: number;
  duplicates: number;
  readyToImport: number;
}

interface ImportTemplate {
  id: string;
  name: string;
  description: string;
  format: 'csv' | 'excel';
  headers: string[];
  exampleData: Record<string, any>[];
}

interface ImportHistory {
  id: string;
  fileName: string;
  importedAt: string;
  totalRows: number;
  successCount: number;
  failedCount: number;
  status: 'completed' | 'partial' | 'failed';
  importedBy: string;
}

// Stats Card Component
const StatsCard = ({ title, value, icon, color, subtitle }: any) => (
  <div className="card-brand p-4 hover:shadow-card-hover transition-shadow">
    <div className="flex items-center justify-between">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{title}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-lg ${color} flex-shrink-0`}>
        {icon}
      </div>
    </div>
  </div>
);

// Constants
const REQUIRED_HEADERS = ['email', 'firstName', 'lastName', 'role'];
const OPTIONAL_HEADERS = ['phoneNumber', 'businessUnitId', 'isActive', 'permissions', 'companyId', 'avatar'];

const ROLE_MAPPING: Record<string, UserRole> = {
  'SUPER_ADMIN': UserRole.SUPER_ADMIN,
  'ADMIN': UserRole.ADMIN,
  'MANAGER': UserRole.MANAGER,
  'EDITOR': UserRole.EDITOR,
  'VIEWER': UserRole.VIEWER,
  'EMPLOYEE': UserRole.EMPLOYEE,
  'CASHIER': UserRole.CASHIER,
  'USER': UserRole.USER,
  'super_admin': UserRole.SUPER_ADMIN,
  'admin': UserRole.ADMIN,
  'manager': UserRole.MANAGER,
  'editor': UserRole.EDITOR,
  'viewer': UserRole.VIEWER,
  'employee': UserRole.EMPLOYEE,
  'cashier': UserRole.CASHIER,
  'user': UserRole.USER,
};

const IMPORT_TEMPLATES: ImportTemplate[] = [
  {
    id: 'standard',
    name: 'Standard Template',
    description: 'Basic user import with essential fields',
    format: 'csv',
    headers: [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS],
    exampleData: [
      {
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'EMPLOYEE',
        phoneNumber: '+1234567890',
        isActive: 'true',
      },
      {
        email: 'jane.smith@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        role: 'MANAGER',
        phoneNumber: '+0987654321',
        isActive: 'true',
      },
    ],
  },
  {
    id: 'minimal',
    name: 'Minimal Template',
    description: 'Only required fields',
    format: 'csv',
    headers: REQUIRED_HEADERS,
    exampleData: [
      {
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'USER',
      },
    ],
  },
  {
    id: 'full',
    name: 'Full Template',
    description: 'All available fields including permissions',
    format: 'csv',
    headers: [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS, 'password'],
    exampleData: [
      {
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'MANAGER',
        phoneNumber: '+1234567890',
        businessUnitId: '1',
        isActive: 'true',
        permissions: 'user:view,inventory:view,product:view',
        companyId: '1',
      },
    ],
  },
];

export default function UserImportPage() {
  const router = useRouter();
  const { can, isSuperAdmin, isAdmin } = useAuth();

  // State management
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [importUsers, setImportUsers] = useState<ImportUser[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('standard');
  const [showPreview, setShowPreview] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importHistory, setImportHistory] = useState<ImportHistory[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<'all' | 'valid' | 'invalid' | 'warning' | 'duplicate'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showColumnMapping, setShowColumnMapping] = useState(false);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewMode, setPreviewMode] = useState<'table' | 'cards'>('table');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'email',
    direction: 'asc',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const hasAccess = isSuperAdmin || isAdmin || can(PERMISSIONS.USER_CREATE);

  // Parse CSV content
  const parseCSV = useCallback((content: string): string[][] => {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];

      if (char === '"') {
        if (inQuotes && content[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\n' && !inQuotes) {
        currentRow.push(currentField.trim());
        if (currentRow.some(field => field !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else if (char === '\r') {
        // Skip carriage return
      } else {
        currentField += char;
      }
    }

    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some(field => field !== '')) {
        rows.push(currentRow);
      }
    }

    return rows;
  }, []);

  // Validate import data
  const validateImportData = useCallback((rows: string[][], headers: string[]): ImportUser[] => {
    const users: ImportUser[] = [];
    const emailSet = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const userData: Record<string, any> = {};
      const errors: string[] = [];
      const warnings: string[] = [];

      // Map row data
      headers.forEach((header, index) => {
        if (row[index] !== undefined) {
          userData[header] = row[index];
        }
      });

      // Validate email
      const email = userData.email || '';
      if (!email) {
        errors.push('Email is required');
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push(`Invalid email format: ${email}`);
      } else if (emailSet.has(email.toLowerCase())) {
        errors.push(`Duplicate email in file: ${email}`);
      }

      if (email && !emailSet.has(email.toLowerCase())) {
        emailSet.add(email.toLowerCase());
      }

      // Validate first name
      if (!userData.firstName) {
        errors.push('First name is required');
      }

      // Validate last name
      if (!userData.lastName) {
        errors.push('Last name is required');
      }

      // Validate role
      const role = ROLE_MAPPING[userData.role] || null;
      if (!userData.role) {
        errors.push('Role is required');
      } else if (!role) {
        errors.push(`Invalid role: ${userData.role}`);
        warnings.push(`Role "${userData.role}" not recognized, defaulting to USER`);
      }

      // Validate phone (if provided)
      if (userData.phoneNumber && !/^[+]?[\d\s-()]+$/.test(userData.phoneNumber)) {
        warnings.push(`Phone number format may be invalid: ${userData.phoneNumber}`);
      }

      // Validate permissions (if provided)
      if (userData.permissions) {
        const permissions = userData.permissions.split(';').map((p: string) => p.trim());
        const validPermissions = permissions.filter((p: string) => p.includes(':'));
        if (validPermissions.length !== permissions.length) {
          warnings.push('Some permissions may be invalid');
        }
      }

      // Determine status
      let status: ImportUser['status'] = 'valid';
      if (errors.length > 0) {
        status = 'invalid';
      } else if (warnings.length > 0) {
        status = 'warning';
      }

      users.push({
        id: `import_${i}_${Date.now()}`,
        email: userData.email || '',
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        phoneNumber: userData.phoneNumber,
        role: role || UserRole.USER,
        businessUnitId: userData.businessUnitId,
        isActive: userData.isActive ? userData.isActive.toLowerCase() === 'true' : true,
        password: userData.password,
        permissions: userData.permissions ? userData.permissions.split(';').map((p: string) => p.trim()) : [],
        companyId: userData.companyId,
        avatar: userData.avatar,
        status,
        errors,
        warnings,
        originalData: userData,
        rowNumber: i + 2,
      });
    }

    return users;
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);

      setSelectedFile(file);
      setFileName(file.name);

      // Read file content
      const content = await readFileContent(file);
      setFileContent(content);

      // Parse CSV
      const rows = parseCSV(content);

      if (rows.length < 2) {
        setError('File must contain at least a header row and one data row');
        return;
      }

      const headers = rows[0];
      const dataRows = rows.slice(1);

      // Validate headers
      const missingHeaders = REQUIRED_HEADERS.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        setError(`Missing required headers: ${missingHeaders.join(', ')}`);
        return;
      }

      // Auto-map columns
      const mapping: Record<string, string> = {};
      headers.forEach(header => {
        mapping[header] = header;
      });
      setColumnMapping(mapping);

      // Validate data
      const validatedUsers = validateImportData(dataRows, headers);
      setImportUsers(validatedUsers);
      setShowPreview(true);
      setShowValidation(true);

      // Show summary
      const summary = getImportSummary(validatedUsers);
      if (summary.invalid > 0) {
        toast.error(`${summary.invalid} users have validation errors`);
      } else if (summary.valid > 0) {
        toast.success(`${summary.valid} users validated successfully`);
      }

    } catch (error: any) {
      console.error('Failed to process file:', error);
      setError(error?.message || 'Failed to process file');
      toast.error('Failed to process file');
    } finally {
      setLoading(false);
    }
  }, [parseCSV, validateImportData]);

  // Read file content
  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target?.result as string);
      };
      reader.onerror = (e) => {
        reject(new Error('Failed to read file'));
      };
      reader.readAsText(file);
    });
  };

  // Get import summary
  const getImportSummary = useCallback((users: ImportUser[]): ImportSummary => {
    const summary: ImportSummary = {
      total: users.length,
      valid: users.filter(u => u.status === 'valid').length,
      invalid: users.filter(u => u.status === 'invalid').length,
      warnings: users.filter(u => u.status === 'warning').length,
      duplicates: 0,
      readyToImport: users.filter(u => u.status === 'valid' || u.status === 'warning').length,
    };

    // Check for duplicates against existing users
    const emails = new Set(users.map(u => u.email.toLowerCase()));
    summary.duplicates = users.length - emails.size;

    return summary;
  }, []);

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (file.type === 'text/csv' || ext === 'csv' || ext === 'xlsx' || ext === 'xls') {
        handleFileUpload(file);
      } else {
        setError('Please upload a CSV or Excel file');
        toast.error('Invalid file type');
      }
    }
  }, [handleFileUpload]);

  // Handle file input change
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  // Handle import
  const handleImport = useCallback(async () => {
    const validUsers = importUsers.filter(u => u.status === 'valid' || u.status === 'warning');

    if (validUsers.length === 0) {
      setError('No valid users to import');
      toast.error('No valid users to import');
      return;
    }

    setImporting(true);
    setImportProgress(0);

    try {
      let successCount = 0;
      let failedCount = 0;

      for (let i = 0; i < validUsers.length; i++) {
        const user = validUsers[i];

        try {
          await userService.createUser({
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phoneNumber: user.phoneNumber,
            role: user.role,
            password: user.password || 'DefaultPass123!',
            businessUnitId: user.businessUnitId,
            isActive: user.isActive,
            permissions: user.permissions,
            companyId: user.companyId,
          });

          successCount++;
        } catch (error: any) {
          console.error(`Failed to import user ${user.email}:`, error);
          failedCount++;
          user.status = 'invalid';
          user.errors.push(error?.message || 'Failed to import');
        }

        // Update progress
        setImportProgress(Math.round(((i + 1) / validUsers.length) * 100));
      }

      // Update history
      const historyEntry: ImportHistory = {
        id: `history_${Date.now()}`,
        fileName,
        importedAt: new Date().toISOString(),
        totalRows: validUsers.length,
        successCount,
        failedCount,
        status: failedCount === 0 ? 'completed' : failedCount < validUsers.length ? 'partial' : 'failed',
        importedBy: 'Current User',
      };

      setImportHistory(prev => [historyEntry, ...prev]);

      if (failedCount === 0) {
        toast.success(`Successfully imported ${successCount} users`);
        setSuccessMessage(`Successfully imported ${successCount} users`);
        setTimeout(() => {
          router.push('/admin/users');
        }, 2000);
      } else if (failedCount < validUsers.length) {
        toast.error(`Imported ${successCount} users, ${failedCount} failed`);
        setError(`Imported ${successCount} users, ${failedCount} failed`);
      } else {
        toast.error('Failed to import users');
        setError('Failed to import users');
      }

      // Reset
      setImportUsers([]);
      setSelectedFile(null);
      setFileName('');
      setFileContent('');
      setShowPreview(false);
      setShowValidation(false);

    } catch (error: any) {
      console.error('Import failed:', error);
      setError(error?.message || 'Import failed');
      toast.error('Import failed');
    } finally {
      setImporting(false);
      setImportProgress(0);
    }
  }, [importUsers, fileName, router]);

  // Handle template download
  const handleDownloadTemplate = useCallback((template: ImportTemplate) => {
    try {
      const headers = template.headers;
      const exampleRows = template.exampleData;

      let csvContent = headers.join(',') + '\n';
      exampleRows.forEach(row => {
        const values = headers.map(h => row[h] || '');
        csvContent += values.join(',') + '\n';
      });

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `user_import_${template.id}_template.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`Downloaded ${template.name} template`);
    } catch (error) {
      console.error('Failed to download template:', error);
      toast.error('Failed to download template');
    }
  }, []);

  // Handle select all
  const handleSelectAll = useCallback(() => {
    if (selectedUsers.size === importUsers.length && importUsers.length > 0) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(importUsers.filter(u => u.status === 'valid' || u.status === 'warning').map(u => u.id)));
    }
  }, [selectedUsers, importUsers]);

  // Handle select user
  const handleSelectUser = useCallback((userId: string) => {
    setSelectedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  }, []);

  // Handle sort
  const handleSort = useCallback((key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  // Filter and sort users with pagination
  const filteredUsers = useMemo(() => {
    let filtered = importUsers;

    if (filterStatus !== 'all') {
      filtered = filtered.filter(u => u.status === filterStatus);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(u =>
        u.email.toLowerCase().includes(query) ||
        u.firstName.toLowerCase().includes(query) ||
        u.lastName.toLowerCase().includes(query) ||
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(query)
      );
    }

    const sorted = [...filtered].sort((a: any, b: any) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
    });

    return sorted;
  }, [importUsers, filterStatus, searchQuery, sortConfig]);

  // Paginated users
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredUsers.length / pageSize);

  // Get status badge
  const getStatusBadge = useCallback((status: ImportUser['status']) => {
    const badges = {
      valid: { icon: <CheckCircle className="w-3 h-3" />, label: 'Valid', className: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400 border-success-200 dark:border-success-700' },
      invalid: { icon: <XCircle className="w-3 h-3" />, label: 'Invalid', className: 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400 border-danger-200 dark:border-danger-700' },
      warning: { icon: <AlertTriangle className="w-3 h-3" />, label: 'Warning', className: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400 border-warning-200 dark:border-warning-700' },
      duplicate: { icon: <Copy className="w-3 h-3" />, label: 'Duplicate', className: 'bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-400 border-secondary-200 dark:border-secondary-700' },
    };

    const badge = badges[status];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${badge.className}`}>
        {badge.icon}
        {badge.label}
      </span>
    );
  }, []);

  // Access denied
  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to import users.
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

  const summary = getImportSummary(importUsers);

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <button
            onClick={() => router.push('/admin/users')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0 focus-ring"
            aria-label="Back to users"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
              <Upload className="w-6 h-6 sm:w-7 sm:h-7 text-brand-500 flex-shrink-0" />
              <span>Import Users</span>
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 hidden sm:block">
              Bulk import users from CSV or Excel file
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-sm focus-ring"
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">Import History</span>
          </button>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-lg p-3 flex items-center gap-2 animate-slideIn">
          <CheckCircle className="w-5 h-5 text-success-600 dark:text-success-400 flex-shrink-0" />
          <span className="text-success-700 dark:text-success-300 text-sm flex-1">{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="p-1 hover:bg-success-100 dark:hover:bg-success-800 rounded transition-colors flex-shrink-0 focus-ring"
            aria-label="Dismiss"
          >
            <XCircle className="w-5 h-5 text-success-600 dark:text-success-400" />
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4 flex items-center gap-3 animate-slideIn">
          <AlertCircle className="w-5 h-5 text-danger-600 dark:text-danger-400 flex-shrink-0" />
          <span className="text-danger-700 dark:text-danger-300 text-sm flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="p-1 hover:bg-danger-100 dark:hover:bg-danger-800 rounded transition-colors flex-shrink-0 focus-ring"
            aria-label="Dismiss error"
          >
            <XCircle className="w-5 h-5 text-danger-600 dark:text-danger-400" />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatsCard
          title="Total Users"
          value={summary.total}
          icon={<Users className="w-5 h-5" />}
          color="bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400"
        />
        <StatsCard
          title="Valid"
          value={summary.valid}
          icon={<CheckCircle className="w-5 h-5" />}
          color="bg-success-100 text-success-600 dark:bg-success-900/30 dark:text-success-400"
        />
        <StatsCard
          title="Invalid"
          value={summary.invalid}
          icon={<XCircle className="w-5 h-5" />}
          color="bg-danger-100 text-danger-600 dark:bg-danger-900/30 dark:text-danger-400"
        />
        <StatsCard
          title="Warnings"
          value={summary.warnings}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="bg-warning-100 text-warning-600 dark:bg-warning-900/30 dark:text-warning-400"
        />
        <StatsCard
          title="Ready to Import"
          value={summary.readyToImport}
          icon={<UserPlus className="w-5 h-5" />}
          color="bg-secondary-100 text-secondary-600 dark:bg-secondary-900/30 dark:text-secondary-400"
          subtitle={`${summary.total > 0 ? Math.round((summary.readyToImport / summary.total) * 100) : 0}% ready`}
        />
      </div>

      {/* Template Download */}
      <div className="card-brand p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Download className="w-5 h-5 text-brand-500" />
          Download Template
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {IMPORT_TEMPLATES.map(template => (
            <div
              key={template.id}
              className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-card-hover ${
                selectedTemplate === template.id
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
              onClick={() => {
                setSelectedTemplate(template.id);
                handleDownloadTemplate(template);
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg ${selectedTemplate === template.id ? 'bg-brand-500 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}>
                  {template.format === 'csv' ? (
                    <FileText className="w-4 h-4" />
                  ) : (
                    <FileSpreadsheet className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">{template.name}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{template.headers.length} columns</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{template.description}</p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadTemplate(template);
                }}
                className="mt-3 px-3 py-1.5 bg-brand-500 text-white rounded-lg text-sm hover:bg-brand-600 transition-colors flex items-center gap-1 focus-ring"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* File Upload Zone */}
      <div
        ref={dropZoneRef}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
          isDragging
            ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-brand-400'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileInputChange}
          className="hidden"
        />

        <div className="flex flex-col items-center">
          {fileName ? (
            <>
              <FileSpreadsheet className="w-16 h-16 text-success-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">{fileName}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                File loaded successfully
              </p>
              <div className="flex flex-wrap gap-2 mt-4 justify-center">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors text-sm focus-ring"
                >
                  Change File
                </button>
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setFileName('');
                    setFileContent('');
                    setImportUsers([]);
                    setShowPreview(false);
                    setShowValidation(false);
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm focus-ring"
                >
                  Remove
                </button>
              </div>
            </>
          ) : (
            <>
              <Upload className="w-16 h-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Drag and drop your file here
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                or click to browse
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                Supported formats: CSV, Excel (.xlsx, .xls)
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors focus-ring"
              >
                Browse Files
              </button>
            </>
          )}
        </div>
      </div>

      {/* Preview and Validation */}
      {showPreview && importUsers.length > 0 && (
        <div className="card-brand p-0 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Eye className="w-5 h-5 text-brand-500" />
                Preview and Validation
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewMode('table')}
                  className={`p-1.5 rounded transition-colors focus-ring ${previewMode === 'table' ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-600' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                  aria-label="Table view"
                >
                  <Table className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPreviewMode('cards')}
                  className={`p-1.5 rounded transition-colors focus-ring ${previewMode === 'cards' ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-600' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                  aria-label="Card view"
                >
                  <Grid className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter buttons */}
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors focus-ring ${
                  filterStatus === 'all' ? 'bg-brand-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                All ({summary.total})
              </button>
              <button
                onClick={() => setFilterStatus('valid')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors focus-ring ${
                  filterStatus === 'valid' ? 'bg-success-600 text-white' : 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400 hover:bg-success-200 dark:hover:bg-success-800/50'
                }`}
              >
                Valid ({summary.valid})
              </button>
              <button
                onClick={() => setFilterStatus('invalid')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors focus-ring ${
                  filterStatus === 'invalid' ? 'bg-danger-600 text-white' : 'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-400 hover:bg-danger-200 dark:hover:bg-danger-800/50'
                }`}
              >
                Invalid ({summary.invalid})
              </button>
              <button
                onClick={() => setFilterStatus('warning')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors focus-ring ${
                  filterStatus === 'warning' ? 'bg-warning-600 text-white' : 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400 hover:bg-warning-200 dark:hover:bg-warning-800/50'
                }`}
              >
                Warnings ({summary.warnings})
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors focus-ring"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>
          </div>

          {/* Table View */}
          {previewMode === 'table' ? (
            <div className="overflow-x-auto sidebar-scroll">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="p-3 text-left w-10">
                      <input
                        type="checkbox"
                        checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
                      />
                    </th>
                    <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Row</th>
                    <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                    <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">Email</th>
                    <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Role</th>
                    <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">Issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedUsers.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedUsers.has(user.id)}
                          onChange={() => handleSelectUser(user.id)}
                          disabled={user.status === 'invalid'}
                          className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500 disabled:opacity-50"
                        />
                      </td>
                      <td className="p-3 text-sm text-gray-500 dark:text-gray-400 tabular-nums">{user.rowNumber || '-'}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-brand-gradient flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                            {user.firstName?.[0]}{user.lastName?.[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate sm:hidden">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-sm text-gray-600 dark:text-gray-400 truncate max-w-[150px] hidden sm:table-cell">
                        {user.email}
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-400">
                          {user.role}
                        </span>
                      </td>
                      <td className="p-3">{getStatusBadge(user.status)}</td>
                      <td className="p-3 hidden lg:table-cell">
                        {user.errors.length > 0 && (
                          <div className="space-y-0.5">
                            {user.errors.slice(0, 1).map((error, i) => (
                              <p key={i} className="text-xs text-danger-600 dark:text-danger-400 flex items-center gap-1">
                                <XCircle className="w-3 h-3" /> {error}
                              </p>
                            ))}
                            {user.errors.length > 1 && (
                              <p className="text-xs text-danger-600 dark:text-danger-400 tabular-nums">+{user.errors.length - 1} more</p>
                            )}
                          </div>
                        )}
                        {user.warnings.length > 0 && user.errors.length === 0 && (
                          <div className="space-y-0.5">
                            {user.warnings.slice(0, 1).map((warning, i) => (
                              <p key={i} className="text-xs text-warning-600 dark:text-warning-400 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> {warning}
                              </p>
                            ))}
                            {user.warnings.length > 1 && (
                              <p className="text-xs text-warning-600 dark:text-warning-400 tabular-nums">+{user.warnings.length - 1} more</p>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                    Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, filteredUsers.length)} of {filteredUsers.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-gray-600 dark:text-gray-400 tabular-nums">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Card View */
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedUsers.map(user => (
                <div key={user.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-card-hover transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-brand-gradient flex items-center justify-center text-white font-medium flex-shrink-0">
                        {user.firstName?.[0]}{user.lastName?.[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                      </div>
                    </div>
                    {getStatusBadge(user.status)}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-400">
                      {user.role}
                    </span>
                    {user.phoneNumber && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {user.phoneNumber}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
                      Row {user.rowNumber || '-'}
                    </span>
                  </div>
                  {(user.errors.length > 0 || user.warnings.length > 0) && (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                      {user.errors.slice(0, 2).map((error, i) => (
                        <p key={i} className="text-xs text-danger-600 dark:text-danger-400 flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> {error}
                        </p>
                      ))}
                      {user.errors.length > 2 && (
                        <p className="text-xs text-danger-600 dark:text-danger-400 tabular-nums">+{user.errors.length - 2} more errors</p>
                      )}
                      {user.warnings.slice(0, 2).map((warning, i) => (
                        <p key={i} className="text-xs text-warning-600 dark:text-warning-400 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {warning}
                        </p>
                      ))}
                      {user.warnings.length > 2 && (
                        <p className="text-xs text-warning-600 dark:text-warning-400 tabular-nums">+{user.warnings.length - 2} more warnings</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Import Actions */}
      {importUsers.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
            {selectedUsers.size} user{selectedUsers.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setSelectedFile(null);
                setFileName('');
                setFileContent('');
                setImportUsers([]);
                setShowPreview(false);
                setShowValidation(false);
              }}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm focus-ring"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={importing || summary.readyToImport === 0}
              className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors flex items-center gap-2 disabled:opacity-50 text-sm focus-ring"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importing... {importProgress}%
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Import {summary.readyToImport} Users
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Import Progress Bar */}
      {importing && (
        <div className="card-brand p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Importing users...</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white tabular-nums">{importProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className="bg-brand-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${importProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Import History */}
      {showHistory && (
        <div className="card-brand p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-brand-500" />
            Import History
          </h3>
          {importHistory.length === 0 ? (
            <div className="text-center py-8">
              <History className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-gray-500 dark:text-gray-400">No import history</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto sidebar-scroll">
              {importHistory.map(history => (
                <div key={history.id} className="flex flex-wrap items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">{history.fileName}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(history.importedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap tabular-nums">
                      {history.successCount}/{history.totalRows} successful
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      history.status === 'completed'
                        ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400'
                        : history.status === 'partial'
                        ? 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400'
                        : 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400'
                    }`}>
                      {history.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
