/**
 * Noderr Autonomous Orchestration Worker
 * Manages task queue and sends commands to Fly.io Claude instance
 */

import { orchestrate, analyzeStateWithClaude, startNoderSession, NODERR_PROMPTS_GUIDE } from './orchestrator.js';

// Constants
const FLY_ENDPOINT = 'https://uncle-frank-claude.fly.dev';
const HMAC_SECRET = 'test-secret-change-in-production'; // Move to secrets in production

/**
 * Generate HMAC signature for command authentication
 */
function signCommand(command, secret) {
  const encoder = new TextEncoder();
  const data = encoder.encode(command);
  const key = encoder.encode(secret);
  
  // Use Web Crypto API for HMAC
  return crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  ).then(cryptoKey => {
    return crypto.subtle.sign('HMAC', cryptoKey, data);
  }).then(signature => {
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  });
}

/**
 * Execute a task by sending command to Fly.io
 */
async function executeTask(task, env) {
  const signature = await signCommand(task.command, env.HMAC_SECRET || HMAC_SECRET);
  
  // No timeout - Claude can take a long time to respond
  const controller = new AbortController();
  // Set a very long timeout (30 minutes) for Claude responses
  const timeoutId = setTimeout(() => controller.abort(), 1800000);
  
  try {
    const response = await fetch(`${FLY_ENDPOINT}/inject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        command: task.command,
        signature: signature
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const result = await response.json();
    return {
      success: response.ok,
      status: response.status,
      result: result
    };
  } catch (error) {
    clearTimeout(timeoutId);
    return {
      success: false,
      status: 500,
      result: { error: error.message }
    };
  }
}

/**
 * Queue a new task
 */
async function queueTask(env, command, metadata = {}) {
  const taskId = crypto.randomUUID();
  const task = {
    taskId,
    command,
    status: 'pending',
    created: new Date().toISOString(),
    executed: null,
    result: null,
    retries: 0,
    metadata
  };
  
  await env.TASK_QUEUE.put(`task:${taskId}`, JSON.stringify(task));
  return task;
}

/**
 * Process pending tasks from queue
 */
async function processQueue(env) {
  const tasks = await env.TASK_QUEUE.list({ prefix: 'task:' });
  const results = [];
  
  for (const key of tasks.keys) {
    const taskData = await env.TASK_QUEUE.get(key.name);
    const task = JSON.parse(taskData);
    
    if (task.status === 'pending' || (task.status === 'failed' && task.retries < 3)) {
      console.log(`Processing task ${task.taskId}: ${task.command}`);
      
      task.status = 'executing';
      await env.TASK_QUEUE.put(key.name, JSON.stringify(task));
      
      try {
        const result = await executeTask(task, env);
        task.status = result.success ? 'completed' : 'failed';
        task.result = result;
        task.executed = new Date().toISOString();
        
        if (!result.success) {
          task.retries++;
        }
        
        results.push({
          taskId: task.taskId,
          status: task.status,
          result: result
        });
      } catch (error) {
        task.status = 'failed';
        task.result = { error: error.message };
        task.retries++;
      }
      
      await env.TASK_QUEUE.put(key.name, JSON.stringify(task));
    }
  }
  
  return results;
}

/**
 * Get system status
 */
async function getStatus(env) {
  const tasks = await env.TASK_QUEUE.list({ prefix: 'task:' });
  const taskList = [];
  
  for (const key of tasks.keys) {
    const taskData = await env.TASK_QUEUE.get(key.name);
    taskList.push(JSON.parse(taskData));
  }
  
  // Get Fly.io status
  let flyStatus = null;
  try {
    const response = await fetch(`${FLY_ENDPOINT}/health`);
    flyStatus = await response.json();
  } catch (error) {
    flyStatus = { error: error.message };
  }
  
  return {
    timestamp: new Date().toISOString(),
    queueLength: taskList.length,
    tasks: taskList.slice(-10), // Last 10 tasks
    flyStatus,
    stats: {
      pending: taskList.filter(t => t.status === 'pending').length,
      executing: taskList.filter(t => t.status === 'executing').length,
      completed: taskList.filter(t => t.status === 'completed').length,
      failed: taskList.filter(t => t.status === 'failed').length
    }
  };
}

/**
 * HTML Dashboard
 */
function renderDashboard(status) {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Noderr Orchestration Dashboard</title>
  <style>
    body { font-family: monospace; background: #1a1a1a; color: #0f0; padding: 20px; }
    h1 { color: #0f0; text-shadow: 0 0 10px #0f0; }
    .status { background: #000; padding: 20px; border: 1px solid #0f0; margin: 20px 0; }
    .task { margin: 10px 0; padding: 10px; background: #111; }
    .pending { border-left: 3px solid yellow; }
    .completed { border-left: 3px solid #0f0; }
    .failed { border-left: 3px solid red; }
    .stats { display: flex; gap: 20px; }
    .stat { background: #000; padding: 10px; border: 1px solid #0f0; }
    button { background: #0f0; color: #000; border: none; padding: 10px 20px; cursor: pointer; }
    button:hover { background: #0a0; }
    input { background: #000; color: #0f0; border: 1px solid #0f0; padding: 10px; width: 500px; }
  </style>
</head>
<body>
  <h1>🤖 Noderr Autonomous Orchestration</h1>
  
  <div class="status">
    <h2>System Status</h2>
    <p>Time: ${status.timestamp}</p>
    <p>Fly.io Health: ${status.flyStatus?.status || 'Unknown'}</p>
    <div class="stats">
      <div class="stat">Pending: ${status.stats.pending}</div>
      <div class="stat">Executing: ${status.stats.executing}</div>
      <div class="stat">Completed: ${status.stats.completed}</div>
      <div class="stat">Failed: ${status.stats.failed}</div>
    </div>
  </div>
  
  <div class="status">
    <h2>Queue Command</h2>
    <input type="text" id="command" placeholder="Enter Noderr command..." />
    <button onclick="queueCommand()">Queue</button>
  </div>
  
  <div class="status">
    <h2>Recent Tasks</h2>
    ${status.tasks.map(task => `
      <div class="task ${task.status}">
        <strong>${task.taskId}</strong> - ${task.status}<br/>
        Command: ${task.command}<br/>
        Created: ${task.created}
      </div>
    `).join('')}
  </div>
  
  <script>
    async function queueCommand() {
      const command = document.getElementById('command').value;
      if (!command) return;
      
      const response = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });
      
      if (response.ok) {
        alert('Command queued!');
        location.reload();
      } else {
        alert('Failed to queue command');
      }
    }
    
    // Auto-refresh every 10 seconds
    setTimeout(() => location.reload(), 10000);
  </script>
</body>
</html>
  `;
}

/**
 * Main worker export
 */
export default {
  /**
   * Handle HTTP requests
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Dashboard
    if (url.pathname === '/') {
      const status = await getStatus(env);
      return new Response(renderDashboard(status), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    // API: Queue command
    if (url.pathname === '/api/queue' && request.method === 'POST') {
      const { command } = await request.json();
      const task = await queueTask(env, command);
      return new Response(JSON.stringify(task), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // API: Get status
    if (url.pathname === '/api/status') {
      const status = await getStatus(env);
      return new Response(JSON.stringify(status), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // API: Process queue manually
    if (url.pathname === '/api/process') {
      const results = await processQueue(env);
      return new Response(JSON.stringify(results), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // API: Intelligent orchestration endpoint
    if (url.pathname === '/api/orchestrate') {
      const result = await orchestrate(env);
      return new Response(JSON.stringify(result || { status: 'no action needed' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // API: Start Noderr session
    if (url.pathname === '/api/start-noderr') {
      const flyEndpoint = env.FLY_ENDPOINT || FLY_ENDPOINT;
      const hmacSecret = env.HMAC_SECRET || HMAC_SECRET;
      const result = await startNoderSession(flyEndpoint, hmacSecret);
      return new Response(JSON.stringify(result || { status: 'failed' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // API: Analyze state with Claude
    if (url.pathname === '/api/analyze' && request.method === 'POST') {
      const { output, history } = await request.json();
      const analysis = await analyzeStateWithClaude(output, history || [], env);
      return new Response(JSON.stringify(analysis || { error: 'Analysis failed' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // API: Webhook for completion notifications (simplified - just triggers orchestration)
    if (url.pathname === '/api/webhook' && request.method === 'POST') {
      const data = await request.json();
      
      // Log the webhook event
      console.log('Webhook received:', data);
      
      // Trigger orchestration to determine next step
      const result = await orchestrate(env);
      
      return new Response(JSON.stringify({
        status: 'received',
        orchestration_result: result
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Not Found', { status: 404 });
  },
  
  /**
   * Handle cron triggers
   */
  async scheduled(event, env, ctx) {
    console.log('Cron triggered:', event.cron);
    
    switch(event.cron) {
      case '*/5 * * * *': // Every 5 minutes
        // First process any pending tasks
        await processQueue(env);
        // Then run intelligent orchestration
        await orchestrate(env);
        break;
      
      case '0 */6 * * *': // Every 6 hours
        // Cleanup old tasks
        const tasks = await env.TASK_QUEUE.list({ prefix: 'task:' });
        const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
        
        for (const key of tasks.keys) {
          const taskData = await env.TASK_QUEUE.get(key.name);
          const task = JSON.parse(taskData);
          const created = new Date(task.created).getTime();
          
          if (created < cutoff && task.status !== 'pending') {
            await env.TASK_QUEUE.delete(key.name);
          }
        }
        break;
    }
  }
};