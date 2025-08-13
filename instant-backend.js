// Instant Backend for Noderr - Deploy to any Node.js host
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());

// Serve static files from docs directory
app.use(express.static(path.join(__dirname, 'docs')));

// In-memory storage
let projects = [];
let tasks = [];

// Projects endpoints
app.get('/api/projects', (req, res) => {
    res.json(projects);
});

app.post('/api/projects', (req, res) => {
    const project = {
        id: `project-${Date.now()}`,
        name: req.body.name || 'Unnamed Project',
        repo: req.body.repo || '',
        branch: req.body.branch || 'main',
        createdAt: new Date().toISOString()
    };
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

app.delete('/api/projects/:id', (req, res) => {
    const index = projects.findIndex(p => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Project not found' });
    projects.splice(index, 1);
    res.status(204).send();
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

// Status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        projects: projects.length,
        tasks: tasks.length
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