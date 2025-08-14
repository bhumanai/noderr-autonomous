// Noderr Fleet Command - Standalone Version (Works Offline)
'use strict';

// Application State
const AppState = {
    currentProject: null,
    tasks: [],
    projects: [],
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
    console.log('Noderr Fleet Command - Starting...');
    initializeElements();
    loadSettings();
    loadProjectsFromLocalStorage();
    loadTasksFromLocalStorage();
    setupEventListeners();
    updateUI();
    showWelcomeIfNeeded();
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
    
    // Modals
    elements.addProjectModal = document.getElementById('addProjectModal');
    elements.addTaskModal = document.getElementById('addTaskModal');
    elements.settingsModal = document.getElementById('settingsModal');
    
    // Task counts
    elements.counts = {
        backlog: document.getElementById('backlogCount'),
        ready: document.getElementById('readyCount'),
        working: document.getElementById('workingCount'),
        review: document.getElementById('reviewCount'),
        pushed: document.getElementById('pushedCount')
    };
}

// Setup Event Listeners
function setupEventListeners() {
    // Project management
    if (elements.projectSelect) {
        elements.projectSelect.addEventListener('change', handleProjectChange);
    }
    if (elements.addProjectBtn) {
        elements.addProjectBtn.addEventListener('click', () => showModal('addProjectModal'));
    }
    
    // Add Task button
    const addTaskBtn = document.getElementById('addTaskBtn');
    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', () => {
            if (!AppState.currentProject) {
                showToast('Please select or create a project first', 'warning');
                return;
            }
            showModal('addTaskModal');
        });
    }
    
    // Project modal
    const saveProjectBtn = document.getElementById('saveProjectBtn');
    if (saveProjectBtn) {
        saveProjectBtn.addEventListener('click', saveProject);
    }
    const cancelProjectBtn = document.getElementById('cancelProjectBtn');
    if (cancelProjectBtn) {
        cancelProjectBtn.addEventListener('click', () => hideModal('addProjectModal'));
    }
    
    // Task modal
    const saveTaskBtn = document.getElementById('saveTaskBtn');
    if (saveTaskBtn) {
        saveTaskBtn.addEventListener('click', saveTask);
    }
    const cancelTaskBtn = document.getElementById('cancelTaskBtn');
    if (cancelTaskBtn) {
        cancelTaskBtn.addEventListener('click', () => hideModal('addTaskModal'));
    }
    
    // Settings
    if (elements.settingsBtn) {
        elements.settingsBtn.addEventListener('click', () => showModal('settingsModal'));
    }
    const saveSettingsBtn = document.getElementById('saveSettings');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', saveSettings);
    }
    const closeSettingsBtn = document.getElementById('closeSettings');
    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener('click', () => hideModal('settingsModal'));
    }
}

// Load projects from localStorage
function loadProjectsFromLocalStorage() {
    try {
        const stored = localStorage.getItem('noderr_projects');
        if (stored) {
            AppState.projects = JSON.parse(stored);
        } else {
            AppState.projects = [];
        }
    } catch (error) {
        console.error('Error loading projects:', error);
        AppState.projects = [];
    }
}

// Save projects to localStorage
function saveProjectsToLocalStorage() {
    try {
        localStorage.setItem('noderr_projects', JSON.stringify(AppState.projects));
    } catch (error) {
        console.error('Error saving projects:', error);
    }
}

// Load tasks from localStorage
function loadTasksFromLocalStorage() {
    if (!AppState.currentProject) {
        AppState.tasks = [];
        return;
    }
    
    try {
        const key = `noderr_tasks_${AppState.currentProject.id}`;
        const stored = localStorage.getItem(key);
        if (stored) {
            AppState.tasks = JSON.parse(stored);
        } else {
            AppState.tasks = [];
        }
    } catch (error) {
        console.error('Error loading tasks:', error);
        AppState.tasks = [];
    }
}

// Save tasks to localStorage
function saveTasksToLocalStorage() {
    if (!AppState.currentProject) return;
    
    try {
        const key = `noderr_tasks_${AppState.currentProject.id}`;
        localStorage.setItem(key, JSON.stringify(AppState.tasks));
    } catch (error) {
        console.error('Error saving tasks:', error);
    }
}

