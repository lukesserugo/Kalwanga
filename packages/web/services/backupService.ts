// D:\Projects\Kalwanga\packages\web\services\backupService.ts
import { api } from './api';

export const backupService = {
  /**
   * Create backup - calls POST /backups
   */
  async createBackup(type: 'full' | 'incremental' = 'full'): Promise<{ filePath: string }> {
    const response = await api.post<{ filePath: string }>('/backups', { type });
    return response;
  },

  /**
   * Export data - calls POST /backups/export
   */
  async exportData(businessUnitId: string): Promise<{ filePath: string }> {
    const response = await api.post<{ filePath: string }>('/backups/export', { businessUnitId });
    return response;
  },

  /**
   * List backups - calls GET /backups/list
   */
  async listBackups(): Promise<Array<{ fileName: string; size: number; createdAt: string }>> {
    const response = await api.get<Array<{ fileName: string; size: number; createdAt: string }>>('/backups/list');
    return response;
  },

  /**
   * Download backup - calls GET /backups/download/:fileName
   */
  async downloadBackup(fileName: string): Promise<Blob> {
    const response = await api.download(`/backups/download/${encodeURIComponent(fileName)}`);
    return response;
  },

  /**
   * Delete backup - calls DELETE /backups/:fileName
   */
  async deleteBackup(fileName: string): Promise<{ message: string }> {
    const response = await api.delete<{ message: string }>(`/backups/${encodeURIComponent(fileName)}`);
    return response;
  },

  /**
   * Restore backup - calls POST /backups/restore
   */
  async restoreBackup(fileName: string): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>('/backups/restore', { fileName });
    return response;
  },
};
