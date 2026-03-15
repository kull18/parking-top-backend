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

export const createReservationSchema = z.object({
  parkingLotId: z.string().cuid(),  // ✅ CAMBIO: uuid() → cuid()
  vehicleId: z.string().cuid().optional(),  // ✅ CAMBIO: uuid() → cuid()
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  notes: z.string().optional()
}).refine(
  (data) => new Date(data.endTime) > new Date(data.startTime),
  { message: 'La fecha de fin debe ser posterior a la de inicio' }
);

export const nearbyParkingSchema = z.object({
  latitude: z.string().transform(val => parseFloat(val)).pipe(z.number().min(-90).max(90)),
  longitude: z.string().transform(val => parseFloat(val)).pipe(z.number().min(-180).max(180)),
  radius: z.string().optional().transform(val => val ? parseInt(val, 10) : 5000).pipe(z.number().positive()),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional()
});