// Update UI
function updateUI() {
    updateProjectDropdown();
    renderTasks();
    updateConnectionStatus();
    updateCounts();
}

// Update project dropdown
function updateProjectDropdown() {
    if (!elements.projectSelect) return;
    
    elements.projectSelect.innerHTML = '<option value="">Select Project...</option>';
    
    AppState.projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        if (AppState.currentProject && AppState.currentProject.id === project.id) {
            option.selected = true;
        }
        elements.projectSelect.appendChild(option);
    });
}

// Handle project change
function handleProjectChange() {
    const projectId = elements.projectSelect.value;
    if (!projectId) {
        AppState.currentProject = null;
        AppState.tasks = [];
        renderTasks();
        return;
    }
    
    AppState.currentProject = AppState.projects.find(p => p.id === projectId);
    loadTasksFromLocalStorage();
    renderTasks();
    showToast(`Switched to project: ${AppState.currentProject.name}`, 'info');
}

// Save project
async function saveProject() {
    const repo = document.getElementById('projectRepo').value.trim();
    const branch = document.getElementById('projectBranch').value.trim() || 'main';
    const name = document.getElementById('projectName').value.trim();
    
    if (!repo) {
        showToast('Repository URL is required', 'error');
        return;
    }
    
    // Extract project name from repo URL if not provided
    let projectName = name;
    if (!projectName) {
        const parts = repo.split('/');
        projectName = parts[parts.length - 1].replace('.git', '');
    }
    
    // Create project
    const project = {
        id: Date.now().toString(),
        name: projectName,
        repo: repo,
        branch: branch,
        created: new Date().toISOString(),
        status: 'active'
    };
    
    // Add to state and save
    AppState.projects.push(project);
    saveProjectsToLocalStorage();
    
    // Select the new project
    AppState.currentProject = project;
    updateUI();
    
    // Clear form
    document.getElementById('projectRepo').value = '';
    document.getElementById('projectBranch').value = '';
    document.getElementById('projectName').value = '';
    
    hideModal('addProjectModal');
    showToast(`Project "${projectName}" created successfully!`, 'success');
}

// Save task
function saveTask() {
    const title = document.getElementById('taskTitle').value.trim();
    const description = document.getElementById('taskDescription').value.trim();
    const priority = document.getElementById('taskPriority').value;
    const assignee = document.getElementById('taskAssignee').value.trim();
    
    if (!title) {
        showToast('Task title is required', 'error');
        return;
    }
    
    if (!AppState.currentProject) {
        showToast('Please select a project first', 'error');
        return;
    }
    
    // Create task
    const task = {
        id: Date.now().toString(),
        title: title,
        description: description,
        priority: priority,
        assignee: assignee || 'Unassigned',
        status: 'backlog',
        created: new Date().toISOString(),
        projectId: AppState.currentProject.id
    };
    
    // Add to state and save
    AppState.tasks.push(task);
    saveTasksToLocalStorage();
    renderTasks();
    
    // Clear form
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskDescription').value = '';
    document.getElementById('taskPriority').value = 'medium';
    document.getElementById('taskAssignee').value = '';
    
    hideModal('addTaskModal');
    showToast(`Task "${title}" added to backlog`, 'success');
}

// Render tasks
function renderTasks() {
    // Clear all containers
    ['backlog', 'ready', 'working', 'review', 'pushed'].forEach(status => {
        const container = elements[`${status}Tasks`];
        if (container) {
            container.innerHTML = '';
        }
    });
    
    if (!AppState.currentProject) {
        updateCounts();
        return;
    }
    
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
        
        if (tasks.length === 0) {
            container.innerHTML = `<p class="empty-state">No tasks</p>`;
        } else {
            tasks.forEach(task => {
                const card = createTaskCard(task);
                container.appendChild(card);
            });
        }
    });
    
    updateCounts();
}

// Create task card
function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.draggable = true;
    card.dataset.taskId = task.id;
    
    card.innerHTML = `
        <div class="task-header">
            <h4>${task.title}</h4>
            <span class="task-priority priority-${task.priority}">${task.priority}</span>
        </div>
        ${task.description ? `<p class="task-description">${task.description}</p>` : ''}
        <div class="task-meta">
            <span class="task-assignee">${task.assignee}</span>
            <div class="task-actions">
                <button onclick="moveTask('${task.id}', 'next')" title="Move to next stage">→</button>
                <button onclick="deleteTask('${task.id}')" title="Delete task">×</button>
            </div>
        </div>
    `;
    
    // Add drag and drop handlers
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);
    
    return card;
}

