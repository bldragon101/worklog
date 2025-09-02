const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Mock data arrays
const customers = [
  { customer: 'ABC Construction', billTo: 'ABC Construction Pty Ltd', contact: 'John Smith - 0412 345 678', fuelLevy: 15, tray: 85, crane: 120, semi: 95, semiCrane: 140, tolls: true, breakDeduction: 0.5 },
  { customer: 'BuildRight Co', billTo: 'BuildRight Company', contact: 'Sarah Johnson - 0423 456 789', fuelLevy: 12, tray: 80, crane: 115, semi: 90, semiCrane: 135, tolls: false, breakDeduction: 0.5 },
  { customer: 'Metro Logistics', billTo: 'Metro Logistics Ltd', contact: 'Mike Brown - 0434 567 890', fuelLevy: 18, tray: 90, crane: 125, semi: 100, semiCrane: 145, tolls: true, breakDeduction: 0.75 },
  { customer: 'Steel Works Inc', billTo: 'Steel Works Incorporated', contact: 'Lisa Wilson - 0445 678 901', fuelLevy: 20, tray: 95, crane: 130, semi: 105, semiCrane: 150, tolls: true, breakDeduction: 1.0 },
  { customer: 'Green Energy Solutions', billTo: 'Green Energy Solutions Pty Ltd', contact: 'David Lee - 0456 789 012', fuelLevy: 10, tray: 75, crane: 110, semi: 85, semiCrane: 130, tolls: false, breakDeduction: 0.5 }
];

const drivers = [
  { driver: 'Alex Thompson', truck: 'Tray Truck', tray: 80, crane: null, semi: null, semiCrane: null, breaks: 0.5, type: 'Employee', fuelLevy: 5, tolls: false },
  { driver: 'Emma Rodriguez', truck: 'Crane Truck', tray: null, crane: 115, semi: null, semiCrane: null, breaks: 0.75, type: 'Employee', fuelLevy: 8, tolls: true },
  { driver: 'James Wilson', truck: 'Semi Trailer', tray: null, crane: null, semi: 95, semiCrane: null, breaks: 1.0, type: 'Contractor', fuelLevy: 10, tolls: true },
  { driver: 'Sophie Chen', truck: 'Semi Crane', tray: null, crane: null, semi: null, semiCrane: 140, breaks: 1.0, type: 'Employee', fuelLevy: 12, tolls: true },
  { driver: 'Marcus Johnson', truck: 'Tray Truck', tray: 85, crane: null, semi: null, semiCrane: null, breaks: 0.5, type: 'Contractor', fuelLevy: 6, tolls: false },
  { driver: 'Isabella Garcia', truck: 'Crane Truck', tray: null, crane: 120, semi: null, semiCrane: null, breaks: 0.75, type: 'Employee', fuelLevy: 9, tolls: true }
];

const vehicles = [
  { registration: 'ABC123', make: 'Isuzu', model: 'NPR 400', yearOfManufacture: 2020, type: 'Tray Truck', carryingCapacity: '4 tonnes', trayLength: '5.2m', craneReach: null, craneType: null, craneCapacity: null, expiryDate: new Date('2025-06-15') },
  { registration: 'DEF456', make: 'Mitsubishi', model: 'Canter 515', yearOfManufacture: 2019, type: 'Crane Truck', carryingCapacity: '3 tonnes', trayLength: '4.8m', craneReach: '8m', craneType: 'Hiab 088', craneCapacity: '2.8 tonnes', expiryDate: new Date('2025-08-22') },
  { registration: 'GHI789', make: 'Volvo', model: 'FH16', yearOfManufacture: 2021, type: 'Semi Trailer', carryingCapacity: '34 tonnes', trayLength: '12.5m', craneReach: null, craneType: null, craneCapacity: null, expiryDate: new Date('2025-11-30') },
  { registration: 'JKL012', make: 'Scania', model: 'R 580', yearOfManufacture: 2022, type: 'Semi Crane', carryingCapacity: '30 tonnes', trayLength: '11m', craneReach: '15m', craneType: 'Palfinger PK 44002', craneCapacity: '12 tonnes', expiryDate: new Date('2026-03-10') },
  { registration: 'MNO345', make: 'Hino', model: '500 Series', yearOfManufacture: 2018, type: 'Tray Truck', carryingCapacity: '8 tonnes', trayLength: '6.5m', craneReach: null, craneType: null, craneCapacity: null, expiryDate: new Date('2025-05-18') },
  { registration: 'PQR678', make: 'Mercedes-Benz', model: 'Atego 1324', yearOfManufacture: 2020, type: 'Crane Truck', carryingCapacity: '5 tonnes', trayLength: '5.8m', craneReach: '10m', craneType: 'Fassi F155', craneCapacity: '4.2 tonnes', expiryDate: new Date('2025-09-14') }
];

const truckTypes = ['Tray Truck', 'Crane Truck', 'Semi Trailer', 'Semi Crane'];
const locations = [
  'Melbourne CBD', 'Richmond', 'South Yarra', 'Prahran', 'Windsor', 'Toorak',
  'Hawthorn', 'Camberwell', 'Box Hill', 'Doncaster', 'Ringwood', 'Blackburn',
  'Clayton', 'Oakleigh', 'Dandenong', 'Frankston', 'Mordialloc', 'Brighton',
  'Port Melbourne', 'Williamstown', 'Footscray', 'Sunshine', 'Airport West',
  'Essendon', 'Moonee Ponds', 'Brunswick', 'Fitzroy', 'Collingwood'
];

