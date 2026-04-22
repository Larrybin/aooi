import { withApi } from '@/shared/lib/api/route';

import { createChatInfoPostAction } from '../create-handlers';
import { chatHandlerRuntimeDeps } from '../handler-deps';

export const POST = withApi(createChatInfoPostAction(chatHandlerRuntimeDeps));
