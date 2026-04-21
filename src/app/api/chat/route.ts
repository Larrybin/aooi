import { withApi } from '@/shared/lib/api/route';

import { createChatStreamPostAction } from './create-handlers';
import { chatHandlerRuntimeDeps } from './handler-deps';

export const POST = withApi(createChatStreamPostAction(chatHandlerRuntimeDeps));
