// Instant Backend for Noderr - Deploy to any Node.js host
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { execSync, spawn } = require('child_process');
const os = require('os');

// Try to load AI module
let analyzeWithAI;
try {
    const aiModule = require('./api/brainstorm-ai');
    analyzeWithAI = aiModule.analyzeWithAI;
    console.log('AI module loaded successfully');
} catch (error) {
    console.log('AI module not available, will use fallback');
}

const app = express();

app.use(cors());
app.use(express.json());

// Serve static files from docs directory
app.use(express.static(path.join(__dirname, 'docs')));

// In-memory storage
let projects = [];
let tasks = [];
let brainstormSessions = [];

// Projects endpoints
app.get('/api/projects', (req, res) => {
    res.json(projects);
});

app.post('/api/projects', async (req, res) => {
    const project = {
        id: `project-${Date.now()}`,
        name: req.body.name || 'Unnamed Project',
        repo: req.body.repo || '',
        branch: req.body.branch || 'main',
        createdAt: new Date().toISOString(),
        localPath: null,
        lastSync: null
    };
    
    // Clone the repository if URL provided
    if (project.repo) {
        try {
            const reposDir = path.join(os.tmpdir(), 'noderr-repos');
            await fs.mkdir(reposDir, { recursive: true });
            
            project.localPath = path.join(reposDir, project.id);
            
            console.log(`Cloning repository ${project.repo} to ${project.localPath}`);
            
            // Clone the repository
            execSync(`git clone --branch ${project.branch} --depth 1 "${project.repo}" "${project.localPath}"`, {
                stdio: 'inherit'
            });
            
            project.lastSync = new Date().toISOString();
            console.log(`Successfully cloned repository to ${project.localPath}`);
        } catch (error) {
            console.error('Failed to clone repository:', error.message);
            // Still create the project but note the error
            project.cloneError = error.message;
        }
    }
    
    projects.push(project);
    res.status(201).json(project);
});