// Move task to next stage
window.moveTask = function(taskId, direction) {
    const task = AppState.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const stages = ['backlog', 'ready', 'working', 'review', 'pushed'];
    const currentIndex = stages.indexOf(task.status);
    
    if (direction === 'next' && currentIndex < stages.length - 1) {
        task.status = stages[currentIndex + 1];
        saveTasksToLocalStorage();
        renderTasks();
        showToast(`Task moved to ${task.status}`, 'info');
    }
};

// Delete task
window.deleteTask = function(taskId) {
    if (confirm('Delete this task?')) {
        AppState.tasks = AppState.tasks.filter(t => t.id !== taskId);
        saveTasksToLocalStorage();
        renderTasks();
        showToast('Task deleted', 'info');
    }
};

// Drag and drop handlers
function handleDragStart(e) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.innerHTML);
    e.target.classList.add('dragging');
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
}

// Update counts
function updateCounts() {
    const counts = {
        backlog: 0,
        ready: 0,
        working: 0,
        review: 0,
        pushed: 0
    };
    
    AppState.tasks.forEach(task => {
        if (counts.hasOwnProperty(task.status)) {
            counts[task.status]++;
        }
    });
    
    Object.entries(counts).forEach(([status, count]) => {
        if (elements.counts[status]) {
            elements.counts[status].textContent = count;
        }
    });
}

// Update connection status
function updateConnectionStatus() {
    if (elements.connectionStatus) {
        elements.connectionStatus.className = 'connection-status local';
        elements.connectionStatus.textContent = 'Local Storage Mode';
    }
}

// Settings functions
function loadSettings() {
    try {
        const stored = localStorage.getItem('noderr_settings');
        if (stored) {
            AppState.settings = { ...AppState.settings, ...JSON.parse(stored) };
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

function saveSettings() {
    // Get settings from form
    const autoCommit = document.getElementById('autoCommit')?.checked;
    const autoPush = document.getElementById('autoPush')?.checked;
    
    AppState.settings.autoCommit = autoCommit;
    AppState.settings.autoPush = autoPush;
    
    try {
        localStorage.setItem('noderr_settings', JSON.stringify(AppState.settings));
        showToast('Settings saved', 'success');
        hideModal('settingsModal');
    } catch (error) {
        showToast('Failed to save settings', 'error');
    }
}

// Modal functions
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        // Focus first input
        const firstInput = modal.querySelector('input, textarea');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Toast notifications
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Show welcome message if first time
function showWelcomeIfNeeded() {
    if (AppState.projects.length === 0) {
        setTimeout(() => {
            showToast('Welcome to Noderr! Click "+" to add your first project.', 'info');
        }, 1000);
    }
}

// Add custom styles
const style = document.createElement('style');
style.textContent = `
    .toast {
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 16px 24px;
        background: #1a1a2e;
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        opacity: 0;
        transform: translateY(20px);
        transition: all 0.3s ease;
        z-index: 10000;
        max-width: 400px;
    }
    .toast.show {
        opacity: 1;
        transform: translateY(0);
    }
    .toast-success {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    }
    .toast-error {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    }
    .toast-warning {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    }
    .toast-info {
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    }
    .connection-status {
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 500;
        background: #4a5568;
        color: white;
    }
    .connection-status.local {
        background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
    }
    .empty-state {
        text-align: center;
        color: #6b7280;
        padding: 20px;
        font-style: italic;
    }
    .task-card {
        transition: all 0.2s ease;
        cursor: move;
    }
    .task-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .task-card.dragging {
        opacity: 0.5;
    }
    .task-actions {
        display: flex;
        gap: 8px;
    }
    .task-actions button {
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.2);
        color: #9ca3af;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
    }
    .task-actions button:hover {
        background: rgba(255,255,255,0.2);
        color: white;
    }
    .modal {
        animation: fadeIn 0.3s ease;
    }
    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: scale(0.95);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }
`;
document.head.appendChild(style);

console.log('Noderr Fleet Command - Standalone version loaded successfully!');