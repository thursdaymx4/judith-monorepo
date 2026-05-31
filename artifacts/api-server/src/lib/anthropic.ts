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
