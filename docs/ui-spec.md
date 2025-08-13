# Noderr Fleet Command UI Specification

## Overview
A mobile-first, Anthropic-inspired task management UI for orchestrating autonomous Noderr agents.

## UI-CORE-001: CloudFlare Pages Application

### UI-CORE-001.1: index.html
**Purpose**: Main application shell with responsive layout
**Requirements**:
- Single-page application structure
- Mobile viewport meta tags
- PWA manifest link
- Anthropic Inter font
- Semantic HTML5 structure

**Key Elements**:
- Project selector dropdown
- Task kanban columns (Backlog, Ready, Working, Review, Pushed)
- Add task modal
- Status indicator
- Settings panel

### UI-CORE-001.2: app.js
**Purpose**: Application logic and state management
**Requirements**:
- Vanilla JavaScript (no framework)
- Event-driven architecture
- Local state management
- API integration layer
- Real-time updates via SSE

**Core Functions**:
- `ProjectManager`: Handle project selection and context
- `TaskQueue`: Manage task CRUD operations
- `GitSync`: Handle GitHub operations
- `UIRenderer`: DOM manipulation and updates
- `RealtimeSync`: SSE connection management

### UI-CORE-001.3: style.css
**Purpose**: Anthropic-inspired visual design
**Design Tokens**:
```css
--color-primary: #000000;
--color-secondary: #666666;
--color-accent: #0066CC;
--color-success: #059669;
--color-warning: #D97706;
--color-error: #DC2626;
--color-bg: #FFFFFF;
--color-bg-secondary: #F9FAFB;
--font-family: 'Inter', system-ui, sans-serif;
--radius: 8px;
--shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
--shadow-md: 0 4px 6px rgba(0,0,0,0.07);
```

**Responsive Breakpoints**:
- Mobile: 320px - 767px
- Tablet: 768px - 1023px
- Desktop: 1024px+

### UI-CORE-001.4: manifest.json
**Purpose**: PWA configuration
**Features**:
- Installable app
- Offline capability
- App icons
- Theme colors
- Display mode: standalone

## CF-API-001: CloudFlare Worker API Extensions

### CF-API-001.1: /api/projects
**Methods**:
- GET: List all projects
- POST: Add new project
- PUT /:id: Update project settings
- DELETE /:id: Remove project

**Schema**:
```typescript
interface Project {
  id: string;
  name: string;
  repo: string;
  branch: string;
  isActive: boolean;
  lastSync: string;
  taskCount: number;
}
```

### CF-API-001.2: /api/tasks
**Enhanced Methods**:
- GET: List tasks with project filter
- POST: Create task with project context
- PATCH /:id: Update task status
- DELETE /:id: Remove task

**Enhanced Schema**:
```typescript
interface Task {
  id: string;
  projectId: string;
  description: string;
  status: 'backlog' | 'ready' | 'working' | 'review' | 'pushed';
  agentId?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  gitCommit?: string;
}
```

### CF-API-001.3: /api/git
**Methods**:
- POST /commit: Trigger commit for completed task
- POST /push: Push changes to GitHub
- GET /status: Get git status for project

### CF-API-001.4: /api/sse
**Purpose**: Server-sent events for real-time updates
**Events**:
- task:created
- task:updated
- task:completed
- agent:status
- git:pushed

## DATA-001: KV Storage Schema

### DATA-001.1: projects:{id}
```json
{
  "id": "proj_123",
  "name": "noderr-autonomous",
  "repo": "bhumanai/noderr-autonomous",
  "branch": "main",
  "githubToken": "encrypted_token",
  "isActive": true,
  "settings": {
    "autoCommit": true,
    "autoPush": true,
    "commitTemplate": "Task: {description}\n\nCompleted by Noderr Agent"
  }
}
```

### DATA-001.2: tasks:{id}
```json
{
  "id": "task_456",
  "projectId": "proj_123",
  "description": "Fix navigation bar on mobile",
  "prompt": "LOOP_1A: Fix navigation bar responsive issues on mobile devices",
  "status": "working",
  "agentId": "agent_2",
  "timestamps": {
    "created": "2024-01-15T10:00:00Z",
    "started": "2024-01-15T10:05:00Z",
    "completed": null
  },
  "git": {
    "branch": "fix-nav-mobile",
    "commit": null,
    "pushed": false
  }
}
```

## Interaction Flows

### Project Selection Flow
1. User opens UI
2. Sees project dropdown
3. Selects project
4. UI loads project context
5. Shows project-specific tasks
6. Updates agent context

### Task Creation Flow
1. User clicks "Add Task"
2. Modal appears
3. User enters description
4. Selects priority (optional)
5. Task added to backlog
6. Auto-moves to ready if queue empty

### Task Execution Flow
1. Task in ready queue
2. Agent picks up task
3. Status changes to "working"
4. Live progress updates via SSE
5. Task completes
6. Moves to review column
7. User approves
8. Auto-commit and push
9. Moves to pushed column

## Mobile Interactions

### Gestures
- Swipe right: Approve task
- Swipe left: Send back for revision
- Pull down: Refresh
- Long press: Task options
- Pinch: Overview mode

### Optimizations
- Touch targets: minimum 44x44px
- Thumb-reachable actions at bottom
- Single-hand operation
- Reduced animations for performance
- Offline queue for tasks

## Performance Requirements
- Initial load: < 2 seconds
- Time to interactive: < 3 seconds
- Lighthouse score: > 90
- Bundle size: < 100KB
- Works offline after first load

## Security Considerations
- API authentication via token
- HTTPS only
- XSS prevention
- CSRF protection
- Encrypted GitHub tokens
- Rate limiting

## Accessibility
- WCAG 2.1 AA compliance
- Keyboard navigation
- Screen reader support
- High contrast mode
- Focus indicators
- ARIA labels

## Browser Support
- Chrome/Edge 90+
- Safari 14+
- Firefox 88+
- Mobile Chrome/Safari
- PWA support on all platforms