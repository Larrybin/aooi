import { withApi } from '@/shared/lib/api/route';

import { createChatListPostAction } from '../create-handlers';
import { chatHandlerRuntimeDeps } from '../runtime-deps';

export const POST = withApi(createChatListPostAction(chatHandlerRuntimeDeps));
