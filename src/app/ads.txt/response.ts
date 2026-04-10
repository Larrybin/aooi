import { NextResponse } from 'next/server';

export function buildAdsTxtResponse(body: string) {
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}
