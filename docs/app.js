// Noderr Fleet Command - Application Logic
'use strict';

// Configuration
const API_BASE = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL) 
    ? CONFIG.API_BASE_URL + '/api'
    : (window.location.hostname === 'localhost' 
        ? 'http://localhost:8787/api' 
        : 'https://uncle-frank-claude.fly.dev/api');

// Application State
const AppState = {
    currentProject: null,
    tasks: [],
    projects: [],
    eventSource: null,
    settings: {
        autoCommit: true,
        autoPush: true,
        soundNotifications: false,
        desktopNotifications: false
    }
};

// DOM Elements
const elements = {};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initializeElements();
    loadSettings();
    loadProjects();
    setupEventListeners();
    setupRealtimeUpdates();
    checkMobileView();
    requestNotificationPermission();
});

// Initialize DOM element references
function initializeElements() {
    elements.projectSelect = document.getElementById('projectSelect');
    elements.addProjectBtn = document.getElementById('addProjectBtn');
    elements.settingsBtn = document.getElementById('settingsBtn');
    elements.connectionStatus = document.getElementById('connectionStatus');
    
    // Task containers
    elements.backlogTasks = document.getElementById('backlogTasks');
    elements.readyTasks = document.getElementById('readyTasks');
    elements.workingTasks = document.getElementById('workingTasks');
    elements.reviewTasks = document.getElementById('reviewTasks');
    elements.pushedTasks = document.getElementById('pushedTasks');
    
    // Mobile elements
    elements.activeTaskMobile = document.getElementById('activeTaskMobile');
    elements.readyTasksMobile = document.getElementById('readyTasksMobile');
    elements.reviewTasksMobile = document.getElementById('reviewTasksMobile');
    
    // Modals
    elements.addTaskModal = document.getElementById('addTaskModal');
    elements.addProjectModal = document.getElementById('addProjectModal');
    elements.reviewTaskModal = document.getElementById('reviewTaskModal');
    elements.settingsModal = document.getElementById('settingsModal');
    
    // Counts
    elements.counts = {
        backlog: document.getElementById('backlogCount'),
        ready: document.getElementById('readyCount'),
        working: document.getElementById('workingCount'),
        review: document.getElementById('reviewCount'),
        pushed: document.getElementById('pushedCount'),
        readyMobile: document.getElementById('readyCountMobile'),
        reviewMobile: document.getElementById('reviewCountMobile')
    };
}

// Setup Event Listeners
function setupEventListeners() {
    // Project management
    elements.projectSelect.addEventListener('change', handleProjectChange);
    elements.addProjectBtn.addEventListener('click', () => showModal('addProjectModal'));
    
    // Task management
    document.getElementById('addTaskBtn')?.addEventListener('click', () => showModal('addTaskModal'));
    document.getElementById('addTaskMobileBtn')?.addEventListener('click', () => showModal('addTaskModal'));
    document.getElementById('saveTaskBtn').addEventListener('click', saveTask);
    
    // Project modal
    document.getElementById('saveProjectBtn').addEventListener('click', saveProject);
    document.getElementById('cancelProjectBtn').addEventListener('click', () => hideModal('addProjectModal'));
    
    // Task modal
    document.getElementById('saveTaskBtn').addEventListener('click', saveTask);
    document.getElementById('cancelTaskBtn').addEventListener('click', () => hideModal('addTaskModal'));
    
    // Review modal
    document.getElementById('approveTaskBtn').addEventListener('click', approveTask);
    document.getElementById('reviseTaskBtn').addEventListener('click', reviseTask);
    
    // Settings
    elements.settingsBtn.addEventListener('click', () => showModal('settingsModal'));
    document.getElementById('saveSettings').addEventListener('click', saveSettings);
    document.getElementById('closeSettings').addEventListener('click', () => hideModal('settingsModal'));
    
    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) hideModal(modal.id);
        });
    });
    
    // Template buttons
    document.querySelectorAll('.template-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const template = e.target.dataset.template;
            applyTaskTemplate(template);
        });
    });
    
    // Click outside modal to close
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) hideModal(modal.id);
        });
    });
}

