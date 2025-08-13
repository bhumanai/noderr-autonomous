#!/usr/bin/env python3
"""
Local test to simulate the command injection flow
This demonstrates how the system would work once deployed
"""

import subprocess
import time
import os
import hmac
import hashlib

def create_tmux_session():
    """Create a local tmux session for testing"""
    session_name = "test-claude"
    
    # Kill existing session if it exists
    subprocess.run(['tmux', 'kill-session', '-t', session_name], 
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    # Create new session with a simple echo responder
    # (In production, this would be claude-code CLI)
    subprocess.run([
        'tmux', 'new-session', '-d', '-s', session_name,
        'bash', '-c', 'echo "Claude simulator ready. Type commands:"; while read cmd; do echo "Claude: Processing \"$cmd\"..."; if [ "$cmd" = "1+1=?" ]; then echo "Claude: The answer is 2"; fi; done'
    ])
    
    print(f"✓ Created tmux session: {session_name}")
    return session_name

def inject_command(session_name, command):
    """Inject a command into the tmux session"""
    print(f"\n→ Injecting command: '{command}'")
    
    result = subprocess.run([
        'tmux', 'send-keys', '-t', session_name,
        command, 'Enter'
    ], capture_output=True, text=True)
    
    if result.returncode == 0:
        print("  ✓ Command injected successfully")
        return True
    else:
        print(f"  ✗ Failed to inject: {result.stderr}")
        return False

def get_session_output(session_name):
    """Capture the current tmux pane output"""
    result = subprocess.run([
        'tmux', 'capture-pane', '-t', session_name, '-p'
    ], capture_output=True, text=True)
    
    if result.returncode == 0:
        return result.stdout
    return None

def test_flow():
    """Test the complete injection flow"""
    print("=" * 60)
    print("LOCAL TEST: Command Injection Flow Simulation")
    print("=" * 60)
    print("\nThis simulates what would happen on Fly.io:")
    print("1. Claude Code CLI runs in tmux")
    print("2. We inject commands via tmux send-keys")
    print("3. Claude processes and responds")
    print("-" * 60)
    
    # Check if tmux is installed
    try:
        subprocess.run(['tmux', '-V'], capture_output=True, check=True)
    except:
        print("\n❌ tmux is not installed. Please install it first:")
        print("   macOS: brew install tmux")
        print("   Linux: apt-get install tmux")
        return
    
    # Create session
    session_name = create_tmux_session()
    time.sleep(1)
    
    # Show initial state
    print("\nInitial session output:")
    print("-" * 40)
    output = get_session_output(session_name)
    if output:
        print(output)
    print("-" * 40)
    
    # Inject our test command
    if inject_command(session_name, "1+1=?"):
        print("\n⏳ Waiting for response...")
        time.sleep(1)
        
        # Get response
        print("\nSession output after command:")
        print("-" * 40)
        output = get_session_output(session_name)
        if output:
            print(output)
            if "2" in output:
                print("-" * 40)
                print("\n✅ SUCCESS! The system works!")
                print("   Command was injected and processed correctly.")
        print("-" * 40)
    
    # Cleanup
    print(f"\n🧹 Cleaning up session '{session_name}'")
    subprocess.run(['tmux', 'kill-session', '-t', session_name], 
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    print("\n" + "=" * 60)
    print("PRODUCTION DEPLOYMENT")
    print("=" * 60)
    print("\nWhen deployed to Fly.io:")
    print("1. The Dockerfile creates a container with Claude Code CLI + tmux")
    print("2. inject_agent.py provides an HTTP API for command injection")
    print("3. Commands are authenticated with HMAC signatures")
    print("4. The CF Worker sends commands to the injection API")
    print("5. Claude processes autonomously based on pre-loaded decisions")
    print("\nTo deploy to Fly.io:")
    print("  cd fly-app")
    print("  ./deploy.sh")
    print("\nOr to use your existing app:")
    print("  fly deploy --app uncle-frank-claude")

if __name__ == "__main__":
    test_flow()