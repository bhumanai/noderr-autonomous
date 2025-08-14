// Real AI Brainstorming with OpenAI GPT-4
// IMPORTANT: Set OPENAI_API_KEY environment variable in your deployment platform
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function callOpenAI(messages, model = 'gpt-4-turbo-preview') {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: model,
            messages: messages,
            temperature: 0.7,
            max_tokens: 2000,
            response_format: { type: "json_object" }
        })
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('OpenAI API error:', error);
        throw new Error('Failed to call OpenAI API');
    }

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
}

async function analyzeWithAI(userMessage, context = {}) {
    const systemPrompt = `You are an expert software architect and developer. 
Your task is to break down user requirements into actionable development tasks.

CRITICAL RULES:
1. Each task should take 2-4 hours to complete
2. Tasks should be specific and actionable (not vague like "research" or "implement")
3. Generate between 3-8 tasks depending on complexity
4. Order tasks by dependencies (foundational tasks first)
5. Include technical details in descriptions
6. Consider the user's tech stack if mentioned

Output JSON format:
{
  "analysis": "Brief analysis of what needs to be built",
  "tasks": [
    {
      "title": "Short task title",
      "description": "Detailed description of what to do",
      "estimatedHours": 2-4,
      "complexity": "low|medium|high",
      "dependencies": [], // Array of task indices this depends on
      "technicalDetails": "Specific technical implementation notes"
    }
  ],
  "clarifyingQuestions": ["Any questions to better understand requirements"],
  "assumptions": ["Any assumptions made about the implementation"],
  "risks": ["Potential challenges or concerns"]
}

GOOD TASK EXAMPLES:
- "Set up PostgreSQL database schema for user authentication"
- "Create JWT authentication middleware with refresh tokens"
- "Build login/signup React components with form validation"
- "Implement password reset flow with email verification"

BAD TASK EXAMPLES:
- "Make UI" (too vague)
- "Add button" (too small)
- "Build entire app" (too large)
- "Research" (not actionable)`;

    const userPrompt = `User request: "${userMessage}"

${context.techStack ? `Tech stack: ${context.techStack}` : ''}
${context.projectType ? `Project type: ${context.projectType}` : ''}
${context.existingCode ? `Existing patterns: ${context.existingCode}` : ''}

Break this down into specific, actionable tasks that each take 2-4 hours.`;

    try {
        const result = await callOpenAI([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ]);

        // Post-process to ensure quality
        result.tasks = result.tasks.map((task, index) => ({
            ...task,
            id: `task-${Date.now()}-${index}`,
            status: 'suggested',
            estimatedHours: task.estimatedHours || 3,
            dependencies: task.dependencies || [],
            approvalStatus: 'pending'
        }));

        // Sort by dependencies (tasks with no deps first)
        result.tasks.sort((a, b) => {
            if (a.dependencies.length === 0 && b.dependencies.length > 0) return -1;
            if (a.dependencies.length > 0 && b.dependencies.length === 0) return 1;
            return a.dependencies.length - b.dependencies.length;
        });

        return result;
    } catch (error) {
        console.error('Error in AI analysis:', error);
        // Fallback to a basic response
        return {
            analysis: "I'll help you break this down into manageable tasks.",
            tasks: generateFallbackTasks(userMessage),
            clarifyingQuestions: [
                "What's your current tech stack?",
                "Are there any specific requirements or constraints?",
                "What's the timeline for this project?"
            ],
            assumptions: [],
            risks: []
        };
    }
}

function generateFallbackTasks(message) {
    // Basic fallback when AI fails
    const lower = message.toLowerCase();
    
    if (lower.includes('auth') || lower.includes('login') || lower.includes('sso')) {
        return [
            {
                id: `task-${Date.now()}-1`,
                title: "Set up authentication database schema",
                description: "Create users table with fields for OAuth providers, add indexes for email and provider IDs",
                estimatedHours: 2,
                complexity: "medium",
                dependencies: [],
                status: 'suggested'
            },
            {
                id: `task-${Date.now()}-2`,
                title: "Implement OAuth provider integration",
                description: "Configure OAuth 2.0 flow with chosen provider (Google/GitHub), handle callbacks and token exchange",
                estimatedHours: 3,
                complexity: "high",
                dependencies: [0],
                status: 'suggested'
            },
            {
                id: `task-${Date.now()}-3`,
                title: "Create authentication API endpoints",
                description: "Build /auth/login, /auth/callback, /auth/logout, /auth/refresh endpoints with proper error handling",
                estimatedHours: 3,
                complexity: "medium",
                dependencies: [0, 1],
                status: 'suggested'
            },
            {
                id: `task-${Date.now()}-4`,
                title: "Build login UI components",
                description: "Create login form, SSO buttons, error messages, and loading states with proper UX",
                estimatedHours: 2,
                complexity: "low",
                dependencies: [2],
                status: 'suggested'
            }
        ];
    }
    
    // Generic fallback
    return [
        {
            id: `task-${Date.now()}-1`,
            title: "Define requirements and architecture",
            description: "Document the specific requirements, create a basic architecture diagram, identify key components",
            estimatedHours: 2,
            complexity: "low",
            dependencies: [],
            status: 'suggested'
        },
        {
            id: `task-${Date.now()}-2`,
            title: "Set up project foundation",
            description: "Initialize repository, set up build tools, configure linting and testing framework",
            estimatedHours: 2,
            complexity: "low",
            dependencies: [],
            status: 'suggested'
        },
        {
            id: `task-${Date.now()}-3`,
            title: "Implement core functionality",
            description: "Build the main feature based on requirements, focus on happy path first",
            estimatedHours: 4,
            complexity: "medium",
            dependencies: [0, 1],
            status: 'suggested'
        }
    ];
}

// Task validation and refinement
function validateTaskSize(task) {
    if (task.estimatedHours < 1) return { valid: false, reason: 'Too small - combine with another task' };
    if (task.estimatedHours > 6) return { valid: false, reason: 'Too large - break down further' };
    if (task.estimatedHours >= 2 && task.estimatedHours <= 4) return { valid: true, reason: 'Perfect size' };
    return { valid: true, reason: 'Acceptable size' };
}

function checkDependencies(tasks) {
    // Ensure no circular dependencies and all deps are valid
    const taskMap = new Map(tasks.map((t, i) => [i, t]));
    const visited = new Set();
    const recursionStack = new Set();
    
    function hasCycle(taskIndex, deps = []) {
        if (recursionStack.has(taskIndex)) return true;
        if (visited.has(taskIndex)) return false;
        
        visited.add(taskIndex);
        recursionStack.add(taskIndex);
        
        const task = taskMap.get(taskIndex);
        if (task && task.dependencies) {
            for (const dep of task.dependencies) {
                if (hasCycle(dep)) return true;
            }
        }
        
        recursionStack.delete(taskIndex);
        return false;
    }
    
    for (let i = 0; i < tasks.length; i++) {
        if (hasCycle(i)) {
            console.warn('Circular dependency detected');
            // Remove circular dependencies
            tasks[i].dependencies = [];
        }
    }
    
    return tasks;
}

// Export for use in API
module.exports = {
    analyzeWithAI,
    validateTaskSize,
    checkDependencies
};