// Project Management
async function loadProjects() {
    try {
        const response = await fetch(`${API_BASE}/projects`);
        if (!response.ok) {
            console.warn('API returned error, using mock data');
            AppState.projects = [
                { id: 'demo-1', name: 'Demo Project', repo: 'demo/repo', branch: 'main' }
            ];
            updateProjectDropdown();
            return;
        }
        
        AppState.projects = await response.json();
        updateProjectDropdown();
        
        // Auto-select first project or saved preference
        const savedProject = localStorage.getItem('selectedProject');
        if (savedProject && AppState.projects.find(p => p.id === savedProject)) {
            elements.projectSelect.value = savedProject;
            handleProjectChange();
        } else if (AppState.projects.length > 0) {
            elements.projectSelect.value = AppState.projects[0].id;
            handleProjectChange();
        }
    } catch (error) {
        console.error('Error loading projects:', error);
        // Use mock data on network error
        AppState.projects = [
            { id: 'demo-1', name: 'Demo Project', repo: 'demo/repo', branch: 'main' }
        ];
        updateProjectDropdown();
        showToast('Using offline mode - API unavailable', 'warning');
    }
}

function updateProjectDropdown() {
    elements.projectSelect.innerHTML = '<option value="">Select Project...</option>';
    AppState.projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name || project.repo;
        elements.projectSelect.appendChild(option);
    });
}

async function handleProjectChange() {
    const projectId = elements.projectSelect.value;
    if (!projectId) {
        AppState.currentProject = null;
        clearTasks();
        return;
    }
    
    AppState.currentProject = AppState.projects.find(p => p.id === projectId);
    localStorage.setItem('selectedProject', projectId);
    
    showLoading();
    await loadTasks();
    hideLoading();
}

async function saveProject() {
    const repo = document.getElementById('projectRepo').value.trim();
    const branch = document.getElementById('projectBranch').value.trim() || 'main';
    const name = document.getElementById('projectName').value.trim();
    
    if (!repo) {
        showToast('Repository is required', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ repo, branch, name: name || repo })
        });
        
        if (!response.ok) {
            // Create mock project locally
            const project = {
                id: `project-${Date.now()}`,
                name: name || repo,
                repo: repo,
                branch: branch
            };
            AppState.projects.push(project);
            updateProjectDropdown();
            elements.projectSelect.value = project.id;
            handleProjectChange();
            hideModal('addProjectModal');
            showToast('Project added (offline mode)', 'warning');
        } else {
            const project = await response.json();
            AppState.projects.push(project);
            updateProjectDropdown();
            
            // Select the new project
            elements.projectSelect.value = project.id;
            handleProjectChange();
            
            hideModal('addProjectModal');
            showToast('Project added successfully', 'success');
        }
        
        // Clear form
        document.getElementById('projectRepo').value = '';
        document.getElementById('projectBranch').value = 'main';
        document.getElementById('projectName').value = '';
    } catch (error) {
        console.error('Error adding project:', error);
        // Create mock project locally on network error
        const project = {
            id: `project-${Date.now()}`,
            name: name || repo,
            repo: repo,
            branch: branch
        };
        AppState.projects.push(project);
        updateProjectDropdown();
        elements.projectSelect.value = project.id;
        handleProjectChange();
        hideModal('addProjectModal');
        showToast('Project added (offline mode)', 'warning');
        
        // Clear form
        document.getElementById('projectRepo').value = '';
        document.getElementById('projectBranch').value = 'main';
        document.getElementById('projectName').value = '';
    }
}

// Task Management
async function loadTasks() {
    if (!AppState.currentProject) return;
    
    try {
        const response = await fetch(`${API_BASE}/tasks?projectId=${AppState.currentProject.id}`);
        if (!response.ok) {
            // Use empty task list in offline mode
            AppState.tasks = [];
            renderTasks();
            return;
        }
        
        AppState.tasks = await response.json();
        renderTasks();
    } catch (error) {
        console.error('Error loading tasks:', error);
        // Use empty task list on network error
        AppState.tasks = [];
        renderTasks();
        showToast('Working in offline mode', 'info');
    }
}