app.get('/api/projects/:id', (req, res) => {
    const project = projects.find(p => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
});

app.put('/api/projects/:id', (req, res) => {
    const project = projects.find(p => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    Object.assign(project, req.body);
    res.json(project);
});

app.delete('/api/projects/:id', async (req, res) => {
    const index = projects.findIndex(p => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Project not found' });
    
    // Clean up cloned repository if it exists
    const project = projects[index];
    if (project.localPath) {
        try {
            await fs.rm(project.localPath, { recursive: true, force: true });
            console.log(`Cleaned up repository at ${project.localPath}`);
        } catch (error) {
            console.error('Failed to clean up repository:', error.message);
        }
    }
    
    projects.splice(index, 1);
    res.status(204).send();
});

// Sync (git pull) a project repository
app.post('/api/projects/:id/sync', async (req, res) => {
    const project = projects.find(p => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    if (!project.localPath) {
        return res.status(400).json({ error: 'Project has no local repository' });
    }
    
    try {
        console.log(`Syncing repository at ${project.localPath}`);
        execSync(`cd "${project.localPath}" && git pull origin ${project.branch}`, {
            stdio: 'inherit'
        });
        project.lastSync = new Date().toISOString();
        res.json({ message: 'Repository synced successfully', lastSync: project.lastSync });
    } catch (error) {
        console.error('Failed to sync repository:', error.message);
        res.status(500).json({ error: 'Failed to sync repository', details: error.message });
    }
});

// List files in a project directory
app.get('/api/projects/:id/files', async (req, res) => {
    const project = projects.find(p => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    if (!project.localPath) {
        return res.status(400).json({ error: 'Project has no local repository' });
    }
    
    const { path: subPath = '' } = req.query;
    const fullPath = path.join(project.localPath, subPath);
    
    try {
        // Security: ensure we're still within the project directory
        if (!fullPath.startsWith(project.localPath)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const stats = await fs.stat(fullPath);
        
        if (stats.isDirectory()) {
            const items = await fs.readdir(fullPath, { withFileTypes: true });
            const files = items
                .filter(item => !item.name.startsWith('.git'))
                .map(item => ({
                    name: item.name,
                    type: item.isDirectory() ? 'directory' : 'file',
                    path: path.join(subPath, item.name)
                }));
            res.json(files);
        } else {
            // It's a file, return its content
            const content = await fs.readFile(fullPath, 'utf-8');
            res.json({ 
                path: subPath, 
                content,
                size: stats.size,
                modified: stats.mtime
            });
        }
    } catch (error) {
        console.error('Failed to read files:', error.message);
        res.status(500).json({ error: 'Failed to read files', details: error.message });
    }
});

// Get project file tree for context
app.get('/api/projects/:id/tree', async (req, res) => {
    const project = projects.find(p => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    if (!project.localPath) {
        return res.status(400).json({ error: 'Project has no local repository' });
    }
    
    try {
        // Get a simple file tree (excluding .git and node_modules)
        const getTree = async (dir, basePath = '') => {
            const items = await fs.readdir(dir, { withFileTypes: true });
            const tree = [];
            
            for (const item of items) {
                if (item.name.startsWith('.git') || item.name === 'node_modules') continue;
                
                const itemPath = path.join(basePath, item.name);
                
                if (item.isDirectory()) {
                    const children = await getTree(path.join(dir, item.name), itemPath);
                    tree.push({
                        name: item.name,
                        type: 'directory',
                        path: itemPath,
                        children
                    });
                } else {
                    tree.push({
                        name: item.name,
                        type: 'file',
                        path: itemPath
                    });
                }
            }
            
            return tree;
        };
        
        const tree = await getTree(project.localPath);
        res.json({ projectId: project.id, tree });
    } catch (error) {
        console.error('Failed to get file tree:', error.message);
        res.status(500).json({ error: 'Failed to get file tree', details: error.message });
    }
});

// Tasks endpoints
app.get('/api/tasks', (req, res) => {
    const { projectId } = req.query;
    const result = projectId ? tasks.filter(t => t.projectId === projectId) : tasks;
    res.json(result);
});

app.post('/api/tasks', (req, res) => {
    const task = {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        description: req.body.description || '',
        projectId: req.body.projectId,
        status: req.body.status || 'backlog',
        createdAt: new Date().toISOString(),
        agentId: null,
        progress: 0
    };
    tasks.push(task);
    res.status(201).json(task);
});

app.patch('/api/tasks/:id', (req, res) => {
    const task = tasks.find(t => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    
    Object.assign(task, req.body);
    
    // Update timestamps
    if (req.body.status === 'working' && !task.startedAt) {
        task.startedAt = new Date().toISOString();
    } else if (req.body.status === 'review' && !task.completedAt) {
        task.completedAt = new Date().toISOString();
    } else if (req.body.status === 'pushed' && !task.pushedAt) {
        task.pushedAt = new Date().toISOString();
    }
    
    res.json(task);
});

app.delete('/api/tasks/:id', (req, res) => {
    const index = tasks.findIndex(t => t.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Task not found' });
    tasks.splice(index, 1);
    res.status(204).send();
});

app.post('/api/tasks/:id/approve', (req, res) => {
    const task = tasks.find(t => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    
    task.status = 'pushed';
    task.pushedAt = new Date().toISOString();
    task.commitMessage = req.body.commitMessage || 'Task completed';
    
    res.json({
        success: true,
        task: task,
        message: 'Task approved and pushed'
    });
});

app.get('/api/tasks/:id/changes', (req, res) => {
    res.json({
        diff: '+ Added new feature\n- Removed old code\n~ Modified configuration',
        files: ['src/app.js', 'config.json']
    });
});

// Git endpoints
app.get('/api/git/status', (req, res) => {
    res.json({
        branch: 'main',
        modified: [],
        untracked: [],
        staged: [],
        ahead: 0,
        behind: 0
    });
});

app.post('/api/git/commit', (req, res) => {
    res.json({
        success: true,
        commit: `commit-${Date.now()}`,
        message: req.body.message || 'Commit from Noderr'
    });
});

app.post('/api/git/push', (req, res) => {
    res.json({
        success: true,
        pushed: true,
        branch: 'main'
    });
});

// Brainstorming endpoints
app.get('/api/brainstorm/sessions', (req, res) => {
    const { projectId } = req.query;
    const result = projectId ? 
        brainstormSessions.filter(s => s.projectId === projectId) : 
        brainstormSessions;
    res.json(result);
});

app.post('/api/brainstorm/sessions', (req, res) => {
    const session = {
        id: `session-${Date.now()}`,
        projectId: req.body.projectId,
        title: req.body.title || 'New Brainstorm',
        messages: req.body.messages || [],
        context: req.body.context || {},
        generatedTasks: req.body.generatedTasks || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    brainstormSessions.push(session);
    res.status(201).json(session);
});

app.get('/api/brainstorm/sessions/:id', (req, res) => {
    const session = brainstormSessions.find(s => s.id === req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
});

app.put('/api/brainstorm/sessions/:id', (req, res) => {
    const session = brainstormSessions.find(s => s.id === req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    
    Object.assign(session, req.body, {
        updatedAt: new Date().toISOString()
    });
    res.json(session);
});

app.delete('/api/brainstorm/sessions/:id', (req, res) => {
    const index = brainstormSessions.findIndex(s => s.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Session not found' });
    brainstormSessions.splice(index, 1);
    res.status(204).send();
});

app.post('/api/brainstorm/analyze', async (req, res) => {
    const { message, context } = req.body;
    const { projectId } = context || {};
    
    // If we have a project with a cloned repo, use Claude CLI for brainstorming
    if (projectId) {
        const project = projects.find(p => p.id === projectId);
        if (project && project.localPath) {
            try {
                // Generate session ID
                const sessionId = `brainstorm-${projectId}-${Date.now()}`;
                
                // Start Claude brainstorm session
                console.log(`Starting Claude CLI brainstorm session for project ${projectId}`);
                
                // Execute the brainstorm script
                execSync(`./brainstorm-with-claude.sh "${projectId}" "${project.localPath}" "${message}" "${sessionId}"`, {
                    cwd: __dirname
                });
                
                // Return session info immediately (async brainstorming)
                res.json({
                    sessionId,
                    status: 'started',
                    message: 'Claude is analyzing your codebase. This may take a minute...',
                    checkUrl: `/api/brainstorm/sessions/${sessionId}/status`
                });
                return;
            } catch (error) {
                console.error('Failed to start Claude brainstorm session:', error.message);
                // Fall through to use API-based brainstorming
            }
        }
    }
    
    // Fallback: Try to use the OpenAI/GPT-5 module if available
    if (analyzeWithAI) {
        try {
            // Get basic context even without full file access
            let enhancedContext = { ...context };
            if (projectId) {
                const project = projects.find(p => p.id === projectId);
                if (project) {
                    enhancedContext.projectName = project.name;
                    enhancedContext.repository = project.repo;
                }
            }
            
            const result = await analyzeWithAI(message, enhancedContext);
            res.json(result);
            return;
        } catch (error) {
            console.error('AI analysis failed:', error.message);
        }
    }
    
    // Fallback to simple keyword-based response
    const lowerMessage = message.toLowerCase();
    let response = {
        analysis: 'Let me analyze your request...',
        tasks: [],
        clarifyingQuestions: [],
        assumptions: [],
        risks: []
    };
    
    if (lowerMessage.includes('feature') || lowerMessage.includes('add')) {
        response.analysis = 'I\'ll help you plan this new feature.';
        response.tasks = [
            {
                id: `task-${Date.now()}-1`,
                title: 'Research similar implementations',
                description: 'Look at how similar features are implemented',
                estimatedHours: 2,
                complexity: 'low',
                dependencies: [],
                status: 'suggested'
            },
            {
                id: `task-${Date.now()}-2`,
                title: 'Design the architecture',
                description: 'Create a detailed design',
                estimatedHours: 3,
                complexity: 'medium',
                dependencies: [0],
                status: 'suggested'
            }
        ];
        response.clarifyingQuestions = [
            'What is the expected scale of this feature?',
            'Are there any specific requirements?'
        ];
    } else if (lowerMessage.includes('bug') || lowerMessage.includes('fix')) {
        response.analysis = 'Let\'s systematically debug this issue.';
        response.tasks = [
            {
                id: `task-${Date.now()}-1`,
                title: 'Reproduce the bug',
                description: 'Create a reliable reproduction case',
                estimatedHours: 2,
                complexity: 'low',
                dependencies: [],
                status: 'suggested'
            },
            {
                id: `task-${Date.now()}-2`,
                title: 'Identify root cause',
                description: 'Debug and find the source of the issue',
                estimatedHours: 3,
                complexity: 'medium',
                dependencies: [0],
                status: 'suggested'
            }
        ];
        response.clarifyingQuestions = [
            'When did this issue start occurring?',
            'Can you reproduce it consistently?'
        ];
    } else {
        response.analysis = 'Let me break this down into manageable tasks.';
        response.tasks = [
            {
                id: `task-${Date.now()}-1`,
                title: 'Define requirements',
                description: 'Clarify what needs to be done',
                estimatedHours: 2,
                complexity: 'low',
                dependencies: [],
                status: 'suggested'
            }
        ];
    }
    
    res.json(response);
});

// Get brainstorm session status and results
app.get('/api/brainstorm/sessions/:sessionId/status', async (req, res) => {
    const { sessionId } = req.params;
    const outputDir = `/tmp/noderr-brainstorms/${sessionId}`;
    
    try {
        // Check if session info exists
        const sessionPath = path.join(outputDir, 'session.json');
        const sessionData = await fs.readFile(sessionPath, 'utf-8');
        const session = JSON.parse(sessionData);
        
        // Check if tasks.json has been created (indicates completion)
        const tasksPath = path.join(outputDir, 'tasks.json');
        try {
            const tasksData = await fs.readFile(tasksPath, 'utf-8');
            const tasks = JSON.parse(tasksData);
            
            // Session completed
            res.json({
                ...session,
                status: 'completed',
                result: tasks
            });
        } catch (e) {
            // Tasks not ready yet, check if tmux session is still running
            try {
                execSync(`tmux has-session -t ${sessionId} 2>/dev/null`);
                // Session still running
                res.json({
                    ...session,
                    status: 'running',
                    message: 'Claude is still analyzing your codebase...'
                });
            } catch (tmuxError) {
                // Session ended but no tasks generated (might have failed)
                res.json({
                    ...session,
                    status: 'failed',
                    error: 'Brainstorm session ended without generating tasks'
                });
            }
        }
    } catch (error) {
        res.status(404).json({
            error: 'Session not found',
            sessionId
        });
    }
});

// Get tmux session output (for debugging)
app.get('/api/brainstorm/sessions/:sessionId/output', async (req, res) => {
    const { sessionId } = req.params;
    
    try {
        // Capture tmux pane content
        const output = execSync(`tmux capture-pane -t ${sessionId} -p`, {
            encoding: 'utf-8',
            maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        });
        
        res.json({
            sessionId,
            output,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(404).json({
            error: 'Session not found or not running',
            sessionId
        });
    }
});

// Kill a brainstorm session
app.delete('/api/brainstorm/sessions/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    
    try {
        // Kill tmux session if running
        execSync(`tmux kill-session -t ${sessionId} 2>/dev/null`);
        console.log(`Killed brainstorm session: ${sessionId}`);
    } catch (e) {
        // Session might not exist, that's ok
    }
    
    // Clean up output directory
    const outputDir = `/tmp/noderr-brainstorms/${sessionId}`;
    try {
        await fs.rm(outputDir, { recursive: true, force: true });
    } catch (e) {
        // Directory might not exist
    }
    
    res.json({ message: 'Session terminated', sessionId });
});

// Status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        projects: projects.length,
        tasks: tasks.length,
        brainstormSessions: brainstormSessions.length
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// Serve frontend at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'docs', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Noderr Backend running on port ${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api`);
    console.log(`UI available at http://localhost:${PORT}`);
});