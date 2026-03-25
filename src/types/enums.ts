export enum UserRole {
  CUSTOMER = 'customer',
  OWNER = 'owner',
  ADMIN = 'admin'
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_VERIFICATION = 'pending_verification'
}

export enum ReservationStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  OVERDUE = 'overdue'
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded'
}

export enum PaymentMethod {
  CARD = 'card',
  TRANSFER = 'transfer',
  CASH = 'cash',
  WALLET = 'wallet'
}

export enum PaymentType {
  RESERVATION = 'reservation',
  OVERTIME = 'overtime',
  SUBSCRIPTION = 'subscription',
  REFUND = 'refund'
}

export enum ParkingStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
  PENDING_APPROVAL = 'pending_approval',
  SUSPENDED_PAYMENT = 'suspended_payment'
}

export enum SpotStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  RESERVED = 'reserved',
  MAINTENANCE = 'maintenance'
}

export enum VehicleType {
  CAR = 'car',
  MOTORCYCLE = 'motorcycle',
  SUV = 'suv',
  TRUCK = 'truck',
  VAN = 'van'
}

export enum NotificationType {
  RESERVATION_CONFIRMED = 'reservation_confirmed',
  RESERVATION_REMINDER = 'reservation_reminder',
  OVERTIME_WARNING = 'overtime_warning',
  OVERTIME_CHARGED = 'overtime_charged',
  PAYMENT_RECEIVED = 'payment_received',
  PARKING_APPROVED = 'parking_approved',
  SUBSCRIPTION_EXPIRING = 'subscription_expiring',
  SUBSCRIPTION_EXPIRED = 'subscription_expired',
  PAYMENT_FAILED = 'payment_failed',
  GENERAL = 'general'
}

export enum SubscriptionStatus {
  PENDING = 'pending',        // ← Verificar que esté
  TRIAL = 'trial',
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired'
}

export enum SubscriptionPlan {
  BASIC = 'basic',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise'
}

export enum PayoutStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}