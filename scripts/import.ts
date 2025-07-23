const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const prisma = new PrismaClient();

function parseDate(dateStr: string) {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    // Assumes DD/MM/YYYY
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const year = parseInt(parts[2], 10);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  return null;
}

async function main() {
  const filePath = '/Users/gaganmac/Downloads/Book1.csv';
  const results: any[] = [];

  const stream = fs.createReadStream(filePath).pipe(csv({
    mapHeaders: ({ header }: { header: string }) => header.trim()
  }));

  stream.on('data', (data: any) => results.push(data))
    .on('end', async () => {
      for (const [index, row] of results.entries()) {
        try {
          const values = Object.values(row);
          const date = parseDate(values[0] as string);
          if (!date) {
            console.error(`Skipping row ${index + 2} due to invalid date:`, values[0]);
            continue;
          }

          await prisma.workLog.create({
            data: {
              date,
              driver: (values[1] as string) || '',
              customer: (values[2] as string) || '',
              billTo: (values[3] as string) || '',
              registration: (values[4] as string) || '',
              truckType: (values[5] as string) || '',
              pickup: (values[6] as string) || '',
              dropoff: (values[7] as string) || '',
              runsheet: ((values[8] as string) || '').toLowerCase() === 'true' || ((values[8] as string) || '').toLowerCase() === 'x',
              invoiced: ((values[9] as string) || '').toLowerCase() === 'true' || ((values[9] as string) || '').toLowerCase() === 'x',
              chargedHours: parseFloat(values[10] as string) || null,
              driverCharge: parseFloat(values[11] as string) || null,
              comments: (values[12] as string) || '',
            },
          });
        } catch (error) {
          console.error(`Error processing row ${index + 2}:`, row);
          console.error('Error:', error);
        }
      }
      console.log('Data import process finished.');
      await prisma.$disconnect();
    });
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
