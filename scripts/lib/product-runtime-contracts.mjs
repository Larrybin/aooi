import * as removerRuntimeContractNamespace from '../../src/domains/remover/domain/runtime-contract.ts';

const removerRuntimeContractModule =
  removerRuntimeContractNamespace.default ?? removerRuntimeContractNamespace;
const { AI_REMOVER_RUNTIME_CONTRACT } = removerRuntimeContractModule;

const PRODUCT_RUNTIME_CONTRACTS = Object.freeze([AI_REMOVER_RUNTIME_CONTRACT]);

export function getProductRuntimeContractsForSite(siteKey) {
  return PRODUCT_RUNTIME_CONTRACTS.filter(
    (contract) => contract.siteKey === siteKey
  );
}
