// D:\Projects\Kalwanga\packages\web\components\shifts\RegisterModal.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AlertCircle,
  RefreshCw,
  Building2,
  Hash,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Wand2,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/Dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/Select';
import { Alert, AlertDescription } from '../ui/Alert';
import { useBusinessUnits } from '../../hooks/useBusinessUnits';
import {
  generateRegisterCode,
  validateRegisterCode,
  previewRegisterCode,
  findNextAvailableCode,
} from '../../utils/registerCodeGenerator';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  initialData?: any;
  isEditing?: boolean;
  existingRegisters?: Array<{ id: string; code: string; name: string }>;
}

export function RegisterModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isEditing,
  existingRegisters = [],
}: RegisterModalProps) {
  const {
    businessUnits,
    isLoading: loadingUnits,
    error: unitsError,
    fetchBusinessUnits,
  } = useBusinessUnits();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isCodeManuallyEdited, setIsCodeManuallyEdited] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    businessUnitId: '',
  });

  // ============================================
  // MEMOIZED VALUES
  // ============================================

  const selectedBusinessUnit = useMemo(() => {
    return businessUnits.find((bu) => bu.id === formData.businessUnitId);
  }, [businessUnits, formData.businessUnitId]);

  const existingCodesForUnit = useMemo(() => {
    return existingRegisters
      .filter((r) => r.id !== initialData?.id)
      .map((r) => r.code);
  }, [existingRegisters, initialData?.id]);

  const conflictingRegister = useMemo(() => {
    if (!formData.code || isEditing) return null;
    const upperCode = formData.code.toUpperCase();
    return existingRegisters.find(
      (r) =>
        r.code.toUpperCase() === upperCode && r.id !== initialData?.id
    );
  }, [formData.code, existingRegisters, initialData?.id, isEditing]);

  const codePreview = useMemo(() => {
    if (!selectedBusinessUnit || !formData.name.trim()) return '';
    return previewRegisterCode(
      selectedBusinessUnit.code,
      formData.name,
      existingCodesForUnit
    );
  }, [selectedBusinessUnit, formData.name, existingCodesForUnit]);

  const suggestedCode = useMemo(() => {
    if (!conflictingRegister || !formData.code) return '';
    return findNextAvailableCode(formData.code, existingCodesForUnit);
  }, [conflictingRegister, formData.code, existingCodesForUnit]);

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMessage(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        code: initialData.code || '',
        businessUnitId: initialData.businessUnitId || '',
      });
      setIsCodeManuallyEdited(true);
    } else if (businessUnits.length > 0) {
      const firstActive = businessUnits.find((bu) => bu.isActive !== false);
      setFormData({
        name: '',
        code: '',
        businessUnitId: firstActive?.id || businessUnits[0]?.id || '',
      });
      setIsCodeManuallyEdited(false);
    }
  }, [initialData, businessUnits]);

  useEffect(() => {
    if (
      !isEditing &&
      !isCodeManuallyEdited &&
      selectedBusinessUnit &&
      formData.name.trim()
    ) {
      const generatedCode = generateRegisterCode({
        businessUnitCode: selectedBusinessUnit.code,
        registerName: formData.name,
        existingCodes: existingCodesForUnit,
      });
      setFormData((prev) => ({ ...prev, code: generatedCode }));
    }
  }, [
    formData.name,
    selectedBusinessUnit,
    isEditing,
    isCodeManuallyEdited,
    existingCodesForUnit,
  ]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleNameChange = useCallback(
    (value: string) => {
      setFormData((prev) => ({ ...prev, name: value }));
      if (!isEditing) setIsCodeManuallyEdited(false);
      setSuccessMessage(null);
    },
    [isEditing]
  );

  const handleBusinessUnitChange = useCallback(
    (value: string) => {
      setFormData((prev) => ({ ...prev, businessUnitId: value }));
      if (!isEditing) setIsCodeManuallyEdited(false);
      setSuccessMessage(null);
    },
    [isEditing]
  );

  const handleCodeChange = useCallback((value: string) => {
    setFormData((prev) => ({ ...prev, code: value.toUpperCase() }));
    setIsCodeManuallyEdited(true);
    setSuccessMessage(null);
  }, []);

  const handleRegenerateCode = useCallback(() => {
    if (selectedBusinessUnit && formData.name.trim()) {
      const generatedCode = generateRegisterCode({
        businessUnitCode: selectedBusinessUnit.code,
        registerName: formData.name,
        existingCodes: existingCodesForUnit,
      });
      setFormData((prev) => ({ ...prev, code: generatedCode }));
      setIsCodeManuallyEdited(false);
      setSuccessMessage(null);
    }
  }, [selectedBusinessUnit, formData.name, existingCodesForUnit]);

  const handleAutoFixCode = useCallback(() => {
    if (!formData.code) return;
    const fixed = findNextAvailableCode(formData.code, existingCodesForUnit);
    setFormData((prev) => ({ ...prev, code: fixed }));
    setIsCodeManuallyEdited(true);
    setSuccessMessage(`Code updated to "${fixed}" to avoid duplication`);
  }, [formData.code, existingCodesForUnit]);

  // ============================================
  // SUBMIT
  // ============================================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!formData.name.trim()) {
      setError('Register name is required');
      return;
    }

    if (!formData.code.trim()) {
      setError('Register code is required');
      return;
    }

    const codeValidation = validateRegisterCode(formData.code);
    if (!codeValidation.valid) {
      setError(codeValidation.error || 'Invalid register code');
      return;
    }

    if (!formData.businessUnitId) {
      setError('Business unit is required');
      return;
    }

    if (conflictingRegister) {
      if (suggestedCode) {
        setError(
          `Code "${formData.code}" already exists. Try "${suggestedCode}" or click "Auto-fix".`
        );
      } else {
        setError(`A register with code "${formData.code}" already exists`);
      }
      return;
    }

    setLoading(true);
    try {
      await onSubmit(formData);
    } catch (err: any) {
      const backendMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Failed to save register';

      if (backendMessage.includes('already exists') && formData.code) {
        const autoFix = findNextAvailableCode(
          formData.code,
          existingCodesForUnit
        );
        if (autoFix && autoFix !== formData.code) {
          setError(
            `Code "${formData.code}" already exists. Suggested: "${autoFix}"`
          );
        } else {
          setError(backendMessage);
        }
      } else {
        setError(backendMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshUnits = useCallback(() => {
    fetchBusinessUnits();
  }, [fetchBusinessUnits]);

  // ============================================
  // RENDER
  // ============================================

  const canSubmit =
    !loading &&
    formData.businessUnitId &&
    formData.name.trim() &&
    formData.code.trim() &&
    !conflictingRegister;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            {isEditing ? 'Edit Register' : 'Create New Register'}
          </DialogTitle>
          <DialogDescription className="text-gray-500 dark:text-gray-400">
            {isEditing
              ? 'Update the register details below.'
              : 'Add a new cash register to manage shifts.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            {/* Error Alert */}
            {error && (
              <Alert
                variant="destructive"
                className="bg-danger-50 dark:bg-danger-950/30 border-danger-200 dark:border-danger-900"
              >
                <AlertCircle className="h-4 w-4 text-danger-600 dark:text-danger-400" />
                <AlertDescription className="flex items-start justify-between gap-2 text-danger-700 dark:text-danger-300">
                  <span>{error}</span>
                  {suggestedCode && conflictingRegister && (
                    <button
                      type="button"
                      onClick={handleAutoFixCode}
                      className="text-2xs font-medium underline hover:no-underline whitespace-nowrap flex items-center gap-1 focus-ring rounded"
                    >
                      <Wand2 className="w-3 h-3" />
                      Auto-fix
                    </button>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Success Alert (from auto-fix) */}
            {successMessage && (
              <Alert className="border-success-200 dark:border-success-900 bg-success-50 dark:bg-success-950/30">
                <CheckCircle2 className="h-4 w-4 text-success-600 dark:text-success-400 animate-badge-pop" />
                <AlertDescription className="text-success-700 dark:text-success-300">
                  {successMessage}
                </AlertDescription>
              </Alert>
            )}

            {/* Business Units Error */}
            {unitsError && (
              <Alert
                variant="destructive"
                className="bg-danger-50 dark:bg-danger-950/30 border-danger-200 dark:border-danger-900"
              >
                <AlertCircle className="h-4 w-4 text-danger-600 dark:text-danger-400" />
                <AlertDescription className="flex items-center justify-between text-danger-700 dark:text-danger-300">
                  <span>{unitsError}</span>
                  <button
                    type="button"
                    onClick={handleRefreshUnits}
                    className="text-sm underline hover:no-underline flex items-center gap-1 focus-ring rounded"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Retry
                  </button>
                </AlertDescription>
              </Alert>
            )}

            {/* Register Name */}
            <div className="space-y-2">
              <Label
                htmlFor="name"
                required
                className="text-gray-700 dark:text-gray-300"
              >
                Register Name
              </Label>
              <Input
                id="name"
                placeholder="e.g., Main Counter, Front Register"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
                autoComplete="off"
                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:ring-brand-500"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                A descriptive name for this register
              </p>
            </div>

            {/* Business Unit */}
            <div className="space-y-2">
              <Label
                htmlFor="businessUnit"
                required
                className="text-gray-700 dark:text-gray-300"
              >
                Business Unit
              </Label>
              {loadingUnits ? (
                <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <RefreshCw className="w-4 h-4 animate-spin text-gray-400 dark:text-gray-500" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Loading business units...
                  </span>
                </div>
              ) : businessUnits.length === 0 ? (
                <div className="flex items-center gap-2 px-3 py-2 border border-warning-200 dark:border-warning-900 rounded-lg bg-warning-50 dark:bg-warning-950/30">
                  <AlertCircle className="w-4 h-4 text-warning-600 dark:text-warning-400" />
                  <span className="text-sm text-warning-700 dark:text-warning-300">
                    No business units available
                  </span>
                </div>
              ) : (
                <Select
                  value={formData.businessUnitId}
                  onValueChange={handleBusinessUnitChange}
                >
                  <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus-visible:ring-brand-500">
                    <SelectValue placeholder="Select business unit" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    {businessUnits
                      .filter((unit) => unit.isActive !== false)
                      .map((unit) => (
                        <SelectItem
                          key={unit.id}
                          value={unit.id}
                          className="text-gray-900 dark:text-white focus:bg-brand-50 dark:focus:bg-gray-700"
                        >
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                            <span>{unit.name}</span>
                            <span className="text-2xs text-gray-400 dark:text-gray-500">
                              ({unit.code})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
              {selectedBusinessUnit && (
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <Building2 className="w-3 h-3" />
                  <span>
                    Code prefix:{' '}
                    <span className="font-mono font-medium text-gray-700 dark:text-gray-300">
                      {selectedBusinessUnit.code}
                    </span>
                  </span>
                </div>
              )}
            </div>

            {/* Register Code - Auto-generated */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="code"
                  required
                  className="text-gray-700 dark:text-gray-300"
                >
                  Register Code
                </Label>
                <div className="flex items-center gap-2">
                  {!isEditing && codePreview && (
                    <button
                      type="button"
                      onClick={handleRegenerateCode}
                      className="text-2xs text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 flex items-center gap-1 font-medium focus-ring rounded"
                    >
                      <Sparkles className="w-3 h-3" />
                      Auto-generate
                    </button>
                  )}
                  {conflictingRegister && suggestedCode && (
                    <button
                      type="button"
                      onClick={handleAutoFixCode}
                      className="text-2xs text-warning-600 dark:text-warning-400 hover:text-warning-800 dark:hover:text-warning-300 flex items-center gap-1 font-medium focus-ring rounded"
                    >
                      <Wand2 className="w-3 h-3" />
                      Auto-fix
                    </button>
                  )}
                </div>
              </div>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <Input
                  id="code"
                  placeholder="e.g., KCL-E-001"
                  value={formData.code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  required
                  className={`pl-10 font-mono bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:ring-brand-500 ${
                    conflictingRegister
                      ? 'border-danger-300 focus-visible:ring-danger-500 dark:border-danger-700'
                      : ''
                  }`}
                  autoComplete="off"
                />
              </div>

              {/* Conflict warning */}
              {conflictingRegister && (
                <div className="flex items-start gap-2 p-2 rounded-md bg-warning-50 dark:bg-warning-950/30 border border-warning-200 dark:border-warning-900">
                  <AlertTriangle className="w-3.5 h-3.5 text-warning-600 dark:text-warning-400 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-warning-700 dark:text-warning-300">
                    <p className="font-medium">Code already in use</p>
                    <p className="text-warning-600 dark:text-warning-400 mt-0.5">
                      Used by &ldquo;{conflictingRegister.name}&rdquo;
                      {suggestedCode && (
                        <>
                          {' '}
                          — try{' '}
                          <button
                            type="button"
                            onClick={handleAutoFixCode}
                            className="font-mono font-semibold underline hover:no-underline focus-ring rounded"
                          >
                            {suggestedCode}
                          </button>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Code preview/help text */}
              {!isEditing && !conflictingRegister && (
                <div className="space-y-1">
                  {codePreview && formData.code !== codePreview ? (
                    <p className="text-xs text-brand-600 dark:text-brand-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Suggested:{' '}
                      <span className="font-mono font-medium">
                        {codePreview}
                      </span>
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Auto-generated from business unit and register name
                    </p>
                  )}
                  <p className="text-2xs text-gray-400 dark:text-gray-500">
                    Format:{' '}
                    <span className="font-mono">
                      {'{BUSINESS_UNIT}-{INITIALS}-{NUMBER}'}
                    </span>
                  </p>
                </div>
              )}

              {isEditing && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Unique identifier for this register
                </p>
              )}
            </div>

            {/* Preview Card */}
            {!isEditing &&
              formData.name &&
              formData.code &&
              selectedBusinessUnit && (
                <div className="bg-gradient-to-r from-brand-50 to-brand-accent-50 dark:from-brand-950/40 dark:to-brand-accent-950/40 rounded-lg p-4 border border-brand-100 dark:border-brand-900">
                  <p className="text-2xs font-medium text-brand-600 dark:text-brand-400 mb-2 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Preview
                  </p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">
                        Name:
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formData.name}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">
                        Code:
                      </span>
                      <span className="font-mono font-medium text-gray-900 dark:text-white">
                        {formData.code}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">
                        Business Unit:
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {selectedBusinessUnit.name}
                      </span>
                    </div>
                  </div>
                </div>
              )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="focus-ring"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              className="bg-brand-gradient hover:bg-brand-gradient-hover text-white shadow-brand focus-ring"
            >
              {loading ? 'Saving...' : isEditing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
