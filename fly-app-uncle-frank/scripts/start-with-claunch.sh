#!/bin/bash
# Start services with claunch for Claude management

echo "Starting services with claunch..."

# Install claunch if not present
if [ ! -f /root/bin/claunch ]; then
    echo "Installing claunch..."
    bash <(curl -s https://raw.githubusercontent.com/0xkaz/claunch/main/install.sh)
    source ~/.bashrc
fi

# Acknowledge claunch warning
touch ~/.claunch_warning_acknowledged

# Install Python dependencies
apt-get update
apt-get install -y python3-flask python3-flask-cors python3-requests tmux

# Start the simple relay service
cd /app
echo "Starting simple relay service..."
python3 claude_relay_simple.py &
RELAY_PID=$!

# Start the main API
echo "Starting main API..."
python3 noderr_api.py &
API_PID=$!

# Start claunch with Claude in tmux (using existing auth if available)
echo "Starting Claude with claunch..."
cd /app
export PROJECT_NAME="fly-app-uncle-frank"

# Check if we have a saved session
if [ -f ~/.claude_session_${PROJECT_NAME} ]; then
    echo "Found existing Claude session"
else
    echo "No existing session found, will need to authenticate"
fi

# Start claunch in tmux mode
/root/bin/claunch --tmux &

echo "Services started:"
echo "  - Simple Relay PID: $RELAY_PID"
echo "  - Main API PID: $API_PID"
echo "  - Claude managed by claunch in tmux"

# Keep the script running
wait