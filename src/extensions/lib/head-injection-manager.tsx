import { Fragment, type ReactNode } from 'react';

type InjectionSlot = () => ReactNode;

export type HeadInjectionProvider = {
  readonly name: string;
  getMetaTags?: InjectionSlot;
  getHeadScripts?: InjectionSlot;
  getBodyScripts?: InjectionSlot;
};

export class HeadInjectionManager<T extends HeadInjectionProvider> {
  protected providers: T[] = [];

  addProvider(provider: T) {
    this.providers.push(provider);
  }

  private render(slot: (provider: T) => InjectionSlot | undefined): ReactNode {
    return this.providers
      .filter((provider) => slot(provider))
      .map((provider) => (
        <Fragment key={provider.name}>{slot(provider)!()}</Fragment>
      ));
  }

  getMetaTags(): ReactNode {
    return this.render((provider) => provider.getMetaTags);
  }

  getHeadScripts(): ReactNode {
    return this.render((provider) => provider.getHeadScripts);
  }

  getBodyScripts(): ReactNode {
    return this.render((provider) => provider.getBodyScripts);
  }
}
