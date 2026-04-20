// data: client-only chat history (calls /api/chat/list) + user context from ChatLayout
// cache: no-store (inherited from ChatLayout)
// reason: chat history is user-specific; avoid caching across users
import { ChatHistory } from '@/domains/chat/ui/history';

export default function ChatHistoryPage() {
  return <ChatHistory />;
}
