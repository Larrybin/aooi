import { z } from 'zod';

import registryJson from './registry.json';

// Keep Locale as a literal union while registry.json remains the runtime data source.
export const localeCodes = [
  'en',
  'zh',
  'ar',
  'bn',
  'cs',
  'da',
  'de',
  'el',
  'es',
  'fa',
  'fi',
  'fr',
  'he',
  'hi',
  'id',
  'it',
  'ja',
  'ko',
  'ms',
  'nl',
  'no',
  'pl',
  'pt',
  'pt-BR',
  'ro',
  'ru',
  'sv',
  'th',
  'tl-PH',
  'tr',
  'uk',
  'ur',
  'vi',
  'zh-TW',
] as const;

export type LocaleCode = (typeof localeCodes)[number];

export const localeCodeSchema = z.enum(localeCodes);

export const localeDirectionSchema = z.enum(['ltr', 'rtl']);

export const localeRegistryEntrySchema = z.object({
  code: localeCodeSchema,
  name: z.string().min(1),
  englishName: z.string().min(1),
  direction: localeDirectionSchema,
  hreflang: z.string().min(1),
});

export const localeRegistrySchema = z
  .array(localeRegistryEntrySchema)
  .nonempty()
  .superRefine((entries, ctx) => {
    const seenCodes = new Map<string, number>();
    const seenHreflangs = new Map<string, number>();

    const presentCodes = new Set<LocaleCode>();

    entries.forEach((entry, index) => {
      const firstCodeIndex = seenCodes.get(entry.code);
      if (firstCodeIndex !== undefined) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate locale code "${entry.code}"`,
          path: [index, 'code'],
        });
      } else {
        seenCodes.set(entry.code, index);
        presentCodes.add(entry.code);
      }

      const firstHreflangIndex = seenHreflangs.get(entry.hreflang);
      if (firstHreflangIndex !== undefined) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate hreflang "${entry.hreflang}"`,
          path: [index, 'hreflang'],
        });
      } else {
        seenHreflangs.set(entry.hreflang, index);
      }
    });

    for (const code of localeCodes) {
      if (!presentCodes.has(code)) {
        ctx.addIssue({
          code: 'custom',
          message: `missing locale code "${code}"`,
          path: [],
        });
      }
    }
  });

export type LocaleDirection = z.infer<typeof localeDirectionSchema>;
export type LocaleRegistryEntry = z.infer<typeof localeRegistryEntrySchema>;
export type LocaleRegistry = ReadonlyArray<Readonly<LocaleRegistryEntry>>;

function freezeLocaleRegistry(entries: LocaleRegistryEntry[]): LocaleRegistry {
  return Object.freeze(
    entries.map((entry) => Object.freeze({ ...entry }))
  ) as LocaleRegistry;
}

export function parseLocaleRegistry(input: unknown): LocaleRegistry {
  return freezeLocaleRegistry(localeRegistrySchema.parse(input));
}

export const localeRegistry = parseLocaleRegistry(registryJson);
