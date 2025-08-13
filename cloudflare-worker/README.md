# Noderr Orchestrator - Cloudflare Worker

Autonomous task orchestration for the Noderr system.

## Setup

1. **Install Wrangler CLI**:
```bash
npm install -g wrangler
```

2. **Login to Cloudflare**:
```bash
wrangler login
```

3. **Create KV Namespace**:
```bash
npm run create-kv
```
Copy the namespace ID and update `wrangler.toml`

4. **Set HMAC Secret**:
```bash
npm run set-secret
# Enter: test-secret-change-in-production
```

5. **Deploy Worker**:
```bash
npm run deploy
```

## Usage

### Dashboard
Visit your worker URL to access the web dashboard.

### API Endpoints

- `GET /` - Web dashboard
- `GET /api/status` - Get system status
- `POST /api/queue` - Queue a new command
- `GET /api/process` - Manually process queue

### Queue a Command
```bash
curl -X POST https://your-worker.workers.dev/api/queue \
  -H "Content-Type: application/json" \
  -d '{"command": "What is 2+2?"}'
```

## Automated Execution

The worker automatically:
- Processes the task queue every 5 minutes
- Cleans up old tasks every 6 hours

## Testing

1. Queue a test command via the dashboard
2. Wait for cron execution or manually trigger via `/api/process`
3. Check Fly.io logs for command execution
4. Monitor status via dashboard

## Architecture

```
CF Worker → Task Queue (KV) → Fly.io Injection → Claude CLI
```

## Troubleshooting

- Check worker logs: `npm run tail`
- Verify KV namespace is correctly configured
- Ensure HMAC secret matches Fly.io configuration
- Check Fly.io service is running and accessible