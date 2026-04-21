import { withApi } from '@/shared/lib/api/route';
import { resolveConfigConsistencyMode } from '@/shared/lib/config-consistency';
import {
  getPublicConfigsCached,
  getPublicConfigsFresh,
} from '@/domains/settings/application/public-config.view';
import { buildGetConfigsLogic } from './route-logic';

const defaultGetConfigsLogic = buildGetConfigsLogic({
  getPublicConfigsCached,
  getPublicConfigsFresh,
  resolveConfigConsistencyMode,
});

export const GET = withApi(defaultGetConfigsLogic);
export const POST = withApi(defaultGetConfigsLogic);
