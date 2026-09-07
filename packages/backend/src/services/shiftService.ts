// src/services/shiftService.ts
import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
// Fix: Import Prisma from the correct path
import { Prisma } from '../generated/prisma/index.js';
import { realtimeService } from './realtimeService.js';
import { notificationService } from './notificationService.js';
import { logger } from '../lib/logger.js';
import * as crypto from 'crypto';

// Enhanced types
interface StartShiftData {
  cashRegisterId: string;
  startingBalance: number;
  userId: string;
  businessUnitId: string;
  notes?: string;
}

interface EndShiftData {
  endingBalance: number;
  notes?: string;
  userId: string;
}

interface ShiftSummary {
  sessionId: string;
  cashRegisterId: string;
  cashRegisterName: string;
  userId: string;
  userName: string;
  openedAt: Date;
  closedAt?: Date | null;
  startingBalance: number;
  endingBalance?: number | null;
  expectedBalance: number;
  discrepancy?: number | null;
  totalSales: number;
  totalRevenue: number;
  cashReceived: number;
  cardReceived: number;
  mobileReceived: number;
  otherReceived: number;
  cashOut: number;
  cashIn: number;
  status: string;
  duration?: number;
  notes?: string | null;
}

interface ShiftStats {
  totalShifts: number;
  openShifts: number;
  closedShifts: number;
  totalRevenue: number;
  averageShiftDuration: number;
  averageShiftRevenue: number;
  topCashiers: Array<{
    userId: string;
    userName: string;
    shiftCount: number;
    totalRevenue: number;
  }>;
}

