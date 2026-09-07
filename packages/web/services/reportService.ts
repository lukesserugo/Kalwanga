// D:\Projects\Kalwanga\packages\web\services\reportService.ts
import { api } from './api';

export const reportService = {
  /**
   * Generate report - calls POST /reports/generate
   * This is the main method used by the ReportGenerator component
   */
  async generateReport(params: {
    type: string;
    format: string;
    startDate: string;
    endDate: string;
    businessUnitId?: string;
  }): Promise<any> {
    const response = await api.post<any>('/reports/generate', params);
    return response;
  },

  /**
   * Generate comprehensive report - calls GET /reports/comprehensive
   */
  async generateComprehensiveReport(params: {
    businessUnitId: string;
    startDate: string;
    endDate: string;
    format?: 'pdf' | 'html' | 'excel' | 'csv';
  }): Promise<any> {
    const response = await api.get<any>('/reports/comprehensive', { params });
    return response;
  },

  /**
   * Generate tax filing - calls GET /reports/tax-filing
   */
  async generateTaxFiling(params: { businessUnitId: string; period: string }): Promise<any> {
    const response = await api.get<any>('/reports/tax-filing', { params });
    return response;
  },

  /**
   * Generate sales report - calls GET /reports/sales
   */
  async generateSalesReport(params: {
    businessUnitId?: string;
    startDate: string;
    endDate: string;
    groupBy?: 'day' | 'week' | 'month' | 'year';
    userId?: string;
  }): Promise<any> {
    const response = await api.get<any>('/reports/sales', { params });
    return response;
  },

  /**
   * Generate inventory report - calls GET /reports/inventory
   */
  async generateInventoryReport(params: {
    businessUnitId: string;
    includeVariants?: boolean;
    lowStockOnly?: boolean;
  }): Promise<any> {
    const response = await api.get<any>('/reports/inventory', { params });
    return response;
  },

  /**
   * Generate customer report - calls GET /reports/customers
   */
  async generateCustomerReport(params: {
    companyId: string;
    startDate?: string;
    endDate?: string;
    minSpent?: number;
    limit?: number;
  }): Promise<any> {
    const response = await api.get<any>('/reports/customers', { params });
    return response;
  },

  /**
   * Generate product report - calls GET /reports/products
   */
  async generateProductReport(params: {
    businessUnitId: string;
    startDate: string;
    endDate: string;
    limit?: number;
  }): Promise<any> {
    const response = await api.get<any>('/reports/products', { params });
    return response;
  },

  /**
   * Generate employee report - calls GET /reports/employees
   */
  async generateEmployeeReport(params: {
    businessUnitId: string;
    startDate: string;
    endDate: string;
    userId?: string;
  }): Promise<any> {
    const response = await api.get<any>('/reports/employees', { params });
    return response;
  },

  /**
   * Generate payment report - calls GET /reports/payments
   */
  async generatePaymentReport(params: {
    businessUnitId?: string;
    startDate: string;
    endDate: string;
  }): Promise<any> {
    const response = await api.get<any>('/reports/payments', { params });
    return response;
  },

  /**
   * Download report - calls GET /reports/download/:id
   */
  async downloadReport(reportId: string): Promise<Blob> {
    const response = await api.download(`/reports/download/${reportId}`);
    return response;
  },

  /**
   * List reports - calls GET /reports
   */
  async listReports(params?: { page?: number; limit?: number; type?: string }): Promise<any> {
    const response = await api.get<any>('/reports', { params });
    return response;
  },

  /**
   * Get report by ID - calls GET /reports/:id
   */
  async getReportById(id: string): Promise<any> {
    const response = await api.get<any>(`/reports/${id}`);
    return response;
  },

  /**
   * Delete report - calls DELETE /reports/:id
   */
  async deleteReport(id: string): Promise<{ message: string }> {
    const response = await api.delete<{ message: string }>(`/reports/${id}`);
    return response;
  },
};
