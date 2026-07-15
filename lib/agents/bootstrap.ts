/**
 * Single import point that registers all built-in agents, tools, and prompts as
 * a side effect. Import this before calling runAgent from a route or a test.
 * ES-module caching makes registration run exactly once per process.
 */
import "@/lib/agents/prompts";
import "@/lib/agents/infraPrompts";
import "@/lib/agents/tools/echo.tool";
import "@/lib/agents/agents/echo.agent";
import "@/lib/agents/goals/goalEcho";
import "@/lib/agents/tools/guardian.tools";
import "@/lib/agents/tools/safeguarding.tools";
import "@/lib/agents/agents/liberialearn-family.agent";
import "@/lib/agents/tools/opsSentinel.tools";
import "@/lib/agents/agents/ops-sentinel.agent";