function renderTasks() {
    // Clear all containers
    const containers = ['backlog', 'ready', 'working', 'review', 'pushed'];
    containers.forEach(status => {
        const container = elements[`${status}Tasks`];
        if (container) container.innerHTML = '';
    });
    
    // Clear mobile containers
    elements.activeTaskMobile.innerHTML = '<p class="empty-state">No active task</p>';
    elements.readyTasksMobile.innerHTML = '';
    elements.reviewTasksMobile.innerHTML = '';
    
    // Group tasks by status
    const tasksByStatus = {
        backlog: [],
        ready: [],
        working: [],
        review: [],
        pushed: []
    };
    
    AppState.tasks.forEach(task => {
        if (tasksByStatus[task.status]) {
            tasksByStatus[task.status].push(task);
        }
    });
    
    // Render tasks for each status
    Object.entries(tasksByStatus).forEach(([status, tasks]) => {
        const container = elements[`${status}Tasks`];
        if (!container) return;
        
        tasks.forEach(task => {
            const taskCard = createTaskCard(task);
            container.appendChild(taskCard);
        });
        
        // Update counts
        if (elements.counts[status]) {
            elements.counts[status].textContent = tasks.length;
        }
    });
    
    // Update mobile views
    if (tasksByStatus.working.length > 0) {
        const activeTask = tasksByStatus.working[0];
        elements.activeTaskMobile.innerHTML = createMobileTaskCard(activeTask);
    }
    
    tasksByStatus.ready.forEach(task => {
        elements.readyTasksMobile.appendChild(createMobileTaskCard(task));
    });
    
    tasksByStatus.review.forEach(task => {
        elements.reviewTasksMobile.appendChild(createMobileTaskCard(task));
    });
    
    // Update mobile counts
    if (elements.counts.readyMobile) {
        elements.counts.readyMobile.textContent = tasksByStatus.ready.length;
    }
    if (elements.counts.reviewMobile) {
        elements.counts.reviewMobile.textContent = tasksByStatus.review.length;
    }
}

function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.dataset.taskId = task.id;
    
    if (task.status === 'working') {
        card.classList.add('task-active');
        card.innerHTML = `
            <div class="task-content">
                <p class="task-description">${escapeHtml(task.description)}</p>
                <div class="task-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${task.progress || 0}%"></div>
                    </div>
                    <span class="progress-text">${task.progress || 0}%</span>
                </div>
                <p class="task-meta">Agent: ${task.agentId || 'Unassigned'}</p>
            </div>
        `;
    } else if (task.status === 'review') {
        card.innerHTML = `
            <div class="task-content">
                <p class="task-description">${escapeHtml(task.description)}</p>
                <p class="task-meta">Completed: ${formatTime(task.completedAt)}</p>
                <div class="task-actions">
                    <button class="btn-small btn-success" onclick="reviewTask('${task.id}')">Review</button>
                </div>
            </div>
        `;
    } else {
        card.innerHTML = `
            <div class="task-content">
                <p class="task-description">${escapeHtml(task.description)}</p>
                ${task.status === 'pushed' ? `<p class="task-meta">Pushed: ${formatTime(task.pushedAt)}</p>` : ''}
            </div>
        `;
    }
    
    // Add click handler for task details
    card.addEventListener('click', (e) => {
        if (!e.target.matches('button')) {
            showTaskDetails(task);
        }
    });
    
    return card;
}

function createMobileTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'task-card-mobile';
    card.dataset.taskId = task.id;
    
    card.innerHTML = `
        <div class="task-content">
            <p class="task-description">${escapeHtml(task.description)}</p>
            ${task.status === 'working' ? `
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${task.progress || 0}%"></div>
                </div>
            ` : ''}
            ${task.status === 'review' ? `
                <button class="btn-small btn-success" onclick="reviewTask('${task.id}')">Review</button>
            ` : ''}
        </div>
    `;
    
    return card;
}

