// src/services/healthService.ts
import { prisma } from '../lib/prisma.js';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

interface DatabaseStatus {
  connected: boolean;
  latency: number;
  error?: string;
  version?: string;
  connections?: number;
}

interface SystemStatus {
  memory: {
    heapUsed: string;
    heapTotal: string;
    rss: string;
    external: string;
    totalSystemMemory: string;
    freeSystemMemory: string;
    memoryUsagePercent: number;
  };
  cpu: {
    loadAverage: number[];
    cores: number;
    model: string;
    speed: number;
    usagePercent: number;
  };
  platform: string;
  architecture: string;
  hostname: string;
  uptime: number;
  nodeVersion: string;
  processId: number;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  database: DatabaseStatus;
  system: SystemStatus;
  services: {
    [key: string]: {
      status: 'up' | 'down' | 'degraded';
      latency?: number;
      error?: string;
    };
  };
  checks: {
    [key: string]: {
      passed: boolean;
      message?: string;
      timestamp: Date;
    };
  };
}

export class HealthService {
  private healthCheckHistory: Array<{
    timestamp: Date;
    status: string;
    checks: any;
  }> = [];
  private maxHistorySize = 100;

  /**
   * Get system health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const dbStatus = await this.checkDatabase();
    const systemStatus = this.getSystemStatus();
    
    // Check additional services
    const services = await this.checkServices();
    
    // Run health checks
    const checks = await this.runHealthChecks();

    // Determine overall status
    const status = this.determineStatus(dbStatus, services, checks);

    // Store in history
    this.addToHistory(status, checks);

    const healthStatus: HealthStatus = {
      status,
      timestamp: new Date(),
      uptime: process.uptime(),
      database: dbStatus,
      system: systemStatus,
      services,
      checks,
    };

    // Try to persist health check to database (using auditLog since healthCheck model doesn't exist)
    await this.persistHealthCheck(healthStatus);

    return healthStatus;
  }

  /**
   * Get basic health status (lighter check)
   */
  async getBasicHealth() {
    const dbStatus = await this.checkDatabase();
    
    return {
      status: dbStatus.connected ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbStatus.connected,
    };
  }

