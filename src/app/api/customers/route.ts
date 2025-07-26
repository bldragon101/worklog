import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
    return NextResponse.json(customers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const customer = await prisma.customer.create({
      data: {
        customer: body.customer,
        billTo: body.billTo,
        contact: body.contact,
        email: body.email,
        phoneNumber: body.phoneNumber,
        tray: body.tray || false,
        crane: body.crane || false,
        semi: body.semi || false,
        semiCrane: body.semiCrane || false,
        fuelLevy: body.fuelLevy || null,
        tolls: body.tolls || null,
        comments: body.comments || null,
      },
    });
    return NextResponse.json(customer);
  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
  }
}
