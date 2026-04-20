import { withApi } from '@/shared/lib/api/route';

import { createChatMessagesPostAction } from '../create-handlers';
import { chatHandlerRuntimeDeps } from '../runtime-deps';

export const POST = withApi(
  createChatMessagesPostAction(chatHandlerRuntimeDeps)
);