async function saveTask() {
    const description = document.getElementById('taskDescription').value.trim();
    if (!description) {
        showToast('Task description is required', 'error');
        return;
    }
    
    if (!AppState.currentProject) {
        showToast('Please select a project first', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectId: AppState.currentProject.id,
                description,
                status: 'backlog'
            })
        });
        
        if (!response.ok) throw new Error('Failed to create task');
        
        const task = await response.json();
        AppState.tasks.push(task);
        renderTasks();
        
        hideModal('addTaskModal');
        showToast('Task added to queue', 'success');
        
        // Clear form
        document.getElementById('taskDescription').value = '';
        
        // Auto-move to ready if no tasks are working
        const workingTasks = AppState.tasks.filter(t => t.status === 'working');
        if (workingTasks.length === 0) {
            moveTaskToReady(task.id);
        }
    } catch (error) {
        console.error('Error creating task:', error);
        showToast('Failed to create task', 'error');
    }
}

async function moveTaskToReady(taskId) {
    try {
        const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'ready' })
        });
        
        if (!response.ok) throw new Error('Failed to update task');
        
        const updatedTask = await response.json();
        const taskIndex = AppState.tasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            AppState.tasks[taskIndex] = updatedTask;
            renderTasks();
        }
    } catch (error) {
        console.error('Error updating task:', error);
    }
}

function applyTaskTemplate(template) {
    const input = document.getElementById('taskDescription');
    const templates = {
        bug: 'Fix bug: ',
        feature: 'Implement feature: ',
        docs: 'Update documentation: ',
        test: 'Add tests for: '
    };
    
    input.value = templates[template] || '';
    input.focus();
}

// Review functionality
window.reviewTask = function(taskId) {
    const task = AppState.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    document.getElementById('reviewTaskTitle').textContent = task.description;
    document.getElementById('reviewDuration').textContent = formatDuration(task.startedAt, task.completedAt);
    document.getElementById('reviewAgent').textContent = task.agentId || 'Unknown';
    document.getElementById('reviewChanges').textContent = task.changes || 'Loading changes...';
    document.getElementById('commitMessage').value = `Task: ${task.description}\n\nCompleted by Noderr Agent`;
    
    elements.reviewTaskModal.dataset.taskId = taskId;
    showModal('reviewTaskModal');
    
    // Load actual changes
    loadTaskChanges(taskId);
};

async function loadTaskChanges(taskId) {
    try {
        const response = await fetch(`${API_BASE}/tasks/${taskId}/changes`);
        if (!response.ok) throw new Error('Failed to load changes');
        
        const changes = await response.json();
        document.getElementById('reviewChanges').textContent = changes.diff || 'No changes recorded';
    } catch (error) {
        console.error('Error loading changes:', error);
        document.getElementById('reviewChanges').textContent = 'Failed to load changes';
    }
}

