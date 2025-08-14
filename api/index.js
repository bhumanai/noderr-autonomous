// Vercel Serverless Function for Noderr API
const cors = require('cors');

// In-memory storage (will reset on each cold start - use a database for production)
let projects = global.projects || [];
let tasks = global.tasks || [];
let brainstormSessions = global.brainstormSessions || [];

// Store in global to persist between warm invocations
global.projects = projects;
global.tasks = tasks;
global.brainstormSessions = brainstormSessions;

// Helper to parse route
function parseRoute(url) {
    const path = url.replace(/\?.*$/, '');
    const parts = path.split('/').filter(Boolean);
    return parts;
}

// Main handler
module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    const route = parseRoute(req.url);
    const apiPath = route.slice(1).join('/'); // Remove 'api' prefix
    
    // Projects endpoints
    if (apiPath === 'projects' && req.method === 'GET') {
        res.json(projects);
        return;
    }
    
    if (apiPath === 'projects' && req.method === 'POST') {
        const project = {
            id: `project-${Date.now()}`,
            name: req.body?.name || 'Unnamed Project',
            repo: req.body?.repo || '',
            branch: req.body?.branch || 'main',
            createdAt: new Date().toISOString()
        };
        projects.push(project);
        res.status(201).json(project);
        return;
    }
    
    if (apiPath.startsWith('projects/') && req.method === 'GET') {
        const id = apiPath.split('/')[1];
        const project = projects.find(p => p.id === id);
        if (!project) {
            res.status(404).json({ error: 'Project not found' });
            return;
        }
        res.json(project);
        return;
    }
    
    if (apiPath.startsWith('projects/') && req.method === 'PUT') {
        const id = apiPath.split('/')[1];
        const project = projects.find(p => p.id === id);
        if (!project) {
            res.status(404).json({ error: 'Project not found' });
            return;
        }
        Object.assign(project, req.body);
        res.json(project);
        return;
    }
    
    if (apiPath.startsWith('projects/') && req.method === 'DELETE') {
        const id = apiPath.split('/')[1];
        const index = projects.findIndex(p => p.id === id);
        if (index === -1) {
            res.status(404).json({ error: 'Project not found' });
            return;
        }
        projects.splice(index, 1);
        res.status(204).end();
        return;
    }
    
    // Tasks endpoints
    if (apiPath === 'tasks' && req.method === 'GET') {
        const projectId = req.query?.projectId;
        const result = projectId ? tasks.filter(t => t.projectId === projectId) : tasks;
        res.json(result);
        return;
    }
    
    if (apiPath === 'tasks' && req.method === 'POST') {
        const task = {
            id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            description: req.body?.description || '',
            projectId: req.body?.projectId,
            status: req.body?.status || 'backlog',
            createdAt: new Date().toISOString(),
            agentId: null,
            progress: 0
        };
        tasks.push(task);
        res.status(201).json(task);
        return;
    }
    
    if (apiPath.startsWith('tasks/') && apiPath.endsWith('/changes')) {
        const id = apiPath.split('/')[1];
        res.json({
            diff: '+ Added new feature\n- Removed old code\n~ Modified configuration',
            files: ['src/app.js', 'config.json']
        });
        return;
    }
    
    if (apiPath.startsWith('tasks/') && apiPath.endsWith('/approve')) {
        const id = apiPath.split('/')[1];
        const task = tasks.find(t => t.id === id);
        if (!task) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }
        
        task.status = 'pushed';
        task.pushedAt = new Date().toISOString();
        task.commitMessage = req.body?.commitMessage || 'Task completed';
        
        res.json({
            success: true,
            task: task,
            message: 'Task approved and pushed'
        });
        return;
    }
    
    if (apiPath.startsWith('tasks/') && req.method === 'PATCH') {
        const id = apiPath.split('/')[1];
        const task = tasks.find(t => t.id === id);
        if (!task) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }
        
        Object.assign(task, req.body);
        
        // Update timestamps
        if (req.body?.status === 'working' && !task.startedAt) {
            task.startedAt = new Date().toISOString();
        } else if (req.body?.status === 'review' && !task.completedAt) {
            task.completedAt = new Date().toISOString();
        } else if (req.body?.status === 'pushed' && !task.pushedAt) {
            task.pushedAt = new Date().toISOString();
        }
        
        res.json(task);
        return;
    }
    
    if (apiPath.startsWith('tasks/') && req.method === 'DELETE') {
        const id = apiPath.split('/')[1];
        const index = tasks.findIndex(t => t.id === id);
        if (index === -1) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }
        tasks.splice(index, 1);
        res.status(204).end();
        return;
    }
    
    // Brainstorm endpoints
    if (apiPath === 'brainstorm/sessions' && req.method === 'GET') {
        const projectId = req.query?.projectId;
        const result = projectId ? 
            brainstormSessions.filter(s => s.projectId === projectId) : 
            brainstormSessions;
        res.json(result);
        return;
    }
    
    if (apiPath === 'brainstorm/sessions' && req.method === 'POST') {
        const session = {
            id: `session-${Date.now()}`,
            projectId: req.body?.projectId,
            title: req.body?.title || 'New Brainstorm',
            messages: req.body?.messages || [],
            context: req.body?.context || {},
            generatedTasks: req.body?.generatedTasks || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        brainstormSessions.push(session);
        res.status(201).json(session);
        return;
    }
    
    if (apiPath === 'brainstorm/analyze' && req.method === 'POST') {
        const message = req.body?.message || '';
        const lowerMessage = message.toLowerCase();
        let response = {
            message: '',
            tasks: [],
            insights: []
        };
        
        if (lowerMessage.includes('feature') || lowerMessage.includes('add')) {
            response.message = `Great idea! Let me analyze the requirements for this feature...`;
            response.tasks = [
                { description: 'Research similar implementations', complexity: 'low' },
                { description: 'Design the architecture', complexity: 'medium' },
                { description: 'Implement core functionality', complexity: 'high' },
                { description: 'Add tests', complexity: 'medium' }
            ];
            response.insights = [
                'Consider user experience implications',
                'Check for existing patterns in codebase',
                'Plan for scalability'
            ];
        } else if (lowerMessage.includes('bug') || lowerMessage.includes('fix')) {
            response.message = `Let's systematically debug this issue...`;
            response.tasks = [
                { description: 'Reproduce the bug', complexity: 'low' },
                { description: 'Identify root cause', complexity: 'medium' },
                { description: 'Implement fix', complexity: 'medium' },
                { description: 'Add regression test', complexity: 'low' }
            ];
            response.insights = [
                'Check recent changes that might have caused this',
                'Look for similar patterns elsewhere',
                'Consider edge cases'
            ];
        } else {
            response.message = `Interesting! Can you provide more details about what you want to achieve?`;
            response.insights = ['Need more context to generate specific tasks'];
        }
        
        res.json(response);
        return;
    }
    
    // Git endpoints
    if (apiPath === 'git/status' && req.method === 'GET') {
        res.json({
            branch: 'main',
            modified: [],
            untracked: [],
            staged: [],
            ahead: 0,
            behind: 0
        });
        return;
    }
    
    if (apiPath === 'git/commit' && req.method === 'POST') {
        res.json({
            success: true,
            commit: `commit-${Date.now()}`,
            message: req.body?.message || 'Commit from Noderr'
        });
        return;
    }
    
    if (apiPath === 'git/push' && req.method === 'POST') {
        res.json({
            success: true,
            pushed: true,
            branch: 'main'
        });
        return;
    }
    
    // Status endpoint
    if (apiPath === 'status' && req.method === 'GET') {
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            projects: projects.length,
            tasks: tasks.length,
            brainstormSessions: brainstormSessions.length
        });
        return;
    }
    
    // Health check
    if (apiPath === 'health' && req.method === 'GET') {
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString()
        });
        return;
    }
    
    // SSE endpoint (return placeholder for Vercel)
    if (apiPath === 'sse') {
        res.json({
            message: 'SSE not supported in Vercel serverless functions',
            alternative: 'Use polling or upgrade to Vercel Edge Functions'
        });
        return;
    }
    
    // Default 404
    res.status(404).json({
        error: 'Not found',
        path: apiPath,
        method: req.method
    });
};