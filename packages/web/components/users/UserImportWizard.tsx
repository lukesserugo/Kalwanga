// D:\Projects\Kalwanga\packages\web\components\users\UserImportWizard.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { 
  Upload, Download, FileSpreadsheet, FileText, FileUp,
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
  Target, Crosshair, Gauge, // ✅ Removed Aim, Bullseye, Speedometer
  CreditCard, Percent, Printer, Send, Link2, Unlink,
  Plus, Minus, RotateCcw, History, Zap, Sparkles,
  UserPlus, UserCheck, UserX, BadgeCheck, Ban,
  StepForward, StepBack, SkipForward, SkipBack,
  FastForward, Rewind, Play, Pause, StopCircle,
  CheckCircle2, Circle, CircleDot, ArrowRight,
  ArrowLeft, ArrowUp, ArrowDown, MoveVertical,
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

interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  required: boolean;
  mapped: boolean;
}

interface ImportResult {
  totalRows: number;
  successCount: number;
  failedCount: number;
  warningCount: number;
  skippedCount: number;
  errors: Array<{ rowNumber: number; email: string; error: string }>;
  warnings: Array<{ rowNumber: number; email: string; warning: string }>;
  importedUsers: string[];
  failedUsers: string[];
}

interface UserImportWizardProps {
  isOpen?: boolean;
  onClose?: () => void;
  onComplete?: (result: ImportResult) => void;
  onCancel?: () => void;
  acceptedFormats?: string[];
  maxFileSize?: number;
  showStepIndicator?: boolean;
  allowSkipValidation?: boolean;
}

const REQUIRED_FIELDS = [
  { field: 'email', label: 'Email', required: true },
  { field: 'firstName', label: 'First Name', required: true },
  { field: 'lastName', label: 'Last Name', required: true },
  { field: 'role', label: 'Role', required: true },
];

const OPTIONAL_FIELDS = [
  { field: 'phoneNumber', label: 'Phone Number', required: false },
  { field: 'businessUnitId', label: 'Business Unit', required: false },
  { field: 'isActive', label: 'Active Status', required: false },
  { field: 'permissions', label: 'Permissions', required: false },
  { field: 'companyId', label: 'Company', required: false },
  { field: 'avatar', label: 'Avatar URL', required: false },
  { field: 'password', label: 'Password', required: false },
];

const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

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

const WIZARD_STEPS = [
  { id: 'upload', label: 'Upload File', icon: <Upload className="w-4 h-4" /> },
  { id: 'mapping', label: 'Map Columns', icon: <SlidersHorizontal className="w-4 h-4" /> },
  { id: 'preview', label: 'Preview & Validate', icon: <Eye className="w-4 h-4" /> },
  { id: 'import', label: 'Import', icon: <UserPlus className="w-4 h-4" /> },
  { id: 'complete', label: 'Complete', icon: <CheckCircle className="w-4 h-4" /> },
];

