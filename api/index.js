// Vercel Serverless Function for Noderr API with Real AI
const cors = require('cors');

// Import AI module if it exists
let analyzeWithAI;
try {
    const aiModule = require('./brainstorm-ai');
    analyzeWithAI = aiModule.analyzeWithAI;
} catch (error) {
    console.log('AI module not available, using fallback');
}

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
        const context = req.body?.context || {};
        
        // Use real AI if available
        if (analyzeWithAI) {
            try {
                const aiResponse = await analyzeWithAI(message, context);
                
                // Format response for frontend
                const response = {
                    message: aiResponse.analysis,
                    tasks: aiResponse.tasks.map(task => ({
                        id: task.id,
                        title: task.title,
                        description: task.description || task.title,
                        complexity: task.complexity,
                        estimatedHours: task.estimatedHours,
                        dependencies: task.dependencies,
                        technicalDetails: task.technicalDetails,
                        status: 'suggested',
                        approvalStatus: 'pending'
                    })),
                    insights: [
                        ...aiResponse.assumptions,
                        ...aiResponse.risks
                    ],
                    clarifyingQuestions: aiResponse.clarifyingQuestions,
                    requiresApproval: true
                };
                
                res.json(response);
                return;
            } catch (error) {
                console.error('AI analysis failed:', error);
                // Fall through to basic response
            }
        }
        
        // Fallback response when AI is not available
        const lowerMessage = message.toLowerCase();
        let response = {
            message: 'I\'ll help you break this down into actionable tasks.',
            tasks: [],
            insights: [],
            clarifyingQuestions: [
                'What tech stack are you using?',
                'What are the specific requirements?',
                'What\'s your timeline?'
            ],
            requiresApproval: true
        };
        
        // Generate better fallback tasks
        if (lowerMessage.includes('auth') || lowerMessage.includes('login') || lowerMessage.includes('sso')) {
            response.tasks = [
                {
                    id: `task-${Date.now()}-1`,
                    title: 'Set up authentication database schema',
                    description: 'Create users table with OAuth provider fields, add proper indexes',
                    complexity: 'medium',
                    estimatedHours: 2,
                    dependencies: [],
                    status: 'suggested'
                },
                {
                    id: `task-${Date.now()}-2`,
                    title: 'Implement OAuth 2.0 provider integration',
                    description: 'Configure Google/GitHub OAuth, handle callbacks and token exchange',
                    complexity: 'high',
                    estimatedHours: 3,
                    dependencies: [0],
                    status: 'suggested'
                },
                {
                    id: `task-${Date.now()}-3`,
                    title: 'Create authentication API endpoints',
                    description: 'Build login, callback, logout, and refresh token endpoints',
                    complexity: 'medium',
                    estimatedHours: 3,
                    dependencies: [1],
                    status: 'suggested'
                },
                {
                    id: `task-${Date.now()}-4`,
                    title: 'Build login UI components',
                    description: 'Create login form, SSO buttons, error handling, loading states',
                    complexity: 'low',
                    estimatedHours: 2,
                    dependencies: [2],
                    status: 'suggested'
                }
            ];
        } else {
            response.tasks = [
                {
                    id: `task-${Date.now()}-1`,
                    title: 'Define and document requirements',
                    description: 'Create detailed specs with acceptance criteria',
                    complexity: 'low',
                    estimatedHours: 2,
                    dependencies: [],
                    status: 'suggested'
                },
                {
                    id: `task-${Date.now()}-2`,
                    title: 'Design technical architecture',
                    description: 'Create component diagram and data flow',
                    complexity: 'medium',
                    estimatedHours: 3,
                    dependencies: [0],
                    status: 'suggested'
                },
                {
                    id: `task-${Date.now()}-3`,
                    title: 'Implement core functionality',
                    description: 'Build main feature following the architecture',
                    complexity: 'high',
                    estimatedHours: 4,
                    dependencies: [1],
                    status: 'suggested'
                }
            ];
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