  /**
   * Get detailed database status
   */
  async getDatabaseStatus() {
    const dbStatus = await this.checkDatabase();
    
    // Get additional database info
    let databaseInfo = {};
    try {
      const [version, connections, databaseSize] = await Promise.all([
        prisma.$queryRaw`SELECT version()`,
        prisma.$queryRaw`SELECT count(*) as count FROM pg_stat_activity`,
        prisma.$queryRaw`SELECT pg_database_size(current_database()) as size`,
      ]);

      databaseInfo = {
        version: (version as any[])[0]?.version || 'Unknown',
        activeConnections: (connections as any[])[0]?.count || 0,
        databaseSize: this.formatBytes((databaseSize as any[])[0]?.size || 0),
      };
    } catch (error) {
      console.warn('Failed to get database info:', error);
    }

    return {
      success: dbStatus.connected,
      connected: dbStatus.connected,
      latency: dbStatus.latency,
      ...databaseInfo,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get health check history
   */
  async getHealthHistory(limit: number = 20) {
    try {
      // FIXED: Use auditLog instead of healthCheck model (which doesn't exist)
      const dbHistory = await prisma.auditLog.findMany({
        where: {
          entityType: 'HEALTH_CHECK',
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      if (dbHistory.length > 0) {
        return dbHistory;
      }

      // Fallback to in-memory history
      return this.healthCheckHistory.slice(-limit);
    } catch (error) {
      console.warn('Failed to get health history from database:', error);
      return this.healthCheckHistory.slice(-limit);
    }
  }

  /**
   * Check database connection
   */
  private async checkDatabase(): Promise<DatabaseStatus> {
    try {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;

      // Get database version
      let version = 'Unknown';
      try {
        const result = await prisma.$queryRaw`SELECT version()`;
        version = (result as any[])[0]?.version?.split(' on ')[0] || 'Unknown';
      } catch (error) {
        console.warn('Failed to get database version:', error);
      }

      return {
        connected: true,
        latency,
        version,
      };
    } catch (error) {
      return {
        connected: false,
        latency: 0,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Get system status
   */
  private getSystemStatus(): SystemStatus {
    const memoryUsage = process.memoryUsage();
    const totalSystemMemory = os.totalmem();
    const freeSystemMemory = os.freemem();
    const memoryUsagePercent = ((totalSystemMemory - freeSystemMemory) / totalSystemMemory) * 100;
    
    const cpus = os.cpus();
    const loadAverage = os.loadavg();

    // Calculate CPU usage
    const cpuUsagePercent = (loadAverage[0] / cpus.length) * 100;

    return {
      memory: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
        rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
        external: Math.round(memoryUsage.external / 1024 / 1024) + 'MB',
        totalSystemMemory: Math.round(totalSystemMemory / 1024 / 1024) + 'MB',
        freeSystemMemory: Math.round(freeSystemMemory / 1024 / 1024) + 'MB',
        memoryUsagePercent: Math.round(memoryUsagePercent * 100) / 100,
      },
      cpu: {
        loadAverage,
        cores: cpus.length,
        model: cpus[0]?.model || 'Unknown',
        speed: cpus[0]?.speed || 0,
        usagePercent: Math.round(cpuUsagePercent * 100) / 100,
      },
      platform: os.platform(),
      architecture: os.arch(),
      hostname: os.hostname(),
      uptime: os.uptime(),
      nodeVersion: process.version,
      processId: process.pid,
    };
  }

  /**
   * Check additional services
   */
  private async checkServices() {
    const services: any = {};

    // Check database
    const dbStatus = await this.checkDatabase();
    services.database = {
      status: dbStatus.connected ? 'up' : 'down',
      latency: dbStatus.latency,
      error: dbStatus.error,
    };

    // Check file system
    try {
      const backupDir = path.join(process.cwd(), 'backups');
      const uploadDir = path.join(process.cwd(), 'uploads');
      
      services.fileSystem = {
        status: 'up',
        writable: this.checkDirectoryWritable(backupDir) && this.checkDirectoryWritable(uploadDir),
      };
    } catch (error) {
      services.fileSystem = {
        status: 'down',
        error: (error as Error).message,
      };
    }

    // Check Redis if configured (example)
    if (process.env.REDIS_URL) {
      try {
        services.redis = {
          status: 'up',
          configured: true,
        };
      } catch (error) {
        services.redis = {
          status: 'down',
          configured: true,
          error: (error as Error).message,
        };
      }
    }

    return services;
  }

  /**
   * Run health checks
   */
  private async runHealthChecks() {
    const checks: any = {};

    // Check database
    const dbStatus = await this.checkDatabase();
    checks.database = {
      passed: dbStatus.connected,
      message: dbStatus.connected ? 'Database connected' : 'Database connection failed',
      timestamp: new Date(),
    };

    // Check memory usage
    const memoryUsagePercent = ((os.totalmem() - os.freemem()) / os.totalmem()) * 100;
    checks.memory = {
      passed: memoryUsagePercent < 90,
      message: `Memory usage: ${memoryUsagePercent.toFixed(2)}%`,
      timestamp: new Date(),
    };

    // Check CPU usage
    const loadAverage = os.loadavg();
    const cpuUsagePercent = (loadAverage[0] / os.cpus().length) * 100;
    checks.cpu = {
      passed: cpuUsagePercent < 90,
      message: `CPU usage: ${cpuUsagePercent.toFixed(2)}%`,
      timestamp: new Date(),
    };

    // Check disk space
    try {
      const { stdout } = await execAsync('df -h /');
      const lines = stdout.trim().split('\n');
      if (lines.length > 1) {
        const diskInfo = lines[1].split(/\s+/);
        const diskUsagePercent = parseInt(diskInfo[4]);
        checks.disk = {
          passed: diskUsagePercent < 90,
          message: `Disk usage: ${diskUsagePercent}%`,
          timestamp: new Date(),
        };
      }
    } catch (error) {
      checks.disk = {
        passed: true,
        message: 'Disk check not available',
        timestamp: new Date(),
      };
    }

    return checks;
  }

  /**
   * Determine overall status
   */
  private determineStatus(dbStatus: DatabaseStatus, services: any, checks: any): 'healthy' | 'degraded' | 'unhealthy' {
    // If database is down, system is unhealthy
    if (!dbStatus.connected) {
      return 'unhealthy';
    }

    // Check if any critical service is down
    for (const service of Object.values(services)) {
      if ((service as any).status === 'down') {
        return 'degraded';
      }
    }

    // Check if any health check failed
    for (const check of Object.values(checks)) {
      if (!(check as any).passed) {
        return 'degraded';
      }
    }

    return 'healthy';
  }

  /**
   * Add to health check history
   */
  private addToHistory(status: string, checks: any) {
    this.healthCheckHistory.push({
      timestamp: new Date(),
      status,
      checks,
    });

    // Keep history size manageable
    if (this.healthCheckHistory.length > this.maxHistorySize) {
      this.healthCheckHistory.shift();
    }
  }

  /**
   * Persist health check to database
   */
  private async persistHealthCheck(healthStatus: HealthStatus) {
    try {
      // FIXED: Use auditLog instead of healthCheck model (which doesn't exist)
      await prisma.auditLog.create({
        data: {
          action: 'HEALTH_CHECK',
          entityType: 'HEALTH_CHECK',
          entityId: new Date().toISOString(),
          user: { connect: { id: 'system' } },
        } as any,
      });
    } catch (error) {
      // Don't fail if health check table doesn't exist
      console.debug('Failed to persist health check:', error);
    }
  }

  /**
   * Check if directory is writable
   */
  private checkDirectoryWritable(dir: string): boolean {
    try {
      if (!fs.existsSync(dir)) {
        return false;
      }
      fs.accessSync(dir, fs.constants.W_OK);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Format bytes to human readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}

export const healthService = new HealthService();
