import type { BrokerageProviderId, PortfolioSyncErrorCode } from "./types";

export class CopilotProviderError extends Error {
  code: PortfolioSyncErrorCode;
  providerId?: BrokerageProviderId;
  retryable: boolean;

  constructor(args: {
    code: PortfolioSyncErrorCode;
    message: string;
    providerId?: BrokerageProviderId;
    retryable?: boolean;
  }) {
    super(args.message);
    this.name = "CopilotProviderError";
    this.code = args.code;
    this.providerId = args.providerId;
    this.retryable = args.retryable ?? false;
  }
}

export class UnknownBrokerageProviderError extends CopilotProviderError {
  constructor(providerId: string) {
    super({
      code: "unknown_provider",
      message: `Unknown Copilot brokerage provider: ${providerId}.`,
      retryable: false,
    });
    this.name = "UnknownBrokerageProviderError";
  }
}

export class DisabledBrokerageProviderError extends CopilotProviderError {
  constructor(providerId: BrokerageProviderId) {
    super({
      code: "disabled_provider",
      message: `Copilot brokerage provider is disabled: ${providerId}.`,
      providerId,
      retryable: false,
    });
    this.name = "DisabledBrokerageProviderError";
  }
}

export class UnsupportedBrokerageProviderError extends CopilotProviderError {
  constructor(providerId: BrokerageProviderId) {
    super({
      code: "unsupported_provider",
      message: `Copilot brokerage provider is not supported yet: ${providerId}.`,
      providerId,
      retryable: false,
    });
    this.name = "UnsupportedBrokerageProviderError";
  }
}

export class UnhealthyBrokerageProviderError extends CopilotProviderError {
  constructor(providerId: BrokerageProviderId, message: string) {
    super({
      code: "unhealthy_provider",
      message,
      providerId,
      retryable: true,
    });
    this.name = "UnhealthyBrokerageProviderError";
  }
}

export class DuplicateBrokerageProviderError extends Error {
  constructor(providerId: BrokerageProviderId) {
    super(`Copilot brokerage provider is already registered: ${providerId}.`);
    this.name = "DuplicateBrokerageProviderError";
  }
}
