import { withApi } from '@/shared/lib/api/route';

import { createChatNewPostAction } from '../create-handlers';
import { chatHandlerRuntimeDeps } from '../handler-deps';

export const POST = withApi(createChatNewPostAction(chatHandlerRuntimeDeps));
