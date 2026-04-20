import {
  createChat,
  findChatById,
  getChats,
  getChatsCount,
} from '@/shared/models/chat';
import {
  createChatMessage,
  getChatMessageWindow,
  getChatMessages,
  getChatMessagesCount,
} from '@/shared/models/chat_message';
import { getAllConfigsCached } from '@/shared/models/config';
import {
  consumeCredits,
  refundConsumedCreditById,
} from '@/shared/models/credit';

export const chatNewDeps = {
  createChat,
};

export const chatListDeps = {
  getChats,
  getChatsCount,
};

export const chatInfoDeps = {
  findChatById,
};

export const chatMessagesDeps = {
  findChatById,
  getChatMessages,
  getChatMessagesCount,
};

export const chatStreamDeps = {
  findChatById,
  createChatMessage,
  getChatMessageWindow,
  getAllConfigs: getAllConfigsCached,
  consumeCredits,
  refundConsumedCreditById,
};
