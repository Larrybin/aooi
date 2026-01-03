export const CHAT_ALLOWED_MODELS = [
  'moonshotai/kimi-k2-thinking',
  'deepseek/deepseek-r1',
  'openai/gpt-5',
  'anthropic/claude-4.5-sonnet',
] as const;

export type ChatAllowedModel = (typeof CHAT_ALLOWED_MODELS)[number];

export const CHAT_MODEL_CREDIT_COST: Record<ChatAllowedModel, number> = {
  'moonshotai/kimi-k2-thinking': 1,
  'deepseek/deepseek-r1': 1,
  'openai/gpt-5': 2,
  'anthropic/claude-4.5-sonnet': 2,
} as const;
