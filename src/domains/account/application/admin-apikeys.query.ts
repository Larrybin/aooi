import {
  getApikeys,
  getApikeysCount,
  type Apikey,
} from '@/domains/account/infra/apikey';

export type AdminApikeyRow = Apikey;

export async function listAdminApikeysQuery(input: {
  page: number;
  limit: number;
}) {
  const [rows, total] = await Promise.all([
    getApikeys({
      getUser: true,
      page: input.page,
      limit: input.limit,
    }),
    getApikeysCount({}),
  ]);

  return { rows, total };
}
