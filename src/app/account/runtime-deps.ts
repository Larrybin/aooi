import { checkUserPermission } from '@/core/rbac';
import { getNonceStr, getUuid } from '@/shared/lib/hash';
import {
  createApikey,
  findApikeyById,
  getApikeys,
  getApikeysCount,
  updateApikey,
} from '@/shared/models/apikey';
import {
  getCredits,
  getCreditsCount,
  getRemainingCredits,
  getRemainingCreditsSummary,
} from '@/shared/models/credit';
import { getCurrentSubscription } from '@/shared/models/subscription';
import { updateUser } from '@/shared/models/user';

export const accountRuntimeDeps = {
  hasPermission: checkUserPermission,
  getRemainingCreditsSummary,
  getRemainingCredits,
  getCredits,
  getCreditsCount,
  getCurrentSubscription,
  updateUser,
  getApikeys,
  getApikeysCount,
  findApikeyById,
  createApikey,
  updateApikey,
  createId: getUuid,
  createSecretKey: () => `sk-${getNonceStr(32)}`,
};
