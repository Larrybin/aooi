import { withApi } from '@/shared/lib/api/route';

import { createChatStreamPostAction } from './create-handlers';
import { chatHandlerRuntimeDeps } from './runtime-deps';

export const POST = withApi(createChatStreamPostAction(chatHandlerRuntimeDeps));