const jobComments = [
  'Delivered on time, no issues',
  'Customer requested early morning delivery',
  'Multiple stops required',
  'Heavy machinery transport',
  'Crane required for unloading',
  'Traffic delays due to roadworks',
  'Customer very satisfied with service',
  'Special handling required for fragile items',
  'Return trip with empty trailer',
  null
];

// Helper functions
function getRandomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function getRandomTime() {
  const hour = Math.floor(Math.random() * 12) + 6; // 6 AM to 6 PM
  const minute = Math.floor(Math.random() * 4) * 15; // 0, 15, 30, 45 minutes
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function calculateChargedHours(startTime, finishTime) {
  if (!startTime || !finishTime) return null;
  
  const start = new Date(`2000-01-01T${startTime}:00`);
  const finish = new Date(`2000-01-01T${finishTime}:00`);
  
  if (finish < start) {
    // Handle overnight jobs
    finish.setDate(finish.getDate() + 1);
  }
  
  return Math.round((finish - start) / (1000 * 60 * 60) * 100) / 100; // Round to 2 decimal places
}

async function seedMockData() {
  try {
    console.log('🌱 Starting mock data seeding...');

    // Clear existing data
    console.log('🧹 Clearing existing data...');
    await prisma.jobs.deleteMany({});
    await prisma.customer.deleteMany({});
    await prisma.vehicle.deleteMany({});
    await prisma.driver.deleteMany({});

    // Seed Customers
    console.log('👥 Seeding customers...');
    const createdCustomers = await Promise.all(
      customers.map(customer => prisma.customer.create({ data: customer }))
    );
    console.log(`✅ Created ${createdCustomers.length} customers`);

    // Seed Drivers
    console.log('🚛 Seeding drivers...');
    const createdDrivers = await Promise.all(
      drivers.map(driver => prisma.driver.create({ data: driver }))
    );
    console.log(`✅ Created ${createdDrivers.length} drivers`);

    // Seed Vehicles
    console.log('🚗 Seeding vehicles...');
    const createdVehicles = await Promise.all(
      vehicles.map(vehicle => prisma.vehicle.create({ data: vehicle }))
    );
    console.log(`✅ Created ${createdVehicles.length} vehicles`);

    // Seed Jobs
    console.log('📋 Seeding jobs...');
    const jobs = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90); // 90 days ago
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30); // 30 days in future

    // Create 150 random jobs
    for (let i = 0; i < 150; i++) {
      const customer = getRandomElement(createdCustomers);
      const driver = getRandomElement(createdDrivers);
      const vehicle = getRandomElement(createdVehicles);
      const jobDate = getRandomDate(startDate, endDate);
      
      // 70% chance of having start/finish times
      const hasTimeTracks = Math.random() > 0.3;
      let startTime = null;
      let finishTime = null;
      let chargedHours = null;
      
      if (hasTimeTracks) {
        const startTimeStr = getRandomTime();
        const startHour = parseInt(startTimeStr.split(':')[0]);
        const duration = Math.floor(Math.random() * 8) + 2; // 2-10 hours later
        const finishHour = (startHour + duration) % 24;
        const finishMinute = Math.floor(Math.random() * 4) * 15; // 0, 15, 30, 45 minutes
        const finishTimeStr = `${finishHour.toString().padStart(2, '0')}:${finishMinute.toString().padStart(2, '0')}`;
        
        startTime = new Date(`${jobDate.toISOString().split('T')[0]}T${startTimeStr}:00.000Z`);
        finishTime = new Date(`${jobDate.toISOString().split('T')[0]}T${finishTimeStr}:00.000Z`);
        
        // If finish time is earlier than start time, it's next day
        if (finishTime <= startTime) {
          finishTime.setDate(finishTime.getDate() + 1);
        }
        
        // Calculate charged hours based on actual duration
        chargedHours = Math.round(duration * 100) / 100;
      }

      const job = {
        date: jobDate,
        driver: driver.driver,
        customer: customer.customer,
        billTo: customer.billTo,
        truckType: getRandomElement(truckTypes),
        registration: vehicle.registration,
        pickup: getRandomElement(locations),
        dropoff: getRandomElement(locations),
        comments: getRandomElement(jobComments),
        runsheet: Math.random() > 0.3, // 70% chance of true
        invoiced: Math.random() > 0.5, // 50% chance of true
        startTime,
        finishTime,
        chargedHours,
        driverCharge: hasTimeTracks ? Math.round((chargedHours || 8) * (Math.random() * 50 + 80) * 100) / 100 : null,
        jobReference: `JOB${String(i + 1).padStart(4, '0')}`,
        citylink: Math.random() > 0.8 ? Math.floor(Math.random() * 3) + 1 : null, // 20% chance
        eastlink: Math.random() > 0.7 ? Math.floor(Math.random() * 5) + 1 : null, // 30% chance
        attachmentDeliveryPhotos: [],
        attachmentDocket: [],
        attachmentRunsheet: []
      };

      jobs.push(job);
    }

    const createdJobs = await Promise.all(
      jobs.map(job => prisma.jobs.create({ data: job }))
    );
    console.log(`✅ Created ${createdJobs.length} jobs`);

    console.log('🎉 Mock data seeding completed successfully!');
    console.log(`
📊 Summary:
- Customers: ${createdCustomers.length}
- Drivers: ${createdDrivers.length}
- Vehicles: ${createdVehicles.length}
- Jobs: ${createdJobs.length}
    `);

  } catch (error) {
    console.error('❌ Error seeding mock data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeding function
if (require.main === module) {
  seedMockData()
    .then(() => {
      console.log('✅ Seeding script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding script failed:', error);
      process.exit(1);
    });
}

module.exports = { seedMockData };