import { z } from 'zod';

import { nonEmptyTrimmedStringSchema } from './common';

export const SettingsSecurityFormSchema = z.object({
  password: nonEmptyTrimmedStringSchema,
});

