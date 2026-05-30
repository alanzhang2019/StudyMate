import { NextResponse } from 'next/server';

export async function GET() {
  const modelString = process.env.MISTAKE_CLASSROOM_MODEL || process.env.DEFAULT_MODEL || 'openai:gpt-4o-mini';

  return NextResponse.json({
    modelString,
    providerId: modelString.split(':')[0] || 'openai',
    modelId: modelString.includes(':') ? modelString.split(':')[1] : modelString,
  });
}
