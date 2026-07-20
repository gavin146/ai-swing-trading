export function finiteNumberOrNull(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatCopilotMoney(
  value: number | string | null | undefined,
  options: {
    currency?: string;
    unavailableLabel?: string;
  } = {},
) {
  const parsed = finiteNumberOrNull(value);

  if (parsed === null) return options.unavailableLabel ?? "Unknown";

  return new Intl.NumberFormat("en-US", {
    currency: options.currency ?? "USD",
    maximumFractionDigits: Math.abs(parsed) >= 1000 ? 0 : 2,
    style: "currency",
  }).format(parsed);
}
