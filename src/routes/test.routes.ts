import { Router, Request, Response } from 'express';
import paymentService from '@/services/payment.service';
import reservationService from '@/services/reservation.service';
import prisma from '@/config/database';
import { PaymentStatus, ReservationStatus } from '@/types/enums';
import logger from '@/utils/logger';

const router = Router();

// ⚠️ SOLO PARA DESARROLLO - ELIMINAR EN PRODUCCIÓN
if (process.env.NODE_ENV === 'development') {
  
  /**
   * Aprobar pago manualmente (testing)
   * POST /test/approve-payment/:reservationId
   */
  router.post('/approve-payment/:reservationId', async (req: Request, res: Response) => {
    try {
      const { reservationId } = req.params;

      logger.info(`[TEST] Approving payment for reservation: ${reservationId}`);

      // Buscar el pago pendiente de esta reserva
      const payment = await prisma.payment.findFirst({
        where: {
          reservationId,
          status: PaymentStatus.PENDING
        }
      });

      if (!payment) {
        return res.status(404).json({
          success: false,
          error: { 
            code: 'NOT_FOUND',
            message: 'No se encontró pago pendiente para esta reserva' 
          }
        });
      }

      // Actualizar pago a completado
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.COMPLETED,
          completedAt: new Date(),
          transactionId: `TEST-${Date.now()}`,
          metadata: {
            ...(payment.metadata as any || {}),
            testApproved: true,
            approvedAt: new Date().toISOString(),
            approvedBy: 'TEST_ENDPOINT'
          }
        }
      });

      logger.info(`[TEST] Payment ${payment.id} marked as completed`);

      // Confirmar reserva
      await reservationService.confirmReservation(reservationId);

      logger.info(`[TEST] Reservation ${reservationId} confirmed`);

      // Obtener reserva actualizada
      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              phone: true
            }
          },
          parkingLot: {
            select: {
              id: true,
              name: true,
              address: true,
              city: true,
              basePricePerHour: true
            }
          },
          payments: true
        }
      });

      return res.json({
        success: true,
        data: {
          message: '✅ Pago aprobado manualmente (TEST MODE)',
          reservation,
          payment: await prisma.payment.findUnique({ 
            where: { id: payment.id } 
          })
        }
      });

    } catch (error: any) {
      logger.error('[TEST] Error approving payment:', error);
      return res.status(500).json({
        success: false,
        error: { 
          code: 'INTERNAL_ERROR',
          message: error.message 
        }
      });
    }
  });

  /**
   * Listar reservas pendientes
   * GET /test/pending-reservations
   */
  router.get('/pending-reservations', async (req: Request, res: Response) => {
    try {
      const reservations = await prisma.reservation.findMany({
        where: { status: ReservationStatus.PENDING },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true
            }
          },
          parkingLot: {
            select: {
              id: true,
              name: true,
              city: true
            }
          },
          payments: true
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      });

      return res.json({
        success: true,
        data: reservations,
        count: reservations.length
      });
    } catch (error: any) {
      logger.error('[TEST] Error fetching pending reservations:', error);
      return res.status(500).json({
        success: false,
        error: { 
          code: 'INTERNAL_ERROR',
          message: error.message 
        }
      });
    }
  });


  /**
 * POST /test/complete-reservation/:reservationId
 * Completar reserva manualmente (testing)
 */
router.post('/complete-reservation/:reservationId', async (req: Request, res: Response) => {
  try {
    const { reservationId } = req.params;

    const reservation = await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        status: ReservationStatus.COMPLETED,
        checkInTime: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 horas atrás
        actualExitTime: new Date(),
        completedAt: new Date()
      }
    });

    return res.json({
      success: true,
      data: {
        message: '✅ Reserva completada manualmente (TEST MODE)',
        reservation
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
});

  /**
   * Rechazar pago manualmente (testing)
   * POST /test/reject-payment/:reservationId
   */
  router.post('/reject-payment/:reservationId', async (req: Request, res: Response) => {
    try {
      const { reservationId } = req.params;

      logger.info(`[TEST] Rejecting payment for reservation: ${reservationId}`);

      const payment = await prisma.payment.findFirst({
        where: {
          reservationId,
          status: PaymentStatus.PENDING
        }
      });

      if (!payment) {
        return res.status(404).json({
          success: false,
          error: { 
            code: 'NOT_FOUND',
            message: 'No se encontró pago pendiente para esta reserva' 
          }
        });
      }

      // Actualizar pago a fallido
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          metadata: {
            ...(payment.metadata as any || {}),
            testRejected: true,
            rejectedAt: new Date().toISOString(),
            rejectedBy: 'TEST_ENDPOINT'
          }
        }
      });

      // Cancelar reserva
      await prisma.reservation.update({
        where: { id: reservationId },
        data: {
          status: ReservationStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: 'Pago rechazado (TEST)'
        }
      });

      logger.info(`[TEST] Payment ${payment.id} marked as failed`);
      logger.info(`[TEST] Reservation ${reservationId} cancelled`);

      return res.json({
        success: true,
        data: {
          message: '❌ Pago rechazado manualmente (TEST MODE)',
          paymentId: payment.id,
          reservationId
        }
      });

    } catch (error: any) {
      logger.error('[TEST] Error rejecting payment:', error);
      return res.status(500).json({
        success: false,
        error: { 
          code: 'INTERNAL_ERROR',
          message: error.message 
        }
      });
    }

    
  });

  logger.info('✅ Test routes enabled (development mode)');

} else {
  logger.warn('❌ Test routes disabled (production mode)');
}

export default router;