// Anthropic per-million-token pricing (USD). Update if rates change.
type Rate = {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
};

const PRICING: Record<string, Rate> = {
  "claude-haiku-4-5": { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
};

const DEFAULT_RATE: Rate = PRICING["claude-haiku-4-5"];

export type AiUsage = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

const MILLION = 1_000_000;

export function computeAiCostUsd(model: string, usage: AiUsage): number {
  const rate = PRICING[model] ?? DEFAULT_RATE;
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cost =
    (input * rate.input +
      output * rate.output +
      cacheWrite * rate.cacheWrite +
      cacheRead * rate.cacheRead) /
    MILLION;
  return Number(cost.toFixed(6));
}
