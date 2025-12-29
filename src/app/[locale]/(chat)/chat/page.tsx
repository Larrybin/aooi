// data: client-only chat generator (calls /api/chat/new) + user context from ChatLayout
// cache: no-store (inherited from ChatLayout)
// reason: interactive chat UI is user-specific; avoid cross-user caching
import { ChatGenerator } from '@/shared/blocks/chat/generator';

export default function ChatPage() {
  return <ChatGenerator />;
}
