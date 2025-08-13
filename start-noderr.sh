#!/bin/bash

# Noderr System Starter Script
# Automatically detects the best way to run the system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ASCII Art Banner
echo -e "${BLUE}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║    ███╗   ██╗ ██████╗ ██████╗ ███████╗██████╗ ██████╗       ║
║    ████╗  ██║██╔═══██╗██╔══██╗██╔════╝██╔══██╗██╔══██╗      ║
║    ██╔██╗ ██║██║   ██║██║  ██║█████╗  ██████╔╝██████╔╝      ║
║    ██║╚██╗██║██║   ██║██║  ██║██╔══╝  ██╔══██╗██╔══██╗      ║
║    ██║ ╚████║╚██████╔╝██████╔╝███████╗██║  ██║██║  ██║      ║
║    ╚═╝  ╚═══╝ ╚═════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝      ║
║                                                               ║
║           Autonomous Development System Launcher              ║
╚═══════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if port is available
port_available() {
    ! lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1
}

# Function to stop running services
cleanup() {
    echo -e "\n${YELLOW}Stopping Noderr services...${NC}"
    if [ -f ".noderr.pid" ]; then
        kill $(cat .noderr.pid) 2>/dev/null || true
        rm .noderr.pid
    fi
    pkill -f "python.*local-dev-server.py" 2>/dev/null || true
    docker-compose down 2>/dev/null || true
    echo -e "${GREEN}Services stopped.${NC}"
}

# Set up trap for cleanup on exit
trap cleanup EXIT

# Check prerequisites
echo -e "${BLUE}Checking system requirements...${NC}"

# Detect available runtime options
RUNTIME_OPTIONS=()

if command_exists docker && command_exists docker-compose; then
    RUNTIME_OPTIONS+=("docker")
    echo -e "${GREEN}✓${NC} Docker and Docker Compose found"
fi

if command_exists python3; then
    RUNTIME_OPTIONS+=("python")
    echo -e "${GREEN}✓${NC} Python 3 found"
fi

if command_exists node && command_exists npm; then
    RUNTIME_OPTIONS+=("node")
    echo -e "${GREEN}✓${NC} Node.js and npm found"
fi

# Check if required directories exist
if [ ! -d "docs" ]; then
    echo -e "${RED}✗${NC} docs/ directory not found"
    echo "Please run this script from the Noderr repository root"
    exit 1
fi

echo -e "${GREEN}✓${NC} Required directories found"

# Select runtime method
echo -e "\n${BLUE}Select how to run Noderr:${NC}"
echo "1) Local Python server (recommended for development)"
echo "2) Docker Compose (recommended for production-like environment)"
echo "3) Manual setup (show instructions only)"
echo "4) Check deployment status"

read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        # Python local server
        if ! command_exists python3; then
            echo -e "${RED}Python 3 is required but not installed${NC}"
            exit 1
        fi
        
        echo -e "\n${BLUE}Starting local development server...${NC}"
        
        # Check if ports are available
        for port in 8080 8081 8082; do
            if ! port_available $port; then
                echo -e "${YELLOW}Port $port is already in use${NC}"
                read -p "Kill existing process? (y/n): " kill_proc
                if [ "$kill_proc" = "y" ]; then
                    lsof -ti:$port | xargs kill -9 2>/dev/null || true
                else
                    echo "Please free up port $port and try again"
                    exit 1
                fi
            fi
        done
        
        # Start the server
        python3 local-dev-server.py &
        echo $! > .noderr.pid
        
        sleep 3
        
        echo -e "\n${GREEN}════════════════════════════════════════════════════════${NC}"
        echo -e "${GREEN}Noderr is running!${NC}"
        echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
        echo -e "UI Dashboard: ${BLUE}http://localhost:8080${NC}"
        echo -e "API Server:   ${BLUE}http://localhost:8081${NC}"
        echo -e "Mock Agent:   ${BLUE}http://localhost:8082${NC}"
        echo -e "\nPress Ctrl+C to stop"
        
        # Keep script running
        wait $(cat .noderr.pid)
        ;;
        
    2)
        # Docker Compose
        if ! command_exists docker || ! command_exists docker-compose; then
            echo -e "${RED}Docker and Docker Compose are required but not installed${NC}"
            echo "Install Docker: https://docs.docker.com/get-docker/"
            exit 1
        fi
        
        echo -e "\n${BLUE}Starting Docker Compose environment...${NC}"
        
        # Update config for Docker environment
        cat > docs/deploy-config.js << 'EOF'
