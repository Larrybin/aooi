import type { ReactNode } from 'react';

import type { AdsProvider, AdsZoneContext, AdsZoneName } from './types';

export type AdsterraMode =
  | 'social_bar'
  | 'popunder'
  | 'native_banner'
  | 'display_banner';

export interface AdsterraConfigs {
  mode: AdsterraMode;
  globalScriptSrc?: string;
  adsTxtEntry?: string;
  zoneScriptSrc: Partial<Record<AdsZoneName, string>>;
}

function AdsterraScript({ src, zone }: { src: string; zone?: AdsZoneName }) {
  return (
    <>
      {zone ? <div data-adsterra-zone={zone} /> : null}
      <script async data-cfasync="false" src={src} />
    </>
  );
}

export class AdsterraProvider implements AdsProvider {
  readonly name = 'adsterra';

  constructor(private readonly configs: AdsterraConfigs) {}

  private supportsInlineZones() {
    return (
      this.configs.mode === 'native_banner' ||
      this.configs.mode === 'display_banner'
    );
  }

  private getZoneScriptSrc(zone: AdsZoneName) {
    return this.configs.zoneScriptSrc[zone] || '';
  }

  getMetaTags(): ReactNode {
    return null;
  }

  getHeadScripts(): ReactNode {
    return null;
  }

  getBodyScripts(): ReactNode {
    if (this.supportsInlineZones() || !this.configs.globalScriptSrc) {
      return null;
    }

    return <AdsterraScript src={this.configs.globalScriptSrc} />;
  }

  supportsZone(zone: AdsZoneName): boolean {
    return this.supportsInlineZones() && Boolean(this.getZoneScriptSrc(zone));
  }

  renderZone(context: AdsZoneContext): ReactNode {
    const scriptSrc = this.getZoneScriptSrc(context.zone);
    if (!this.supportsZone(context.zone) || !scriptSrc) {
      return null;
    }

    return <AdsterraScript src={scriptSrc} zone={context.zone} />;
  }

  getAdsTxtEntry(): string | null {
    return this.configs.adsTxtEntry?.trim() || null;
  }
}
