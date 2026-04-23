// data: signed-in user (better-auth) + ai tasks (db) + pagination/filter
// cache: no-store (request-bound auth)
// reason: user-specific activity history
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { AITaskStatus } from '@/extensions/ai';
import { AudioPlayer } from '@/shared/blocks/common/audio-player';
import { AppImage } from '@/shared/blocks/common/app-image';
import { Empty } from '@/shared/blocks/common/empty';
import { TableCard } from '@/shared/blocks/table';
import { isAiEnabled } from '@/domains/ai/domain/enablement';
import { readPublicUiConfigCached } from '@/domains/settings/application/settings-runtime.query';
import { getSignedInUserIdentity } from '@/infra/platform/auth/session.server';
import { safeJsonParse } from '@/shared/lib/json';
import {
  listMemberAiTasksQuery,
  type MemberAiTaskRow,
} from '@/domains/ai/application/member-ai-tasks.query';
import type { Button, Tab } from '@/shared/types/blocks/common';
import { type Table } from '@/shared/types/blocks/table';

export default async function AiTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: number; pageSize?: number; type?: string }>;
}) {
  if (!isAiEnabled(await readPublicUiConfigCached())) {
    notFound();
  }

  const { page: pageNum, pageSize, type } = await searchParams;
  const page = pageNum || 1;
  const limit = pageSize || 20;

  const t = await getTranslations('activity.ai-tasks');

  const user = await getSignedInUserIdentity();
  if (!user) {
    return <Empty message={t('errors.no_auth')} />;
  }

  const { rows: aiTasks, total } = await listMemberAiTasksQuery({
    userId: user.id,
    mediaType: type,
    page,
    limit,
  });

  const table: Table<MemberAiTaskRow> = {
    title: t('list.title'),
    columns: [
      { name: 'prompt', title: t('fields.prompt'), type: 'copy' },
      { name: 'mediaType', title: t('fields.media_type'), type: 'label' },
      { name: 'provider', title: t('fields.provider'), type: 'label' },
      { name: 'model', title: t('fields.model'), type: 'label' },
      // { name: 'options', title: t('fields.options'), type: 'copy' },
      { name: 'status', title: t('fields.status'), type: 'label' },
      { name: 'costCredits', title: t('fields.cost_credits'), type: 'label' },
      {
        name: 'result',
        title: t('fields.result'),
        callback: (item: MemberAiTaskRow) => {
          if (!item.taskInfo) {
            return '-';
          }

          const taskInfo = safeJsonParse<Record<string, unknown>>(
            item.taskInfo
          );
          if (!taskInfo) {
            return '-';
          }

          const errorMessage =
            typeof taskInfo.errorMessage === 'string'
              ? taskInfo.errorMessage
              : '';
          if (errorMessage) {
            return <div className="text-red-500">Failed: {errorMessage}</div>;
          }

          const songsValue = taskInfo.songs;
          if (Array.isArray(songsValue) && songsValue.length > 0) {
            const songs = songsValue
              .filter(
                (
                  song
                ): song is { id: string; audioUrl?: string; title?: string } =>
                  Boolean(song) && typeof song === 'object'
              )
              .filter((song) => typeof song.audioUrl === 'string');

            if (songs.length > 0) {
              return (
                <div className="flex flex-col gap-2">
                  {songs.map((song) => (
                    <AudioPlayer
                      key={song.id}
                      src={song.audioUrl as string}
                      title={song.title}
                      className="w-80"
                    />
                  ))}
                </div>
              );
            }
          }

          const imagesValue = taskInfo.images;
          if (Array.isArray(imagesValue) && imagesValue.length > 0) {
            return (
              <div className="flex flex-col gap-2">
                {imagesValue
                  .filter(
                    (image): image is { imageUrl: string } =>
                      Boolean(image) &&
                      typeof image === 'object' &&
                      typeof (image as { imageUrl?: unknown }).imageUrl ===
                        'string'
                  )
                  .map((image, index: number) => (
                    <div
                      key={index}
                      className="relative h-32 w-32 overflow-hidden rounded-md border"
                    >
                      <AppImage
                        src={image.imageUrl}
                        alt="Generated image"
                        fill
                        sizes="128px"
                        className="object-contain"
                      />
                    </div>
                  ))}
              </div>
            );
          }

          return '-';
        },
      },
      { name: 'createdAt', title: t('fields.created_at'), type: 'time' },
      {
        name: 'action',
        title: t('fields.action'),
        type: 'dropdown',
        callback: (item: MemberAiTaskRow) => {
          const items: Button[] = [];

          if (
            item.status === AITaskStatus.PENDING ||
            item.status === AITaskStatus.PROCESSING
          ) {
            items.push({
              title: t('list.buttons.refresh'),
              url: `/activity/ai-tasks/${item.id}/refresh`,
              icon: 'RiRefreshLine',
            });
          }

          return items;
        },
      },
    ],
    data: aiTasks,
    emptyMessage: t('list.empty_message'),
    pagination: {
      total,
      page,
      limit,
    },
  };

  const tabs: Tab[] = [
    {
      name: 'all',
      title: t('list.tabs.all'),
      url: '/activity/ai-tasks',
      is_active: !type || type === 'all',
    },
    {
      name: 'music',
      title: t('list.tabs.music'),
      url: '/activity/ai-tasks?type=music',
      is_active: type === 'music',
    },
    {
      name: 'image',
      title: t('list.tabs.image'),
      url: '/activity/ai-tasks?type=image',
      is_active: type === 'image',
    },
    {
      name: 'video',
      title: t('list.tabs.video'),
      url: '/activity/ai-tasks?type=video',
      is_active: type === 'video',
    },
    {
      name: 'audio',
      title: t('list.tabs.audio'),
      url: '/activity/ai-tasks?type=audio',
      is_active: type === 'audio',
    },
    {
      name: 'text',
      title: t('list.tabs.text'),
      url: '/activity/ai-tasks?type=text',
      is_active: type === 'text',
    },
  ];

  return (
    <div className="space-y-8">
      <TableCard title={t('list.title')} tabs={tabs} table={table} />
    </div>
  );
}
