export type PreferredBrokerage =
  | "none"
  | "schwab"
  | "fidelity"
  | "robinhood"
  | "etrade"
  | "interactive_brokers"
  | "other";

export type BrokerageOption = {
  description: string;
  label: string;
  value: PreferredBrokerage;
};

export const brokerageOptions: BrokerageOption[] = [
  {
    description: "Show all supported brokerage handoff links.",
    label: "No preference",
    value: "none",
  },
  {
    description: "Prioritize Schwab quote and research pages.",
    label: "Schwab",
    value: "schwab",
  },
  {
    description: "Prioritize Fidelity quote and research pages.",
    label: "Fidelity",
    value: "fidelity",
  },
  {
    description: "Prioritize Robinhood stock pages.",
    label: "Robinhood",
    value: "robinhood",
  },
  {
    description: "Prioritize E*TRADE account login.",
    label: "E*TRADE",
    value: "etrade",
  },
  {
    description: "Save this preference for future direct links.",
    label: "Interactive Brokers",
    value: "interactive_brokers",
  },
  {
    description: "Keep your brokerage preference flexible.",
    label: "Other",
    value: "other",
  },
];

const brokerageValues = new Set<PreferredBrokerage>(
  brokerageOptions.map((option) => option.value),
);

export function normalizePreferredBrokerage(value: unknown): PreferredBrokerage {
  const normalized = String(value ?? "none").trim().toLowerCase();

  return brokerageValues.has(normalized as PreferredBrokerage)
    ? (normalized as PreferredBrokerage)
    : "none";
}

export function getBrokerageLabel(value: PreferredBrokerage) {
  return brokerageOptions.find((option) => option.value === value)?.label ?? "No preference";
}
