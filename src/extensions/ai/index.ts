import { ServiceUnavailableError } from '@/shared/lib/api/errors';

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
  // ai providers
  private providers: AIProvider[] = [];
  // default ai provider
  private defaultProvider?: AIProvider;

  private normalizeProviderName(name: unknown): string {
    return typeof name === 'string' ? name.trim() : '';
  }

  hasProvider(name: string): boolean {
    const normalized = this.normalizeProviderName(name);
    return this.providers.some(
      (p) => this.normalizeProviderName(p.name) === normalized
    );
  }

  // add ai provider
  addProvider(provider: AIProvider, isDefault = false) {
    const name = this.normalizeProviderName(provider?.name);
    if (!name) {
      throw new ServiceUnavailableError('AI provider name is required');
    }
    if (this.hasProvider(name)) {
      throw new ServiceUnavailableError(
        `AI provider '${name}' is already registered`
      );
    }
    this.providers.push(provider);
    if (isDefault) {
      this.defaultProvider = provider;
    }
  }

  removeProvider(name: string): boolean {
    const normalized = this.normalizeProviderName(name);
    const index = this.providers.findIndex(
      (p) => this.normalizeProviderName(p.name) === normalized
    );
    if (index < 0) return false;

    const [removed] = this.providers.splice(index, 1);

    if (
      this.normalizeProviderName(this.defaultProvider?.name) ===
      this.normalizeProviderName(removed.name)
    ) {
      this.defaultProvider = undefined;
    }

    return true;
  }

  clearProviders(): void {
    this.providers = [];
    this.defaultProvider = undefined;
  }

  setDefaultProvider(name: string): void {
    const provider = this.getProvider(name);
    if (!provider) {
      throw new ServiceUnavailableError(`AI provider '${name}' not found`);
    }
    this.defaultProvider = provider;
  }

  // get provider by name
  getProvider(name: string): AIProvider | undefined {
    const normalized = this.normalizeProviderName(name);
    return this.providers.find(
      (p) => this.normalizeProviderName(p.name) === normalized
    );
  }

  // get all provider names
  getProviderNames(): string[] {
    return this.providers.map((p) => this.normalizeProviderName(p.name));
  }

  // get all media types
  getMediaTypes(): string[] {
    return Object.values(AIMediaType);
  }

  getDefaultProvider(): AIProvider | undefined {
    return this.defaultProvider ?? this.providers[0];
  }
}

// ai manager
export const aiManager = new AIManager();
