const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const vehicleData = [
  {
    registration: "BJN154",
    expiryDate: new Date("2025-09-07"),
    make: "MERC B",
    model: "X250",
    yearOfManufacture: 2020,
    type: "UTE",
  },
  {
    registration: "CKY727",
    expiryDate: new Date("2025-09-05"),
    make: "DAF",
    model: "LF290",
    yearOfManufacture: 2023,
    type: "TRAY",
  },
  {
    registration: "XW58DC",
    expiryDate: new Date("2026-05-08"),
    make: "U D",
    model: "PW24",
    yearOfManufacture: 2018,
    type: "CRANE",
  },
  {
    registration: "XV91JY",
    expiryDate: new Date("2026-02-20"),
    make: "U D",
    model: "PD24 2",
    yearOfManufacture: 2019,
    type: "TRAY",
  },
  {
    registration: "BLN404",
    expiryDate: new Date("2026-03-30"),
    make: "DAF",
    model: "XF530",
    yearOfManufacture: 2021,
    type: "SEMI",
  },
  {
    registration: "XW65RG",
    expiryDate: new Date("2026-08-02"),
    make: "DAF",
    model: "LF290",
    yearOfManufacture: 2021,
    type: "CRANE",
  },
  {
    registration: "BQW194",
    expiryDate: new Date("2026-01-28"),
    make: "DAF",
    model: "FA LF2",
    yearOfManufacture: 2021,
    type: "CRANE",
  },
  {
    registration: "YV01PG",
    expiryDate: new Date("2025-09-26"),
    make: "STONE",
    model: "3 AXLE",
    yearOfManufacture: 2022,
    type: "TRAILER",
  },
  {
    registration: "YV00PG",
    expiryDate: new Date("2025-09-26"),
    make: "STONE",
    model: "3 AXLE",
    yearOfManufacture: 2022,
    type: "TRAILER",
  },
  {
    registration: "BWS900",
    expiryDate: new Date("2025-10-26"),
    make: "DAF",
    model: "CF480F",
    yearOfManufacture: 2022,
    type: "SEMI",
  },
  {
    registration: "BWS903",
    expiryDate: new Date("2026-02-03"),
    make: "DAF",
    model: "CF410",
    yearOfManufacture: 2022,
    type: "CRANE",
  },
  {
    registration: "BCJ996",
    expiryDate: new Date("2026-04-12"),
    make: "HINO",
    model: "700",
    yearOfManufacture: 2022,
    type: "CRANE",
  },
  {
    registration: "BCJ995",
    expiryDate: new Date("2026-05-15"),
    make: "HINO",
    model: "700",
    yearOfManufacture: 2022,
    type: "CRANE",
  },
  {
    registration: "CKY704",
    expiryDate: new Date("2025-10-04"),
    make: "DAF",
    model: "XF530",
    yearOfManufacture: 2023,
    type: "SEMI",
  },
  {
    registration: "XW19ML",
    expiryDate: new Date("2025-11-23"),
    make: "IVECO",
    model: "STRALI",
    yearOfManufacture: 2014,
    type: "SEMI CRANE",
  },
  {
    registration: "CNV398",
    expiryDate: new Date("2025-12-14"),
    make: "DAF",
    model: "LF290",
    yearOfManufacture: 2023,
    type: "TRAY",
  },
  {
    registration: "XW36NI",
    expiryDate: new Date("2026-02-28"),
    make: "HINO",
    model: "500",
    yearOfManufacture: 2023,
    type: "TRAY",
  },
  {
    registration: "YV07SH",
    expiryDate: new Date("2026-07-02"),
    make: "STONE",
    model: "ST3 OD",
    yearOfManufacture: 2024,
    type: "TRAILER",
  },
  {
    registration: "BCJ998",
    expiryDate: new Date("2025-09-19"),
    make: "HINO",
    model: "700",
    yearOfManufacture: 2023,
    type: "SEMI CRANE",
  },
  {
    registration: "CTJ450",
    expiryDate: new Date("2025-09-25"),
    make: "DAF",
    model: "CF450",
    yearOfManufacture: 2023,
    type: "CRANE",
  },
  {
    registration: "YV59WD",
    expiryDate: new Date("2026-07-22"),
    make: "STONE",
    model: "ST3 OD",
    yearOfManufacture: 2025,
    type: "TRAILER",
  },
  {
    registration: "GAGANW",
    expiryDate: new Date("2026-07-18"),
    make: "DAF",
    model: "XG660",
    yearOfManufacture: 2024,
    type: "SEMI",
  },
]

async function main() {
  console.log('🌱 Seeding vehicles...')
  
  // Delete existing vehicles
  await prisma.vehicle.deleteMany({})
  console.log('🗑️ Cleared existing vehicles')
  
  // Create vehicles
  for (const vehicle of vehicleData) {
    try {
      await prisma.vehicle.create({
        data: vehicle,
      })
      console.log(`✅ Created vehicle: ${vehicle.registration}`)
    } catch (error) {
      console.error(`❌ Failed to create vehicle ${vehicle.registration}:`, error)
    }
  }
  
  console.log('🌱 Seeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })