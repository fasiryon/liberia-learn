/**
 * Single import point that registers all built-in agents, tools, and prompts as
 * a side effect. Import this before calling runAgent from a route or a test.
 * ES-module caching makes registration run exactly once per process.
 */
import "@/lib/agents/prompts";
import "@/lib/agents/tools/echo.tool";
import "@/lib/agents/agents/echo.agent";
