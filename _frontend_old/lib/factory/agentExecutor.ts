import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class AgentExecutor {
  private agentPrompts: Map<string, string> = new Map();

  /**
   * Load agent prompts from docs/internal/agents/
   */
  async loadAgentPrompts() {
    const agentDir = path.join(process.cwd(), 'docs/internal/agents');
    const agents = [
      'research-agent',
      'curriculum-architect-agent',
      'uiux-designer-agent',
      'software-engineer-agent',
      'qa-governance-agent',
    ];

    for (const agent of agents) {
      const promptPath = path.join(agentDir, `${agent}.md`);
      const prompt = await fs.readFile(promptPath, 'utf-8');
      this.agentPrompts.set(agent, prompt);
    }
  }

  /**
   * Read prompt file from agents/ directory (e.g., agents/agent-1.prompt.txt)
   * Equivalent to PowerShell: $prompt = Get-Content ".\agents\agent-1.prompt.txt" -Raw
   */
  async readAgentPromptFile(agentNumber: number): Promise<string> {
    const promptPath = path.join(process.cwd(), 'agents', `agent-${agentNumber}.prompt.txt`);
    try {
      const prompt = await fs.readFile(promptPath, 'utf-8');
      return prompt;
    } catch (error) {
      throw new Error(`Failed to read prompt file for agent-${agentNumber}: ${error}`);
    }
  }

  /**
   * Make HTTP request (equivalent to PowerShell's Invoke-RestMethod)
   * Supports GET, POST, PUT, DELETE methods
   */
  async invokeRestMethod(
    uri: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any,
    headers?: Record<string, string>
  ): Promise<any> {
    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    const options: RequestInit = {
      method,
      headers: defaultHeaders,
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    try {
      const response = await fetch(uri, options);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (error) {
      throw new Error(`REST method invocation failed: ${error}`);
    }
  }

  /**
   * Execute an agent with given EWO
   */
  async executeAgent(agentType: string, ewo: any): Promise<any> {
    const agentPrompt = this.agentPrompts.get(`${agentType}-agent`);
    if (!agentPrompt) {
      throw new Error(`Agent prompt for ${agentType} not loaded`);
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: `${agentPrompt}

---

## YOUR TASK

You are now processing the following Education Work Order:

\`\`\`json
${JSON.stringify(ewo, null, 2)}
\`\`\`

Please complete your agent responsibilities as specified in your prompt above. Output valid JSON only.`,
        },
      ],
    });

    const responseText = completion.choices[0]?.message?.content || '';
    
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = responseText.match(/```json\n([\s\S]+?)\n```/) || responseText.match(/```\n([\s\S]+?)\n```/);
    const jsonText = jsonMatch ? jsonMatch[1] : responseText;
    
    try {
      return JSON.parse(jsonText);
    } catch (error) {
      console.error('Failed to parse agent output as JSON:', error);
      return { error: 'Invalid JSON output', raw: responseText };
    }
  }

  /**
   * Execute agent using prompt file from agents/ directory
   * Equivalent to PowerShell workflow:
   *   $prompt = Get-Content ".\agents\agent-1.prompt.txt" -Raw
   *   Invoke-RestMethod ...
   */
  async executeAgentFromPromptFile(
    agentNumber: number,
    ewo: any,
    apiEndpoint?: string
  ): Promise<any> {
    // Read prompt file (equivalent to Get-Content ".\agents\agent-1.prompt.txt" -Raw)
    const prompt = await this.readAgentPromptFile(agentNumber);

    // If API endpoint is provided, use HTTP request (equivalent to Invoke-RestMethod)
    if (apiEndpoint) {
      const response = await this.invokeRestMethod(apiEndpoint, 'POST', {
        prompt,
        ewo,
      });
      return response;
    }

    // Otherwise, use OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: `${prompt}

---

## YOUR TASK

You are now processing the following Education Work Order:

\`\`\`json
${JSON.stringify(ewo, null, 2)}
\`\`\`

Please complete your agent responsibilities as specified in your prompt above. Output valid JSON only.`,
        },
      ],
    });

    const responseText = completion.choices[0]?.message?.content || '';
    
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = responseText.match(/```json\n([\s\S]+?)\n```/) || responseText.match(/```\n([\s\S]+?)\n```/);
    const jsonText = jsonMatch ? jsonMatch[1] : responseText;
    
    try {
      return JSON.parse(jsonText);
    } catch (error) {
      console.error('Failed to parse agent output as JSON:', error);
      return { error: 'Invalid JSON output', raw: responseText };
    }
  }
}