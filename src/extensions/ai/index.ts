import { ServiceUnavailableError } from '@/shared/lib/api/errors';
import {
  ProviderRegistry,
  trimmedProviderNameKey,
} from '@/shared/lib/providers/provider-registry';

/**
 * AI Configs to use AI functions
 */
export interface AIConfigs {
  [key: string]: unknown;
}

/**
 * ai media type
 */
export enum AIMediaType {
  MUSIC = 'music',
  IMAGE = 'image',
  VIDEO = 'video',
  TEXT = 'text',
  SPEECH = 'speech',
}

export interface AISong {
  id?: string;
  createTime?: Date;
  audioUrl: string;
  imageUrl: string;
  duration: number;
  prompt: string;
  title: string;
  tags: string;
  style: string;
  model?: string;
  artist?: string;
  album?: string;
}

export interface AIImage {
  id?: string;
  createTime?: Date;
  imageUrl: string;
}

/**
 * AI generate params
 */
export interface AIGenerateParams {
  mediaType: AIMediaType;
  prompt: string;
  model?: string;
  // custom options
  options?: Record<string, unknown>;
  // receive notify result
  callbackUrl?: string;
  // is return stream
  stream?: boolean;
  // is async
  async?: boolean;
}

export enum AITaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELED = 'canceled',
}

/**
 * AI task info
 */
export interface AITaskInfo {
  songs?: AISong[];
  images?: AIImage[];
  status?: string; // provider task status
  errorCode?: string;
  errorMessage?: string;
  createTime?: Date;
}

/**
 * AI task result
 */
export interface AITaskResult {
  taskStatus: AITaskStatus;
  taskId: string; // provider task id
  taskInfo?: AITaskInfo;
  taskResult?: unknown; // raw result from provider
}

/**
 * AI Provider provide AI functions
 */
export interface AIProvider {
  // provider name
  readonly name: string;

  // provider configs
  configs: AIConfigs;

  // generate content
  generate({ params }: { params: AIGenerateParams }): Promise<AITaskResult>;

  // query task
  query?({ taskId }: { taskId: string }): Promise<AITaskResult>;
}

/**
 * AI Manager to manage all AI providers
 */
export class AIManager {
  private readonly registry = new ProviderRegistry<AIProvider>({
    toNameKey: trimmedProviderNameKey,
  });

  hasProvider(name: string): boolean {
    return this.registry.has(name);
  }

  // add ai provider
  addProvider(provider: AIProvider, isDefault = false) {
    const name = trimmedProviderNameKey(provider?.name);
    if (!name) {
      throw new ServiceUnavailableError('AI provider name is required');
    }
    if (this.registry.has(name)) {
      throw new ServiceUnavailableError(
        `AI provider '${name}' is already registered`
      );
    }
    this.registry.add(provider, isDefault);
  }

  removeProvider(name: string): boolean {
    return this.registry.remove(name);
  }

  clearProviders(): void {
    this.registry.clear();
  }

  setDefaultProvider(name: string): void {
    if (!this.registry.setDefault(name)) {
      throw new ServiceUnavailableError(`AI provider '${name}' not found`);
    }
  }

  // get provider by name
  getProvider(name: string): AIProvider | undefined {
    return this.registry.get(name);
  }

  // get all provider names
  getProviderNames(): string[] {
    return this.registry.getProviderNames();
  }

  // get all media types
  getMediaTypes(): string[] {
    return Object.values(AIMediaType);
  }

  getDefaultProvider(): AIProvider | undefined {
    return this.registry.getDefault();
  }
}

// ai manager
export const aiManager = new AIManager();
