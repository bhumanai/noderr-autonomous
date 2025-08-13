/**
 * API Extensions for Noderr Fleet Command UI
 */

// Project Management
export async function handleProjects(request, env, method) {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const projectId = pathParts[2]; // /api/projects/:id
    
    switch (method) {
        case 'GET':
            return await getProjects(env);
        case 'POST':
            return await createProject(request, env);
        case 'PUT':
            return await updateProject(projectId, request, env);
        case 'DELETE':
            return await deleteProject(projectId, env);
        default:
            return new Response('Method not allowed', { status: 405 });
    }
}

async function getProjects(env) {
    const projects = [];
    const list = await env.TASK_QUEUE.list({ prefix: 'project:' });
    
    for (const key of list.keys) {
        const project = await env.TASK_QUEUE.get(key.name, 'json');
        if (project) projects.push(project);
    }
    
    return new Response(JSON.stringify(projects), {
        headers: { 'Content-Type': 'application/json' }
    });
}

async function createProject(request, env) {
    const data = await request.json();
    const projectId = `project:${Date.now()}`;
    
    const project = {
        id: projectId,
        name: data.name || data.repo,
        repo: data.repo,
        branch: data.branch || 'main',
        isActive: false,
        lastSync: new Date().toISOString(),
        taskCount: 0,
        settings: {
            autoCommit: true,
            autoPush: true,
            commitTemplate: 'Task: {description}\n\nCompleted by Noderr Agent'
        }
    };
    
    await env.TASK_QUEUE.put(projectId, JSON.stringify(project));
    
    return new Response(JSON.stringify(project), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
    });
}

async function updateProject(projectId, request, env) {
    if (!projectId) {
        return new Response('Project ID required', { status: 400 });
    }
    
    const existing = await env.TASK_QUEUE.get(projectId, 'json');
    if (!existing) {
        return new Response('Project not found', { status: 404 });
    }
    
    const updates = await request.json();
    const updated = { ...existing, ...updates };
    await env.TASK_QUEUE.put(projectId, JSON.stringify(updated));
    
    return new Response(JSON.stringify(updated), {
        headers: { 'Content-Type': 'application/json' }
    });
}

async function deleteProject(projectId, env) {
    if (!projectId) {
        return new Response('Project ID required', { status: 400 });
    }
    
    await env.TASK_QUEUE.delete(projectId);
    return new Response('Project deleted', { status: 200 });
}

// Enhanced Task Management
export async function handleTasks(request, env, method) {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const taskId = pathParts[2]; // /api/tasks/:id
    const action = pathParts[3]; // /api/tasks/:id/action
    
    if (action === 'approve') {
        return await approveTask(taskId, request, env);
    } else if (action === 'revise') {
        return await reviseTask(taskId, env);
    } else if (action === 'changes') {
        return await getTaskChanges(taskId, env);
    }
    
    switch (method) {
        case 'GET':
            return await getTasks(request, env);
        case 'POST':
            return await createTask(request, env);
        case 'PATCH':
            return await updateTask(taskId, request, env);
        case 'DELETE':
            return await deleteTask(taskId, env);
        default:
            return new Response('Method not allowed', { status: 405 });
    }
}

async function getTasks(request, env) {
    const url = new URL(request.url);
    const projectId = url.searchParams.get('projectId');
    
    const tasks = [];
    const list = await env.TASK_QUEUE.list({ prefix: 'task:' });
    
    for (const key of list.keys) {
        const task = await env.TASK_QUEUE.get(key.name, 'json');
        if (task && (!projectId || task.projectId === projectId)) {
            tasks.push(task);
        }
    }
    
    // Sort by created date
    tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    return new Response(JSON.stringify(tasks), {
        headers: { 'Content-Type': 'application/json' }
    });
}

