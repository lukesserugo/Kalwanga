// D:\Projects\Kalwanga\packages\web\components\shifts\ShiftsDashboard.tsx
'use client';

import { useState, useEffect, useCallback, ChangeEvent } from 'react';
import {
  Plus,
  RefreshCw,
  Clock,
  LayoutGrid,
  List,
  Search,
} from 'lucide-react';
import { useShifts } from '../../hooks/useShifts';
import { RegisterList } from './RegisterList';
import { RegisterModal } from './RegisterModal';
import { ShiftModal } from './ShiftModal';
import { ShiftStats } from './ShiftStats';
import { CurrentShiftCard } from './CurrentShiftCard';
import { ShiftHistory } from './ShiftHistory';
import { EmptyState } from './EmptyState';
import { NoActiveShiftCard } from './NoActiveShiftCard';
import { ShiftsDashboardSkeleton } from './ShiftsDashboardSkeleton';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs';
import { Badge } from '../ui/Badge';
import { RegisterCard } from './RegisterCard';
import type { Register, Shift, ShiftScope } from '../../types/register';

// ============================================
// BUSINESS UNIT PERSISTENCE
// ============================================
//
// When a register is created, the modal sends `businessUnitId` in
// the POST body. The backend saves the register under that unit.
// But the FETCH path (`GET /shifts/registers`) has no body, so it
// resolves the business unit from `req.query.businessUnitId` or,
// if absent, falls through to the user's primary unit.
//
// If the user's primary unit differs from the modal's selection,
// the create and fetch resolve to different units, and the register
// is invisible.
//
// Writing the chosen unit to localStorage closes the gap: the
// frontend sends it on every subsequent fetch, so both paths agree.

const BUSINESS_UNIT_STORAGE_KEYS = [
  'selectedBusinessUnitId',
  'businessUnitId',
] as const;

function persistBusinessUnitId(businessUnitId: string | undefined | null) {
  if (!businessUnitId) return;
  if (
    businessUnitId === 'default' ||
    businessUnitId === 'null' ||
    businessUnitId === 'undefined'
  ) {
    return;
  }
  try {
    for (const key of BUSINESS_UNIT_STORAGE_KEYS) {
      localStorage.setItem(key, businessUnitId);
    }
  } catch {
    /* storage unavailable */
  }
}

// ============================================
// TOAST
// ============================================

const toast = {
  success: (message: string) => console.log('✅', message),
  error: (message: string) => console.error('❌', message),
  warning: (message: string) => console.warn('⚠️', message),
  info: (message: string) => console.info('ℹ️', message),
};

// ============================================
// REGISTER GRID COMPONENT
// ============================================

