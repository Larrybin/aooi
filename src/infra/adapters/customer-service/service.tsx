import 'server-only';

import type { Configs } from '@/domains/settings/application/settings-store';
import { buildServiceFromLatestConfigs } from '@/infra/adapters/config-refresh-policy';

import {
  CrispCustomerServiceProvider,
  CustomerServiceManager,
  TawkCustomerServiceProvider,
} from '@/extensions/customer-service';
import type { ConfigConsistencyMode } from '@/shared/lib/config-consistency';

/**
 * get affiliate manager with configs
 */
export function getCustomerServiceWithConfigs(configs: Configs) {
  const customerServiceManager: CustomerServiceManager =
    new CustomerServiceManager();

  // crisp
  if (configs.crisp_enabled === 'true' && configs.crisp_website_id) {
    customerServiceManager.addProvider(
      new CrispCustomerServiceProvider({
        websiteId: configs.crisp_website_id,
      })
    );
  }

  // tawk
  if (
    configs.tawk_enabled === 'true' &&
    configs.tawk_property_id &&
    configs.tawk_widget_id
  ) {
    customerServiceManager.addProvider(
      new TawkCustomerServiceProvider({
        propertyId: configs.tawk_property_id,
        widgetId: configs.tawk_widget_id,
      })
    );
  }

  return customerServiceManager;
}

/**
 * global customer service
 */
export async function getCustomerService(
  options: {
    mode?: ConfigConsistencyMode;
  } = {}
): Promise<CustomerServiceManager> {
  return await buildServiceFromLatestConfigs(
    getCustomerServiceWithConfigs,
    options
  );
}
