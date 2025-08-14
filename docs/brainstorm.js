// Brainstorming Mode for Noderr
class BrainstormManager {
    constructor() {
        this.currentSession = null;
        this.sessions = [];
        this.generatedTasks = [];
        this.contextData = {
            codebaseInsights: [],
            researchFindings: [],
            considerations: []
        };
        this.aiState = 'idle';
        // Initialize the advanced brainstorm engine
        this.engine = typeof BrainstormEngine !== 'undefined' ? new BrainstormEngine() : null;
        this.init();
    }

    init() {
        this.loadSessions();
        this.attachEventListeners();
        this.startNewSession();
    }

    attachEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // New session button
        const newSessionBtn = document.getElementById('newSessionBtn');
        if (newSessionBtn) {
            newSessionBtn.addEventListener('click', () => this.startNewSession());
        }

        // Send brainstorm message
        const sendBtn = document.getElementById('sendBrainstormBtn');
        const input = document.getElementById('brainstormInput');
        
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendMessage());
        }
        
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        // Tool buttons
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.toggleTool(e.target.dataset.tool));
        });

        // Export tasks button
        const exportBtn = document.getElementById('exportTasksBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportTasks());
        }

        // Refine tasks button
        const refineBtn = document.getElementById('refineTasksBtn');
        if (refineBtn) {
            refineBtn.addEventListener('click', () => this.refineTasks());
        }
    }

    switchTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        const kanbanView = document.getElementById('kanbanView');
        const brainstormView = document.getElementById('brainstormView');

        if (tab === 'brainstorm') {
            kanbanView.style.display = 'none';
            brainstormView.style.display = 'block';
        } else {
            kanbanView.style.display = 'block';
            brainstormView.style.display = 'none';
        }
    }

    async startNewSession() {
        const sessionId = `session-${Date.now()}`;
        this.currentSession = {
            id: sessionId,
            title: 'New Brainstorm',
            messages: [],
            context: {},
            tasks: [],
            createdAt: new Date().toISOString()
        };

        this.sessions.unshift(this.currentSession);
        this.saveSessions();
        this.renderSessions();
        this.clearChat();
        this.addAIMessage("Hi! Let's brainstorm your idea. Tell me what you want to build, and I'll help you think through every detail, research the codebase, and generate comprehensive tasks.");
    }

    loadSessions() {
        const saved = localStorage.getItem('brainstorm-sessions');
        if (saved) {
            this.sessions = JSON.parse(saved);
        }
    }

    saveSessions() {
        localStorage.setItem('brainstorm-sessions', JSON.stringify(this.sessions));
    }

    renderSessions() {
        const sessionsList = document.getElementById('sessionsList');
        if (!sessionsList) return;

        sessionsList.innerHTML = this.sessions.map(session => `
            <div class="session-item ${session.id === this.currentSession?.id ? 'active' : ''}" 
                 data-session-id="${session.id}">
                <strong>${session.title}</strong>
                <div style="font-size: 0.75rem; color: #666;">
                    ${new Date(session.createdAt).toLocaleDateString()}
                </div>
            </div>
        `).join('');

        sessionsList.querySelectorAll('.session-item').forEach(item => {
            item.addEventListener('click', () => this.loadSession(item.dataset.sessionId));
        });
    }

    loadSession(sessionId) {
        const session = this.sessions.find(s => s.id === sessionId);
        if (!session) return;

        this.currentSession = session;
        this.renderSessions();
        this.renderMessages();
        this.renderGeneratedTasks();
        this.renderContext();
    }

    clearChat() {
        const messagesDiv = document.getElementById('chatMessages');
        if (messagesDiv) {
            messagesDiv.innerHTML = '';
        }
    }

    async sendMessage() {
        const input = document.getElementById('brainstormInput');
        if (!input || !input.value.trim()) return;

        const message = input.value.trim();
        input.value = '';

        // Add user message
        this.addUserMessage(message);

        // Process with AI
        await this.processWithAI(message);
    }

    addUserMessage(text) {
        const messagesDiv = document.getElementById('chatMessages');
        if (!messagesDiv) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message user';
        messageDiv.innerHTML = `
            <div class="message-content">
                <strong>You</strong>
                <p>${this.escapeHtml(text)}</p>
            </div>
        `;
        messagesDiv.appendChild(messageDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;

        if (this.currentSession) {
            this.currentSession.messages.push({ type: 'user', text, timestamp: Date.now() });
            this.saveSessions();
        }
    }

    addAIMessage(text, isThinking = false) {
        const messagesDiv = document.getElementById('chatMessages');
        if (!messagesDiv) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message ai';
        
        if (isThinking) {
            messageDiv.innerHTML = `
                <div class="message-content thinking-indicator">
                    <span>🧠 Thinking deeply about your idea...</span>
                </div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="message-content">
                    <strong>🧠 Brainstorm AI</strong>
                    <p>${text}</p>
                </div>
            `;
        }
        
        messagesDiv.appendChild(messageDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;

        if (!isThinking && this.currentSession) {
            this.currentSession.messages.push({ type: 'ai', text, timestamp: Date.now() });
            this.saveSessions();
        }

        return messageDiv;
    }

    async processWithAI(userMessage) {
        // Show thinking indicator
        const thinkingDiv = this.addAIMessage('', true);

        try {
            let response;
            
            // Use advanced engine if available, otherwise fall back to simulation
            if (this.engine) {
                // Use the advanced BrainstormEngine for deep analysis
                const analysis = await this.engine.deepAnalyze(userMessage, this.contextData);
                response = {
                    message: analysis.message,
                    context: analysis.context,
                    tasks: analysis.tasks,
                    questions: analysis.questions
                };
            } else {
                // Fallback to simulation
                response = await this.simulateAIResponse(userMessage);
            }
            
            // Remove thinking indicator
            thinkingDiv.remove();
            
            // Add AI response
            this.addAIMessage(response.message);
            
            // If there are clarifying questions, add them
            if (response.questions && response.questions.length > 0) {
                const questionsMsg = '\n\nTo better understand your needs, can you clarify:\n' +
                    response.questions.slice(0, 3).map((q, i) => `${i + 1}. ${q}`).join('\n');
                this.addAIMessage(questionsMsg);
            }
            
            // Update context
            if (response.context) {
                this.updateContext(response.context);
            }
            
            // Generate tasks if appropriate
            if (response.tasks && response.tasks.length > 0) {
                this.addGeneratedTasks(response.tasks);
            }
            
            // Update session title if it's still "New Brainstorm"
            if (this.currentSession && this.currentSession.title === 'New Brainstorm') {
                this.currentSession.title = this.extractTitle(userMessage);
                this.renderSessions();
                this.saveSessions();
            }
        } catch (error) {
            console.error('Error in processWithAI:', error);
            thinkingDiv.remove();
            this.addAIMessage('Sorry, I encountered an error processing your request. Please try again.');
        }
    }

    async simulateAIResponse(userMessage) {
        // Simulate different types of AI responses based on keywords
        const lowerMessage = userMessage.toLowerCase();
        
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Check for different intents
        if (lowerMessage.includes('feature') || lowerMessage.includes('add') || lowerMessage.includes('build')) {
            return this.generateFeatureResponse(userMessage);
        } else if (lowerMessage.includes('bug') || lowerMessage.includes('fix') || lowerMessage.includes('error')) {
            return this.generateBugFixResponse(userMessage);
        } else if (lowerMessage.includes('refactor') || lowerMessage.includes('improve')) {
            return this.generateRefactorResponse(userMessage);
        } else {
            return this.generateGenericResponse(userMessage);
        }
    }

    generateFeatureResponse(userMessage) {
        const feature = this.extractFeatureName(userMessage);
        
        return {
            message: `Great idea! Let me help you think through implementing ${feature}. 

I have some clarifying questions:
1. What's the primary use case for this feature?
2. Who are the main users?
3. Are there any performance constraints?
4. Should this integrate with existing systems?

Let me research the codebase to understand the current architecture...`,
            context: {
                codebaseInsights: [
                    'Found existing authentication system in /src/auth',
                    'Database schema supports extensibility',
                    'API follows RESTful patterns'
                ],
                researchFindings: [
                    'Industry best practice: Progressive disclosure',
                    'Similar feature in competitor uses lazy loading',
                    'Consider GDPR compliance for user data'
                ],
                considerations: [
                    'Need to maintain backward compatibility',
                    'Consider mobile responsiveness',
                    'Plan for internationalization'
                ]
            },
            tasks: [
                {
                    description: `Research and document requirements for ${feature}`,
                    complexity: 'low',
                    dependencies: [],
                    estimatedTime: '30m'
                },
                {
                    description: `Design database schema changes for ${feature}`,
                    complexity: 'medium',
                    dependencies: ['task-1'],
                    estimatedTime: '1h'
                },
                {
                    description: `Create API endpoints for ${feature}`,
                    complexity: 'medium',
                    dependencies: ['task-2'],
                    estimatedTime: '2h'
                },
                {
                    description: `Implement frontend UI for ${feature}`,
                    complexity: 'high',
                    dependencies: ['task-3'],
                    estimatedTime: '3h'
                },
                {
                    description: `Add validation and error handling`,
                    complexity: 'medium',
                    dependencies: ['task-3', 'task-4'],
                    estimatedTime: '1h'
                },
                {
                    description: `Write unit tests for ${feature}`,
                    complexity: 'medium',
                    dependencies: ['task-5'],
                    estimatedTime: '1.5h'
                },
                {
                    description: `Write integration tests`,
                    complexity: 'medium',
                    dependencies: ['task-6'],
                    estimatedTime: '1h'
                },
                {
                    description: `Update documentation`,
                    complexity: 'low',
                    dependencies: ['task-7'],
                    estimatedTime: '30m'
                }
            ]
        };
    }

    generateBugFixResponse(userMessage) {
        return {
            message: `I understand you're dealing with a bug. Let me help you systematically debug and fix this issue.

First, let's gather more information:
1. When did this bug first appear?
2. Can you reproduce it consistently?
3. What's the expected vs actual behavior?
4. Are there any error messages in the console?

I'll analyze the codebase to identify potential root causes...`,
            context: {
                codebaseInsights: [
                    'Recent changes in error handling module',
                    'Potential race condition in async operations',
                    'Missing null checks in data processing'
                ],
                researchFindings: [
                    'Similar issue reported in framework GitHub',
                    'Known browser compatibility issue',
                    'Memory leak pattern detected'
                ],
                considerations: [
                    'Need regression testing',
                    'Check side effects of fix',
                    'Consider adding monitoring'
                ]
            },
            tasks: [
                {
                    description: 'Reproduce the bug in development environment',
                    complexity: 'low',
                    dependencies: [],
                    estimatedTime: '15m'
                },
                {
                    description: 'Add detailed logging to trace the issue',
                    complexity: 'low',
                    dependencies: ['task-1'],
                    estimatedTime: '20m'
                },
                {
                    description: 'Identify root cause through debugging',
                    complexity: 'medium',
                    dependencies: ['task-2'],
                    estimatedTime: '1h'
                },
                {
                    description: 'Implement the bug fix',
                    complexity: 'medium',
                    dependencies: ['task-3'],
                    estimatedTime: '45m'
                },
                {
                    description: 'Add test to prevent regression',
                    complexity: 'low',
                    dependencies: ['task-4'],
                    estimatedTime: '30m'
                },
                {
                    description: 'Test fix in multiple scenarios',
                    complexity: 'medium',
                    dependencies: ['task-5'],
                    estimatedTime: '30m'
                }
            ]
        };
    }

    generateRefactorResponse(userMessage) {
        return {
            message: `Good thinking about refactoring! Clean code is crucial for maintainability.

Let me analyze the codebase to identify:
1. Code duplication patterns
2. Complex functions that need simplification
3. Outdated patterns that could be modernized
4. Performance bottlenecks

What's your main goal with this refactor? Performance, readability, or preparing for new features?`,
            context: {
                codebaseInsights: [
                    'Found 5 instances of duplicated logic',
                    'Several functions exceed 50 lines',
                    'Opportunity to extract reusable components'
                ],
                researchFindings: [
                    'Modern pattern: Composition over inheritance',
                    'Consider SOLID principles',
                    'Potential for lazy loading implementation'
                ],
                considerations: [
                    'Maintain API compatibility',
                    'Plan incremental refactoring',
                    'Update tests alongside refactoring'
                ]
            },
            tasks: [
                {
                    description: 'Audit codebase for refactoring opportunities',
                    complexity: 'medium',
                    dependencies: [],
                    estimatedTime: '1h'
                },
                {
                    description: 'Create refactoring plan and priority list',
                    complexity: 'low',
                    dependencies: ['task-1'],
                    estimatedTime: '30m'
                },
                {
                    description: 'Extract common utilities into shared modules',
                    complexity: 'medium',
                    dependencies: ['task-2'],
                    estimatedTime: '1.5h'
                },
                {
                    description: 'Simplify complex functions',
                    complexity: 'high',
                    dependencies: ['task-3'],
                    estimatedTime: '2h'
                },
                {
                    description: 'Update and optimize imports',
                    complexity: 'low',
                    dependencies: ['task-4'],
                    estimatedTime: '20m'
                },
                {
                    description: 'Run performance benchmarks',
                    complexity: 'low',
                    dependencies: ['task-5'],
                    estimatedTime: '30m'
                }
            ]
        };
    }

    generateGenericResponse(userMessage) {
        return {
            message: `Interesting! Let me think about this more deeply. Can you provide more details about:
1. What problem are you trying to solve?
2. What's the desired outcome?
3. Are there any constraints or requirements?

The more context you provide, the better I can help you break this down into actionable tasks.`,
            context: {
                codebaseInsights: [],
                researchFindings: [],
                considerations: []
            },
            tasks: []
        };
    }

    extractTitle(message) {
        // Simple title extraction - take first few words
        const words = message.split(' ').slice(0, 5);
        return words.join(' ') + (message.split(' ').length > 5 ? '...' : '');
    }

    extractFeatureName(message) {
        // Try to extract feature name from message
        const patterns = [
            /add(?:ing)?\s+(?:a\s+)?(.+?)(?:\s+feature)?$/i,
            /build(?:ing)?\s+(?:a\s+)?(.+?)$/i,
            /implement(?:ing)?\s+(.+?)$/i,
            /creat(?:e|ing)\s+(?:a\s+)?(.+?)$/i
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match) {
                return match[1];
            }
        }

        return 'the new feature';
    }

    updateContext(context) {
        if (context.codebaseInsights) {
            this.contextData.codebaseInsights.push(...context.codebaseInsights);
        }
        if (context.researchFindings) {
            this.contextData.researchFindings.push(...context.researchFindings);
        }
        if (context.considerations) {
            this.contextData.considerations.push(...context.considerations);
        }

        this.renderContext();

        if (this.currentSession) {
            this.currentSession.context = this.contextData;
            this.saveSessions();
        }
    }

    renderContext() {
        const codebaseList = document.getElementById('codebaseInsights');
        const researchList = document.getElementById('researchFindings');
        const considerationsList = document.getElementById('considerations');

        if (codebaseList) {
            codebaseList.innerHTML = this.contextData.codebaseInsights
                .map(insight => `<li>• ${this.escapeHtml(insight)}</li>`)
                .join('');
        }

        if (researchList) {
            researchList.innerHTML = this.contextData.researchFindings
                .map(finding => `<li>• ${this.escapeHtml(finding)}</li>`)
                .join('');
        }

        if (considerationsList) {
            considerationsList.innerHTML = this.contextData.considerations
                .map(consideration => `<li>• ${this.escapeHtml(consideration)}</li>`)
                .join('');
        }
    }

    addGeneratedTasks(tasks) {
        tasks.forEach((task, index) => {
            task.id = `gen-task-${Date.now()}-${index}`;
        });

        this.generatedTasks.push(...tasks);
        this.renderGeneratedTasks();

        if (this.currentSession) {
            this.currentSession.tasks = this.generatedTasks;
            this.saveSessions();
        }
    }

    renderGeneratedTasks() {
        const tasksDiv = document.getElementById('generatedTasks');
        const countSpan = document.getElementById('taskGenCount');

        if (countSpan) {
            const approvedCount = this.generatedTasks.filter(t => t.approvalStatus === 'approved').length;
            countSpan.textContent = `${approvedCount}/${this.generatedTasks.length}`;
        }

        if (!tasksDiv) return;

        if (this.generatedTasks.length === 0) {
            tasksDiv.innerHTML = '<p class="empty-state">No tasks generated yet. Start brainstorming to generate tasks!</p>';
            return;
        }

        tasksDiv.innerHTML = this.generatedTasks.map((task, index) => `
            <div class="generated-task ${task.approvalStatus === 'approved' ? 'task-approved' : task.approvalStatus === 'rejected' ? 'task-rejected' : ''}">
                <div class="task-approval-controls">
                    <input type="checkbox" 
                           id="task-${task.id}" 
                           ${task.approvalStatus === 'approved' ? 'checked' : ''}
                           onchange="window.brainstormManager.toggleTaskApproval('${task.id}')"
                           class="task-checkbox">
                </div>
                <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="flex: 1;">
                            <strong>${this.escapeHtml(task.title || task.description)}</strong>
                            ${task.description && task.description !== task.title ? `
                                <div style="color: #666; font-size: 0.875rem; margin-top: 4px;">
                                    ${this.escapeHtml(task.description)}
                                </div>
                            ` : ''}
                            ${task.technicalDetails ? `
                                <div style="color: #888; font-size: 0.75rem; margin-top: 4px; font-style: italic;">
                                    📝 ${this.escapeHtml(task.technicalDetails)}
                                </div>
                            ` : ''}
                        </div>
                        <div style="text-align: right;">
                            <span class="task-complexity complexity-${task.complexity}">
                                ${task.complexity}
                            </span>
                            <div style="color: #666; font-size: 0.875rem; margin-top: 4px;">
                                ${task.estimatedHours || task.estimatedTime || '2-4'}h
                            </div>
                        </div>
                    </div>
                    ${task.dependencies && task.dependencies.length > 0 ? `
                        <div class="task-dependencies">
                            ⚡ Depends on: Task ${task.dependencies.map(d => d + 1).join(', ')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('');
        
        // Update export button state
        const exportBtn = document.getElementById('exportTasksBtn');
        if (exportBtn) {
            const approvedTasks = this.generatedTasks.filter(t => t.approvalStatus === 'approved');
            exportBtn.disabled = approvedTasks.length === 0;
            exportBtn.textContent = approvedTasks.length > 0 
                ? `📤 Export ${approvedTasks.length} Tasks to Kanban`
                : '📤 Export to Kanban';
        }
    }
    
    toggleTaskApproval(taskId) {
        const task = this.generatedTasks.find(t => t.id === taskId);
        if (task) {
            task.approvalStatus = task.approvalStatus === 'approved' ? 'pending' : 'approved';
            this.renderGeneratedTasks();
            this.saveSessions();
        }
    }
    
    approveAllTasks() {
        this.generatedTasks.forEach(task => {
            task.approvalStatus = 'approved';
        });
        this.renderGeneratedTasks();
        this.saveSessions();
    }
    
    rejectAllTasks() {
        this.generatedTasks.forEach(task => {
            task.approvalStatus = 'rejected';
        });
        this.renderGeneratedTasks();
        this.saveSessions();
    }

    async exportTasks() {
        // Only export approved tasks
        const approvedTasks = this.generatedTasks.filter(t => t.approvalStatus === 'approved');
        
        if (approvedTasks.length === 0) {
            this.showToast('No approved tasks to export. Please select tasks first.', 'warning');
            return;
        }

        // Get current project
        const projectSelect = document.getElementById('projectSelect');
        const projectId = projectSelect?.value;

        if (!projectId) {
            this.showToast('Please select a project first', 'warning');
            return;
        }

        try {
            // Export only approved tasks to the backlog
            for (const task of approvedTasks) {
                await this.createTask(projectId, task);
            }

            this.showToast(`Exported ${approvedTasks.length} approved tasks to backlog`, 'success');
            
            // Clear generated tasks after export
            this.generatedTasks = [];
            this.renderGeneratedTasks();
            
            // Switch to kanban view
            this.switchTab('kanban');
            
            // Trigger refresh of kanban board
            if (window.taskManager) {
                window.taskManager.loadTasks();
            }
        } catch (error) {
            console.error('Error exporting tasks:', error);
            this.showToast('Failed to export tasks', 'error');
        }
    }

    async createTask(projectId, taskData) {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                projectId: projectId,
                description: taskData.description,
                status: 'backlog',
                complexity: taskData.complexity || 'medium',
                estimatedTime: taskData.estimatedTime || '1h',
                dependencies: taskData.dependencies || [],
                phase: taskData.phase || null,
                skills: taskData.skills || [],
                risk: taskData.risk || 'low',
                priority: taskData.priority || 'medium',
                resources: taskData.resources || [],
                source: 'brainstorm'
            })
        });

        if (!response.ok) {
            throw new Error('Failed to create task');
        }

        return response.json();
    }

    async refineTasks() {
        if (this.generatedTasks.length === 0) {
            this.showToast('No tasks to refine', 'warning');
            return;
        }

        const thinkingDiv = this.addAIMessage('', true);

        try {
            // Simulate refining tasks
            await new Promise(resolve => setTimeout(resolve, 2000));

            thinkingDiv.remove();

            // Add more granular tasks
            const refinedTasks = [];
            for (const task of this.generatedTasks) {
                refinedTasks.push(task);
                
                // Add subtasks for complex tasks
                if (task.complexity === 'high' || task.complexity === 'medium') {
                    refinedTasks.push({
                        description: `Research best practices for: ${task.description}`,
                        complexity: 'low',
                        dependencies: [],
                        estimatedTime: '15m'
                    });
                    refinedTasks.push({
                        description: `Write tests for: ${task.description}`,
                        complexity: 'low',
                        dependencies: [task.id],
                        estimatedTime: '30m'
                    });
                }
            }

            this.generatedTasks = refinedTasks;
            this.renderGeneratedTasks();
            
            this.addAIMessage(`I've refined your tasks and added ${refinedTasks.length - this.generatedTasks.length} additional subtasks for better granularity. Each complex task now has research and testing phases.`);
            
        } catch (error) {
            thinkingDiv.remove();
            this.addAIMessage('Failed to refine tasks. Please try again.');
        }
    }

    toggleTool(tool) {
        const btn = document.querySelector(`.tool-btn[data-tool="${tool}"]`);
        if (!btn) return;

        btn.classList.toggle('active');

        switch(tool) {
            case 'research':
                this.triggerCodebaseResearch();
                break;
            case 'adversarial':
                this.triggerAdversarialAnalysis();
                break;
            case 'mindmap':
                this.showMindMap();
                break;
        }
    }

    async triggerCodebaseResearch() {
        this.addAIMessage('🔍 Researching codebase...');
        
        // Simulate codebase research
        setTimeout(() => {
            this.updateContext({
                codebaseInsights: [
                    'Found 23 React components in /src/components',
                    'API structure follows REST conventions',
                    'State management using Context API',
                    'Test coverage at 67%'
                ]
            });
            this.addAIMessage('Codebase research complete! I found relevant patterns and structures that will help guide our implementation.');
        }, 2000);
    }

    async triggerAdversarialAnalysis() {
        this.addAIMessage('⚔️ Running adversarial analysis with Red Team and Blue Team agents...');
        
        // Simulate adversarial analysis
        setTimeout(() => {
            this.updateContext({
                considerations: [
                    '🔴 Red Team: Potential SQL injection if inputs not sanitized',
                    '🔴 Red Team: Performance degradation with large datasets',
                    '🔵 Blue Team: Implement input validation at API layer',
                    '🔵 Blue Team: Add rate limiting to prevent abuse',
                    '👿 Devil\'s Advocate: Is this feature worth the complexity?'
                ]
            });
            this.addAIMessage('Adversarial analysis complete! Red Team identified potential vulnerabilities, Blue Team proposed mitigations, and Devil\'s Advocate questioned assumptions.');
        }, 3000);
    }

    showMindMap() {
        this.showToast('Mind map visualization coming soon!', 'info');
    }

    renderMessages() {
        const messagesDiv = document.getElementById('chatMessages');
        if (!messagesDiv || !this.currentSession) return;

        messagesDiv.innerHTML = this.currentSession.messages.map(msg => {
            if (msg.type === 'user') {
                return `
                    <div class="chat-message user">
                        <div class="message-content">
                            <strong>You</strong>
                            <p>${this.escapeHtml(msg.text)}</p>
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div class="chat-message ai">
                        <div class="message-content">
                            <strong>🧠 Brainstorm AI</strong>
                            <p>${msg.text}</p>
                        </div>
                    </div>
                `;
            }
        }).join('');

        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

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

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize brainstorm manager when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.brainstormManager = new BrainstormManager();
    });
} else {
    window.brainstormManager = new BrainstormManager();
}