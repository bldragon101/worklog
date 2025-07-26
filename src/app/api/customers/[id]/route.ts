import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    const body = await request.json();
    
    const customer = await prisma.customer.update({
      where: { id },
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
    console.error('Error updating customer:', error);
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    
    await prisma.customer.delete({
      where: { id },
    });
    
    return NextResponse.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 });
  }
}
