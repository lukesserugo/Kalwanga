// D:\Projects\Kalwanga\packages\web\components\inventory\InventoryAuditLog.tsx

'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield, Clock, User, Package, Edit, Trash2,
  Plus, Filter, RefreshCw, Search, Download,
  ChevronLeft, ChevronRight, Eye, FileText,
  ArrowUp, Barcode, QrCode, Scan, Copy, Check,
  Printer, Link2
} from 'lucide-react';
import { toast } from '../../utils/toast-manager';
import { useAuth } from '../../hooks/useAuth';
import { formatDate } from '../../utils/formatters';
import { barcodeService } from '../../services/barcodeService';

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName: string;
  changes: Record<string, { old: any; new: any }>;
  userId: string;
  user: { firstName: string; lastName: string };
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  barcode?: string;
  qrCodeData?: string;
  severity?: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface AuditFilters {
  action: string;
  entityType: string;
  startDate: string;
  endDate: string;
  hasBarcode: 'all' | 'yes' | 'no';
}

export function InventoryAuditLog() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<AuditFilters>({
    action: '',
    entityType: '',
    startDate: '',
    endDate: '',
    hasBarcode: 'all',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [copiedBarcode, setCopiedBarcode] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const businessUnitId = user?.businessUnits?.[0]?.businessUnitId || '';

  useEffect(() => {
    loadAuditLog();
  }, [businessUnitId, filter, pagination.page]);

  const loadAuditLog = async () => {
    try {
      setLoading(true);
      // Load audit log from API with barcode filters
      // const data = await inventoryService.getAuditLog({ ...filter, ...pagination });
      // setEntries(data.data);
      // setPagination(prev => ({ ...prev, total: data.total, totalPages: data.totalPages }));
      
      // Mock data with barcode entries
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const mockEntries: AuditEntry[] = [
        {
          id: '1',
          action: 'CREATE',
          entityType: 'PRODUCT',
          entityId: 'prod_1',
          entityName: 'iPhone 15 Pro',
          changes: { name: { old: '', new: 'iPhone 15 Pro' }, price: { old: 0, new: 999.99 } },
          userId: 'user_1',
          user: { firstName: 'John', lastName: 'Doe' },
          createdAt: new Date().toISOString(),
          severity: 'INFO',
        },
        {
          id: '2',
          action: 'BARCODE_GENERATE',
          entityType: 'PRODUCT',
          entityId: 'prod_1',
          entityName: 'iPhone 15 Pro',
          changes: { 
            barcode: { old: null, new: '8901234567890' },
            format: { old: '', new: 'EAN-13' }
          },
          userId: 'user_1',
          user: { firstName: 'John', lastName: 'Doe' },
          createdAt: new Date(Date.now() - 1800000).toISOString(),
          barcode: '8901234567890',
          severity: 'INFO',
        },
        {
          id: '3',
          action: 'BARCODE_SCAN',
          entityType: 'INVENTORY',
          entityId: 'inv_1',
          entityName: 'iPhone 15 Pro Stock',
          changes: { 
            scanned: { old: '', new: '8901234567890' },
            location: { old: 'Warehouse A', new: 'Store B' }
          },
          userId: 'user_2',
          user: { firstName: 'Jane', lastName: 'Smith' },
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          barcode: '8901234567890',
          severity: 'LOW',
        },
        {
          id: '4',
          action: 'QR_CODE_GENERATE',
          entityType: 'PRODUCT',
          entityId: 'prod_2',
          entityName: 'MacBook Pro',
          changes: { 
            qrCode: { old: null, new: 'QR-2024-001' },
            data: { old: '', new: '{"productId":"prod_2","sku":"MBP-2024"}' }
          },
          userId: 'user_3',
          user: { firstName: 'Bob', lastName: 'Johnson' },
          createdAt: new Date(Date.now() - 7200000).toISOString(),
          qrCodeData: 'QR-2024-001',
          severity: 'INFO',
        },
        {
          id: '5',
          action: 'UPDATE',
          entityType: 'INVENTORY',
          entityId: 'inv_2',
          entityName: 'Samsung Galaxy S24',
          changes: { 
            quantity: { old: 25, new: 24 },
            barcode: { old: null, new: '9876543210123' }
          },
          userId: 'user_1',
          user: { firstName: 'John', lastName: 'Doe' },
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          barcode: '9876543210123',
          severity: 'MEDIUM',
        },
        {
          id: '6',
          action: 'BARCODE_ASSOCIATE',
          entityType: 'INVENTORY',
          entityId: 'inv_3',
          entityName: 'Sony Headphones',
          changes: { 
            barcode: { old: null, new: '8765432109876' },
            status: { old: 'PENDING', new: 'ACTIVE' }
          },
          userId: 'user_2',
          user: { firstName: 'Jane', lastName: 'Smith' },
          createdAt: new Date(Date.now() - 129600000).toISOString(),
          barcode: '8765432109876',
          severity: 'LOW',
        },
        {
          id: '7',
          action: 'UPDATE',
          entityType: 'BARCODE',
          entityId: 'barcode_1',
          entityName: 'Barcode 8901234567890',
          changes: { 
            status: { old: 'ACTIVE', new: 'INACTIVE' },
            expiryDate: { old: '2025-12-31', new: '2024-12-31' }
          },
          userId: 'user_4',
          user: { firstName: 'Sarah', lastName: 'Williams' },
          createdAt: new Date(Date.now() - 172800000).toISOString(),
          barcode: '8901234567890',
          severity: 'HIGH',
        },
        {
          id: '8',
          action: 'BARCODE_SCAN',
          entityType: 'INVENTORY',
          entityId: 'inv_4',
          entityName: 'Dell XPS 15',
          changes: { 
            scanned: { old: '', new: '7654321098765' },
            quantity: { old: 12, new: 11 }
          },
          userId: 'user_5',
          user: { firstName: 'Mike', lastName: 'Brown' },
          createdAt: new Date(Date.now() - 259200000).toISOString(),
          barcode: '7654321098765',
          severity: 'LOW',
        },
      ];

      // Filter by barcode presence
      let filtered = mockEntries;
      if (filter.hasBarcode === 'yes') {
        filtered = mockEntries.filter(e => e.barcode || e.qrCodeData);
      } else if (filter.hasBarcode === 'no') {
        filtered = mockEntries.filter(e => !e.barcode && !e.qrCodeData);
      }

      setEntries(filtered);
      setPagination(prev => ({ ...prev, total: filtered.length, totalPages: 1 }));
    } catch (error) {
      console.error('Failed to load audit log:', error);
      toast.error('Failed to load audit log');
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      'CREATE': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      'UPDATE': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      'DELETE': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      'BARCODE_GENERATE': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
      'BARCODE_SCAN': 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
      'BARCODE_ASSOCIATE': 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
      'QR_CODE_GENERATE': 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
    };
    return colors[action] || 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300';
  };

  const getActionIcon = (action: string) => {
    const icons: Record<string, React.ReactNode> = {
      'CREATE': <Plus className="w-4 h-4" />,
      'UPDATE': <Edit className="w-4 h-4" />,
      'DELETE': <Trash2 className="w-4 h-4" />,
      'BARCODE_GENERATE': <Barcode className="w-4 h-4" />,
      'BARCODE_SCAN': <Scan className="w-4 h-4" />,
      'BARCODE_ASSOCIATE': <Link2 className="w-4 h-4" />,
      'QR_CODE_GENERATE': <QrCode className="w-4 h-4" />,
    };
    return icons[action] || <Shield className="w-4 h-4" />;
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      'BARCODE_GENERATE': 'Barcode Generated',
      'BARCODE_SCAN': 'Barcode Scanned',
      'BARCODE_ASSOCIATE': 'Barcode Associated',
      'QR_CODE_GENERATE': 'QR Code Generated',
    };
    return labels[action] || action;
  };

  const getSeverityBadge = (severity?: string) => {
    const badges: Record<string, { label: string; color: string }> = {
      'INFO': { label: 'Info', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
      'LOW': { label: 'Low', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
      'MEDIUM': { label: 'Medium', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
      'HIGH': { label: 'High', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
      'CRITICAL': { label: 'Critical', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
    };
    return badges[severity || 'INFO'] || badges['INFO'];
  };

  const handleCopyBarcode = async (barcode: string) => {
    try {
      await navigator.clipboard.writeText(barcode);
      setCopiedBarcode(barcode);
      toast.success('Barcode copied');
      setTimeout(() => setCopiedBarcode(null), 2000);
    } catch {
      toast.error('Failed to copy barcode');
    }
  };

  const handlePrintBarcode = (entry: AuditEntry) => {
    if (!entry.barcode) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Barcode - ${entry.entityName}</title>
          <style>
            body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: white; }
            .container { text-align: center; padding: 30px; border: 1px solid #ddd; border-radius: 8px; max-width: 400px; }
            .barcode-img { max-width: 300px; margin: 15px 0; }
            .qr-img { max-width: 150px; margin: 10px 0; }
            .product-name { margin: 0 0 5px 0; color: #1a1a1a; }
            .sku { color: #666; font-size: 12px; margin: 0 0 15px 0; }
            .info { margin-top: 15px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2 class="product-name">${entry.entityName}</h2>
            <p class="sku">${entry.entityType}</p>
            <img src="https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(entry.barcode!)}&code=EAN-13&dpi=96" alt="Barcode" class="barcode-img" />
            ${entry.qrCodeData ? `<img src="https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(JSON.stringify({ barcode: entry.barcode, entity: entry.entityName }))}&size=200x200" alt="QR Code" class="qr-img" />` : ''}
            <div class="info">
              <span>${entry.barcode}</span>
              <span>| ${formatDate(entry.createdAt)}</span>
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const renderBarcodeCell = (entry: AuditEntry) => {
    if (!entry.barcode && !entry.qrCodeData) {
      return <span className="text-xs text-gray-400">No barcode</span>;
    }
    
    return (
      <div className="flex items-center gap-1">
        {entry.barcode && (
          <>
            <Barcode className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
            <span className="text-xs font-mono text-gray-600 dark:text-gray-300 truncate max-w-[100px]">
              {entry.barcode}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopyBarcode(entry.barcode!);
              }}
              className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
              title="Copy barcode"
            >
              {copiedBarcode === entry.barcode ? (
                <Check className="w-3 h-3 text-green-500" />
              ) : (
                <Copy className="w-3 h-3 text-gray-400" />
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrintBarcode(entry);
              }}
              className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
              title="Print barcode"
            >
              <Printer className="w-3 h-3 text-gray-400" />
            </button>
          </>
        )}
        {entry.qrCodeData && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(JSON.stringify({ 
                qrCode: entry.qrCodeData,
                entity: entry.entityName,
                type: entry.entityType
              }))}&size=200x200`;
              window.open(qrUrl, '_blank');
            }}
            className="p-0.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
            title="View QR Code"
          >
            <QrCode className="w-3 h-3 text-blue-500" />
          </button>
        )}
      </div>
    );
  };

  const filteredEntries = entries.filter(entry => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      entry.entityName.toLowerCase().includes(query) ||
      entry.user.firstName.toLowerCase().includes(query) ||
      entry.user.lastName.toLowerCase().includes(query) ||
      (entry.barcode && entry.barcode.toLowerCase().includes(query)) ||
      (entry.qrCodeData && entry.qrCodeData.toLowerCase().includes(query))
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-gray-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Audit Log</h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            ({pagination.total} entries)
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, user, or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 border rounded-lg transition-colors ${
              showFilters || filter.hasBarcode !== 'all'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Filter className="w-4 h-4" />
          </button>
          <button
            onClick={loadAuditLog}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex flex-wrap items-center gap-3">
          <select
            value={filter.action}
            onChange={(e) => setFilter({ ...filter, action: e.target.value })}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
          >
            <option value="">All Actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
            <option value="BARCODE_GENERATE">Barcode Generate</option>
            <option value="BARCODE_SCAN">Barcode Scan</option>
            <option value="BARCODE_ASSOCIATE">Barcode Associate</option>
            <option value="QR_CODE_GENERATE">QR Code Generate</option>
          </select>
          <select
            value={filter.entityType}
            onChange={(e) => setFilter({ ...filter, entityType: e.target.value })}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
          >
            <option value="">All Types</option>
            <option value="PRODUCT">Product</option>
            <option value="INVENTORY">Inventory</option>
            <option value="CATEGORY">Category</option>
            <option value="SUPPLIER">Supplier</option>
            <option value="BARCODE">Barcode</option>
            <option value="QR_CODE">QR Code</option>
          </select>
          <select
            value={filter.hasBarcode}
            onChange={(e) => setFilter({ ...filter, hasBarcode: e.target.value as 'all' | 'yes' | 'no' })}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
          >
            <option value="all">All Barcodes</option>
            <option value="yes">Has Barcode</option>
            <option value="no">No Barcode</option>
          </select>
          <input
            type="date"
            value={filter.startDate}
            onChange={(e) => setFilter({ ...filter, startDate: e.target.value })}
            className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
          />
          <span className="text-xs text-gray-500">to</span>
          <input
            type="date"
            value={filter.endDate}
            onChange={(e) => setFilter({ ...filter, endDate: e.target.value })}
            className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
          />
        </div>
      )}

      {/* Entries List */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[500px] overflow-y-auto">
        {filteredEntries.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
            <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p>No audit entries found</p>
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const severityBadge = getSeverityBadge(entry.severity);
            
            return (
              <div
                key={entry.id}
                className="px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                onClick={() => {
                  setSelectedEntry(entry);
                  setShowDetailModal(true);
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-1.5 rounded-lg ${getActionColor(entry.action)}`}>
                      {getActionIcon(entry.action)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getActionColor(entry.action)}`}>
                          {getActionLabel(entry.action)}
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {entry.entityName}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {entry.entityType}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {entry.user.firstName} {entry.user.lastName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(entry.createdAt)}
                        </span>
                        {entry.severity && (
                          <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${severityBadge.color}`}>
                            {severityBadge.label}
                          </span>
                        )}
                        {Object.keys(entry.changes).length > 0 && (
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {Object.keys(entry.changes).length} change(s)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {renderBarcodeCell(entry)}
                    <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Showing {filteredEntries.length} of {pagination.total} entries
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              disabled={pagination.page <= 1}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowDetailModal(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <button
              onClick={() => setShowDetailModal(false)}
              className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              ✕
            </button>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Audit Entry Details
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Action</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionColor(selectedEntry.action)}`}>
                    {getActionLabel(selectedEntry.action)}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Entity Type</p>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedEntry.entityType}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Entity Name</p>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedEntry.entityName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Entity ID</p>
                  <p className="font-mono text-sm text-gray-600 dark:text-gray-300">{selectedEntry.entityId}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">User</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {selectedEntry.user.firstName} {selectedEntry.user.lastName}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Timestamp</p>
                  <p className="font-medium text-gray-900 dark:text-white">{formatDate(selectedEntry.createdAt)}</p>
                </div>
              </div>

              {/* Barcode/QR Code Section */}
              {(selectedEntry.barcode || selectedEntry.qrCodeData) && (
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <Barcode className="w-4 h-4 text-green-500" />
                    Barcode Information
                  </p>
                  <div className="flex flex-wrap items-center gap-4">
                    {selectedEntry.barcode && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Barcode:</span>
                        <span className="font-mono text-sm text-gray-900 dark:text-white">{selectedEntry.barcode}</span>
                        <button
                          onClick={() => handleCopyBarcode(selectedEntry.barcode!)}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                        <button
                          onClick={() => handlePrintBarcode(selectedEntry)}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                      </div>
                    )}
                    {selectedEntry.qrCodeData && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">QR Code:</span>
                        <span className="font-mono text-sm text-gray-900 dark:text-white">{selectedEntry.qrCodeData}</span>
                        <button
                          onClick={() => {
                            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(JSON.stringify({ 
                              qrCode: selectedEntry.qrCodeData,
                              entity: selectedEntry.entityName,
                              type: selectedEntry.entityType
                            }))}&size=200x200`;
                            window.open(qrUrl, '_blank');
                          }}
                          className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                        >
                          <QrCode className="w-3.5 h-3.5 text-blue-500" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Changes */}
              {Object.keys(selectedEntry.changes).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Changes</p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {Object.entries(selectedEntry.changes).map(([key, value]) => (
                      <div key={key} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{key}</p>
                        <div className="flex items-center gap-4 mt-1">
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Old</p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">{value.old !== undefined && value.old !== null ? String(value.old) : '-'}</p>
                          </div>
                          <ArrowUp className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">New</p>
                            <p className="text-sm text-green-600 dark:text-green-400">{value.new !== undefined && value.new !== null ? String(value.new) : '-'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
