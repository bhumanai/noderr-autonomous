FROM ubuntu:22.04

# Prevent interactive prompts during installation
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

# Install system dependencies including sudo
RUN apt-get update && apt-get install -y \
    curl \
    git \
    tmux \
    python3 \
    python3-pip \
    supervisor \
    wget \
    ca-certificates \
    sudo \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip3 install --no-cache-dir \
    flask \
    flask-cors \
    gunicorn \
    requests

# Create app directory
WORKDIR /app

# Install Node.js 20.x for Claude Code CLI (includes npm)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Install Claude Code CLI - try multiple methods
RUN npm install -g @anthropic-ai/claude-code || \
    npm install -g claude || \
    (curl -fsSL https://claude.ai/install.sh | bash) || \
    (wget -qO- https://claude.ai/install.sh | bash) || \
    echo "Claude Code CLI installation failed - will retry in start script"

# Ensure claude binary is in PATH
RUN which claude || \
    ln -s /usr/local/bin/claude /usr/bin/claude || \
    ln -s /root/.local/bin/claude /usr/bin/claude || \
    echo "Claude binary not found yet"

# Create claude-user and workspace
RUN useradd -m -s /bin/bash claude-user && \
    mkdir -p /workspace && \
    chown -R claude-user:claude-user /workspace && \
    mkdir -p /home/claude-user/.config && \
    chown -R claude-user:claude-user /home/claude-user && \
    mkdir -p /data && \
    chown -R claude-user:claude-user /data

# Copy application files
COPY inject_agent_cors.py /app/inject_agent.py
COPY noderr_api.py /app/
COPY claude_auth_handler.py /app/
COPY claude_relay.py /app/
COPY completion_monitor.py /app/
COPY scripts/start.sh /app/
COPY scripts/start-claude-relay.sh /app/
COPY scripts/init-claude.sh /app/
COPY scripts/ensure-claude.sh /app/
COPY scripts/save-claude-config.sh /app/
COPY scripts/save-claude-auth.sh /app/
COPY scripts/restore-claude-auth.sh /app/
COPY scripts/healthcheck.sh /app/
COPY supervisor.conf /etc/supervisor/conf.d/

# Make scripts executable
RUN chmod +x /app/start.sh /app/start-claude-relay.sh /app/init-claude.sh /app/ensure-claude.sh /app/save-claude-config.sh /app/save-claude-auth.sh /app/restore-claude-auth.sh /app/healthcheck.sh

# Expose ports
EXPOSE 8080 8081 8084

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD /app/healthcheck.sh || exit 1

# Start supervisor
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]