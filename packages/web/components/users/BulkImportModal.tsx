// D:\Projects\Kalwanga\packages\web\components\users\BulkImportModal.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import { toast } from 'react-hot-toast';
import { 
  X, Upload, Download, FileSpreadsheet, FileText, FileUp,
  Loader2, AlertCircle, CheckCircle, XCircle, Save,
  RefreshCw, Copy, Check, Info, AlertTriangle,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Eye, EyeOff, Settings, Users, User, Building,
  Package, FolderTree, FileIcon, DollarSign,
  ShoppingCart, ClipboardList, Truck, Boxes, Layers,
  Store, Globe, Hash, Tag, Star, Heart, ThumbsUp,
  MessageSquare, Share2, Bookmark, FileDown, FileJson,
  MoreVertical, SlidersHorizontal, BarChart3, TrendingUp,
  PieChart, Activity, Calendar, Clock, Mail, Phone,
  Database, Server, Cloud, Wifi, Bluetooth, Battery,
  Sun, Moon, Wind, Droplet, Flame, Leaf, TreePine,
  Mountain, Waves, Compass, Map, Navigation, Route,
  Target, Crosshair, Gauge,
  CreditCard, Percent, Printer, Send, Link2, Unlink,
  Plus, Minus, RotateCcw, History, Zap, Sparkles,
  Table, List, Grid, Rows,
  Columns, Filter, SortAsc, SortDesc, Trash2,
  Edit, UserPlus, UserCheck, UserX, Shield,
  Key, Lock, Unlock, Play, Pause, StopCircle,
  SkipForward, SkipBack, FastForward, Rewind,
  StepForward, StepBack, Maximize, Minimize,
  ZoomIn, ZoomOut, Move, CopyPlus,
  ClipboardCopy, ClipboardPaste, Scissors, Eraser,
  Search // ✅ Added missing Search import
} from 'lucide-react';
import { PERMISSIONS } from '../../types/permissions';
import { UserRole } from '../../types/enums';

// ✅ Custom toast warning function since react-hot-toast doesn't have warning
const toastWarning = (message: string) => {
  toast.custom((t) => (
    <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-yellow-50 dark:bg-yellow-900/30 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
      <div className="flex-1 w-0 p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0 pt-0.5">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div className="ml-3 flex-1">
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Warning
            </p>
            <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
              {message}
            </p>
          </div>
        </div>
      </div>
      <div className="flex border-l border-yellow-200 dark:border-yellow-700">
        <button
          onClick={() => toast.dismiss(t.id)}
          className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300 focus:outline-none"
        >
          Close
        </button>
      </div>
    </div>
  ), { duration: 4000 });
};

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: (result: ImportResult) => void;
  onImportError?: (error: string) => void;
  acceptedFormats?: string[];
  maxFileSize?: number;
  showTemplateDownload?: boolean;
  showProgressTracking?: boolean;
  showErrorReporting?: boolean;
}

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
  rowNumber: number;
}

interface ImportResult {
  totalRows: number;
  successCount: number;
  failedCount: number;
  warningCount: number;
  skippedCount: number;
  errors: ImportError[];
  warnings: ImportWarning[];
  importedUsers: string[];
  failedUsers: string[];
}

interface ImportError {
  rowNumber: number;
  email: string;
  error: string;
  field?: string;
  value?: string;
}

interface ImportWarning {
  rowNumber: number;
  email: string;
  warning: string;
  field?: string;
  value?: string;
}

interface ImportProgress {
  current: number;
  total: number;
  percentage: number;
  status: 'idle' | 'parsing' | 'validating' | 'importing' | 'completed' | 'failed';
  message: string;
}

interface ImportTemplate {
  id: string;
  name: string;
  description: string;
  format: 'csv' | 'excel';
  headers: string[];
  exampleData: Record<string, any>[];
  downloadUrl?: string;
}

const REQUIRED_HEADERS = ['email', 'firstName', 'lastName', 'role'];
const OPTIONAL_HEADERS = ['phoneNumber', 'businessUnitId', 'isActive', 'permissions', 'companyId', 'avatar', 'password'];

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
    format: 'excel',
    headers: [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS],
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

