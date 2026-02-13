import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Limpiar datos existentes (CUIDADO en producción)
  if (process.env.NODE_ENV === 'development') {
    console.log('🗑️  Clearing existing data...');
    await prisma.review.deleteMany();
    await prisma.overtimeCharge.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.reservation.deleteMany();
    await prisma.parkingSpot.deleteMany();
    await prisma.parkingLot.deleteMany();
    await prisma.vehicle.deleteMany();
    await prisma.subscriptionInvoice.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.subscriptionPlan.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.pushToken.deleteMany();
    await prisma.user.deleteMany();
  }

  // 1. Crear planes de suscripción
  console.log('📋 Creating subscription plans...');
  const basicPlan = await prisma.subscriptionPlan.create({
    data: {
      name: 'basic',
      displayName: 'Plan Básico',
      description: 'Ideal para empezar',
      monthlyPrice: 499,
      setupFee: 0,
      maxParkingLots: 1,
      maxSpotsPerLot: 50,
      commissionRate: 15,
      features: ['basic_analytics', 'email_support'],
      trialDays: 7,
      stripePriceId: 'price_basic_test'
    }
  });

  const premiumPlan = await prisma.subscriptionPlan.create({
    data: {
      name: 'premium',
      displayName: 'Plan Premium',
      description: 'Para múltiples estacionamientos',
      monthlyPrice: 999,
      setupFee: 0,
      maxParkingLots: 5,
      maxSpotsPerLot: null,
      commissionRate: 12,
      features: ['advanced_analytics', 'priority_support'],
      trialDays: 14,
      stripePriceId: 'price_premium_test'
    }
  });

  const enterprisePlan = await prisma.subscriptionPlan.create({
    data: {
      name: 'enterprise',
      displayName: 'Plan Empresarial',
      description: 'Solución completa',
      monthlyPrice: 2499,
      setupFee: 500,
      maxParkingLots: null,
      maxSpotsPerLot: null,
      commissionRate: 10,
      features: ['advanced_analytics', '24_7_support', 'api_access'],
      trialDays: 30,
      stripePriceId: 'price_enterprise_test'
    }
  });

  // 2. Crear usuarios de prueba
  console.log('👥 Creating test users...');
  const passwordHash = await bcrypt.hash('password123', 10);

  const customer1 = await prisma.user.create({
    data: {
      email: 'cliente@test.com',
      passwordHash,
      fullName: 'Juan Pérez',
      phone: '9611234567',
      role: 'customer',
      status: 'active',
      emailVerified: true
    }
  });

  const owner1 = await prisma.user.create({
    data: {
      email: 'propietario@test.com',
      passwordHash,
      fullName: 'María González',
      phone: '9617654321',
      role: 'owner',
      status: 'active',
      emailVerified: true
    }
  });

  const admin1 = await prisma.user.create({
    data: {
      email: 'admin@parkingtop.com',
      passwordHash,
      fullName: 'Admin Parking Top',
      role: 'admin',
      status: 'active',
      emailVerified: true
    }
  });

  // 3. Crear suscripción para propietario
  console.log('💳 Creating test subscription...');
  const subscription = await prisma.subscription.create({
    data: {
      userId: owner1.id,
      planId: premiumPlan.id,
      status: 'active',
      startDate: new Date(),
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      stripeCustomerId: 'cus_test_123',
      stripeSubscriptionId: 'sub_test_123'
    }
  });

  // 4. Crear estacionamiento de prueba
  console.log('🅿️  Creating test parking lot...');
  const parking = await prisma.parkingLot.create({
    data: {
      ownerId: owner1.id,
      subscriptionId: subscription.id,
      name: 'Estacionamiento Centro',
      description: 'Estacionamiento en el centro de San Cristóbal',
      address: 'Calle Real de Guadalupe 15',
      city: 'San Cristóbal de las Casas',
      state: 'Chiapas',
      postalCode: '29200',
      latitude: 16.7370,
      longitude: -92.6376,
      totalSpots: 30,
      availableSpots: 30,
      status: 'active',
      basePricePerHour: 20,
      overtimeRatePerHour: 25,
      features: ['techado', 'vigilancia', 'cctv', 'iluminado'],
      images: ['https://example.com/parking1.jpg'],
      operatingHours: {
        monday: { open: '06:00', close: '22:00' },
        tuesday: { open: '06:00', close: '22:00' },
        wednesday: { open: '06:00', close: '22:00' },
        thursday: { open: '06:00', close: '22:00' },
        friday: { open: '06:00', close: '22:00' },
        saturday: { open: '08:00', close: '20:00' },
        sunday: { open: '08:00', close: '20:00' }
      },
      approvedAt: new Date(),
      approvedBy: admin1.id,
      subscriptionVerifiedAt: new Date()
    }
  });

  // 5. Crear espacios
  console.log('📍 Creating parking spots...');
  const spots = Array.from({ length: 30 }, (_, i) => ({
    parkingLotId: parking.id,
    spotNumber: String(i + 1),
    status: 'available' as const,
    vehicleType: 'car' as const
  }));

  await prisma.parkingSpot.createMany({ data: spots });

  // 6. Crear vehículo de prueba
  console.log('Creating test vehicle...');
  await prisma.vehicle.create({
    data: {
      userId: customer1.id,
      licensePlate: 'ABC-123-D',
      brand: 'Toyota',
      model: 'Corolla',
      color: 'Blanco',
      vehicleType: 'car',
      isDefault: true
    }
  });

  console.log('✅ Seeding completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`- Plans: 3 (Basic, Premium, Enterprise)`);
  console.log(`- Users: 3 (1 customer, 1 owner, 1 admin)`);
  console.log(`- Subscriptions: 1 (active)`);
  console.log(`- Parking lots: 1 (30 spots)`);
  console.log(`\n🔑 Test credentials:`);
  console.log(`Customer: cliente@test.com / password123`);
  console.log(`Owner: propietario@test.com / password123`);
  console.log(`Admin: admin@parkingtop.com / password123`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });