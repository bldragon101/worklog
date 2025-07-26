import { NextRequest, NextResponse } from 'next/server';

interface SuburbData {
  name: string;
  postcode: number;
  state: {
    name: string;
    abbreviation: string;
  };
  locality: string | null;
  latitude: number;
  longitude: number;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  
  if (!query || query.trim().length < 2) {
    return NextResponse.json([]);
  }

  try {
    const response = await fetch(
      `https://v0.postcodeapi.com.au/suburbs.json?state=VIC&q=${encodeURIComponent(query.trim())}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch suburbs');
    }

    const data = await response.json();
    
    // Transform the data to include both name and postcode for display
    const suburbs = data.map((suburb: SuburbData) => ({
      value: suburb.name,
      label: `${suburb.name}, VIC ${suburb.postcode}`,
      postcode: suburb.postcode,
      name: suburb.name,
    }));

    return NextResponse.json(suburbs);
  } catch (error) {
    console.error('Error fetching suburbs:', error);
    return NextResponse.json([], { status: 500 });
  }
}
