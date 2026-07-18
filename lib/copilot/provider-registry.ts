import { getCopilotFeatureConfig, type CopilotFeatureConfig } from "./config";
import {
  DisabledBrokerageProviderError,
  DuplicateBrokerageProviderError,
  UnknownBrokerageProviderError,
} from "./errors";
import { assertServerOnlyModule } from "./server-only";
import type {
  BrokerageConnectionSummary,
  BrokerageProviderId,
  BrokerageProviderRegistry,
  BrokerageReadProvider,
} from "./types";
import {
  assertBrokerageProviderId,
  assertNoTradingCapability,
} from "./validation";

assertServerOnlyModule("lib/copilot/provider-registry");

type RegistryOptions = {
  config?: CopilotFeatureConfig;
  providers?: BrokerageReadProvider[];
};

function connectionSummaryForProvider(
  provider: BrokerageReadProvider,
): BrokerageConnectionSummary {
  return {
    capabilities: {
      ...provider.capabilities,
      canPlaceOrders: false,
    },
    displayName: provider.displayName,
    providerId: provider.id,
    status: provider.isEnabled() ? "not_connected" : "disabled",
    statusMessage: provider.isEnabled()
      ? "Provider is registered but no connection has been established."
      : "Provider is registered but disabled by configuration.",
  };
}

export class DependencyInjectedBrokerageProviderRegistry
  implements BrokerageProviderRegistry
{
  private readonly config: CopilotFeatureConfig;
  private readonly providers = new Map<BrokerageProviderId, BrokerageReadProvider>();

  constructor(options: RegistryOptions = {}) {
    this.config = options.config ?? getCopilotFeatureConfig();
    options.providers?.forEach((provider) => this.register(provider));
  }

  register(provider: BrokerageReadProvider) {
    assertBrokerageProviderId(provider.id);
    assertNoTradingCapability(provider.capabilities);

    if (this.providers.has(provider.id)) {
      throw new DuplicateBrokerageProviderError(provider.id);
    }

    this.providers.set(provider.id, provider);
  }

  listProviders(options: { includeDisabled?: boolean } = {}) {
    if (!this.config.copilotEnabled || !this.config.brokerageConnectionsEnabled) {
      return options.includeDisabled
        ? Array.from(this.providers.values()).map(connectionSummaryForProvider)
        : [];
    }

    return Array.from(this.providers.values())
      .filter((provider) => options.includeDisabled || provider.isEnabled())
      .map(connectionSummaryForProvider);
  }

  getProvider(providerId: BrokerageProviderId) {
    const normalizedProviderId = assertBrokerageProviderId(providerId);
    const provider = this.providers.get(normalizedProviderId);

    if (!provider) {
      throw new UnknownBrokerageProviderError(normalizedProviderId);
    }

    if (!this.config.copilotEnabled || !this.config.brokerageConnectionsEnabled) {
      throw new DisabledBrokerageProviderError(normalizedProviderId);
    }

    if (!provider.isEnabled()) {
      throw new DisabledBrokerageProviderError(normalizedProviderId);
    }

    assertNoTradingCapability(provider.capabilities);
    return provider;
  }
}

export function createBrokerageProviderRegistry(options: RegistryOptions = {}) {
  return new DependencyInjectedBrokerageProviderRegistry(options);
}
