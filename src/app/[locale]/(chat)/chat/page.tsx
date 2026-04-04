// data: client-only chat generator (calls /api/chat/new) + user context from ChatLayout
// cache: no-store (inherited from ChatLayout)
// reason: interactive chat UI is user-specific; avoid cross-user caching
import { ChatGenerator } from '@/features/web/chat/components/generator';

export default function ChatPage() {
  return <ChatGenerator />;
}
