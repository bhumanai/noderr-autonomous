# Claude CLI Authentication Flow Documentation

## Manual Authentication Process

1. **SSH into Fly.io machine:**
   ```bash
   fly ssh console -a uncle-frank-claude
   ```

2. **Switch to claude-user:**
   ```bash
   sudo -u claude-user -i
   ```

3. **Run Claude auth login:**
   ```bash
   claude auth login
   ```
   - This will provide an authentication URL
   - Visit the URL in a browser
   - Complete the authentication flow

4. **Verify authentication:**
   ```bash
   claude auth status
   ```

## Important: Running Claude CLI After Authentication

After authentication, Claude must be run with the `--dangerously-skip-permissions` flag to work properly in the container environment:

```bash
claude --dangerously-skip-permissions
```

## Tmux Session Setup

To run Claude in a persistent tmux session:

1. **Create or attach to tmux session:**
   ```bash
   sudo -u claude-user tmux new-session -s claude-code
   # OR attach to existing:
   sudo -u claude-user tmux attach -t claude-code
   ```

2. **Inside tmux, run Claude with permissions flag:**
   ```bash
   claude --dangerously-skip-permissions
   ```

## Automation Notes for Future Implementation

- Auth URL extraction patterns to look for in CLI output
- Device code flow may be available as alternative
- Need to handle interactive prompts in tmux session
- Store auth tokens in persistent storage (/data volume)
- Run all commands as claude-user for proper permissions