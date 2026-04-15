'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { fetchBlobWithTimeout } from '@/shared/lib/fetch/client';

export function useBlobDownload({ timeoutMs = 20000 }: { timeoutMs?: number } = {}) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const downloadBlob = useCallback(
    async ({
      id,
      url,
      fileName,
      successMessage,
      errorMessage,
    }: {
      id: string;
      url: string;
      fileName: string;
      successMessage: string;
      errorMessage: string;
    }) => {
      if (!url) {
        return false;
      }

      try {
        setDownloadingId(id);
        const blob = await fetchBlobWithTimeout(url, timeoutMs);
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 200);
        toast.success(successMessage);
        return true;
      } catch (error) {
        console.error('Failed to download blob:', error);
        toast.error(errorMessage);
        return false;
      } finally {
        setDownloadingId(null);
      }
    },
    [timeoutMs]
  );

  return {
    downloadingId,
    downloadBlob,
  };
}
