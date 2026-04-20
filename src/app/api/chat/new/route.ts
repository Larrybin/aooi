import { withApi } from '@/shared/lib/api/route';

import { createChatNewPostAction } from '../create-handlers';
import { chatHandlerRuntimeDeps } from '../runtime-deps';

export const POST = withApi(createChatNewPostAction(chatHandlerRuntimeDeps));
