import { site } from '@/site';

export function getSite() {
  return site;
}

export function getSiteOrigin(): string {
  return site.brand.appUrl;
}

export function getSiteHost(): string {
  return new URL(site.brand.appUrl).host;
}
