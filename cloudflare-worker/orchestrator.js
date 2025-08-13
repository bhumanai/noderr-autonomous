/**
 * Intelligent Noderr Orchestrator using Claude API
 * Uses Claude to analyze outputs and determine next steps based on Noderr methodology
 */

// Noderr Prompts Guide (embedded for Claude to reference)
const NODERR_PROMPTS_GUIDE = `
# Noderr Prompts Guide

## Start Work Session
Always begin with reviewing the log and tracker to understand project state.

## The 4-Step Loop

### LOOP_1A: Propose Change Set
- Analyze the request and identify ALL affected NodeIDs
- Present the complete Change Set for approval
- PAUSE for approval

### LOOP_1B: Draft Specs
- Create detailed specifications for each NodeID in the Change Set
- Use the strict spec template from noderr_loop.md
- PAUSE for approval

### LOOP_2: Implement Change Set
- Implement all components in the WorkGroupID
- Perform ARC verification
- Fix and re-verify until 100% pass
- PAUSE for authorization

### LOOP_3: Finalize and Commit
- Update specs to "as-built" state
- Update tracker and log
- Create git commit
- Report completion

## Key Principles
- Work on entire Change Sets, not individual nodes
- Every significant action gets logged
- Technical debt gets scheduled as REFACTOR_ tasks
- Maintain perfect memory through specs and logs
`;

/**
 * Use Claude API to analyze the current state and determine next action
 */
async function analyzeStateWithClaude(currentOutput, taskHistory, env) {
  const claudeApiKey = env.CLAUDE_API_KEY;
  
  if (!claudeApiKey) {
    console.error('CLAUDE_API_KEY not configured');
    return null;
  }

  const prompt = `You are the Noderr Orchestrator managing an autonomous development system.

## Noderr Methodology
${NODERR_PROMPTS_GUIDE}

## Current Situation
The Claude Code CLI agent has just produced this output:
"""
${currentOutput}
"""

## Task History
Recent tasks executed:
${JSON.stringify(taskHistory, null, 2)}

## Your Role
Analyze the current output and determine:
1. What stage of the Noderr Loop is the agent at?
2. Has the agent completed their current task and is awaiting next instruction?
3. What is the appropriate next command to send?

## Response Format
Respond with a JSON object:
{
  "current_stage": "START_SESSION|LOOP_1A|LOOP_1B|LOOP_2|LOOP_3|COMPLETE|BLOCKED",
  "is_awaiting_instruction": true/false,
  "detected_completion": "what specific completion marker you found",
  "next_command": "the exact command to send to Claude",
  "reasoning": "brief explanation of your decision"
}

If the agent is still working or you're unsure, set is_awaiting_instruction to false.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeApiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-1-20250805',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      console.error('Claude API error:', response.status);
      return null;
    }

    const data = await response.json();
    const content = data.content[0].text;
    
    // Parse the JSON response
    try {
      return JSON.parse(content);
    } catch (e) {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      console.error('Failed to parse Claude response as JSON:', content);
      return null;
    }
  } catch (error) {
    console.error('Error calling Claude API:', error);
    return null;
  }
}

/**
 * Get the current state of the Claude agent
 */
async function getAgentState(flyEndpoint) {
  try {
    const response = await fetch(`${flyEndpoint}/status`);
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    return {
      output: data.current_output || '',
      sessions: data.sessions || []
    };
  } catch (error) {
    console.error('Error getting agent state:', error);
    return null;
  }
}

/**
 * Send next command to the agent
 */
async function sendCommandToAgent(command, flyEndpoint, hmacSecret) {
  const signature = await signCommand(command, hmacSecret);
  
  try {
    const response = await fetch(`${flyEndpoint}/inject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        command: command,
        signature: signature
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Error sending command:', error);
    return false;
  }
}

/**
 * Start a new Noderr session if none exists
 */
async function startNoderSession(flyEndpoint, hmacSecret) {
  console.log('Starting new Noderr session with pre-authorized Claude...');
  
  // The Claude CLI should already be authorized via the config file
  // We can skip directly to the Noderr work
  const startCommand = `Let's begin a Noderr work session. First, check if there's a noderr/ directory with project files. If not, we'll need to initialize Noderr for this project. Otherwise, review the noderr/noderr_log.md and noderr/noderr_tracker.md to understand the current project state and propose what to work on next.`;
  
  const sent = await sendCommandToAgent(startCommand, flyEndpoint, hmacSecret);
  
  if (sent) {
    console.log('Noderr session start command sent (using pre-authorized Claude)');
    return {
      status: 'session_started', 
      command_sent: startCommand,
      note: 'Claude is pre-authorized via config file'
    };
  } else {
    console.error('Failed to start Noderr session');
    return null;
  }
}

/**
 * Main orchestration loop - called periodically
 */
async function orchestrate(env) {
  const flyEndpoint = env.FLY_ENDPOINT || 'https://uncle-frank-claude.fly.dev';
  const hmacSecret = env.HMAC_SECRET || 'test-secret-change-in-production';
  
  // Get current agent state
  const agentState = await getAgentState(flyEndpoint);
  
  // If no output or no session, start a new Noderr session
  if (!agentState || !agentState.output || agentState.output.length < 100) {
    console.log('No active session detected, starting Noderr...');
    return await startNoderSession(flyEndpoint, hmacSecret);
  }
  
  // Get recent task history
  const tasks = await env.TASK_QUEUE.list({ prefix: 'task:' });
  const recentTasks = [];
  
  for (const key of tasks.keys.slice(-5)) { // Last 5 tasks
    const taskData = await env.TASK_QUEUE.get(key.name);
    if (taskData) {
      const task = JSON.parse(taskData);
      recentTasks.push({
        command: task.command.substring(0, 100), // First 100 chars
        status: task.status,
        created: task.created
      });
    }
  }
  
  // Use Claude to analyze the state
  const analysis = await analyzeStateWithClaude(
    agentState.output.substring(-3000), // Last 3000 chars of output
    recentTasks,
    env
  );
  
  if (!analysis) {
    console.log('Failed to analyze state with Claude');
    return;
  }
  
  console.log('Claude Orchestrator Analysis:', analysis);
  
  // If agent is awaiting instruction, send the next command
  if (analysis.is_awaiting_instruction && analysis.next_command) {
    console.log(`Sending next command: ${analysis.next_command.substring(0, 100)}...`);
    
    // Queue the command
    const taskId = crypto.randomUUID();
    const task = {
      taskId,
      command: analysis.next_command,
      status: 'pending',
      created: new Date().toISOString(),
      metadata: {
        triggered_by: 'orchestrator',
        stage: analysis.current_stage,
        reasoning: analysis.reasoning
      }
    };
    
    await env.TASK_QUEUE.put(`task:${taskId}`, JSON.stringify(task));
    
    // Send it immediately
    const sent = await sendCommandToAgent(
      analysis.next_command,
      flyEndpoint,
      hmacSecret
    );
    
    if (sent) {
      task.status = 'sent';
      task.executed = new Date().toISOString();
      await env.TASK_QUEUE.put(`task:${taskId}`, JSON.stringify(task));
      
      console.log('Command sent successfully');
    } else {
      console.error('Failed to send command');
    }
  } else {
    console.log('Agent is still working or no action needed');
  }
  
  return analysis;
}

// Helper function for HMAC signing (same as before)
async function signCommand(command, secret) {
  const encoder = new TextEncoder();
  const data = encoder.encode(command);
  const key = encoder.encode(secret);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Export functions for use in the worker
export { orchestrate, analyzeStateWithClaude, startNoderSession, NODERR_PROMPTS_GUIDE };