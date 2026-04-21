import { withApi } from '@/shared/lib/api/route';

import { createChatMessagesPostAction } from '../create-handlers';
import { chatHandlerRuntimeDeps } from '../handler-deps';

export const POST = withApi(
  createChatMessagesPostAction(chatHandlerRuntimeDeps)
);
