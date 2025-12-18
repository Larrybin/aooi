import { z } from 'zod';

import { nonEmptyTrimmedStringSchema, optionalTrimmedStringSchema } from './common';

export const SettingsProfileFormSchema = z.object({
  name: nonEmptyTrimmedStringSchema,
  image: optionalTrimmedStringSchema,
});

