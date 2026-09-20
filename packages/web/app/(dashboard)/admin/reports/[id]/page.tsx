'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft, FileText, Download, Trash2, RefreshCw,
  Loader2, Lock, Calendar, BarChart3, TrendingUp,
  DollarSign, Package, Users, ShoppingBag
} from 'lucide-react';
import { useAuth } from '../../../../../hooks/useAuth';
import { usePermission } from '../../../../../hooks/usePermission';
import { reportService } from '../../../../../services/reportService';
import { toast } from '../../../../../utils/toast-manager';
import { formatDate, formatCurrency } from '../../../../../utils/formatters';
import { PermissionResource } from '../../../../../types/enums';
import { Report } from '../../../../../types/report';

export default function ReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { user } = useAuth();
  const { canView, canDelete, canManage } = usePermission();

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const canViewReport = canView(PermissionResource.REPORT) || canManage(PermissionResource.REPORT);
  const canDeleteReport = canDelete(PermissionResource.REPORT) || canManage(PermissionResource.REPORT);

  useEffect(() => {
    loadReport();
  }, [id]);

  const loadReport = async () => {
    try {
      setLoading(true);
      const data = await reportService.getReportById(id);
      setReport(data);
    } catch (error) {
      console.error('Failed to load report:', error);
      toast.error('Failed to load report');
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!report) return;
    setDownloading(true);
    try {
      const blob = await reportService.downloadReport(report.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${report.name}.${report.format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Report downloaded');
    } catch (error) {
      toast.error('Failed to download report');
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await reportService.deleteReport(id);
      toast.success('Report deleted');
      router.push('/admin/reports');
    } catch (error) {
      toast.error('Failed to delete report');
    }
  };

  if (!canViewReport) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          You don't have permission to view this report.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📄</div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Report not found</h2>
        <Link
          href="/admin/reports"
          className="mt-4 inline-block text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 transition duration-250 focus-ring rounded"
        >
          Back to Reports
        </Link>
      </div>
    );
  }

  const getReportIcon = (type: string) => {
    switch (type) {
      case 'sales': return <ShoppingBag className="w-5 h-5" />;
      case 'inventory': return <Package className="w-5 h-5" />;
      case 'customers': return <Users className="w-5 h-5" />;
      case 'products': return <Package className="w-5 h-5" />;
      case 'payments': return <DollarSign className="w-5 h-5" />;
      default: return <BarChart3 className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-container mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/reports"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition duration-250 focus-ring"
            aria-label="Back to reports"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              {getReportIcon(report.type)}
              {report.name}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              <span className="tabular-nums">{report.type.toUpperCase()}</span> •{' '}
              <span className="tabular-nums">{report.format.toUpperCase()}</span> • Generated{' '}
              {formatDate(report.generatedAt)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="btn-brand disabled:opacity-50"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download
          </button>
          {canDeleteReport && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-xl transition duration-250 flex items-center gap-2 focus-ring"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Report Info */}
      <div className="card-brand shadow-soft animate-slide-down">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Report Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Type</p>
            <p className="font-medium text-gray-900 dark:text-white tabular-nums">
              {report.type.toUpperCase()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Format</p>
            <p className="font-medium text-gray-900 dark:text-white tabular-nums">
              {report.format.toUpperCase()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Period</p>
            <p className="font-medium text-gray-900 dark:text-white tabular-nums">
              {report.period}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
            <span className={`inline-block px-2 py-1 rounded-full text-2xs font-medium ${
              report.status === 'COMPLETED'
                ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300'
                : report.status === 'FAILED'
                  ? 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300'
                  : 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300'
            }`}>
              {report.status}
            </span>
          </div>
        </div>
      </div>

      {/* Report Data Preview */}
      {report.data && Object.keys(report.data).length > 0 && (
        <div className="card-brand shadow-soft animate-slide-down">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Report Data</h3>
          <div className="overflow-x-auto custom-scrollbar">
            <pre className="text-sm font-mono tabular-nums text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all max-h-96 overflow-y-auto custom-scrollbar">
              {JSON.stringify(report.data, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
            onClick={() => setShowDeleteModal(false)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6 animate-fade-in">
            <div className="text-center">
              <div className="text-6xl mb-4">⚠️</div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                Delete Report
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Are you sure you want to delete{' '}
                <strong className="text-gray-900 dark:text-white">{report.name}</strong>?
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-xl transition duration-250 flex items-center gap-2 focus-ring"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
