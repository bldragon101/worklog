import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const log = await prisma.workLog.findUnique({
      where: { id: Number(id) },
    });
    if (!log) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(log);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch log' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await req.json();
    const updatedLog = await prisma.workLog.update({
      where: { id: Number(id) },
      data: {
        date: new Date(data.date),
        driver: data.driver,
        customer: data.customer,
        billTo: data.billTo,
        truckType: data.truckType,
        registration: data.registration,
        pickup: data.pickup,
        dropoff: data.dropoff,
        runsheet: data.runsheet,
        invoiced: data.invoiced,
        chargedHours: data.chargedHours,
        driverCharge: data.driverCharge,
        comments: data.comments || null,
      },
    });
    return NextResponse.json(updatedLog);
  } catch {
    return NextResponse.json({ error: 'Failed to update log' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.workLog.delete({
      where: { id: Number(id) },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete log' }, { status: 500 });
  }
}
