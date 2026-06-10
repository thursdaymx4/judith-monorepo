import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }
  if (!client) {
    client = new Anthropic({ apiKey });
  }
  return client;
}

export const ANTHROPIC_MODEL =
  process.env["ANTHROPIC_MODEL"] ?? "claude-sonnet-4-5-20250929";

// claude-3-5-haiku-20241022 reached EOL Feb 2026; replaced with claude-haiku-4-5-20251001.
export const ANTHROPIC_HAIKU_MODEL =
  process.env["ANTHROPIC_HAIKU_MODEL"] ?? "claude-haiku-4-5-20251001";