function RegisterGridComponent({
  registers,
  currentShift,
  onEdit,
  onDelete,
  onStartShift,
  onEndShift,
  onAddCash,
  onRemoveCash,
}: {
  registers: Register[];
  currentShift: Shift | null;
  onEdit: (register: Register) => void;
  onDelete: (id: string) => void;
  onStartShift: (register: Register) => void;
  onEndShift: (id: string, data: { endingBalance: number; notes?: string }) => void;
  onAddCash: (register: Register, amount: number, description?: string) => void;
  onRemoveCash: (register: Register, amount: number, description?: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {registers.map((register: Register) => (
        <RegisterCard
          key={register.id}
          register={register}
          currentShift={currentShift}
          onEdit={onEdit}
          onDelete={onDelete}
          onStartShift={onStartShift}
          onEndShift={onEndShift}
          onAddCash={onAddCash}
          onRemoveCash={onRemoveCash}
        />
      ))}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ShiftsDashboard() {
  const {
    registers,
    currentShift,
    isLoading,
    stats,
    shifts,
    shiftsTotal,
    shiftsTotalPages,
    fetchRegisters,
    fetchCurrentShift,
    fetchStats,
    fetchShifts,
    createRegister,
    updateRegister,
    deleteRegister,
    startShift,
    endShift,
    addCash,
    removeCash,
  } = useShifts();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);
  const [showShiftModal, setShowShiftModal] = useState<boolean>(false);
  const [editingRegister, setEditingRegister] = useState<Register | null>(null);
  const [selectedRegister, setSelectedRegister] = useState<Register | null>(null);
  const [activeTab, setActiveTab] = useState<string>('registers');

  // Shift history state — scope + pagination
  const [shiftsScope, setShiftsScope] = useState<ShiftScope>('businessUnit');
  const [shiftsPage, setShiftsPage] = useState<number>(1);
  const [shiftsHistoryLoading, setShiftsHistoryLoading] = useState<boolean>(false);

  // ============================================
  // DATA LOADING
  // ============================================

  const loadData = useCallback(async () => {
    try {
      await Promise.all([
        fetchRegisters(),
        fetchCurrentShift(),
        fetchStats(),
      ]);
    } catch (error) {
      console.error('Failed to load shifts data:', error);
    }
  }, [fetchRegisters, fetchCurrentShift, fetchStats]);

  const loadShiftsHistory = useCallback(
    async (scope: ShiftScope = shiftsScope, page: number = shiftsPage) => {
      try {
        setShiftsHistoryLoading(true);
        await fetchShifts({
          scope,
          page,
          limit: 50,
        });
      } catch (error) {
        console.error('Failed to load shift history:', error);
      } finally {
        setShiftsHistoryLoading(false);
      }
    },
    [fetchShifts, shiftsScope, shiftsPage]
  );

  // Initial data load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Lazy-load shift history when the History tab is opened
  useEffect(() => {
    if (activeTab === 'history') {
      loadShiftsHistory(shiftsScope, shiftsPage);
    }
  }, [activeTab, shiftsScope, shiftsPage, loadShiftsHistory]);

  // ============================================
  // DERIVED DATA
  // ============================================

  const filteredRegisters = registers.filter((register: Register) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      register.name?.toLowerCase().includes(term) ||
      register.code?.toLowerCase().includes(term)
    );
  });

  const existingRegistersForModal = registers.map((r: Register) => ({
    id: r.id,
    code: r.code,
    name: r.name,
  }));

  const activeRegisterCount = registers.filter((r: Register) => r.isActive).length;

  // ============================================
  // HANDLERS
  // ============================================

  /**
   * Create a register.
   *
   * After the create succeeds, the modal's chosen `businessUnitId`
   * is written to localStorage. That makes `readStoredBusinessUnitId`
   * in `useShifts` return the SAME unit on the subsequent
   * `fetchRegisters()` call that `loadData()` triggers — so the
   * new register appears in the list instead of being queried from
   * a different unit.
   *
   * Without this write, the create path (which sends the ID in the
   * body) and the fetch path (which reads from query params or
   * falls back to the user's primary unit) can disagree about
   * which unit to use.
   */
  const handleCreateRegister = async (data: any) => {
    try {
      const created = await createRegister(data);
      console.log('✅ Register created:', created);

      // Persist the chosen unit BEFORE the re-fetch below.
      persistBusinessUnitId(data?.businessUnitId);

      toast.success('Register created successfully');
      setShowRegisterModal(false);
      setEditingRegister(null);
      await new Promise((resolve) => setTimeout(resolve, 150));
      await loadData();
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to create register';
      toast.error(message);
      throw error;
    }
  };

  /**
   * Update a register.
   *
   * The edit modal doesn't currently send `businessUnitId` (the
   * backend's `updateRegisterSchema` only accepts name/code/isActive),
   * so there's nothing new to persist here. If you later add
   * business-unit reassignment to the modal, call
   * `persistBusinessUnitId(data.businessUnitId)` here too.
   */
  const handleUpdateRegister = async (data: any) => {
    try {
      if (!editingRegister) return;
      await updateRegister(editingRegister.id, data);

      // Defensive — if the modal ever starts sending a business
      // unit, persist it. Today this is a no-op.
      if (data?.businessUnitId) {
        persistBusinessUnitId(data.businessUnitId);
      }

      toast.success('Register updated successfully');
      setShowRegisterModal(false);
      setEditingRegister(null);
      await new Promise((resolve) => setTimeout(resolve, 150));
      await loadData();
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to update register';
      toast.error(message);
      throw error;
    }
  };

  const handleDeleteRegister = async (id: string) => {
    if (!confirm('Are you sure you want to delete this register?')) return;
    try {
      await deleteRegister(id);
      toast.success('Register deleted successfully');
      await loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete register');
    }
  };

  const handleStartShift = async (data: any) => {
    try {
      await startShift(data);
      toast.success('Shift started successfully');
      setShowShiftModal(false);
      setSelectedRegister(null);
      await loadData();
      if (activeTab === 'history') {
        await loadShiftsHistory(shiftsScope, shiftsPage);
      }
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to start shift';
      toast.error(message);
      throw error;
    }
  };

  const handleEndShift = async (
    id: string,
    data: { endingBalance: number; notes?: string }
  ): Promise<void> => {
    try {
      await endShift(id, data);
      toast.success('Shift ended successfully');
      await loadData();
      if (activeTab === 'history') {
        await loadShiftsHistory(shiftsScope, shiftsPage);
      }
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to end shift';
      toast.error(message);
      throw error;
    }
  };

  const handleAddCash = async (
    sessionId: string,
    amount: number,
    description?: string
  ): Promise<void> => {
    try {
      await addCash(sessionId, { amount, description });
      toast.success('Cash added successfully');
      await loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add cash');
      throw error;
    }
  };

  const handleRemoveCash = async (
    sessionId: string,
    amount: number,
    description?: string
  ): Promise<void> => {
    try {
      await removeCash(sessionId, { amount, description });
      toast.success('Cash removed successfully');
      await loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove cash');
      throw error;
    }
  };

  // ============================================
  // WRAPPERS FOR REGISTER OBJECT
  // ============================================

  const handleAddCashForRegister = async (
    register: Register,
    amount: number,
    description?: string
  ): Promise<void> => {
    const sessionId = register.currentSession?.id || register.id;
    await handleAddCash(sessionId, amount, description);
  };

  const handleRemoveCashForRegister = async (
    register: Register,
    amount: number,
    description?: string
  ): Promise<void> => {
    const sessionId = register.currentSession?.id || register.id;
    await handleRemoveCash(sessionId, amount, description);
  };

  // ============================================
  // MODAL HANDLERS
  // ============================================

  const handleOpenCreateModal = () => {
    setEditingRegister(null);
    setShowRegisterModal(true);
  };

  const handleOpenEditModal = (register: Register) => {
    setEditingRegister(register);
    setShowRegisterModal(true);
  };

  const handleCloseRegisterModal = () => {
    setShowRegisterModal(false);
    setEditingRegister(null);
  };

  const handleOpenShiftModal = (register: Register) => {
    setSelectedRegister(register);
    setShowShiftModal(true);
  };

  const handleCloseShiftModal = () => {
    setShowShiftModal(false);
    setSelectedRegister(null);
  };

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleScopeChange = (scope: ShiftScope) => {
    setShiftsScope(scope);
    setShiftsPage(1);
  };

  const handleShiftPageChange = (page: number) => {
    setShiftsPage(page);
  };

  // ============================================
  // RENDER
  // ============================================

  if (isLoading && !registers.length) {
    return <ShiftsDashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 transition-colors duration-200">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Shift Management
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              Manage cash registers, shifts, and transactions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus-ring"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button
              onClick={handleOpenCreateModal}
              className="btn-brand shadow-brand focus-ring"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Register
            </Button>
          </div>
        </div>

        {/* Stats */}
        <ShiftStats stats={stats} currentShift={currentShift} />

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <TabsList className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <TabsTrigger
                value="registers"
                className="flex items-center gap-2 text-gray-600 dark:text-gray-400 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white"
              >
                <LayoutGrid className="w-4 h-4" />
                Registers
                <Badge variant="secondary" className="ml-1">
                  {activeRegisterCount}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="current"
                className="flex items-center gap-2 text-gray-600 dark:text-gray-400 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white"
              >
                <Clock className="w-4 h-4" />
                Current Shift
                {currentShift && (
                  <Badge variant="success" className="ml-1">
                    Active
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="flex items-center gap-2 text-gray-600 dark:text-gray-400 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white"
              >
                <Clock className="w-4 h-4" />
                History
                {shiftsTotal > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {shiftsTotal}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {activeTab === 'registers' && (
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
                  <Input
                    placeholder="Search registers..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="pl-9 w-48 md:w-64 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:ring-brand-500"
                  />
                </div>
                <div className="flex gap-1 border border-gray-200 dark:border-gray-700 rounded-lg p-1 bg-white dark:bg-gray-800">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded transition-colors duration-200 focus-ring ${
                      viewMode === 'grid'
                        ? 'bg-brand-500 dark:bg-brand-600 text-white'
                        : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-brand-50 dark:hover:bg-gray-700'
                    }`}
                    aria-label="Grid view"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded transition-colors duration-200 focus-ring ${
                      viewMode === 'list'
                        ? 'bg-brand-500 dark:bg-brand-600 text-white'
                        : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-brand-50 dark:hover:bg-gray-700'
                    }`}
                    aria-label="List view"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <TabsContent value="registers">
            {filteredRegisters.length === 0 ? (
              <EmptyState onAdd={handleOpenCreateModal} searchTerm={searchTerm} />
            ) : viewMode === 'grid' ? (
              <RegisterGridComponent
                registers={filteredRegisters}
                currentShift={currentShift}
                onEdit={handleOpenEditModal}
                onDelete={handleDeleteRegister}
                onStartShift={handleOpenShiftModal}
                onEndShift={handleEndShift}
                onAddCash={handleAddCashForRegister}
                onRemoveCash={handleRemoveCashForRegister}
              />
            ) : (
              <RegisterList
                registers={filteredRegisters}
                currentShift={currentShift}
                onEdit={handleOpenEditModal}
                onDelete={handleDeleteRegister}
                onStartShift={handleOpenShiftModal}
                onEndShift={handleEndShift}
              />
            )}
          </TabsContent>

          <TabsContent value="current">
            {currentShift ? (
              <CurrentShiftCard
                shift={currentShift}
                onEndShift={handleEndShift}
                onAddCash={async (amount: number, description?: string) => {
                  if (!currentShift) return;
                  await handleAddCash(currentShift.id, amount, description);
                }}
                onRemoveCash={async (amount: number, description?: string) => {
                  if (!currentShift) return;
                  await handleRemoveCash(currentShift.id, amount, description);
                }}
              />
            ) : (
              <NoActiveShiftCard />
            )}
          </TabsContent>

          <TabsContent value="history">
            <ShiftHistory
              shifts={shifts}
              scope={shiftsScope}
              onScopeChange={handleScopeChange}
              currentPage={shiftsPage}
              totalPages={shiftsTotalPages}
              total={shiftsTotal}
              onPageChange={handleShiftPageChange}
              onViewShift={(shift) => {
                console.log('View shift:', shift);
              }}
              isLoading={shiftsHistoryLoading}
            />
          </TabsContent>
        </Tabs>

        {/* Register Modal */}
        <RegisterModal
          isOpen={showRegisterModal}
          onClose={handleCloseRegisterModal}
          onSubmit={editingRegister ? handleUpdateRegister : handleCreateRegister}
          initialData={editingRegister}
          isEditing={!!editingRegister}
          existingRegisters={existingRegistersForModal}
        />

        {/* Shift Modal */}
        <ShiftModal
          isOpen={showShiftModal}
          onClose={handleCloseShiftModal}
          onSubmit={handleStartShift}
          register={selectedRegister}
        />
      </div>
    </div>
  );
}