const CONFIG = {
    API_BASE_URL: 'http://localhost:8081',
    FALLBACK_API: 'http://localhost:8082',
    SSE_ENDPOINT: 'http://localhost:8081/api/sse',
    ENVIRONMENT: 'docker',
    FEATURES: {
        GIT_INTEGRATION: true,
        AUTO_COMMIT: false,
        REAL_TIME_UPDATES: false
    }
};
EOF
        
        # Start Docker Compose
        docker-compose up -d
        
        echo -e "\n${GREEN}════════════════════════════════════════════════════════${NC}"
        echo -e "${GREEN}Noderr is running in Docker!${NC}"
        echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
        echo -e "UI Dashboard: ${BLUE}http://localhost:8080${NC}"
        echo -e "API Server:   ${BLUE}http://localhost:8081${NC}"
        echo -e "Mock Agent:   ${BLUE}http://localhost:8082${NC}"
        echo -e "\nRun 'docker-compose logs -f' to see logs"
        echo -e "Run 'docker-compose down' to stop"
        ;;
        
    3)
        # Manual setup instructions
        echo -e "\n${BLUE}Manual Setup Instructions${NC}"
        echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
        
        echo -e "\n${YELLOW}Option 1: Deploy to Cloud Providers${NC}"
        echo "1. Cloudflare Worker:"
        echo "   cd cloudflare-worker"
        echo "   wrangler deploy"
        echo ""
        echo "2. Fly.io App:"
        echo "   cd fly-app-uncle-frank"
        echo "   fly deploy"
        echo ""
        echo "3. UI to GitHub Pages:"
        echo "   git push origin main"
        echo "   Enable GitHub Pages from /docs folder"
        
        echo -e "\n${YELLOW}Option 2: Run Locally${NC}"
        echo "1. Start local server:"
        echo "   python3 local-dev-server.py"
        echo ""
        echo "2. Or use Docker:"
        echo "   docker-compose up"
        
        echo -e "\n${YELLOW}Option 3: Deploy to VPS${NC}"
        echo "1. Clone repository to VPS"
        echo "2. Install Docker"
        echo "3. Run: docker-compose up -d"
        echo "4. Configure nginx reverse proxy"
        ;;
        
    4)
        # Check deployment status
        echo -e "\n${BLUE}Checking deployment status...${NC}"
        
        # Check local services
        echo -e "\n${YELLOW}Local Services:${NC}"
        for port in 8080 8081 8082; do
            if curl -s http://localhost:$port > /dev/null 2>&1; then
                echo -e "${GREEN}✓${NC} Port $port is responding"
            else
                echo -e "${RED}✗${NC} Port $port is not responding"
            fi
        done
        
        # Check remote services
        echo -e "\n${YELLOW}Remote Services:${NC}"
        
        # Check Fly.io
        if curl -s https://uncle-frank-claude.fly.dev/health > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC} Fly.io app is running"
            health=$(curl -s https://uncle-frank-claude.fly.dev/health)
            echo "   $health" | head -c 80
            echo
        else
            echo -e "${RED}✗${NC} Fly.io app is not accessible"
        fi
        
        # Check if docs are ready for GitHub Pages
        if [ -f "docs/index.html" ] && [ -f "docs/app.js" ]; then
            echo -e "${GREEN}✓${NC} UI files ready for GitHub Pages deployment"
        else
            echo -e "${RED}✗${NC} UI files not found in docs/"
        fi
        
        # Check Docker
        if command_exists docker; then
            if docker ps > /dev/null 2>&1; then
                echo -e "${GREEN}✓${NC} Docker is running"
                containers=$(docker-compose ps 2>/dev/null | grep noderr | wc -l)
                if [ $containers -gt 0 ]; then
                    echo "   $containers Noderr containers running"
                fi
            else
                echo -e "${YELLOW}⚠${NC} Docker installed but daemon not running"
            fi
        fi
        ;;
        
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo -e "\n${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "For more information, see:"
echo -e "  • README.md"
echo -e "  • DEPLOYMENT.md"
echo -e "  • docs/git-integration.md"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"