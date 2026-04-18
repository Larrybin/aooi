export type ProviderNameKeyFn = (name: unknown) => string;

export const exactProviderNameKey: ProviderNameKeyFn = (name) =>
  typeof name === 'string' ? name : '';

export const trimmedProviderNameKey: ProviderNameKeyFn = (name) =>
  typeof name === 'string' ? name.trim() : '';

type RegistryOptions = {
  toNameKey: ProviderNameKeyFn;
  memoizeDefault?: boolean;
};

type ErrorFactory = (name: string) => Error;

export class ProviderRegistry<T extends { readonly name: string }> {
  private providers: T[] = [];
  private defaultProvider: T | undefined;
  private readonly toNameKey: ProviderNameKeyFn;
  private readonly memoizeDefault: boolean;

  constructor(options: RegistryOptions) {
    this.toNameKey = options.toNameKey;
    this.memoizeDefault = options.memoizeDefault === true;
  }

  add(provider: T, isDefault = false): void {
    this.providers.push(provider);
    if (isDefault) {
      this.defaultProvider = provider;
    }
  }

  addUnique(
    provider: T,
    options: {
      isDefault?: boolean;
      invalidNameError: ErrorFactory;
      duplicateNameError: ErrorFactory;
    }
  ): void {
    const name = this.toNameKey(provider?.name);
    if (!name) {
      throw options.invalidNameError('');
    }
    if (this.has(name)) {
      throw options.duplicateNameError(name);
    }
    this.add(provider, options.isDefault === true);
  }

  has(name: string): boolean {
    const key = this.toNameKey(name);
    return this.providers.some((p) => this.toNameKey(p.name) === key);
  }

  get(name: string): T | undefined {
    const key = this.toNameKey(name);
    return this.providers.find((p) => this.toNameKey(p.name) === key);
  }

  getRequired(name: string, createError: ErrorFactory): T {
    const provider = this.get(name);
    if (!provider) {
      throw createError(name);
    }
    return provider;
  }

  remove(name: string): boolean {
    const key = this.toNameKey(name);
    const index = this.providers.findIndex(
      (p) => this.toNameKey(p.name) === key
    );
    if (index < 0) return false;

    const [removed] = this.providers.splice(index, 1);
    if (
      removed &&
      this.toNameKey(this.defaultProvider?.name) ===
        this.toNameKey(removed.name)
    ) {
      this.defaultProvider = undefined;
    }

    return true;
  }

  clear(): void {
    this.providers = [];
    this.defaultProvider = undefined;
  }

  setDefault(name: string): boolean {
    const provider = this.get(name);
    if (!provider) return false;
    this.defaultProvider = provider;
    return true;
  }

  getDefault(): T | undefined {
    if (this.defaultProvider) return this.defaultProvider;
    const fallback = this.providers[0];
    if (fallback && this.memoizeDefault) {
      this.defaultProvider = fallback;
    }
    return fallback;
  }

  getDefaultRequired(createError: () => Error): T {
    const provider = this.getDefault();
    if (!provider) {
      throw createError();
    }
    return provider;
  }

  getProviderNames(): string[] {
    return this.providers.map((p) => this.toNameKey(p.name));
  }
}
