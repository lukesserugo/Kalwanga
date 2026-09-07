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
        <Lock className="w-12 h-12 text-gray-400 mb-4" />
        <h2 className="text-2xl font-bold">Access Restricted</h2>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📄</div>
        <h2 className="text-xl font-semibold">Report not found</h2>
        <Link href="/admin/reports" className="mt-4 inline-block text-blue-600">
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
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/reports" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              {getReportIcon(report.type)}
              {report.name}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {report.type.toUpperCase()} • {report.format.toUpperCase()} • Generated {formatDate(report.generatedAt)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download
          </button>
          {canDeleteReport && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Report Info */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-6">
        <h3 className="font-semibold mb-4">Report Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">Type</p>
            <p className="font-medium">{report.type.toUpperCase()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Format</p>
            <p className="font-medium">{report.format.toUpperCase()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Period</p>
            <p className="font-medium">{report.period}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <span className={`px-2 py-1 rounded-full text-xs ${
              report.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
              report.status === 'FAILED' ? 'bg-red-100 text-red-700' :
              'bg-yellow-100 text-yellow-700'
            }`}>
              {report.status}
            </span>
          </div>
        </div>
      </div>

      {/* Report Data Preview */}
      {report.data && Object.keys(report.data).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-6">
          <h3 className="font-semibold mb-4">Report Data</h3>
          <div className="overflow-x-auto">
            <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all max-h-96 overflow-y-auto">
              {JSON.stringify(report.data, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowDeleteModal(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="text-6xl mb-4">⚠️</div>
              <h3 className="text-lg font-bold mb-2">Delete Report</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Are you sure you want to delete <strong>{report.name}</strong>?
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
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
