#!/bin/bash
# Install claunch and dependencies

echo "Installing claunch and dependencies..."

# Install system dependencies
apt-get update
apt-get install -y tmux python3-flask python3-flask-cors python3-requests curl

# Install claunch if not present
if [ ! -f /root/bin/claunch ]; then
    echo "Installing claunch..."
    curl -s https://raw.githubusercontent.com/0xkaz/claunch/main/install.sh | bash
    
    # Make sure it's in PATH
    export PATH=$PATH:/root/bin
    echo 'export PATH=$PATH:/root/bin' >> /root/.bashrc
fi

# Acknowledge claunch warning
touch /root/.claunch_warning_acknowledged

echo "Claunch installation complete"