import { z } from 'zod';

export const generalSocialLinkSchema = z
  .object({
    title: z.string().optional(),
    icon: z.string().optional(),
    url: z.string().optional(),
    target: z.enum(['_self', '_blank']).optional(),
    enabled: z.boolean().optional().default(false),
  })
  .refine(
    (val) => {
      if (!val.enabled) return true;
      return Boolean(val.icon && val.icon.trim() && val.url && val.url.trim());
    },
    {
      message: 'When enabled=true, both icon and url are required',
    }
  )
  .refine(
    (val) => {
      if (!val.enabled || !val.url) return true;
      try {
        const parsed = new URL(val.url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    },
    {
      message: 'When enabled=true, url must be http/https',
    }
  )
  .passthrough();

export const generalSocialLinksSchema = z.array(generalSocialLinkSchema);