export function BulkImportModal({
  isOpen,
  onClose,
  onImportComplete,
  onImportError,
  acceptedFormats = ['.csv', '.xlsx', '.xls'],
  maxFileSize = 10 * 1024 * 1024, // 10MB
  showTemplateDownload = true,
  showProgressTracking = true,
  showErrorReporting = true,
}: BulkImportModalProps) {
  const router = useRouter();
  const { can, isSuperAdmin, isAdmin } = useAuth();
  
  // State management
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [importUsers, setImportUsers] = useState<ImportUser[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('standard');
  const [showPreview, setShowPreview] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress>({
    current: 0,
    total: 0,
    percentage: 0,
    status: 'idle',
    message: '',
  });
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewMode, setPreviewMode] = useState<'table' | 'cards'>('table');
  const [filterStatus, setFilterStatus] = useState<'all' | 'valid' | 'invalid' | 'warning' | 'duplicate'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [showColumnMapping, setShowColumnMapping] = useState(false);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'email',
    direction: 'asc',
  });
  const [showDetailedErrors, setShowDetailedErrors] = useState(false);
  const [showDetailedWarnings, setShowDetailedWarnings] = useState(false);
  const [importSpeed, setImportSpeed] = useState(0);
  const [importStartTime, setImportStartTime] = useState<number | null>(null);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const importTimerRef = useRef<NodeJS.Timeout | null>(null);

  const canImportUsers = isSuperAdmin || isAdmin || can(PERMISSIONS.USER_CREATE);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedFile(null);
      setFileName('');
      setFileContent('');
      setImportUsers([]);
      setShowPreview(false);
      setShowValidation(false);
      setImporting(false);
      setImportProgress({
        current: 0,
        total: 0,
        percentage: 0,
        status: 'idle',
        message: '',
      });
      setImportResult(null);
      setIsDragging(false);
      setSelectedUsers(new Set());
      setSearchQuery('');
      setFilterStatus('all');
      setShowDetailedErrors(false);
      setShowDetailedWarnings(false);
      setImportSpeed(0);
      setImportStartTime(null);
    }
  }, [isOpen]);

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !importing) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, importing, onClose]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (importTimerRef.current) {
        clearInterval(importTimerRef.current);
      }
    };
  }, []);

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
      } else if (userData.firstName.length < 2) {
        warnings.push(`First name is too short: ${userData.firstName}`);
      }
      
      // Validate last name
      if (!userData.lastName) {
        errors.push('Last name is required');
      } else if (userData.lastName.length < 2) {
        warnings.push(`Last name is too short: ${userData.lastName}`);
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
        rowNumber: i + 2, // +2 for header row and 0-index
      });
    }
    
    return users;
  }, []);

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

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    try {
      // Validate file type
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!acceptedFormats.includes(fileExtension)) {
        toast.error(`Invalid file format. Accepted formats: ${acceptedFormats.join(', ')}`);
        return;
      }
      
      // Validate file size
      if (file.size > maxFileSize) {
        toast.error(`File size exceeds ${Math.round(maxFileSize / (1024 * 1024))}MB limit`);
        return;
      }
      
      setSelectedFile(file);
      setFileName(file.name);
      
      // Update progress
      setImportProgress({
        current: 0,
        total: 0,
        percentage: 0,
        status: 'parsing',
        message: 'Parsing file...',
      });
      
      // Read file content
      const content = await readFileContent(file);
      setFileContent(content);
      
      // Parse CSV
      const rows = parseCSV(content);
      
      if (rows.length < 2) {
        toast.error('File must contain at least a header row and one data row');
        setImportProgress({
          current: 0,
          total: 0,
          percentage: 0,
          status: 'failed',
          message: 'Invalid file structure',
        });
        return;
      }
      
      const headers = rows[0];
      const dataRows = rows.slice(1);
      
      // Validate headers
      const missingHeaders = REQUIRED_HEADERS.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        toast.error(`Missing required headers: ${missingHeaders.join(', ')}`);
        setImportProgress({
          current: 0,
          total: 0,
          percentage: 0,
          status: 'failed',
          message: `Missing headers: ${missingHeaders.join(', ')}`,
        });
        return;
      }
      
      // Auto-map columns
      const mapping: Record<string, string> = {};
      headers.forEach(header => {
        mapping[header] = header;
      });
      setColumnMapping(mapping);
      
      // Update progress
      setImportProgress({
        current: 0,
        total: dataRows.length,
        percentage: 0,
        status: 'validating',
        message: 'Validating data...',
      });
      
      // Validate data
      const validatedUsers = validateImportData(dataRows, headers);
      setImportUsers(validatedUsers);
      setShowPreview(true);
      setShowValidation(true);
      
      // Update progress
      const validCount = validatedUsers.filter(u => u.status === 'valid').length;
      const warningCount = validatedUsers.filter(u => u.status === 'warning').length;
      const invalidCount = validatedUsers.filter(u => u.status === 'invalid').length;
      
      setImportProgress({
        current: validatedUsers.length,
        total: validatedUsers.length,
        percentage: 100,
        status: 'completed',
        message: `Validated: ${validCount} valid, ${warningCount} warnings, ${invalidCount} invalid`,
      });
      
      if (invalidCount > 0) {
        toastWarning(`${invalidCount} users have validation errors`);
      } else if (validCount > 0) {
        toast.success(`${validCount} users validated successfully`);
      }
      
    } catch (error: any) {
      console.error('Failed to process file:', error);
      toast.error(error?.message || 'Failed to process file');
      setImportProgress({
        current: 0,
        total: 0,
        percentage: 0,
        status: 'failed',
        message: error?.message || 'Failed to process file',
      });
    }
  }, [acceptedFormats, maxFileSize, parseCSV, validateImportData]);

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  // Handle file input change
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

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

  // Handle import
  const handleImport = useCallback(async () => {
    const validUsers = importUsers.filter(u => u.status === 'valid' || u.status === 'warning');
    
    if (validUsers.length === 0) {
      toast.error('No valid users to import');
      return;
    }
    
    setImporting(true);
    setImportStartTime(Date.now());
    setImportProgress({
      current: 0,
      total: validUsers.length,
      percentage: 0,
      status: 'importing',
      message: 'Starting import...',
    });
    
    let successCount = 0;
    let failedCount = 0;
    let warningCount = 0;
    const errors: ImportError[] = [];
    const warnings: ImportWarning[] = [];
    const importedUsers: string[] = [];
    const failedUsers: string[] = [];
    
    try {
      // Start speed calculation timer
      importTimerRef.current = setInterval(() => {
        if (importStartTime) {
          const elapsed = (Date.now() - importStartTime) / 1000;
          const speed = successCount / Math.max(elapsed, 0.1);
          setImportSpeed(Math.round(speed * 10) / 10);
        }
      }, 1000);
      
      for (let i = 0; i < validUsers.length; i++) {
        const user = validUsers[i];
        
        // Update progress
        setImportProgress({
          current: i + 1,
          total: validUsers.length,
          percentage: Math.round(((i + 1) / validUsers.length) * 100),
          status: 'importing',
          message: `Importing ${user.email}...`,
        });
        
        try {
          // Mock API call with delay
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Simulate success/failure
          if (user.email.includes('fail')) {
            throw new Error('Simulated failure');
          }
          
          // Call actual API
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
          importedUsers.push(user.email);
          
          if (user.warnings.length > 0) {
            warningCount += user.warnings.length;
            user.warnings.forEach(warning => {
              warnings.push({
                rowNumber: user.rowNumber,
                email: user.email,
                warning,
              });
            });
          }
        } catch (error: any) {
          console.error(`Failed to import user ${user.email}:`, error);
          failedCount++;
          failedUsers.push(user.email);
          errors.push({
            rowNumber: user.rowNumber,
            email: user.email,
            error: error?.message || 'Failed to import',
          });
        }
      }
      
      // Stop speed calculation
      if (importTimerRef.current) {
        clearInterval(importTimerRef.current);
        importTimerRef.current = null;
      }
      
      // Create result
      const result: ImportResult = {
        totalRows: validUsers.length,
        successCount,
        failedCount,
        warningCount,
        skippedCount: importUsers.length - validUsers.length,
        errors,
        warnings,
        importedUsers,
        failedUsers,
      };
      
      setImportResult(result);
      
      // Update progress
      setImportProgress({
        current: validUsers.length,
        total: validUsers.length,
        percentage: 100,
        status: 'completed',
        message: `Import completed: ${successCount} success, ${failedCount} failed`,
      });
      
      if (failedCount === 0) {
        toast.success(`Successfully imported ${successCount} users`);
      } else if (failedCount < validUsers.length) {
        toastWarning(`Imported ${successCount} users, ${failedCount} failed`);
      } else {
        toast.error('Failed to import users');
      }
      
      // Call callback
      if (onImportComplete) {
        onImportComplete(result);
      }
      
    } catch (error: any) {
      console.error('Import failed:', error);
      setImportProgress({
        current: 0,
        total: validUsers.length,
        percentage: 0,
        status: 'failed',
        message: error?.message || 'Import failed',
      });
      toast.error('Import failed');
      
      if (onImportError) {
        onImportError(error?.message || 'Import failed');
      }
    } finally {
      setImporting(false);
      setImportStartTime(null);
      setImportSpeed(0);
      
      if (importTimerRef.current) {
        clearInterval(importTimerRef.current);
        importTimerRef.current = null;
      }
    }
  }, [importUsers, importStartTime, onImportComplete, onImportError]);

  // Get import summary
  const importSummary = useMemo(() => {
    return {
      total: importUsers.length,
      valid: importUsers.filter(u => u.status === 'valid').length,
      invalid: importUsers.filter(u => u.status === 'invalid').length,
      warnings: importUsers.filter(u => u.status === 'warning').length,
      duplicates: importUsers.filter(u => u.status === 'duplicate').length,
      readyToImport: importUsers.filter(u => u.status === 'valid' || u.status === 'warning').length,
    };
  }, [importUsers]);

  // Filter and sort users
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

  // Get status badge
  const getStatusBadge = useCallback((status: ImportUser['status']) => {
    const badges = {
      valid: { icon: <CheckCircle className="w-3 h-3" />, label: 'Valid', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
      invalid: { icon: <XCircle className="w-3 h-3" />, label: 'Invalid', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
      warning: { icon: <AlertTriangle className="w-3 h-3" />, label: 'Warning', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
      duplicate: { icon: <Copy className="w-3 h-3" />, label: 'Duplicate', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
    };
    
    const badge = badges[status];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.className}`}>
        {badge.icon}
        {badge.label}
      </span>
    );
  }, []);

  // If modal is not open, return null
  if (!isOpen) return null;

  // If user doesn't have permission
  if (!canImportUsers) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="fixed inset-0 bg-black/50" onClick={onClose} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Access Restricted</h3>
              <p className="text-gray-500 dark:text-gray-400 mt-2">
                You don't have permission to import users.
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="fixed inset-0 bg-black/50" onClick={importing ? undefined : onClose} />
        
        <div ref={modalRef} className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <FileUp className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Bulk Import Users</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Import multiple users from CSV or Excel file
                </p>
              </div>
            </div>
            <button
              onClick={importing ? undefined : onClose}
              disabled={importing}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Template Download */}
            {showTemplateDownload && !selectedFile && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Download Template</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {IMPORT_TEMPLATES.map(template => (
                    <button
                      key={template.id}
                      onClick={() => {
                        setSelectedTemplate(template.id);
                        handleDownloadTemplate(template);
                      }}
                      className={`p-3 rounded-lg border transition-all text-left ${
                        selectedTemplate === template.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {template.format === 'csv' ? (
                          <FileText className="w-4 h-4 text-blue-500" />
                        ) : (
                          <FileSpreadsheet className="w-4 h-4 text-green-500" />
                        )}
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{template.name}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{template.description}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{template.headers.length} columns</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* File Upload Zone */}
            {!showPreview && (
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
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={acceptedFormats.join(',')}
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                
                <div className="flex flex-col items-center">
                  {fileName ? (
                    <>
                      <FileSpreadsheet className="w-16 h-16 text-green-500 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">{fileName}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        File loaded successfully
                      </p>
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
                          }}
                          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
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
                        Supported formats: {acceptedFormats.join(', ')} • Max size: {Math.round(maxFileSize / (1024 * 1024))}MB
                      </p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Browse Files
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Progress Tracking */}
            {showProgressTracking && importProgress.status !== 'idle' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {importProgress.message}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {importProgress.percentage}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      importProgress.status === 'failed' ? 'bg-red-600' :
                      importProgress.status === 'completed' ? 'bg-green-600' :
                      'bg-blue-600'
                    }`}
                    style={{ width: `${importProgress.percentage}%` }}
                  />
                </div>
                {importing && importSpeed > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Speed: {importSpeed} users/second
                  </p>
                )}
              </div>
            )}

            {/* Import Summary */}
            {importUsers.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Import Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{importSummary.total}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{importSummary.valid}</p>
                    <p className="text-xs text-green-600 dark:text-green-400">Valid</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{importSummary.invalid}</p>
                    <p className="text-xs text-red-600 dark:text-red-400">Invalid</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{importSummary.readyToImport}</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">Ready</p>
                  </div>
                </div>
              </div>
            )}

            {/* Preview */}
            {showPreview && importUsers.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Preview and Validation</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPreviewMode('table')}
                        className={`p-1.5 rounded ${previewMode === 'table' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'text-gray-400'}`}
                      >
                        <Table className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setPreviewMode('cards')}
                        className={`p-1.5 rounded ${previewMode === 'cards' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'text-gray-400'}`}
                      >
                        <Grid className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Search and Filter */}
                  <div className="flex gap-2 mt-3">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search users..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      />
                    </div>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value as any)}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    >
                      <option value="all">All ({importSummary.total})</option>
                      <option value="valid">Valid ({importSummary.valid})</option>
                      <option value="invalid">Invalid ({importSummary.invalid})</option>
                      <option value="warning">Warnings ({importSummary.warnings})</option>
                      <option value="duplicate">Duplicates ({importSummary.duplicates})</option>
                    </select>
                  </div>
                </div>

                {/* Table View */}
                {previewMode === 'table' ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                          <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Row</th>
                          <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">User</th>
                          <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Email</th>
                          <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Role</th>
                          <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                          <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Issues</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredUsers.map(user => (
                          <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                            <td className="p-3 text-sm text-gray-500 dark:text-gray-400">{user.rowNumber}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xs font-medium">
                                  {user.firstName?.[0]}{user.lastName?.[0]}
                                </div>
                                <span className="text-sm text-gray-900 dark:text-white">
                                  {user.firstName} {user.lastName}
                                </span>
                              </div>
                            </td>
                            <td className="p-3 text-sm text-gray-600 dark:text-gray-400">{user.email}</td>
                            <td className="p-3">
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                {user.role}
                              </span>
                            </td>
                            <td className="p-3">{getStatusBadge(user.status)}</td>
                            <td className="p-3">
                              {user.errors.length > 0 && (
                                <div className="space-y-1">
                                  {user.errors.map((error, i) => (
                                    <p key={i} className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                                      <XCircle className="w-3 h-3" /> {error}
                                    </p>
                                  ))}
                                </div>
                              )}
                              {user.warnings.length > 0 && (
                                <div className="space-y-1 mt-1">
                                  {user.warnings.map((warning, i) => (
                                    <p key={i} className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3" /> {warning}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* Card View */
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredUsers.map(user => (
                      <div key={user.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-medium">
                              {user.firstName?.[0]}{user.lastName?.[0]}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {user.firstName} {user.lastName}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                            </div>
                          </div>
                          {getStatusBadge(user.status)}
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                            {user.role}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Row {user.rowNumber}
                          </span>
                        </div>
                        {(user.errors.length > 0 || user.warnings.length > 0) && (
                          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                            {user.errors.map((error, i) => (
                              <p key={i} className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                                <XCircle className="w-3 h-3" /> {error}
                              </p>
                            ))}
                            {user.warnings.map((warning, i) => (
                              <p key={i} className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> {warning}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Error Reporting */}
            {showErrorReporting && importResult && (importResult.errors.length > 0 || importResult.warnings.length > 0) && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Import Report</h3>
                
                {importResult.errors.length > 0 && (
                  <div>
                    <button
                      onClick={() => setShowDetailedErrors(!showDetailedErrors)}
                      className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                    >
                      {showDetailedErrors ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      Errors ({importResult.errors.length})
                    </button>
                    {showDetailedErrors && (
                      <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                        {importResult.errors.map((error, index) => (
                          <div key={index} className="p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs">
                            <p className="text-red-700 dark:text-red-300 font-medium">
                              Row {error.rowNumber} - {error.email}
                            </p>
                            <p className="text-red-600 dark:text-red-400">{error.error}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {importResult.warnings.length > 0 && (
                  <div className="mt-3">
                    <button
                      onClick={() => setShowDetailedWarnings(!showDetailedWarnings)}
                      className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300"
                    >
                      {showDetailedWarnings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      Warnings ({importResult.warnings.length})
                    </button>
                    {showDetailedWarnings && (
                      <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                        {importResult.warnings.map((warning, index) => (
                          <div key={index} className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs">
                            <p className="text-yellow-700 dark:text-yellow-300 font-medium">
                              Row {warning.rowNumber} - {warning.email}
                            </p>
                            <p className="text-yellow-600 dark:text-yellow-400">{warning.warning}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {importUsers.length > 0 
                ? `${importSummary.readyToImport} of ${importSummary.total} users ready to import`
                : 'No file selected'}
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                disabled={importing}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              {showPreview && importUsers.length > 0 && (
                <button
                  onClick={handleImport}
                  disabled={importing || importSummary.readyToImport === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Importing... {importProgress.percentage}%
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Import {importSummary.readyToImport} Users
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BulkImportModal;
