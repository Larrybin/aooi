import { withApi } from '@/shared/lib/api/route';

import { createChatInfoPostAction } from '../create-handlers';
import { chatHandlerRuntimeDeps } from '../runtime-deps';

export const POST = withApi(createChatInfoPostAction(chatHandlerRuntimeDeps));
