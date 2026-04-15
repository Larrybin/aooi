import type { ReactNode } from 'react';

import { renderAdsterraSnippet } from './adsterra-snippet.server';
import type { AdsProvider, AdsZoneContext, AdsZoneName } from './types';

export type AdsterraMode =
  | 'social_bar'
  | 'popunder'
  | 'native_banner'
  | 'display_banner';

export interface AdsterraConfigs {
  mode: AdsterraMode;
  globalSnippet?: string;
  adsTxtEntry?: string;
  zoneSnippets: Partial<Record<AdsZoneName, string>>;
}

export class AdsterraProvider implements AdsProvider {
  readonly name = 'adsterra';

  private readonly globalHeadScripts: ReactNode;

  private readonly globalBodyScripts: ReactNode;

  private readonly zoneNodes: Partial<Record<AdsZoneName, ReactNode>>;

  constructor(private readonly configs: AdsterraConfigs) {
    const parsedGlobalSnippet = this.parseGlobalSnippet();

    this.globalHeadScripts =
      this.configs.mode === 'popunder' ? parsedGlobalSnippet : null;
    this.globalBodyScripts =
      this.configs.mode === 'social_bar' ? parsedGlobalSnippet : null;
    this.zoneNodes = this.parseZoneSnippets();
  }

  private supportsInlineZones() {
    return (
      this.configs.mode === 'native_banner' ||
      this.configs.mode === 'display_banner'
    );
  }

  private parseGlobalSnippet() {
    const snippet = this.configs.globalSnippet?.trim();
    if (!snippet || this.supportsInlineZones()) {
      return null;
    }

    const parsedSnippet = renderAdsterraSnippet(
      snippet,
      `adsterra-global-${this.configs.mode}`
    );
    return parsedSnippet.ok ? parsedSnippet.node : null;
  }

  private parseZoneSnippets() {
    const zoneNodes: Partial<Record<AdsZoneName, ReactNode>> = {};
    if (!this.supportsInlineZones()) {
      return zoneNodes;
    }

    for (const [zone, snippet] of Object.entries(this.configs.zoneSnippets) as [
      AdsZoneName,
      string | undefined,
    ][]) {
      const normalizedSnippet = snippet?.trim();
      if (!normalizedSnippet) {
        continue;
      }

      const parsedSnippet = renderAdsterraSnippet(
        normalizedSnippet,
        `adsterra-zone-${zone}`
      );
      if (parsedSnippet.ok) {
        zoneNodes[zone] = parsedSnippet.node;
      }
    }

    return zoneNodes;
  }

  getMetaTags(): ReactNode {
    return null;
  }

  getHeadScripts(): ReactNode {
    return this.globalHeadScripts;
  }

  getBodyScripts(): ReactNode {
    return this.globalBodyScripts;
  }

  supportsZone(zone: AdsZoneName): boolean {
    return Boolean(this.zoneNodes[zone]);
  }

  renderZone(context: AdsZoneContext): ReactNode {
    return this.zoneNodes[context.zone] || null;
  }

  getAdsTxtEntry(): string | null {
    return this.configs.adsTxtEntry?.trim() || null;
  }
}
