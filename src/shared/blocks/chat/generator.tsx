'use client';

import { useEffect, useState } from 'react';
import { UIMessage, UseChatHelpers } from '@ai-sdk/react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useRouter } from '@/core/i18n/navigation';
import { LocaleSelector } from '@/shared/blocks/common';
import { PromptInputMessage } from '@/shared/components/ai-elements/prompt-input';
import { SidebarTrigger } from '@/shared/components/ui/sidebar';
import { useAppContext } from '@/shared/contexts/app';
import { useChatContext } from '@/shared/contexts/chat';
import { isPlainObject } from '@/shared/lib/api/client';
import { fetchJson } from '@/shared/lib/api/fetch-json';
import {
  formatMessageWithRequestId,
  getRequestIdFromError,
} from '@/shared/lib/request-id';
import type { Chat } from '@/shared/types/chat';

import { ChatInput } from './input';

export function ChatGenerator() {
  const router = useRouter();
  const locale = useLocale();

  const t = useTranslations('ai.chat.generator');

  const { user, setIsShowSignModal } = useAppContext();
  const { chats, setChats, setChat } = useChatContext();

  const [status, setStatus] = useState<UseChatHelpers<UIMessage>['status']>();
  const [error, setError] = useState<string | null>(null);

  const fetchNewChat = async (
    msg: PromptInputMessage,
    body: Record<string, unknown>
  ) => {
    setStatus('submitted');
    setError(null);

    try {
      const data = await fetchJson<Chat>(
        '/api/chat/new',
        { method: 'POST', body: { message: msg, body: body } },
        {
          validate: (value): value is Chat =>
            isPlainObject(value) &&
            typeof (value as { id?: unknown }).id === 'string' &&
            Boolean((value as { id: string }).id.trim()),
          invalidDataMessage: 'failed to create chat',
        }
      );

      const id = data.id.trim();

      setChats([data, ...chats]);

      const path = `/chat/${id}`;
      router.push(path, {
        locale,
      });
      setStatus(undefined);
      setError(null);
    } catch (e: unknown) {
      const baseMessage =
        e instanceof Error ? e.message : 'request failed, please try again';
      const message = formatMessageWithRequestId(
        baseMessage,
        getRequestIdFromError(e)
      );
      setStatus('error');
      setError(message);
      toast.error(message);
      throw e instanceof Error ? e : new Error(message);
    }
  };

  const handleSubmit = async (
    message: PromptInputMessage,
    body: Record<string, unknown>
  ) => {
    // check user sign
    if (!user) {
      setIsShowSignModal(true);
      return;
    }

    // check user input
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);
    if (!(hasText || hasAttachments)) {
      return;
    }

    if (!body.model) {
      toast.error('please select a model');
      return;
    }

    await fetchNewChat(message, body);
  };

  useEffect(() => {
    setChat(null);
  }, [setChat]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="bg-background sticky top-0 z-10 flex w-full items-center gap-2 px-4 py-3">
        <SidebarTrigger className="size-7" />
        <div className="flex-1"></div>
        <LocaleSelector />
      </header>
      <div className="mx-auto -mt-16 flex h-screen w-full flex-1 flex-col items-center justify-center px-4 pb-6 md:max-w-2xl">
        <h2 className="mb-4 text-center text-3xl font-bold">{t('title')}</h2>
        <ChatInput
          error={error}
          handleSubmit={handleSubmit}
          onInputChange={() => {
            if (status === 'error') {
              setStatus(undefined);
            }
            if (error) {
              setError(null);
            }
          }}
          status={status}
        />
      </div>
    </div>
  );
}
