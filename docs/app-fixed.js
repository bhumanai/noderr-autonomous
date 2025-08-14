// Noderr Fleet Command - Fixed Version with Local Storage
'use strict';

// Configuration - Point to the actual Fly.io backend
const API_BASE = 'https://uncle-frank-claude.fly.dev';
const HMAC_SECRET = 'test-secret-change-in-production';

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
    loadProjectsFromLocalStorage();
    setupEventListeners();
    checkConnection();
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
    elements.settingsModal = document.getElementById('settingsModal');
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
    
    // Project modal buttons
    const saveProjectBtn = document.getElementById('saveProjectBtn');
    if (saveProjectBtn) {
        saveProjectBtn.addEventListener('click', saveProject);
    }
    
    const cancelProjectBtn = document.getElementById('cancelProjectBtn');
    if (cancelProjectBtn) {
        cancelProjectBtn.addEventListener('click', () => hideModal('addProjectModal'));
    }
    
    // Settings
    if (elements.settingsBtn) {
        elements.settingsBtn.addEventListener('click', () => showModal('settingsModal'));
    }
}

// Load projects from localStorage
function loadProjectsFromLocalStorage() {
    try {
        const stored = localStorage.getItem('noderr_projects');
        if (stored) {
            AppState.projects = JSON.parse(stored);
            updateProjectDropdown();
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

// Update project dropdown
function updateProjectDropdown() {
    if (!elements.projectSelect) return;
    
    elements.projectSelect.innerHTML = '<option value="">Select Project...</option>';
    
    AppState.projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        elements.projectSelect.appendChild(option);
    });
}

// Handle project change
function handleProjectChange() {
    const projectId = elements.projectSelect.value;
    if (!projectId) {
        AppState.currentProject = null;
        return;
    }
    
    AppState.currentProject = AppState.projects.find(p => p.id === projectId);
    console.log('Selected project:', AppState.currentProject);
    
    // Load tasks for this project
    loadProjectTasks();
}

// Load tasks for current project
function loadProjectTasks() {
    if (!AppState.currentProject) return;
    
    // Load tasks from localStorage
    const tasksKey = `noderr_tasks_${AppState.currentProject.id}`;
    try {
        const stored = localStorage.getItem(tasksKey);
        if (stored) {
            AppState.tasks = JSON.parse(stored);
        } else {
            AppState.tasks = [];
        }
        renderTasks();
    } catch (error) {
        console.error('Error loading tasks:', error);
        AppState.tasks = [];
    }
}

// Render tasks
function renderTasks() {
    // Clear containers
    ['backlog', 'ready', 'working', 'review', 'pushed'].forEach(status => {
        const container = elements[`${status}Tasks`];
        if (container) container.innerHTML = '';
    });
    
    // Group and render tasks
    AppState.tasks.forEach(task => {
        const container = elements[`${task.status}Tasks`];
        if (container) {
            const card = createTaskCard(task);
            container.appendChild(card);
        }
    });
}

// Create task card
function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.innerHTML = `
        <h4>${task.title}</h4>
        <p>${task.description || ''}</p>
        <div class="task-meta">
            <span class="task-priority priority-${task.priority}">${task.priority}</span>
        </div>
    `;
    return card;
}

// Save project (Fixed version)
async function saveProject() {
    const repo = document.getElementById('projectRepo').value.trim();
    const branch = document.getElementById('projectBranch').value.trim() || 'main';
    const name = document.getElementById('projectName').value.trim();
    
    if (!repo) {
        showToast('Repository URL is required', 'error');
        return;
    }
    
    try {
        // Create project object
        const project = {
            id: Date.now().toString(),
            name: name || repo.split('/').pop().replace('.git', ''),
            repo: repo,
            branch: branch,
            status: 'ready',
            created: new Date().toISOString()
        };
        
        // Add to state and save
        AppState.projects.push(project);
        saveProjectsToLocalStorage();
        updateProjectDropdown();
        
        // Select the new project
        elements.projectSelect.value = project.id;
        handleProjectChange();
        
        // Try to clone on backend if Claude is authenticated
        try {
            const cloneCommand = `echo "Importing ${repo}"`;
            const signature = await generateSignature(cloneCommand);
            
            await fetch(`${API_BASE}/inject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    command: cloneCommand,
                    signature: signature
                })
            });
        } catch (error) {
            console.log('Backend not available, project saved locally');
        }
        
        hideModal('addProjectModal');
        showToast('Project added successfully!', 'success');
        
        // Clear form
        document.getElementById('projectRepo').value = '';
        document.getElementById('projectBranch').value = '';
        document.getElementById('projectName').value = '';
        
    } catch (error) {
        console.error('Error saving project:', error);
        showToast('Failed to add project: ' + error.message, 'error');
    }
}

// Generate HMAC signature
async function generateSignature(command) {
    const encoder = new TextEncoder();
    const data = encoder.encode(command);
    const key = encoder.encode(HMAC_SECRET);
    
    // Simple hash for demo (in production use proper HMAC)
    const msgBuffer = new TextEncoder().encode(command + HMAC_SECRET);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Check connection to backend
async function checkConnection() {
    try {
        const response = await fetch(`${API_BASE}/health`);
        const data = await response.json();
        
        if (data.claude_session) {
            updateConnectionStatus('connected', 'Claude Connected');
        } else {
            updateConnectionStatus('warning', 'Claude Not Authenticated');
        }
    } catch (error) {
        updateConnectionStatus('error', 'Backend Offline');
    }
}

// Update connection status
function updateConnectionStatus(status, message) {
    if (!elements.connectionStatus) return;
    
    elements.connectionStatus.className = `connection-status ${status}`;
    elements.connectionStatus.textContent = message;
}

// Modal functions
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
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

// Load settings
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

// Add styles for toast notifications
const style = document.createElement('style');
style.textContent = `
    .toast {
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 24px;
        background: #333;
        color: white;
        border-radius: 8px;
        opacity: 0;
        transform: translateY(20px);
        transition: all 0.3s ease;
        z-index: 10000;
    }
    .toast.show {
        opacity: 1;
        transform: translateY(0);
    }
    .toast-success { background: #10b981; }
    .toast-error { background: #ef4444; }
    .toast-warning { background: #f59e0b; }
    .connection-status {
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 500;
    }
    .connection-status.connected {
        background: #10b981;
        color: white;
    }
    .connection-status.warning {
        background: #f59e0b;
        color: white;
    }
    .connection-status.error {
        background: #ef4444;
        color: white;
    }
`;
document.head.appendChild(style);

console.log('Noderr Fleet Command - Fixed version loaded');