export const CANVA_MCP_URL = "https://mcp.canva.com/mcp";

export function hasAnthropicApiKey(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.ANTHROPIC_API_KEY?.trim());
}

export function getCanvaMcpHealth(env: NodeJS.ProcessEnv = process.env) {
  return {
    anthropicEnvDetected: hasAnthropicApiKey(env),
    canvaMcpConfigured: CANVA_MCP_URL.startsWith("https://mcp.canva.com/"),
    canvaMcpUrlHost: "mcp.canva.com",
    serverSideOnly: true,
  };
}
