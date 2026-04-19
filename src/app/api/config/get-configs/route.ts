import { withApi } from '@/shared/lib/api/route';
import { resolveConfigConsistencyMode } from '@/shared/lib/config-consistency';
import {
  getPublicConfigsCached,
  getPublicConfigsFresh,
} from '@/shared/models/config';
import { buildGetConfigsLogic } from './route-logic';

const defaultGetConfigsLogic = buildGetConfigsLogic({
  getPublicConfigsCached,
  getPublicConfigsFresh,
  resolveConfigConsistencyMode,
});

export const GET = withApi(defaultGetConfigsLogic);
export const POST = withApi(defaultGetConfigsLogic);
