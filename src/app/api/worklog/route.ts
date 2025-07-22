import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const logs = await prisma.workLog.findMany({
      orderBy: { date: 'desc' },
    });
    return NextResponse.json(logs);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const newLog = await prisma.workLog.create({
      data: {
        date: new Date(data.date),
        driver: data.driver,
        customer: data.customer,
        client: data.client,
        startTime: data.startTime,
        finishTime: data.finishTime,
        truckType: data.truckType,
        vehicle: data.vehicle,
        comments: data.comments || null,
      },
    });
    return NextResponse.json(newLog, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create log' }, { status: 500 });
  }
} 