async function createTask(request, env) {
    const data = await request.json();
    const taskId = `task:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const task = {
        id: taskId,
        projectId: data.projectId,
        description: data.description,
        status: data.status || 'backlog',
        agentId: null,
        createdAt: new Date().toISOString(),
        startedAt: null,
        completedAt: null,
        pushedAt: null,
        progress: 0,
        changes: null,
        gitCommit: null
    };
    
    await env.TASK_QUEUE.put(taskId, JSON.stringify(task));
    
    // Trigger SSE update
    await broadcastTaskUpdate(env, 'task:created', task);
    
    return new Response(JSON.stringify(task), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
    });
}

async function updateTask(taskId, request, env) {
    if (!taskId) {
        return new Response('Task ID required', { status: 400 });
    }
    
    const existing = await env.TASK_QUEUE.get(taskId, 'json');
    if (!existing) {
        return new Response('Task not found', { status: 404 });
    }
    
    const updates = await request.json();
    const updated = { ...existing, ...updates };
    
    // Update timestamps
    if (updates.status === 'working' && !existing.startedAt) {
        updated.startedAt = new Date().toISOString();
    } else if (updates.status === 'review' && !existing.completedAt) {
        updated.completedAt = new Date().toISOString();
    } else if (updates.status === 'pushed' && !existing.pushedAt) {
        updated.pushedAt = new Date().toISOString();
    }
    
    await env.TASK_QUEUE.put(taskId, JSON.stringify(updated));
    
    // Trigger SSE update
    await broadcastTaskUpdate(env, 'task:updated', updated);
    
    return new Response(JSON.stringify(updated), {
        headers: { 'Content-Type': 'application/json' }
    });
}

async function deleteTask(taskId, env) {
    if (!taskId) {
        return new Response('Task ID required', { status: 400 });
    }
    
    await env.TASK_QUEUE.delete(taskId);
    return new Response('Task deleted', { status: 200 });
}

async function approveTask(taskId, request, env) {
    const task = await env.TASK_QUEUE.get(taskId, 'json');
    if (!task) {
        return new Response('Task not found', { status: 404 });
    }
    
    const { commitMessage } = await request.json();
    const FLY_ENDPOINT = env.FLY_ENDPOINT || 'https://uncle-frank-claude.fly.dev';
    
    try {
        // Stage all changes
        const addResponse = await fetch(`${FLY_ENDPOINT}/git/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: '/workspace' })
        });
        
        if (!addResponse.ok) {
            throw new Error('Failed to stage changes');
        }
        
        // Commit changes
        const commitResponse = await fetch(`${FLY_ENDPOINT}/git/commit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: '/workspace',
                message: commitMessage || `Task completed: ${task.description}`
            })
        });
        
        const commitResult = await commitResponse.json();
        if (!commitResult.success) {
            throw new Error(commitResult.error || 'Failed to commit');
        }
        
        // Push to remote
        const pushResponse = await fetch(`${FLY_ENDPOINT}/git/push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: '/workspace' })
        });
        
        const pushResult = await pushResponse.json();
        if (!pushResult.success) {
            throw new Error(pushResult.error || 'Failed to push');
        }
        
        // Update task status
        task.status = 'pushed';
        task.pushedAt = new Date().toISOString();
        task.gitCommit = commitResult.commit || `commit_${Date.now()}`;
        
        await env.TASK_QUEUE.put(taskId, JSON.stringify(task));
        
        // Trigger SSE update
        await broadcastTaskUpdate(env, 'task:completed', task);
        
        return new Response(JSON.stringify({ 
            success: true, 
            task,
            commit: commitResult.commit
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function reviseTask(taskId, env) {
    const task = await env.TASK_QUEUE.get(taskId, 'json');
    if (!task) {
        return new Response('Task not found', { status: 404 });
    }
    
    task.status = 'ready';
    task.completedAt = null;
    
    await env.TASK_QUEUE.put(taskId, JSON.stringify(task));
    
    // Trigger SSE update
    await broadcastTaskUpdate(env, 'task:updated', task);
    
    return new Response(JSON.stringify({ success: true, task }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

async function getTaskChanges(taskId, env) {
    const FLY_ENDPOINT = env.FLY_ENDPOINT || 'https://uncle-frank-claude.fly.dev';
    
    try {
        // Get git diff from Fly.io
        const diffResponse = await fetch(`${FLY_ENDPOINT}/git/diff?path=/workspace`);
        
        if (!diffResponse.ok) {
            throw new Error('Failed to get diff');
        }
        
        const diffResult = await diffResponse.json();
        
        if (diffResult.success) {
            return new Response(JSON.stringify({
                diff: diffResult.diff,
                files: diffResult.files || []
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } else {
            throw new Error(diffResult.error || 'Failed to get changes');
        }
    } catch (error) {
        // Return error response
        return new Response(JSON.stringify({
            error: error.message,
            diff: 'Unable to fetch changes',
            files: []
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Server-Sent Events for real-time updates
export async function handleSSE(request, env) {
    const encoder = new TextEncoder();
    let clientId = crypto.randomUUID();
    
    const stream = new ReadableStream({
        start(controller) {
            // Send initial connection message
            controller.enqueue(encoder.encode(`event: connected\ndata: {"clientId":"${clientId}"}\n\n`));
            
            // Keep connection alive with heartbeat
            const heartbeat = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(': heartbeat\n\n'));
                } catch (e) {
                    clearInterval(heartbeat);
                }
            }, 30000);
            
            // Store controller for updates
            env.SSE_CLIENTS = env.SSE_CLIENTS || new Map();
            env.SSE_CLIENTS.set(clientId, controller);
        },
        cancel() {
            // Clean up when client disconnects
            if (env.SSE_CLIENTS) {
                env.SSE_CLIENTS.delete(clientId);
            }
        }
    });
    
    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        }
    });
}

// Broadcast updates to all SSE clients
async function broadcastTaskUpdate(env, event, data) {
    if (!env.SSE_CLIENTS) return;
    
    const encoder = new TextEncoder();
    const message = encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    
    for (const [clientId, controller] of env.SSE_CLIENTS.entries()) {
        try {
            controller.enqueue(message);
        } catch (e) {
            // Client disconnected, remove it
            env.SSE_CLIENTS.delete(clientId);
        }
    }
}

// Git Operations
export async function handleGit(request, env, method) {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const action = pathParts[2]; // /api/git/action
    
    switch (action) {
        case 'commit':
            return await handleCommit(request, env);
        case 'push':
            return await handlePush(request, env);
        case 'status':
            return await handleGitStatus(request, env);
        default:
            return new Response('Unknown git action', { status: 400 });
    }
}

async function handleCommit(request, env) {
    const { projectId, taskId, message } = await request.json();
    const FLY_ENDPOINT = env.FLY_ENDPOINT || 'https://uncle-frank-claude.fly.dev';
    
    try {
        // Stage all changes first
        const addResponse = await fetch(`${FLY_ENDPOINT}/git/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: '/workspace' })
        });
        
        if (!addResponse.ok) {
            throw new Error('Failed to stage changes');
        }
        
        // Commit changes
        const commitResponse = await fetch(`${FLY_ENDPOINT}/git/commit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: '/workspace',
                message: message || 'Update from Noderr'
            })
        });
        
        const result = await commitResponse.json();
        
        if (result.success) {
            return new Response(JSON.stringify({
                success: true,
                commit: result.commit,
                message: message,
                output: result.output
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } else {
            throw new Error(result.error || 'Commit failed');
        }
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function handlePush(request, env) {
    const { projectId, branch } = await request.json();
    const FLY_ENDPOINT = env.FLY_ENDPOINT || 'https://uncle-frank-claude.fly.dev';
    
    try {
        // Push to remote
        const pushResponse = await fetch(`${FLY_ENDPOINT}/git/push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: '/workspace',
                branch: branch || 'main'
            })
        });
        
        const result = await pushResponse.json();
        
        if (result.success) {
            return new Response(JSON.stringify({
                success: true,
                pushed: true,
                branch: branch || 'main',
                output: result.output
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } else {
            throw new Error(result.error || 'Push failed');
        }
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function handleGitStatus(request, env) {
    const url = new URL(request.url);
    const projectId = url.searchParams.get('projectId');
    const FLY_ENDPOINT = env.FLY_ENDPOINT || 'https://uncle-frank-claude.fly.dev';
    
    try {
        // Get git status from Fly.io
        const statusResponse = await fetch(`${FLY_ENDPOINT}/git/status?path=/workspace`);
        
        if (!statusResponse.ok) {
            throw new Error('Failed to get status');
        }
        
        const result = await statusResponse.json();
        
        if (result.success) {
            return new Response(JSON.stringify({
                branch: result.branch || 'main',
                ahead: 0,  // Would need additional git commands to get this
                behind: 0, // Would need additional git commands to get this
                modified: result.modified || [],
                untracked: result.untracked || [],
                staged: result.staged || []
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } else {
            throw new Error(result.error || 'Status check failed');
        }
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            // Return empty status on error
            branch: 'unknown',
            ahead: 0,
            behind: 0,
            modified: [],
            untracked: [],
            staged: []
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}