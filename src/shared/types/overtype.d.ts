declare module 'overtype' {
  export type OverTypeOptions = {
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    minHeight?: number;
    showToolbar?: boolean;
  };

  export type OverTypeInstance = {
    destroy(): void;
    getValue(): string;
    setValue(value: string): void;
  };

  export const OverType: {
    init(
      element: HTMLElement | null,
      options?: OverTypeOptions
    ): [OverTypeInstance, never];
  };
}
