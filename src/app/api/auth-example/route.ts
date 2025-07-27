import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ 
    message: 'Authenticated successfully!',
    userId: userId,
    timestamp: new Date().toISOString()
  });
}

export async function POST() {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // This is where you would typically handle authenticated POST requests
  // For example, creating a new work log entry for the authenticated user
  
  return NextResponse.json({ 
    message: 'POST request authenticated successfully!',
    userId: userId,
    timestamp: new Date().toISOString()
  });
} 