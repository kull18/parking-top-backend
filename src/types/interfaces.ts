import { Request } from 'express';
import {
  UserRole,
  UserStatus,
  ReservationStatus,
  PaymentStatus,
  SubscriptionStatus,
  ParkingStatus
} from './enums';

export interface IUser {
  id: string;
  email: string;
  passwordHash: string;
  phone?: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  profileImageUrl?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export interface IUserResponse {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  profileImageUrl?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: Date;
}

// src/types/interfaces.ts
export interface IAuthTokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  fullName: string;
}

export interface IAuthResponse {
  user: IUserResponse;
  token: string;
  refreshToken?: string;
}

export interface AuthRequest extends Request {
  user?: IAuthTokenPayload;
}

export interface ISubscriptionPlan {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  monthlyPrice: number;
  setupFee: number;
  maxParkingLots?: number;
  maxSpotsPerLot?: number;
  commissionRate: number;
  features: string[];
  trialDays: number;
  isActive: boolean;
  stripePriceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISubscription {
  id: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  trialStartDate?: Date;
  trialEndDate?: Date;
  startDate: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelledAt?: Date;
  endedAt?: Date;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  cancelAtPeriodEnd: boolean;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IParkingLot {
  id: string;
  ownerId: string;
  subscriptionId?: string;
  name: string;
  description?: string;
  address: string;
  city: string;
  state: string;
  postalCode?: string;
  latitude: number;
  longitude: number;
  totalSpots: number;
  availableSpots: number;
  status: ParkingStatus;
  operatingHours: Record<string, { open: string; close: string }>;
  basePricePerHour: number;
  overtimeRatePerHour: number;
  features: string[];
  images: string[];
  ratingAverage: number;
  totalReviews: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IReservation {
  id: string;
  userId: string;
  parkingLotId: string;
  parkingSpotId?: string;
  vehicleId?: string;
  reservationCode: string;
  status: ReservationStatus;
  startTime: Date;
  endTime: Date;
  actualExitTime?: Date;
  checkInTime?: Date;
  reservedHours: number;
  overtimeHours: number;
  baseCost: number;
  overtimeCost: number;
  totalCost: number;
  commissionRate: number;
  commissionAmount: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPayment {
  id: string;
  userId: string;
  paymentType: string;
  reservationId?: string;
  subscriptionId?: string;
  amount: number;
  commissionAmount: number;
  netAmount: number;
  paymentMethod: string;
  status: PaymentStatus;
  paymentIntentId?: string;
  transactionId?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    page?: number;
    perPage?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface CreateSubscriptionDTO {
  planId: string;
  paymentMethodId: string;
}

export interface CreateReservationDTO {
  parkingLotId: string;
  vehicleId?: string;
  startTime: Date;
  endTime: Date;
  notes?: string;
}

export interface NearbyParkingQuery {
  latitude: number;
  longitude: number;
  radius?: number;
  startTime?: Date;
  endTime?: Date;
}


// Después ✅ - center pertenece al feature, no al response
export interface MapboxFeature {
  id: string;
  place_name: string;
  center: [number, number];
  geometry: {
    type: string;
    coordinates: [number, number];
  };
}

export interface MapboxGeocodeResponse {
  type: string;
  features: MapboxFeature[];
}

export interface MapboxDirectionsResponse {
  routes: MapboxDirectionsRoute[];
  waypoints: any[];
  code: string;
}

export interface MapboxDirectionsRoute {
  distance: number;
  duration: number;
  geometry: any;
}