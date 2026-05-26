import { z } from 'zod';

import registryJson from './registry.json';

export const localeDirectionSchema = z.enum(['ltr', 'rtl']);

export const localeRegistryEntrySchema = z.object({
  code: z.string().min(1),
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
