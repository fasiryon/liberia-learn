export const CANVA_MCP_URL = "https://mcp.canva.com/mcp";

export function hasAnthropicApiKey(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.ANTHROPIC_API_KEY?.trim());
}

export function hasCanvaMcpAuthorizationToken(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.CANVA_MCP_AUTHORIZATION_TOKEN?.trim());
}

export function getCanvaMcpAuthorizationToken(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.CANVA_MCP_AUTHORIZATION_TOKEN?.trim() || undefined;
}

export function getCanvaMcpHealth(env: NodeJS.ProcessEnv = process.env) {
  return {
    anthropicEnvDetected: hasAnthropicApiKey(env),
    canvaMcpAuthorizationTokenDetected: hasCanvaMcpAuthorizationToken(env),
    canvaMcpConfigured: CANVA_MCP_URL.startsWith("https://mcp.canva.com/"),
    canvaMcpUrlHost: "mcp.canva.com",
    serverSideOnly: true,
  };
}