export class ShiftService extends BaseService {
  /**
   * Start a new shift
   */
  async startShift(data: StartShiftData) {
    try {
      if (!data.cashRegisterId) {
        throw new AppError('Cash register ID is required', 400);
      }
      if (data.startingBalance < 0) {
        throw new AppError('Starting balance cannot be negative', 400);
      }
      if (!data.userId) {
        throw new AppError('User ID is required', 400);
      }

      return await this.prisma.$transaction(async (tx: any) => {
        const cashRegister = await tx.cashRegister.findUnique({
          where: { id: data.cashRegisterId },
        });

        if (!cashRegister) {
          throw new AppError('Cash register not found', 404);
        }

        if (!cashRegister.isActive) {
          throw new AppError('Cash register is not active', 400);
        }

        const openShift = await tx.cashRegisterSession.findFirst({
          where: {
            cashRegisterId: data.cashRegisterId,
            status: 'OPEN',
          },
        });

        if (openShift) {
          throw new AppError('Cash register already has an open shift', 400);
        }

        const userOpenShift = await tx.cashRegisterSession.findFirst({
          where: {
            userId: data.userId,
            status: 'OPEN',
          },
        });

        if (userOpenShift) {
          throw new AppError('User already has an open shift', 400);
        }

        const shift = await tx.cashRegisterSession.create({
          data: {
            cashRegisterId: data.cashRegisterId,
            userId: data.userId,
            startingBalance: data.startingBalance,
            expectedEndingBalance: data.startingBalance,
            status: 'OPEN',
            openedAt: new Date(),
            notes: data.notes,
          },
          include: {
            cashRegister: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        });

        await tx.cashRegister.update({
          where: { id: data.cashRegisterId },
          data: {
            cashBalance: data.startingBalance,
            currentSessionId: shift.id,
            lastOpenedAt: new Date(),
          },
        });

        // Create cash transaction
        await tx.cashTransaction.create({
          data: {
            cashRegisterSessionId: shift.id,
            type: 'OPENING_BALANCE',
            amount: data.startingBalance,
            userId: data.userId,
            businessUnitId: data.businessUnitId,
            transactionDate: new Date(),
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            action: 'START_SHIFT',
            entityType: 'CASH_REGISTER_SESSION',
            entityId: shift.id,
            userId: data.userId,
            entityName: `Shift ${shift.id}`,
            changes: {
              cashRegisterId: data.cashRegisterId,
              startingBalance: data.startingBalance,
            },
            severity: 'INFO',
            createdAt: new Date(),
          },
        });

        try {
          (realtimeService as any).emitShiftStarted?.(shift, data.businessUnitId);
        } catch (wsError) {
          logger.warn('Failed to emit shift started event:', wsError);
        }

        try {
          await notificationService.sendShiftNotification(
            data.businessUnitId,
            data.userId,
            'started'
          );
        } catch (notifError) {
          logger.warn('Failed to send shift notification:', notifError);
        }

        return shift;
      });
    } catch (error) {
      this.handleError(error, 'ShiftService.startShift');
    }
  }

  /**
   * End current shift
   */
  async endShift(sessionId: string, data: EndShiftData) {
    try {
      if (!sessionId) {
        throw new AppError('Session ID is required', 400);
      }
      if (data.endingBalance < 0) {
        throw new AppError('Ending balance cannot be negative', 400);
      }

      return await this.prisma.$transaction(async (tx: any) => {
        const session = await tx.cashRegisterSession.findUnique({
          where: { id: sessionId },
          include: {
            cashRegister: true,
            sales: {
              include: {
                payments: true,
              },
            },
            payments: true,
            cashTransactions: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        });

        if (!session) {
          throw new AppError('Shift not found', 404);
        }

        if (session.status !== 'OPEN') {
          throw new AppError('Shift is already closed', 400);
        }

        const cashPayments = session.payments.filter((p: any) => p.paymentMethod === 'CASH');
        const cashReceived = cashPayments.reduce((sum: number, p: any) => sum + p.amount, 0);
        
        const cashOutTransactions = session.cashTransactions.filter((t: any) => 
          t.type === 'CASH_OUT' || t.type === 'EXPENSE' || t.type === 'REFUND'
        );
        const cashOut = cashOutTransactions.reduce((sum: number, t: any) => sum + t.amount, 0);
        
        const cashInTransactions = session.cashTransactions.filter((t: any) => 
          t.type === 'CASH_IN' || t.type === 'DEPOSIT'
        );
        const cashIn = cashInTransactions.reduce((sum: number, t: any) => sum + t.amount, 0);

        const expectedBalance = session.startingBalance + cashReceived + cashIn - cashOut;
        const discrepancy = data.endingBalance - expectedBalance;

        const closedShift = await tx.cashRegisterSession.update({
          where: { id: sessionId },
          data: {
            endingBalance: data.endingBalance,
            expectedEndingBalance: expectedBalance,
            discrepancy,
            notes: data.notes || session.notes,
            status: 'CLOSED',
            closedAt: new Date(),
          },
          include: {
            cashRegister: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        });

        await tx.cashRegister.update({
          where: { id: session.cashRegisterId },
          data: {
            cashBalance: data.endingBalance,
            currentSessionId: null,
            lastClosedAt: new Date(),
          },
        });

        // Create cash transaction
        await tx.cashTransaction.create({
          data: {
            cashRegisterSessionId: sessionId,
            type: 'CLOSING_BALANCE',
            amount: data.endingBalance,
            userId: data.userId,
            businessUnitId: session.cashRegister.businessUnitId,
            transactionDate: new Date(),
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            action: 'END_SHIFT',
            entityType: 'CASH_REGISTER_SESSION',
            entityId: sessionId,
            userId: data.userId,
            entityName: `Shift ${sessionId}`,
            changes: {
              endingBalance: data.endingBalance,
              expectedBalance,
              discrepancy,
            },
            severity: 'INFO',
            createdAt: new Date(),
          },
        });

        try {
          (realtimeService as any).emitShiftEnded?.(closedShift, session.cashRegister.businessUnitId);
        } catch (wsError) {
          logger.warn('Failed to emit shift ended event:', wsError);
        }

        return {
          ...closedShift,
          expectedBalance,
          discrepancy,
          cashReceived,
          cashOut,
          cashIn,
        };
      });
    } catch (error) {
      this.handleError(error, 'ShiftService.endShift');
    }
  }

  /**
   * Get current shift status
   */
  async getCurrentShift(cashRegisterId: string) {
    try {
      if (!cashRegisterId) {
        throw new AppError('Cash register ID is required', 400);
      }

      const session = await this.prisma.cashRegisterSession.findFirst({
        where: {
          cashRegisterId,
          status: 'OPEN',
        },
        include: {
          cashRegister: true,
          sales: {
            include: {
              payments: true,
            },
          },
          payments: true,
          cashTransactions: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (!session) {
        return null;
      }

      const cashPayments = session.payments.filter((p: any) => p.paymentMethod === 'CASH');
      const cashReceived = cashPayments.reduce((sum: number, p: any) => sum + p.amount, 0);
      
      const cashOut = session.cashTransactions
        .filter((t: any) => t.type === 'CASH_OUT' || t.type === 'EXPENSE')
        .reduce((sum: number, t: any) => sum + t.amount, 0);
      
      const cashIn = session.cashTransactions
        .filter((t: any) => t.type === 'CASH_IN' || t.type === 'DEPOSIT')
        .reduce((sum: number, t: any) => sum + t.amount, 0);

      const expectedBalance = session.startingBalance + cashReceived + cashIn - cashOut;

      return {
        ...session,
        expectedBalance,
        cashReceived,
        cashOut,
        cashIn,
        totalSales: session.sales.length,
        totalRevenue: session.sales.reduce((sum: number, s: any) => sum + s.total, 0),
      };
    } catch (error) {
      this.handleError(error, 'ShiftService.getCurrentShift');
    }
  }

  /**
   * Get all shifts with filtering
   */
  async getAllShifts(params: {
    businessUnitId?: string;
    userId?: string;
    cashRegisterId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    try {
      const {
        businessUnitId,
        userId,
        cashRegisterId,
        status,
        startDate,
        endDate,
        page = 1,
        limit = 20,
      } = params;

      const validatedPage = Math.max(1, page);
      const validatedLimit = Math.min(100, Math.max(1, limit));
      const skip = (validatedPage - 1) * validatedLimit;

      const where: any = {
        ...(userId && { userId }),
        ...(cashRegisterId && { cashRegisterId }),
        ...(status && { status: status as any }),
        ...(businessUnitId && {
          cashRegister: { businessUnitId },
        }),
        ...(startDate && { openedAt: { gte: startDate } }),
        ...(endDate && {
          openedAt: {
            ...(startDate ? { gte: startDate } : {}),
            lte: endDate,
          },
        }),
      };

      const [shifts, total, stats] = await Promise.all([
        this.prisma.cashRegisterSession.findMany({
          where,
          skip,
          take: validatedLimit,
          orderBy: { openedAt: 'desc' },
          include: {
            cashRegister: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            sales: {
              select: {
                id: true,
                total: true,
                saleDate: true,
              },
            },
            payments: {
              select: {
                id: true,
                amount: true,
                paymentMethod: true,
              },
            },
            cashTransactions: true,
            _count: {
              select: {
                sales: true,
                payments: true,
              },
            },
          },
        }),
        this.prisma.cashRegisterSession.count({ where }),
        this.getShiftStats({ businessUnitId, startDate, endDate }),
      ]);

      const enhancedShifts = shifts.map((shift: any) => ({
        ...shift,
        totalSales: shift._count?.sales || 0,
        totalRevenue: shift.sales.reduce((sum: number, s: any) => sum + s.total, 0),
        cashReceived: shift.payments
          .filter((p: any) => p.paymentMethod === 'CASH')
          .reduce((sum: number, p: any) => sum + p.amount, 0),
        duration: shift.closedAt 
          ? (shift.closedAt.getTime() - shift.openedAt.getTime()) / 1000 
          : (Date.now() - shift.openedAt.getTime()) / 1000,
      }));

      return {
        shifts: enhancedShifts,
        total,
        page: validatedPage,
        limit: validatedLimit,
        totalPages: Math.ceil(total / validatedLimit),
        stats,
      };
    } catch (error) {
      this.handleError(error, 'ShiftService.getAllShifts');
    }
  }

  /**
   * Get shift by ID with full details
   */
  async getShiftById(sessionId: string) {
    try {
      if (!sessionId) {
        throw new AppError('Session ID is required', 400);
      }

      const shift = await this.prisma.cashRegisterSession.findUnique({
        where: { id: sessionId },
        include: {
          cashRegister: {
            include: {
              businessUnit: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
            },
          },
          sales: {
            include: {
              items: {
                include: {
                  product: {
                    select: {
                      id: true,
                      name: true,
                      sku: true,
                    },
                  },
                },
              },
              payments: true,
              customer: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          payments: true,
          cashTransactions: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          _count: {
            select: {
              sales: true,
              payments: true,
              cashTransactions: true,
            },
          },
        },
      });

      if (!shift) {
        throw new AppError('Shift not found', 404);
      }

      const cashPayments = shift.payments.filter((p: any) => p.paymentMethod === 'CASH');
      const cashReceived = cashPayments.reduce((sum: number, p: any) => sum + p.amount, 0);
      
      const cardReceived = shift.payments
        .filter((p: any) => p.paymentMethod === 'CREDIT_CARD' || p.paymentMethod === 'DEBIT_CARD')
        .reduce((sum: number, p: any) => sum + p.amount, 0);
      
      const mobileReceived = shift.payments
        .filter((p: any) => p.paymentMethod === 'MOBILE_MONEY')
        .reduce((sum: number, p: any) => sum + p.amount, 0);
      
      const otherReceived = shift.payments
        .filter((p: any) => !['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_MONEY'].includes(p.paymentMethod))
        .reduce((sum: number, p: any) => sum + p.amount, 0);

      const cashOut = shift.cashTransactions
        .filter((t: any) => t.type === 'CASH_OUT' || t.type === 'EXPENSE')
        .reduce((sum: number, t: any) => sum + t.amount, 0);
      
      const cashIn = shift.cashTransactions
        .filter((t: any) => t.type === 'CASH_IN' || t.type === 'DEPOSIT')
        .reduce((sum: number, t: any) => sum + t.amount, 0);

      const expectedBalance = shift.startingBalance + cashReceived + cashIn - cashOut;
      const discrepancy = shift.endingBalance !== null 
        ? shift.endingBalance - expectedBalance 
        : null;

      return {
        ...shift,
        summary: {
          totalSales: shift._count?.sales || 0,
          totalRevenue: shift.sales.reduce((sum: number, s: any) => sum + s.total, 0),
          cashReceived,
          cardReceived,
          mobileReceived,
          otherReceived,
          cashOut,
          cashIn,
          expectedBalance,
          discrepancy,
          duration: shift.closedAt 
            ? (shift.closedAt.getTime() - shift.openedAt.getTime()) / 1000 
            : (Date.now() - shift.openedAt.getTime()) / 1000,
        },
      };
    } catch (error) {
      this.handleError(error, 'ShiftService.getShiftById');
    }
  }

  /**
   * Get shift statistics
   */
  async getShiftStats(params: {
    businessUnitId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<ShiftStats> {
    try {
      const { businessUnitId, startDate, endDate } = params;

      const where: any = {
        ...(businessUnitId && {
          cashRegister: { businessUnitId },
        }),
        ...(startDate && { openedAt: { gte: startDate } }),
        ...(endDate && {
          openedAt: {
            ...(startDate ? { gte: startDate } : {}),
            lte: endDate,
          },
        }),
      };

      const [totalShifts, openShifts, closedShifts, totalRevenue, shifts] = await Promise.all([
        this.prisma.cashRegisterSession.count({ where }),
        this.prisma.cashRegisterSession.count({ where: { ...where, status: 'OPEN' } }),
        this.prisma.cashRegisterSession.count({ where: { ...where, status: 'CLOSED' } }),
        this.prisma.sale.aggregate({
          where: {
            cashRegisterSession: where,
          },
          _sum: { total: true },
        }),
        this.prisma.cashRegisterSession.findMany({
          where: { ...where, status: 'CLOSED' },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            sales: {
              select: {
                total: true,
              },
            },
          },
        }),
      ]);

      const closedShiftsWithDuration = shifts.filter((s: any) => s.closedAt);
      const totalDuration = closedShiftsWithDuration.reduce(
        (sum: number, s: any) => sum + (s.closedAt!.getTime() - s.openedAt.getTime()) / 1000,
        0
      );

      const cashierMap = new Map<string, { userId: string; userName: string; shiftCount: number; totalRevenue: number }>();
      
      shifts.forEach((shift: any) => {
        const key = shift.userId;
        const current = cashierMap.get(key) || {
          userId: shift.userId,
          userName: `${shift.user.firstName} ${shift.user.lastName}`.trim(),
          shiftCount: 0,
          totalRevenue: 0,
        };
        current.shiftCount += 1;
        current.totalRevenue += shift.sales.reduce((sum: number, s: any) => sum + s.total, 0);
        cashierMap.set(key, current);
      });

      const topCashiers = Array.from(cashierMap.values())
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 10);

      return {
        totalShifts,
        openShifts,
        closedShifts,
        totalRevenue: totalRevenue._sum.total || 0,
        averageShiftDuration: closedShiftsWithDuration.length > 0 
          ? totalDuration / closedShiftsWithDuration.length 
          : 0,
        averageShiftRevenue: closedShifts > 0 
          ? (totalRevenue._sum.total || 0) / closedShifts 
          : 0,
        topCashiers,
      };
    } catch (error) {
      this.handleError(error, 'ShiftService.getShiftStats');
    }
  }

  /**
   * Add cash to register
   */
  async addCash(sessionId: string, amount: number, userId: string, description?: string) {
    try {
      if (!sessionId) throw new AppError('Session ID is required', 400);
      if (amount <= 0) throw new AppError('Amount must be positive', 400);

      return await this.prisma.$transaction(async (tx: any) => {
        const session = await tx.cashRegisterSession.findUnique({
          where: { id: sessionId },
          include: { cashRegister: true },
        });

        if (!session) throw new AppError('Shift not found', 404);
        if (session.status !== 'OPEN') throw new AppError('Shift is not open', 400);

        const transaction = await tx.cashTransaction.create({
          data: {
            cashRegisterSessionId: sessionId,
            type: 'CASH_IN',
            amount,
            userId,
            businessUnitId: session.cashRegister.businessUnitId,
            transactionDate: new Date(),
          },
        });

        await tx.cashRegister.update({
          where: { id: session.cashRegisterId },
          data: { cashBalance: { increment: amount } },
        });

        return transaction;
      });
    } catch (error) {
      this.handleError(error, 'ShiftService.addCash');
    }
  }

  /**
   * Remove cash from register
   */
  async removeCash(sessionId: string, amount: number, userId: string, description?: string) {
    try {
      if (!sessionId) throw new AppError('Session ID is required', 400);
      if (amount <= 0) throw new AppError('Amount must be positive', 400);

      return await this.prisma.$transaction(async (tx: any) => {
        const session = await tx.cashRegisterSession.findUnique({
          where: { id: sessionId },
          include: { cashRegister: true },
        });

        if (!session) throw new AppError('Shift not found', 404);
        if (session.status !== 'OPEN') throw new AppError('Shift is not open', 400);
        if (session.cashRegister.cashBalance < amount) throw new AppError('Insufficient cash in register', 400);

        const transaction = await tx.cashTransaction.create({
          data: {
            cashRegisterSessionId: sessionId,
            type: 'CASH_OUT',
            amount,
            userId,
            businessUnitId: session.cashRegister.businessUnitId,
            transactionDate: new Date(),
          },
        });

        await tx.cashRegister.update({
          where: { id: session.cashRegisterId },
          data: { cashBalance: { decrement: amount } },
        });

        return transaction;
      });
    } catch (error) {
      this.handleError(error, 'ShiftService.removeCash');
    }
  }

  /**
   * Get shift summary
   */
  async getShiftSummary(sessionId: string): Promise<ShiftSummary> {
    try {
      const shift = await this.getShiftById(sessionId);
      
      return {
        sessionId: shift.id,
        cashRegisterId: shift.cashRegisterId,
        cashRegisterName: shift.cashRegister.name,
        userId: shift.userId,
        userName: `${shift.user.firstName} ${shift.user.lastName}`.trim(),
        openedAt: shift.openedAt,
        closedAt: shift.closedAt,
        startingBalance: shift.startingBalance,
        endingBalance: shift.endingBalance,
        expectedBalance: shift.summary.expectedBalance,
        discrepancy: shift.summary.discrepancy,
        totalSales: shift.summary.totalSales,
        totalRevenue: shift.summary.totalRevenue,
        cashReceived: shift.summary.cashReceived,
        cardReceived: shift.summary.cardReceived,
        mobileReceived: shift.summary.mobileReceived,
        otherReceived: shift.summary.otherReceived,
        cashOut: shift.summary.cashOut,
        cashIn: shift.summary.cashIn,
        status: shift.status,
        duration: shift.summary.duration,
        notes: shift.notes,
      };
    } catch (error) {
      this.handleError(error, 'ShiftService.getShiftSummary');
    }
  }
}

export const shiftService = new ShiftService();
