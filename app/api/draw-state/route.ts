import { NextResponse } from 'next/server';
import { getState, saveState } from '@/lib/server-state';

export async function GET() {
  const state = await getState();
  return NextResponse.json(state);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await saveState(body);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

