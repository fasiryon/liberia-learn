import Anthropic from "@anthropic-ai/sdk";
import { logger } from "@/lib/logger";
import { CANVA_MCP_URL, hasAnthropicApiKey } from "@/lib/canva/config";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const CANVA_DESIGN_URL_RE = /https:\/\/www\.canva\.com\/design\/[^\s")]+/;

type CanvaGenerationResult = {
  canvaUrl: string;
  designId: string;
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  tokensUsed: number;
};

function getAnthropicClient() {
  if (!hasAnthropicApiKey()) {
    logger.warn("[CANVA_MCP] Anthropic API key missing", {
      provider: "anthropic",
      canvaMcpConfigured: true,
      reason: "missing_server_env",
    });
    throw Object.assign(new Error("Anthropic API key is not configured"), {
      status: 503,
      code: "ANTHROPIC_ENV_MISSING",
    });
  }
  return new Anthropic();
}

function extractDesignId(canvaUrl: string): string {
  const match = canvaUrl.match(/\/design\/([^/?#\s]+)/);
  return match?.[1] ?? "";
}

export async function generateCanvaAsset(prompt: string): Promise<CanvaGenerationResult> {
  const client = getAnthropicClient();
  const model = process.env.ANTHROPIC_CANVA_MODEL ?? DEFAULT_MODEL;
  const response = await client.messages.create({
    model,
    max_tokens: 1000,
    mcp_servers: [
      {
        type: "url",
        url: CANVA_MCP_URL,
        name: "canva",
      },
    ],
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  } as any);

  const text = response.content
    .filter((block: any) => block.type === "text")
    .map((block: any) => block.text)
    .join("");
  const canvaUrl = text.match(CANVA_DESIGN_URL_RE)?.[0] ?? "";

  if (!canvaUrl) {
    throw Object.assign(new Error("Canva URL not returned"), { status: 502 });
  }

  return {
    canvaUrl,
    designId: extractDesignId(canvaUrl),
    text,
    model,
    inputTokens: Number((response as any).usage?.input_tokens ?? 0),
    outputTokens: Number((response as any).usage?.output_tokens ?? 0),
    tokensUsed:
      Number((response as any).usage?.input_tokens ?? 0) +
      Number((response as any).usage?.output_tokens ?? 0),
  };
}
