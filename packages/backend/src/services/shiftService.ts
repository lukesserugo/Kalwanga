// packages/backend/src/services/shiftService.ts
import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import { realtimeService } from './realtimeService.js';
import { notificationService } from './notificationService.js';
import { logger } from '../lib/logger.js';

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

/**
 * Derive ShiftType from the hour of day
 */
function deriveShiftType(date: Date = new Date()): 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'WEEKEND' {
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday
  if (day === 0 || day === 6) return 'WEEKEND';
  const hour = date.getHours();
  if (hour < 12) return 'MORNING';
  if (hour < 18) return 'AFTERNOON';
  return 'NIGHT';
}

export class ShiftService extends BaseService {
  // ============================================
  // REGISTER MANAGEMENT
  // ============================================

  async getCurrentShiftForUser(userId: string, businessUnitId: string) {
    try {
      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const shift = await this.prisma.cashRegisterSession.findFirst({
        where: {
          userId,
          status: 'OPEN',
          cashRegister: { businessUnitId },
        },
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
              receiptNumber: true,
              total: true,
              status: true,
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
          cashTransactions: {
            select: {
              id: true,
              type: true,
              amount: true,
              reason: true,
              createdAt: true,
            },
          },
        },
        orderBy: { openedAt: 'desc' },
      });

      if (!shift) return null;

      const totalSales = shift.sales?.length || 0;
      const totalRevenue = shift.sales?.reduce((sum, sale) => sum + sale.total, 0) || 0;

      const cashPayments = shift.payments?.filter((p) => p.paymentMethod === 'CASH') || [];
      const cashReceived = cashPayments.reduce((sum, p) => sum + p.amount, 0);

      const cashOut = shift.cashTransactions
        ?.filter((t) => t.type === 'CASH_OUT')
        .reduce((sum, t) => sum + t.amount, 0) || 0;

      const cashIn = shift.cashTransactions
        ?.filter((t) => t.type === 'CASH_IN')
        .reduce((sum, t) => sum + t.amount, 0) || 0;

      const expectedBalance =
        shift.startingBalance + cashReceived + cashIn - cashOut;

      return {
        ...shift,
        totalSales,
        totalRevenue,
        cashReceived,
        cashOut,
        cashIn,
        expectedBalance,
        summary: {
          totalSales,
          totalRevenue,
          averageTicket: totalSales > 0 ? totalRevenue / totalSales : 0,
          cashReceived,
          cashOut,
          cashIn,
          expectedBalance,
        },
      };
    } catch (error) {
      this.handleError(error, 'ShiftService.getCurrentShiftForUser');
    }
  }

  async getRegisters(businessUnitId: string, isActive?: boolean) {
    try {
      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const where: any = { businessUnitId };
      if (isActive !== undefined) where.isActive = isActive;

      const registers = await this.prisma.cashRegister.findMany({
        where,
        include: {
          sessions: {
            where: { status: 'OPEN' },
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
              sessions: true,
              sales: true,
              payments: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      return registers.map((register) => {
        const openSession = register.sessions[0];
        return {
          ...register,
          currentSession: openSession || null,
          isOpen: !!openSession,
          sessionUser: openSession?.user || null,
        };
      });
    } catch (error) {
      this.handleError(error, 'ShiftService.getRegisters');
    }
  }

  async getRegisterById(id: string) {
    try {
      if (!id) throw new AppError('Register ID is required', 400);

      const register = await this.prisma.cashRegister.findUnique({
        where: { id },
        include: {
          businessUnit: {
            select: { id: true, name: true },
          },
          sessions: {
            orderBy: { openedAt: 'desc' },
            take: 10,
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
          _count: {
            select: { sessions: true, sales: true, payments: true },
          },
        },
      });

      if (!register) throw new AppError('Register not found', 404);
      return register;
    } catch (error) {
      this.handleError(error, 'ShiftService.getRegisterById');
    }
  }

  async getRegisterStatus(id: string) {
    try {
      if (!id) throw new AppError('Register ID is required', 400);

      const register = await this.prisma.cashRegister.findUnique({
        where: { id },
        include: {
          sessions: {
            where: { status: 'OPEN' },
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true },
              },
              sales: {
                select: {
                  id: true,
                  total: true,
                  paidAmount: true,
                  status: true,
                },
              },
            },
          },
        },
      });

      if (!register) throw new AppError('Register not found', 404);

      const openSession = register.sessions[0];
      const isOpen = !!openSession;

      let summary = {
        totalSales: 0,
        totalRevenue: 0,
        totalPaid: 0,
        transactionCount: 0,
      };

      if (openSession) {
        const sales = openSession.sales || [];
        summary = {
          totalSales: sales.length,
          totalRevenue: sales.reduce((sum, s) => sum + s.total, 0),
          totalPaid: sales.reduce((sum, s) => sum + s.paidAmount, 0),
          transactionCount: sales.length,
        };
      }

      return {
        id: register.id,
        name: register.name,
        code: register.code,
        status: register.status,
        cashBalance: register.cashBalance,
        isOpen,
        session: openSession || null,
        summary,
      };
    } catch (error) {
      this.handleError(error, 'ShiftService.getRegisterStatus');
    }
  }

  async createRegister(data: {
    name: string;
    code: string;
    businessUnitId: string;
    createdBy: string;
    isActive?: boolean;
  }) {
    try {
      // Auto-resolve duplicate codes by incrementing the sequence
      let finalCode = data.code.toUpperCase();
      const match = finalCode.match(/^(.*?)-(\d+)$/);

      if (match) {
        const prefix = match[1];
        let sequence = parseInt(match[2], 10);

        let attempts = 0;
        const maxAttempts = 1000;

        while (attempts < maxAttempts) {
          const existing = await this.prisma.cashRegister.findUnique({
            where: { code: finalCode },
          });
          if (!existing) break;
          sequence += 1;
          finalCode = `${prefix}-${String(sequence).padStart(3, '0')}`;
          attempts++;
        }

        if (attempts >= maxAttempts) {
          throw new AppError(
            `Unable to generate a unique register code after ${maxAttempts} attempts`,
            400
          );
        }
      } else {
        const existing = await this.prisma.cashRegister.findUnique({
          where: { code: finalCode },
        });
        if (existing) {
          throw new AppError(`Register with code "${finalCode}" already exists`, 400);
        }
      }

      const register = await this.prisma.cashRegister.create({
        data: {
          name: data.name,
          code: finalCode,
          businessUnitId: data.businessUnitId,
          isActive: data.isActive ?? true,
          cashBalance: 0,
          status: 'CLOSED',
        },
      });

      await this.createAuditLog({
        action: 'CREATE',
        entityType: 'CASH_REGISTER',
        entityId: register.id,
        entityName: register.name,
        userId: data.createdBy,
        businessUnitId: data.businessUnitId,
        severity: 'INFO',
        changes: { data: { ...data, code: finalCode } },
      });

      return register;
    } catch (error) {
      this.handleError(error, 'ShiftService.createRegister');
    }
  }

  async updateRegister(
    id: string,
    data: { name?: string; code?: string; isActive?: boolean }
  ) {
    try {
      if (!id) throw new AppError('Register ID is required', 400);

      const existing = await this.prisma.cashRegister.findUnique({ where: { id } });
      if (!existing) throw new AppError('Register not found', 404);

      if (data.code && data.code !== existing.code) {
        const duplicate = await this.prisma.cashRegister.findUnique({
          where: { code: data.code },
        });
        if (duplicate) {
          throw new AppError(`Register with code "${data.code}" already exists`, 400);
        }
      }

      return await this.prisma.cashRegister.update({
        where: { id },
        data: {
          name: data.name,
          code: data.code,
          isActive: data.isActive,
        },
      });
    } catch (error) {
      this.handleError(error, 'ShiftService.updateRegister');
    }
  }

  async deleteRegister(id: string) {
    try {
      if (!id) throw new AppError('Register ID is required', 400);

      const openSession = await this.prisma.cashRegisterSession.findFirst({
        where: { cashRegisterId: id, status: 'OPEN' },
      });

      if (openSession) {
        throw new AppError('Cannot delete register with open sessions', 400);
      }

      await this.prisma.cashRegister.update({
        where: { id },
        data: { isActive: false },
      });

      return { success: true };
    } catch (error) {
      this.handleError(error, 'ShiftService.deleteRegister');
    }
  }

  // ============================================
  // SHIFT MANAGEMENT
  // ============================================

  async startShift(data: StartShiftData) {
    try {
      if (!data.cashRegisterId) throw new AppError('Cash register ID is required', 400);
      if (data.startingBalance < 0) throw new AppError('Starting balance cannot be negative', 400);
      if (!data.userId) throw new AppError('User ID is required', 400);

      return await this.prisma.$transaction(async (tx: any) => {
        const cashRegister = await tx.cashRegister.findUnique({
          where: { id: data.cashRegisterId },
        });

        if (!cashRegister) throw new AppError('Cash register not found', 404);
        if (!cashRegister.isActive) throw new AppError('Cash register is not active', 400);

        const openShift = await tx.cashRegisterSession.findFirst({
          where: { cashRegisterId: data.cashRegisterId, status: 'OPEN' },
        });
        if (openShift) {
          throw new AppError('Cash register already has an open shift', 400);
        }

        const userOpenShift = await tx.cashRegisterSession.findFirst({
          where: { userId: data.userId, status: 'OPEN' },
        });
        if (userOpenShift) {
          throw new AppError('User already has an open shift', 400);
        }

        // ✅ 1. Create the CashRegisterSession
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
              select: { id: true, firstName: true, lastName: true },
            },
          },
        });

        // ✅ 2. Update the CashRegister balance + status
        await tx.cashRegister.update({
          where: { id: data.cashRegisterId },
          data: {
            cashBalance: data.startingBalance,
            status: 'OPEN',
          },
        });

        // ✅ 3. Create the CashTransaction (FIXED: cashRegisterId required, no businessUnitId)
        await tx.cashTransaction.create({
          data: {
            cashRegisterId: data.cashRegisterId,        // ✅ required
            cashRegisterSessionId: shift.id,            // ✅ optional link
            type: 'CASH_IN',
            amount: data.startingBalance,
            userId: data.userId,
            reason: 'Starting balance',
            createdAt: new Date(),
          },
        });

        // ✅ 4. Create the ShiftLog (audit trail)
        const shiftLog = await tx.shiftLog.create({
          data: {
            userId: data.userId,
            businessUnitId: data.businessUnitId,
            shiftStart: new Date(),
            startingCash: data.startingBalance,
            status: 'OPEN',
            type: deriveShiftType(new Date()),
            notes: data.notes || `Shift started on register ${cashRegister.name}`,
            entityName: `Shift ${shift.id}`,
          },
        });

        // ✅ 5. Create the AuditLog
        await tx.auditLog.create({
          data: {
            action: 'CREATE',
            entityType: 'SHIFT',
            entityId: shift.id,
            entityName: `Shift ${shift.id}`,
            userId: data.userId,
            businessUnitId: data.businessUnitId,
            changes: {
              cashRegisterId: data.cashRegisterId,
              startingBalance: data.startingBalance,
              shiftLogId: shiftLog.id,
            },
            severity: 'INFO',
            createdAt: new Date(),
          },
        });

        // ✅ 6. Emit realtime event (non-blocking)
        try {
          (realtimeService as any).emitShiftStarted?.(shift, data.businessUnitId);
        } catch (wsError) {
          logger.warn('Failed to emit shift started event:', wsError);
        }

        // ✅ 7. Send notification (non-blocking)
        try {
          await notificationService.sendShiftNotification(
            data.businessUnitId,
            data.userId,
            'started'
          );
        } catch (notifError) {
          logger.warn('Failed to send shift notification:', notifError);
        }

        return {
          ...shift,
          shiftLogId: shiftLog.id,
        };
      });
    } catch (error) {
      this.handleError(error, 'ShiftService.startShift');
    }
  }

  async endShift(sessionId: string, data: EndShiftData) {
    try {
      if (!sessionId) throw new AppError('Session ID is required', 400);
      if (data.endingBalance < 0) throw new AppError('Ending balance cannot be negative', 400);

      return await this.prisma.$transaction(async (tx: any) => {
        const session = await tx.cashRegisterSession.findUnique({
          where: { id: sessionId },
          include: {
            cashRegister: true,
            sales: { include: { payments: true } },
            payments: true,
            cashTransactions: true,
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        });

        if (!session) throw new AppError('Shift not found', 404);
        if (session.status !== 'OPEN') throw new AppError('Shift is already closed', 400);

        // Calculate totals from existing relations
        const cashPayments = session.payments.filter((p: any) => p.paymentMethod === 'CASH');
        const cashReceived = cashPayments.reduce((sum: number, p: any) => sum + p.amount, 0);

        const cashOut = session.cashTransactions
          .filter((t: any) => t.type === 'CASH_OUT')
          .reduce((sum: number, t: any) => sum + t.amount, 0);

        const cashIn = session.cashTransactions
          .filter((t: any) => t.type === 'CASH_IN')
          .reduce((sum: number, t: any) => sum + t.amount, 0);

        const expectedBalance = session.startingBalance + cashReceived + cashIn - cashOut;
        const discrepancy = data.endingBalance - expectedBalance;

        // ✅ 1. Close the CashRegisterSession
        const closedShift = await tx.cashRegisterSession.update({
          where: { id: sessionId },
          data: {
            endingBalance: data.endingBalance,
            expectedEndingBalance: expectedBalance,
            discrepancy,
            discrepancyReason: data.notes || null,
            notes: data.notes || session.notes,
            status: 'CLOSED',
            closedAt: new Date(),
          },
          include: {
            cashRegister: true,
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        });

        // ✅ 2. Update the CashRegister balance + status
        await tx.cashRegister.update({
          where: { id: session.cashRegisterId },
          data: {
            cashBalance: data.endingBalance,
            status: 'CLOSED',
          },
        });

        // ✅ 3. Create the closing CashTransaction (FIXED)
        await tx.cashTransaction.create({
          data: {
            cashRegisterId: session.cashRegisterId,    // ✅ required
            cashRegisterSessionId: sessionId,          // ✅ optional
            type: 'CASH_IN',
            amount: data.endingBalance,
            userId: data.userId,
            reason: 'Closing balance',
            createdAt: new Date(),
          },
        });

        // ✅ 4. Close the corresponding ShiftLog (find the latest open one for this user)
        const openShiftLog = await tx.shiftLog.findFirst({
          where: {
            userId: session.userId,
            businessUnitId: session.cashRegister.businessUnitId,
            status: 'OPEN',
          },
          orderBy: { shiftStart: 'desc' },
        });

        if (openShiftLog) {
          await tx.shiftLog.update({
            where: { id: openShiftLog.id },
            data: {
              shiftEnd: new Date(),
              endingCash: data.endingBalance,
              expectedCash: expectedBalance,
              discrepancy,
              discrepancyReason: data.notes || null,
              status: 'CLOSED',
              notes: data.notes || openShiftLog.notes,
            },
          });
        }

        // ✅ 5. Create the AuditLog
        await tx.auditLog.create({
          data: {
            action: 'UPDATE',
            entityType: 'SHIFT',
            entityId: sessionId,
            entityName: `Shift ${sessionId}`,
            userId: data.userId,
            businessUnitId: session.cashRegister.businessUnitId,
            changes: {
              endingBalance: data.endingBalance,
              expectedBalance,
              discrepancy,
              shiftLogId: openShiftLog?.id,
            },
            severity: discrepancy !== 0 ? 'HIGH' : 'INFO',
            createdAt: new Date(),
          },
        });

        // ✅ 6. Emit realtime event (non-blocking)
        try {
          (realtimeService as any).emitShiftEnded?.(
            closedShift,
            session.cashRegister.businessUnitId
          );
        } catch (wsError) {
          logger.warn('Failed to emit shift ended event:', wsError);
        }

        // ✅ 7. Notify if there's a discrepancy
        if (discrepancy !== 0) {
          try {
            await notificationService.sendShiftNotification(
              session.cashRegister.businessUnitId,
              data.userId,
              'discrepancy'
            );
          } catch (notifError) {
            logger.warn('Failed to send discrepancy notification:', notifError);
          }
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

  async getCurrentShift(cashRegisterId: string) {
    try {
      if (!cashRegisterId) throw new AppError('Cash register ID is required', 400);

      const session = await this.prisma.cashRegisterSession.findFirst({
        where: { cashRegisterId, status: 'OPEN' },
        include: {
          cashRegister: true,
          sales: { include: { payments: true } },
          payments: true,
          cashTransactions: true,
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      if (!session) return null;

      const cashPayments = session.payments.filter((p: any) => p.paymentMethod === 'CASH');
      const cashReceived = cashPayments.reduce((sum: number, p: any) => sum + p.amount, 0);

      const cashOut = session.cashTransactions
        .filter((t: any) => t.type === 'CASH_OUT')
        .reduce((sum: number, t: any) => sum + t.amount, 0);

      const cashIn = session.cashTransactions
        .filter((t: any) => t.type === 'CASH_IN')
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
        ...(businessUnitId && { cashRegister: { businessUnitId } }),
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
              select: { id: true, firstName: true, lastName: true, email: true },
            },
            sales: {
              select: { id: true, total: true, saleDate: true },
            },
            payments: {
              select: { id: true, amount: true, paymentMethod: true },
            },
            cashTransactions: true,
            _count: {
              select: { sales: true, payments: true },
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

  async getShiftById(sessionId: string) {
    try {
      if (!sessionId) throw new AppError('Session ID is required', 400);

      const shift = await this.prisma.cashRegisterSession.findUnique({
        where: { id: sessionId },
        include: {
          cashRegister: {
            include: {
              businessUnit: { select: { id: true, name: true } },
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
                    select: { id: true, name: true, sku: true },
                  },
                },
              },
              payments: true,
              customer: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
          payments: true,
          cashTransactions: {
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
          _count: {
            select: { sales: true, payments: true, cashTransactions: true },
          },
        },
      });

      if (!shift) throw new AppError('Shift not found', 404);

      const cashPayments = shift.payments.filter((p: any) => p.paymentMethod === 'CASH');
      const cashReceived = cashPayments.reduce((sum: number, p: any) => sum + p.amount, 0);

      const cardReceived = shift.payments
        .filter((p: any) => ['CREDIT_CARD', 'DEBIT_CARD'].includes(p.paymentMethod))
        .reduce((sum: number, p: any) => sum + p.amount, 0);

      const mobileReceived = shift.payments
        .filter((p: any) => p.paymentMethod === 'MOBILE_MONEY')
        .reduce((sum: number, p: any) => sum + p.amount, 0);

      const otherReceived = shift.payments
        .filter((p: any) =>
          !['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_MONEY'].includes(p.paymentMethod)
        )
        .reduce((sum: number, p: any) => sum + p.amount, 0);

      const cashOut = shift.cashTransactions
        .filter((t: any) => t.type === 'CASH_OUT')
        .reduce((sum: number, t: any) => sum + t.amount, 0);

      const cashIn = shift.cashTransactions
        .filter((t: any) => t.type === 'CASH_IN')
        .reduce((sum: number, t: any) => sum + t.amount, 0);

      const expectedBalance = shift.startingBalance + cashReceived + cashIn - cashOut;
      const discrepancy =
        shift.endingBalance !== null ? shift.endingBalance - expectedBalance : null;

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
   * Get shift statistics with scope support
   */
  async getShiftStats(params: {
    businessUnitId?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<ShiftStats> {
    try {
      const { businessUnitId, userId, startDate, endDate } = params;

      const where: any = {
        ...(businessUnitId && { cashRegister: { businessUnitId } }),
        ...(userId && { userId }),
        ...(startDate && { openedAt: { gte: startDate } }),
        ...(endDate && {
          openedAt: {
            ...(startDate ? { gte: startDate } : {}),
            lte: endDate,
          },
        }),
      };

      const [totalShifts, openShifts, closedShifts, totalRevenue, shifts] =
        await Promise.all([
          this.prisma.cashRegisterSession.count({ where }),
          this.prisma.cashRegisterSession.count({
            where: { ...where, status: 'OPEN' },
          }),
          this.prisma.cashRegisterSession.count({
            where: { ...where, status: 'CLOSED' },
          }),
          this.prisma.sale.aggregate({
            where: { cashRegisterSession: where },
            _sum: { total: true },
          }),
          this.prisma.cashRegisterSession.findMany({
            where: { ...where, status: 'CLOSED' },
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true },
              },
              sales: { select: { total: true } },
            },
          }),
        ]);

      const closedShiftsWithDuration = shifts.filter((s: any) => s.closedAt);
      const totalDuration = closedShiftsWithDuration.reduce(
        (sum: number, s: any) =>
          sum + (s.closedAt!.getTime() - s.openedAt.getTime()) / 1000,
        0
      );

      const cashierMap = new Map<
        string,
        {
          userId: string;
          userName: string;
          shiftCount: number;
          totalRevenue: number;
        }
      >();

      shifts.forEach((shift: any) => {
        const key = shift.userId;
        const current = cashierMap.get(key) || {
          userId: shift.userId,
          userName: `${shift.user.firstName} ${shift.user.lastName}`.trim(),
          shiftCount: 0,
          totalRevenue: 0,
        };
        current.shiftCount += 1;
        current.totalRevenue += shift.sales.reduce(
          (sum: number, s: any) => sum + s.total,
          0
        );
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
        averageShiftDuration:
          closedShiftsWithDuration.length > 0
            ? totalDuration / closedShiftsWithDuration.length
            : 0,
        averageShiftRevenue:
          closedShifts > 0
            ? (totalRevenue._sum.total || 0) / closedShifts
            : 0,
        topCashiers,
      };
    } catch (error) {
      this.handleError(error, 'ShiftService.getShiftStats');
    }
  }

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

        // ✅ Create CashTransaction with proper relations
        const transaction = await tx.cashTransaction.create({
          data: {
            cashRegisterId: session.cashRegisterId,    // ✅ required
            cashRegisterSessionId: sessionId,          // ✅ optional
            type: 'CASH_IN',
            amount,
            userId,
            reason: description || 'Cash added',
            createdAt: new Date(),
          },
        });

        // ✅ Update register balance
        await tx.cashRegister.update({
          where: { id: session.cashRegisterId },
          data: { cashBalance: { increment: amount } },
        });

        // ✅ Audit log
        await tx.auditLog.create({
          data: {
            action: 'UPDATE',
            entityType: 'SHIFT',
            entityId: sessionId,
            entityName: `Cash In - Shift ${sessionId}`,
            userId,
            businessUnitId: session.cashRegister.businessUnitId,
            changes: { amount, description },
            severity: 'INFO',
          },
        });

        return transaction;
      });
    } catch (error) {
      this.handleError(error, 'ShiftService.addCash');
    }
  }

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
        if (session.cashRegister.cashBalance < amount) {
          throw new AppError('Insufficient cash in register', 400);
        }

        const transaction = await tx.cashTransaction.create({
          data: {
            cashRegisterId: session.cashRegisterId,    // ✅ required
            cashRegisterSessionId: sessionId,          // ✅ optional
            type: 'CASH_OUT',
            amount,
            userId,
            reason: description || 'Cash removed',
            createdAt: new Date(),
          },
        });

        await tx.cashRegister.update({
          where: { id: session.cashRegisterId },
          data: { cashBalance: { decrement: amount } },
        });

        await tx.auditLog.create({
          data: {
            action: 'UPDATE',
            entityType: 'SHIFT',
            entityId: sessionId,
            entityName: `Cash Out - Shift ${sessionId}`,
            userId,
            businessUnitId: session.cashRegister.businessUnitId,
            changes: { amount, description },
            severity: 'INFO',
          },
        });

        return transaction;
      });
    } catch (error) {
      this.handleError(error, 'ShiftService.removeCash');
    }
  }

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
