export type CopilotFeatureConfig = {
  brokerageConnectionsEnabled: boolean;
  copilotEnabled: boolean;
  paperTradingEnabled: boolean;
};

function envFlag(env: Record<string, string | undefined>, name: string) {
  return env[name]?.trim().toLowerCase() === "true";
}

export function getCopilotFeatureConfig(
  env: Record<string, string | undefined> = process.env,
): CopilotFeatureConfig {
  return {
    brokerageConnectionsEnabled: envFlag(env, "BROKERAGE_CONNECTIONS_ENABLED"),
    copilotEnabled: envFlag(env, "COPILOT_ENABLED"),
    paperTradingEnabled: envFlag(env, "PAPER_TRADING_ENABLED"),
  };
}

export const defaultCopilotFeatureConfig: CopilotFeatureConfig = {
  brokerageConnectionsEnabled: false,
  copilotEnabled: false,
  paperTradingEnabled: false,
};
