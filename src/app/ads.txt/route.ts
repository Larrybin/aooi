import { NextResponse } from 'next/server';

import { getRequestLogger } from '@/shared/lib/request-logger.server';
import { getAllConfigs } from '@/shared/models/config';

export async function GET(req: Request) {
  const { log } = getRequestLogger(req);
  try {
    const configs = await getAllConfigs();

    if (!configs.adsense_code) {
      throw new Error('adsense_code is not set');
    }

    const adsenseCode = configs.adsense_code.replace('ca-', '');

    const adsContent = `google.com, ${adsenseCode}, DIRECT, f08c47fec0942fa0`;

    return new NextResponse(adsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  } catch (error) {
    log.error('ads.txt: get configs failed', { error });
    return new NextResponse('', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }
}
