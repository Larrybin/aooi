import { z } from 'zod';

import { nonEmptyTrimmedStringSchema } from './common';

export const SettingsApiKeyUpsertFormSchema = z.object({
  title: nonEmptyTrimmedStringSchema,
});

