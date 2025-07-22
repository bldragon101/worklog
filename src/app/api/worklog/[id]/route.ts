import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const log = await prisma.workLog.findUnique({
      where: { id: Number(params.id) },
    });
    if (!log) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(log);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch log' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const data = await req.json();
    const updatedLog = await prisma.workLog.update({
      where: { id: Number(params.id) },
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
    return NextResponse.json(updatedLog);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update log' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.workLog.delete({
      where: { id: Number(params.id) },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete log' }, { status: 500 });
  }
} 