import { withApi } from '@/shared/lib/api/route';

import { createChatListPostAction } from '../create-handlers';
import { chatHandlerRuntimeDeps } from '../handler-deps';

export const POST = withApi(createChatListPostAction(chatHandlerRuntimeDeps));
