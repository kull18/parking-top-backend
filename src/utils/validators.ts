import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  fullName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  phone: z.string().optional(),
  role: z.enum(['customer', 'owner']).default('customer')
});

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida')
});

export const createSubscriptionSchema = z.object({
  planId: z.string().uuid('Plan ID inválido'),
  paymentMethodId: z.string().min(1, 'Método de pago requerido')
});

export const createParkingSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  description: z.string().optional(),
  address: z.string().min(5, 'Dirección inválida'),
  city: z.string().default('San Cristóbal de las Casas'),
  state: z.string().default('Chiapas'),
  postalCode: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  totalSpots: z.number().int().positive(),
  basePricePerHour: z.number().positive(),
  overtimeRatePerHour: z.number().nonnegative(),
  features: z.array(z.string()).default([]),
  images: z.array(z.string().url()).default([]),
  operatingHours: z.record(z.object({
    open: z.string(),
    close: z.string()
  })).optional()
});

export const nearbyParkingSchema = z.object({
  latitude: z.string().transform(val => parseFloat(val)).pipe(z.number().min(-90).max(90)),
  longitude: z.string().transform(val => parseFloat(val)).pipe(z.number().min(-180).max(180)),
  radius: z.string().optional().transform(val => val ? parseInt(val, 10) : 5000).pipe(z.number().positive()),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional()
});

export const createReviewSchema = z.object({
  parkingLotId: z.string().cuid(),
  reservationId: z.string().cuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(10).max(500).optional()
});

export const createParkingSpotSchema = z.object({
  parkingLotId: z.string().cuid('parkingLotId inválido'),
  spotNumber: z.string().min(1, 'El número del espacio es requerido'),
  status: z.enum(['available', 'occupied', 'reserved', 'maintenance']).optional(),
  vehicleType: z.string().min(1).optional(),
  floor: z.string().optional(),
  section: z.string().optional()
});

export const updateParkingSpotSchema = z.object({
  spotNumber: z.string().min(1, 'El número del espacio es requerido').optional(),
  status: z.enum(['available', 'occupied', 'reserved', 'maintenance']).optional(),
  vehicleType: z.string().min(1).optional(),
  floor: z.string().nullable().optional(),
  section: z.string().nullable().optional()
}).refine(
  (data) =>
    data.spotNumber !== undefined ||
    data.status !== undefined ||
    data.vehicleType !== undefined ||
    data.floor !== undefined ||
    data.section !== undefined,
  { message: 'Debes enviar al menos un campo para actualizar' }
);
 
export const respondReviewSchema = z.object({
  response: z.string().min(10).max(500)
});

export const registerFCMTokenSchema = z.object({
  token: z.string().min(10),
  platform: z.enum(['android', 'ios', 'web'])
});
 
export const removeFCMTokenSchema = z.object({
  token: z.string().min(10)
});
 
 
 
export const updateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().min(10).max(500).optional()
}).refine(
  (data) => data.rating !== undefined || data.comment !== undefined,
  { message: 'Debes proporcionar al menos rating o comment' }
);

export const createReservationSchema = z.object({
  body: z.object({
    parkingLotId: z.string().cuid('ID de estacionamiento inválido'),
    parkingSpotId: z.string().cuid('ID de espacio inválido').optional(), // ✅ Nuevo
    vehicleId: z.string().cuid('ID de vehículo inválido').optional(),
    startTime: z.string().datetime('Fecha de inicio inválida'),
    endTime: z.string().datetime('Fecha de fin inválida'),
    paymentMethod: z.enum(['mercadopago', 'cash']).default('mercadopago'), // ✅ Nuevo
    notes: z.string().max(500, 'Las notas no pueden exceder 500 caracteres').optional()
  }).refine(
    (data) => new Date(data.endTime) > new Date(data.startTime),
    {
      message: 'La fecha de fin debe ser posterior a la fecha de inicio',
      path: ['endTime']
    }
  )
});
 
export const updateReservationSchema = z.object({
  body: z.object({
    parkingSpotId: z.string().cuid().optional(), // ✅ Permitir actualizar spot
    vehicleId: z.string().cuid().optional(),
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
    notes: z.string().max(500).optional()
  })
});
 
export const cancelReservationSchema = z.object({
  body: z.object({
    reason: z.string().max(500, 'La razón no puede exceder 500 caracteres').optional()
  })
});
 
export const checkAvailabilitySchema = z.object({
  query: z.object({
    parkingLotId: z.string().cuid(),
    startTime: z.string().datetime(),
    endTime: z.string().datetime()
  })
});