export function UserImportWizard({
  isOpen = true,
  onClose,
  onComplete,
  onCancel,
  acceptedFormats = ['.csv', '.xlsx', '.xls'],
  maxFileSize = 10 * 1024 * 1024,
  showStepIndicator = true,
  allowSkipValidation = false,
}: UserImportWizardProps) {
  const router = useRouter();
  
  // State management
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [fileData, setFileData] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importUsers, setImportUsers] = useState<ImportUser[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [autoMapping, setAutoMapping] = useState<Record<string, string>>({});
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [importOptions, setImportOptions] = useState({
    skipDuplicates: true,
    skipInvalid: true,
    sendWelcomeEmail: false,
    defaultPassword: '',
    autoActivate: true,
    batchSize: 100,
  });
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageSize, setPreviewPageSize] = useState(10);
  const [filterStatus, setFilterStatus] = useState<'all' | 'valid' | 'invalid' | 'warning'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const wizardRef = useRef<HTMLDivElement>(null);

  // Calculate progress
  const stepProgress = useMemo(() => {
    return ((currentStep + 1) / WIZARD_STEPS.length) * 100;
  }, [currentStep]);

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

  // Auto-detect column mappings
  const detectColumnMappings = useCallback((headers: string[]): Record<string, string> => {
    const mappings: Record<string, string> = {};
    
    headers.forEach(header => {
      const normalizedHeader = header.toLowerCase().trim();
      
      ALL_FIELDS.forEach(field => {
        const fieldLower = field.field.toLowerCase();
        
        // Check for exact match
        if (normalizedHeader === fieldLower) {
          mappings[header] = field.field;
          return;
        }
        
        // Check for partial match
        if (normalizedHeader.includes(fieldLower) || fieldLower.includes(normalizedHeader)) {
          if (!mappings[header]) {
            mappings[header] = field.field;
          }
          return;
        }
        
        // Check for common variations
        const variations: Record<string, string[]> = {
          email: ['email', 'email_address', 'e-mail', 'mail'],
          firstName: ['firstname', 'first_name', 'fname', 'given_name'],
          lastName: ['lastname', 'last_name', 'lname', 'surname'],
          role: ['role', 'user_role', 'userrole', 'access_level'],
          phoneNumber: ['phone', 'phone_number', 'phonenumber', 'mobile', 'tel'],
          businessUnitId: ['business_unit', 'businessunit', 'bu_id', 'unit'],
          isActive: ['active', 'is_active', 'status', 'isactive'],
          permissions: ['permissions', 'perms', 'access'],
          companyId: ['company', 'company_id', 'companyid'],
          avatar: ['avatar', 'avatar_url', 'profile_picture', 'photo'],
          password: ['password', 'pass', 'pwd'],
        };
        
        if (variations[field.field]?.includes(normalizedHeader)) {
          mappings[header] = field.field;
        }
      });
    });
    
    return mappings;
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    try {
      setIsProcessing(true);
      setError(null);
      
      // Validate file type
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!acceptedFormats.includes(fileExtension)) {
        toast.error(`Invalid file format. Accepted: ${acceptedFormats.join(', ')}`);
        return;
      }
      
      // Validate file size
      if (file.size > maxFileSize) {
        toast.error(`File size exceeds ${Math.round(maxFileSize / (1024 * 1024))}MB limit`);
        return;
      }
      
      setSelectedFile(file);
      setFileName(file.name);
      
      // Read file content
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setFileContent(content);
        
        // Parse CSV
        const rows = parseCSV(content);
        
        if (rows.length < 2) {
          setError('File must contain at least a header row and one data row');
          return;
        }
        
        const headers = rows[0];
        const data = rows.slice(1);
        
        setFileHeaders(headers);
        setFileData(data);
        
        // Auto-detect mappings
        const mappings = detectColumnMappings(headers);
        setAutoMapping(mappings);
        setColumnMapping(mappings);
        
        toast.success('File uploaded successfully');
        setCurrentStep(1); // Move to mapping step
      };
      
      reader.readAsText(file);
    } catch (error: any) {
      console.error('Failed to process file:', error);
      setError(error?.message || 'Failed to process file');
      toast.error('Failed to process file');
    } finally {
      setIsProcessing(false);
    }
  }, [acceptedFormats, maxFileSize, parseCSV, detectColumnMappings]);

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

  // Handle column mapping change
  const handleColumnMappingChange = useCallback((sourceColumn: string, targetField: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [sourceColumn]: targetField,
    }));
  }, []);

  // Handle validation
  const handleValidate = useCallback(() => {
    try {
      setIsProcessing(true);
      setError(null);
      
      // Check required mappings
      const missingRequired = REQUIRED_FIELDS.filter(field => 
        field.required && !Object.values(columnMapping).includes(field.field)
      );
      
      if (missingRequired.length > 0) {
        setError(`Missing required field mappings: ${missingRequired.map(f => f.label).join(', ')}`);
        toast.error('Please map all required fields');
        return;
      }
      
      // Validate data
      const users: ImportUser[] = [];
      const emailSet = new Set<string>();
      
      fileData.forEach((row, index) => {
        const userData: Record<string, any> = {};
        const errors: string[] = [];
        const warnings: string[] = [];
        
        // Map data using column mappings
        fileHeaders.forEach((header, colIndex) => {
          const targetField = columnMapping[header];
          if (targetField && row[colIndex] !== undefined) {
            userData[targetField] = row[colIndex];
          }
        });
        
        // Validate email
        const email = userData.email || '';
        if (!email) {
          errors.push('Email is required');
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.push(`Invalid email format: ${email}`);
        } else if (emailSet.has(email.toLowerCase())) {
          errors.push(`Duplicate email: ${email}`);
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
        
        let status: ImportUser['status'] = 'valid';
        if (errors.length > 0) {
          status = 'invalid';
        } else if (warnings.length > 0) {
          status = 'warning';
        }
        
        users.push({
          id: `import_${index}_${Date.now()}`,
          email,
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
          rowNumber: index + 2,
        });
      });
      
      setImportUsers(users);
      
      const validCount = users.filter(u => u.status === 'valid').length;
      const invalidCount = users.filter(u => u.status === 'invalid').length;
      const warningCount = users.filter(u => u.status === 'warning').length;
      
      toast.success(`Validated: ${validCount} valid, ${warningCount} warnings, ${invalidCount} invalid`);
      setCurrentStep(2); // Move to preview step
    } catch (error: any) {
      console.error('Validation failed:', error);
      setError(error?.message || 'Validation failed');
      toast.error('Validation failed');
    } finally {
      setIsProcessing(false);
    }
  }, [fileData, fileHeaders, columnMapping]);

  // Handle import
  const handleImport = useCallback(async () => {
    try {
      setIsImporting(true);
      setError(null);
      
      const validUsers = importUsers.filter(u => u.status === 'valid' || u.status === 'warning');
      
      if (validUsers.length === 0) {
        setError('No valid users to import');
        toast.error('No valid users to import');
        return;
      }
      
      let successCount = 0;
      let failedCount = 0;
      const errors: Array<{ rowNumber: number; email: string; error: string }> = [];
      const warnings: Array<{ rowNumber: number; email: string; warning: string }> = [];
      const importedUsers: string[] = [];
      const failedUsers: string[] = [];
      
      for (let i = 0; i < validUsers.length; i++) {
        const user = validUsers[i];
        
        // Update progress
        setImportProgress(Math.round(((i + 1) / validUsers.length) * 100));
        
        try {
          // Simulate API call
          await new Promise(resolve => setTimeout(resolve, 50));
          
          successCount++;
          importedUsers.push(user.email);
          
          if (user.warnings.length > 0) {
            user.warnings.forEach(warning => {
              warnings.push({
                rowNumber: user.rowNumber,
                email: user.email,
                warning,
              });
            });
          }
        } catch (error: any) {
          failedCount++;
          failedUsers.push(user.email);
          errors.push({
            rowNumber: user.rowNumber,
            email: user.email,
            error: error?.message || 'Failed to import',
          });
        }
      }
      
      const result: ImportResult = {
        totalRows: validUsers.length,
        successCount,
        failedCount,
        warningCount: warnings.length,
        skippedCount: importUsers.length - validUsers.length,
        errors,
        warnings,
        importedUsers,
        failedUsers,
      };
      
      setImportResult(result);
      setCurrentStep(4); // Move to complete step
      
      if (failedCount === 0) {
        toast.success(`Successfully imported ${successCount} users`);
      } else if (failedCount < validUsers.length) {
        toastWarning(`Imported ${successCount} users, ${failedCount} failed`);
      } else {
        toast.error('Failed to import users');
      }
      
      onComplete?.(result);
    } catch (error: any) {
      console.error('Import failed:', error);
      setError(error?.message || 'Import failed');
      toast.error('Import failed');
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  }, [importUsers, onComplete]);

  // Filter preview users
  const filteredPreviewUsers = useMemo(() => {
    let filtered = importUsers;
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(u => u.status === filterStatus);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(u => 
        u.email.toLowerCase().includes(query) ||
        u.firstName.toLowerCase().includes(query) ||
        u.lastName.toLowerCase().includes(query)
      );
    }
    
    const start = (previewPage - 1) * previewPageSize;
    return filtered.slice(start, start + previewPageSize);
  }, [importUsers, filterStatus, searchQuery, previewPage, previewPageSize]);

  // Get total pages
  const totalPreviewPages = useMemo(() => {
    const filtered = importUsers.filter(u => {
      if (filterStatus !== 'all' && u.status !== filterStatus) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return u.email.toLowerCase().includes(query) ||
               u.firstName.toLowerCase().includes(query) ||
               u.lastName.toLowerCase().includes(query);
      }
      return true;
    });
    return Math.ceil(filtered.length / previewPageSize);
  }, [importUsers, filterStatus, searchQuery, previewPageSize]);

  // Get import summary
  const importSummary = useMemo(() => {
    return {
      total: importUsers.length,
      valid: importUsers.filter(u => u.status === 'valid').length,
      invalid: importUsers.filter(u => u.status === 'invalid').length,
      warnings: importUsers.filter(u => u.status === 'warning').length,
      readyToImport: importUsers.filter(u => u.status === 'valid' || u.status === 'warning').length,
    };
  }, [importUsers]);

  // Handle next step
  const handleNext = useCallback(() => {
    setCurrentStep(prev => Math.min(WIZARD_STEPS.length - 1, prev + 1));
  }, []);

  // Handle previous step
  const handlePrevious = useCallback(() => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  }, []);

  // Handle step click
  const handleStepClick = useCallback((stepIndex: number) => {
    // Allow going back to previous steps
    if (stepIndex < currentStep) {
      setCurrentStep(stepIndex);
    }
  }, [currentStep]);

  // Reset wizard
  const handleReset = useCallback(() => {
    setCurrentStep(0);
    setSelectedFile(null);
    setFileName('');
    setFileContent('');
    setFileHeaders([]);
    setFileData([]);
    setColumnMapping({});
    setImportUsers([]);
    setImportResult(null);
    setError(null);
    setSuccessMessage(null);
    setImportProgress(0);
  }, []);

  // If not open, return null
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        
        <div ref={wizardRef} className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <FileUp className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Import Users</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Step {currentStep + 1} of {WIZARD_STEPS.length}: {WIZARD_STEPS[currentStep].label}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Close wizard"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="px-6 pt-4">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${stepProgress}%` }}
              />
            </div>
          </div>

          {/* Step Indicator */}
          {showStepIndicator && (
            <div className="px-6 pt-4">
              <div className="flex items-center justify-between">
                {WIZARD_STEPS.map((step, index) => (
                  <React.Fragment key={step.id}>
                    <button
                      onClick={() => handleStepClick(index)}
                      disabled={index > currentStep}
                      className={`flex items-center gap-2 ${
                        index < currentStep
                          ? 'text-green-600 dark:text-green-400 cursor-pointer'
                          : index === currentStep
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        index < currentStep
                          ? 'bg-green-100 dark:bg-green-900/30'
                          : index === currentStep
                          ? 'bg-blue-100 dark:bg-blue-900/30'
                          : 'bg-gray-100 dark:bg-gray-700'
                      }`}>
                        {index < currentStep ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          step.icon
                        )}
                      </div>
                      <span className="hidden sm:inline text-sm">{step.label}</span>
                    </button>
                    {index < WIZARD_STEPS.length - 1 && (
                      <div className={`flex-1 h-px mx-2 ${
                        index < currentStep ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                      }`} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Step 1: Upload */}
            {currentStep === 0 && (
              <div className="space-y-4">
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
                            onClick={handleReset}
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

                {/* Template Download */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Need a template?</h4>
                  <button
                    onClick={() => {
                      const headers = ['email', 'firstName', 'lastName', 'role', 'phoneNumber', 'isActive'];
                      const exampleData = [
                        ['john.doe@example.com', 'John', 'Doe', 'EMPLOYEE', '+1234567890', 'true'],
                        ['jane.smith@example.com', 'Jane', 'Smith', 'MANAGER', '+0987654321', 'true'],
                      ];
                      const csvContent = [headers.join(','), ...exampleData.map(row => row.join(','))].join('\n');
                      const blob = new Blob([csvContent], { type: 'text/csv' });
                      const url = window.URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = 'user_import_template.csv';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      window.URL.revokeObjectURL(url);
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
                  >
                    <Download className="w-4 h-4" />
                    Download CSV Template
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Column Mapping */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Map your file columns to the required fields. Columns marked with * are required.
                  </p>
                </div>
                
                <div className="space-y-3">
                  {fileHeaders.map((header, index) => {
                    const mappedField = columnMapping[header] || '';
                    const isAutoMapped = autoMapping[header] === mappedField && mappedField !== '';
                    
                    return (
                      <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{header}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Column {index + 1}
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                        <div className="flex-1">
                          <select
                            value={mappedField}
                            onChange={(e) => handleColumnMappingChange(header, e.target.value)}
                            className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm ${
                              mappedField
                                ? 'border-green-300 dark:border-green-700'
                                : 'border-gray-300 dark:border-gray-600'
                            }`}
                          >
                            <option value="">-- Ignore Column --</option>
                            {ALL_FIELDS.map(field => (
                              <option key={field.field} value={field.field}>
                                {field.label} {field.required && '*'}
                              </option>
                            ))}
                          </select>
                        </div>
                        {isAutoMapped && (
                          <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-full">
                            Auto-mapped
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Missing required fields */}
                {REQUIRED_FIELDS.some(field => 
                  field.required && !Object.values(columnMapping).includes(field.field)
                ) && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      Missing required mappings: {REQUIRED_FIELDS.filter(field => 
                        field.required && !Object.values(columnMapping).includes(field.field)
                      ).map(f => f.label).join(', ')}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Preview & Validate */}
            {currentStep === 2 && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{importSummary.total}</p>
                    <p className="text-xs text-gray-500">Total</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-600">{importSummary.valid}</p>
                    <p className="text-xs text-green-600">Valid</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-600">{importSummary.invalid}</p>
                    <p className="text-xs text-red-600">Invalid</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-blue-600">{importSummary.readyToImport}</p>
                    <p className="text-xs text-blue-600">Ready</p>
                  </div>
                </div>

                {/* Search and Filter */}
                <div className="flex gap-2">
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
                    <option value="all">All</option>
                    <option value="valid">Valid</option>
                    <option value="invalid">Invalid</option>
                    <option value="warning">Warnings</option>
                  </select>
                </div>

                {/* Preview Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Row</th>
                        <th className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Name</th>
                        <th className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Email</th>
                        <th className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Role</th>
                        <th className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Status</th>
                        <th className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Issues</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredPreviewUsers.map(user => (
                        <tr key={user.id}>
                          <td className="p-2 text-sm text-gray-500">{user.rowNumber}</td>
                          <td className="p-2 text-sm text-gray-900 dark:text-white">
                            {user.firstName} {user.lastName}
                          </td>
                          <td className="p-2 text-sm text-gray-600 dark:text-gray-400">{user.email}</td>
                          <td className="p-2">
                            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-full">
                              {user.role}
                            </span>
                          </td>
                          <td className="p-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs ${
                              user.status === 'valid'
                                ? 'bg-green-100 text-green-700'
                                : user.status === 'warning'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {user.status}
                            </span>
                          </td>
                          <td className="p-2">
                            {user.errors.length > 0 && (
                              <div className="space-y-0.5">
                                {user.errors.map((error, i) => (
                                  <p key={i} className="text-xs text-red-600">{error}</p>
                                ))}
                              </div>
                            )}
                            {user.warnings.length > 0 && (
                              <div className="space-y-0.5">
                                {user.warnings.map((warning, i) => (
                                  <p key={i} className="text-xs text-yellow-600">{warning}</p>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Preview Pagination */}
                {totalPreviewPages > 1 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      Page {previewPage} of {totalPreviewPages}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPreviewPage(p => Math.max(1, p - 1))}
                        disabled={previewPage === 1}
                        className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setPreviewPage(p => Math.min(totalPreviewPages, p + 1))}
                        disabled={previewPage === totalPreviewPages}
                        className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Advanced Options */}
                <div>
                  <button
                    onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                    className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900"
                  >
                    {showAdvancedOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    Advanced Options
                  </button>
                  {showAdvancedOptions && (
                    <div className="mt-3 space-y-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={importOptions.skipDuplicates}
                          onChange={(e) => setImportOptions(prev => ({ ...prev, skipDuplicates: e.target.checked }))}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Skip duplicate emails</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={importOptions.sendWelcomeEmail}
                          onChange={(e) => setImportOptions(prev => ({ ...prev, sendWelcomeEmail: e.target.checked }))}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Send welcome email</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={importOptions.autoActivate}
                          onChange={(e) => setImportOptions(prev => ({ ...prev, autoActivate: e.target.checked }))}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Auto-activate users</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 4: Import Progress */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="bg-white dark:bg-gray-700/50 rounded-lg p-6 text-center">
                  <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Importing Users...
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Please wait while we import your users
                  </p>
                </div>
                
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
                <p className="text-center text-sm text-gray-500">
                  {importProgress}% complete
                </p>
              </div>
            )}

            {/* Step 5: Complete */}
            {currentStep === 4 && importResult && (
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 text-center">
                  <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Import Complete!
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Successfully imported {importResult.successCount} users
                  </p>
                </div>
                
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{importResult.totalRows}</p>
                    <p className="text-xs text-gray-500">Total</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-600">{importResult.successCount}</p>
                    <p className="text-xs text-green-600">Success</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-600">{importResult.failedCount}</p>
                    <p className="text-xs text-red-600">Failed</p>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-yellow-600">{importResult.warningCount}</p>
                    <p className="text-xs text-yellow-600">Warnings</p>
                  </div>
                </div>
                
                {importResult.errors.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Errors ({importResult.errors.length})
                    </h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {importResult.errors.map((error, index) => (
                        <div key={index} className="p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs">
                          <span className="font-medium">Row {error.rowNumber}:</span> {error.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Navigation */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
            <div>
              {currentStep > 0 && currentStep < 4 && (
                <button
                  onClick={handlePrevious}
                  disabled={isProcessing || isImporting}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
              )}
            </div>
            <div className="flex gap-3">
              {currentStep === 0 && (
                <>
                  <button
                    onClick={onCancel || onClose}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!selectedFile || isProcessing}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
              
              {currentStep === 1 && (
                <>
                  <button
                    onClick={handlePrevious}
                    disabled={isProcessing}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleValidate}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Validate
                  </button>
                </>
              )}
              
              {currentStep === 2 && (
                <>
                  <button
                    onClick={handlePrevious}
                    disabled={isImporting}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={isImporting || importSummary.readyToImport === 0}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <UserPlus className="w-4 h-4" />
                    Import {importSummary.readyToImport} Users
                  </button>
                </>
              )}
              
              {currentStep === 4 && (
                <>
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Import More
                  </button>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Done
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserImportWizard;