async function approveTask() {
    const taskId = elements.reviewTaskModal.dataset.taskId;
    const commitMessage = document.getElementById('commitMessage').value;
    
    if (!taskId) return;
    
    try {
        showLoading();
        
        // Approve and push
        const response = await fetch(`${API_BASE}/tasks/${taskId}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ commitMessage })
        });
        
        if (!response.ok) throw new Error('Failed to approve task');
        
        const result = await response.json();
        
        // Update task status
        const taskIndex = AppState.tasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            AppState.tasks[taskIndex].status = 'pushed';
            AppState.tasks[taskIndex].pushedAt = new Date().toISOString();
            renderTasks();
        }
        
        hideModal('reviewTaskModal');
        hideLoading();
        showToast('Task approved and pushed to GitHub', 'success');
    } catch (error) {
        console.error('Error approving task:', error);
        hideLoading();
        showToast('Failed to approve task', 'error');
    }
}

async function reviseTask() {
    const taskId = elements.reviewTaskModal.dataset.taskId;
    if (!taskId) return;
    
    try {
        const response = await fetch(`${API_BASE}/tasks/${taskId}/revise`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) throw new Error('Failed to revise task');
        
        // Update task status back to ready
        const taskIndex = AppState.tasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            AppState.tasks[taskIndex].status = 'ready';
            renderTasks();
        }
        
        hideModal('reviewTaskModal');
        showToast('Task sent back for revision', 'info');
    } catch (error) {
        console.error('Error revising task:', error);
        showToast('Failed to revise task', 'error');
    }
}

// Real-time Updates
function setupRealtimeUpdates() {
    if (AppState.eventSource) {
        AppState.eventSource.close();
    }
    
    AppState.eventSource = new EventSource(`${API_BASE}/sse`);
    
    AppState.eventSource.onopen = () => {
        updateConnectionStatus('connected');
    };
    
    AppState.eventSource.onerror = () => {
        updateConnectionStatus('disconnected');
        setTimeout(setupRealtimeUpdates, 5000); // Retry after 5 seconds
    };
    
    AppState.eventSource.addEventListener('task:created', (e) => {
        const task = JSON.parse(e.data);
        AppState.tasks.push(task);
        renderTasks();
        if (AppState.settings.soundNotifications) playSound('new');
        showToast(`New task: ${task.description}`, 'info');
    });
    
    AppState.eventSource.addEventListener('task:updated', (e) => {
        const updatedTask = JSON.parse(e.data);
        const taskIndex = AppState.tasks.findIndex(t => t.id === updatedTask.id);
        if (taskIndex !== -1) {
            AppState.tasks[taskIndex] = updatedTask;
            renderTasks();
            
            if (updatedTask.status === 'review') {
                showToast(`Task ready for review: ${updatedTask.description}`, 'success');
                if (AppState.settings.desktopNotifications) {
                    showDesktopNotification('Task Ready for Review', updatedTask.description);
                }
            }
        }
    });
    
    AppState.eventSource.addEventListener('task:completed', (e) => {
        const task = JSON.parse(e.data);
        const taskIndex = AppState.tasks.findIndex(t => t.id === task.id);
        if (taskIndex !== -1) {
            AppState.tasks[taskIndex] = task;
            renderTasks();
            showToast(`Task completed: ${task.description}`, 'success');
        }
    });
}

function updateConnectionStatus(status) {
    elements.connectionStatus.className = `status-indicator status-${status}`;
    elements.connectionStatus.title = status === 'connected' ? 'Connected' : 'Disconnected';
}

// Settings Management
function loadSettings() {
    const saved = localStorage.getItem('fleetSettings');
    if (saved) {
        AppState.settings = { ...AppState.settings, ...JSON.parse(saved) };
        applySettings();
    }
}

function applySettings() {
    document.getElementById('autoCommit').checked = AppState.settings.autoCommit;
    document.getElementById('autoPush').checked = AppState.settings.autoPush;
    document.getElementById('soundNotifications').checked = AppState.settings.soundNotifications;
    document.getElementById('desktopNotifications').checked = AppState.settings.desktopNotifications;
}

function saveSettings() {
    AppState.settings.autoCommit = document.getElementById('autoCommit').checked;
    AppState.settings.autoPush = document.getElementById('autoPush').checked;
    AppState.settings.soundNotifications = document.getElementById('soundNotifications').checked;
    AppState.settings.desktopNotifications = document.getElementById('desktopNotifications').checked;
    
    localStorage.setItem('fleetSettings', JSON.stringify(AppState.settings));
    hideModal('settingsModal');
    showToast('Settings saved', 'success');
}

// Utility Functions
function showModal(modalId) {
    document.getElementById(modalId).classList.add('modal-open');
    document.body.style.overflow = 'hidden';
}

function hideModal(modalId) {
    document.getElementById(modalId).classList.remove('modal-open');
    document.body.style.overflow = '';
}

function showLoading() {
    document.getElementById('loadingOverlay').classList.add('loading-visible');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('loading-visible');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('toast-show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('toast-show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showTaskDetails(task) {
    // Future: Show detailed task modal
    console.log('Task details:', task);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(timestamp) {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
}

function formatDuration(start, end) {
    if (!start || !end) return 'Unknown';
    const diff = new Date(end) - new Date(start);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes} minutes`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function checkMobileView() {
    const isMobile = window.innerWidth < 768;
    document.body.classList.toggle('mobile', isMobile);
}

function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function showDesktopNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            body,
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-72.png'
        });
    }
}

function playSound(type) {
    // Future: Add sound effects
    console.log('Play sound:', type);
}

// Handle window resize
window.addEventListener('resize', checkMobileView);

// Handle visibility change for reconnection
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && AppState.eventSource?.readyState === EventSource.CLOSED) {
        setupRealtimeUpdates();
    }
});

// Export for debugging
window.AppState = AppState;