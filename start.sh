#!/bin/bash

# AI Personalized Tutor - Startup Script
# This script sets up the database, seeds data, and starts the application with hot-reload

set -e

echo "=========================================="
echo "   AI Personalized Tutor - Setup Script"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    print_status "Loaded environment variables from .env"
else
    print_error ".env file not found. Creating default .env file..."
    cat > .env << 'EOF'
# OpenRouter API Configuration
OPENROUTER_API_KEY="your_openrouter_api_key_here"
OPENROUTER_MODEL="anthropic/claude-haiku-4.5"

# Database Configuration
DATABASE_URL=postgresql://tutor_user:tutor_password@localhost:5432/ai_tutor_db
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_tutor_db
DB_USER=tutor_user
DB_PASSWORD=tutor_password

# Backend Configuration
BACKEND_PORT=3001
NODE_ENV=development

# Frontend Configuration
VITE_API_URL=http://localhost:3001/api

# JWT Secret
JWT_SECRET=your_super_secret_jwt_key_change_in_production
EOF
    export $(cat .env | grep -v '^#' | xargs)
    print_warning "Created default .env file. Please update OPENROUTER_API_KEY!"
fi

# Set default values if not in .env
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-ai_tutor_db}
DB_USER=${DB_USER:-tutor_user}
DB_PASSWORD=${DB_PASSWORD:-tutor_password}
BACKEND_PORT=${BACKEND_PORT:-3001}
FRONTEND_PORT=3000

# Function to kill process on port
kill_port() {
    local port=$1
    local pid=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$pid" ]; then
        print_warning "Killing process on port $port (PID: $pid)"
        kill -9 $pid 2>/dev/null || true
        sleep 1
    fi
}

# Clean up common ports that might interfere
print_status "Cleaning up ports..."
kill_port $BACKEND_PORT
kill_port $FRONTEND_PORT
kill_port 5173  # Vite default
kill_port 5174  # Vite alternate
kill_port 4173  # Vite preview
print_success "Ports cleaned"

# Check if PostgreSQL is running
print_status "Checking PostgreSQL connection..."
if ! pg_isready -h $DB_HOST -p $DB_PORT > /dev/null 2>&1; then
    print_warning "PostgreSQL is not running. Attempting to start..."

    # Try to start PostgreSQL (macOS)
    if command -v brew &> /dev/null; then
        brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null || true
        sleep 3
    fi

    # Check again
    if ! pg_isready -h $DB_HOST -p $DB_PORT > /dev/null 2>&1; then
        print_error "Could not connect to PostgreSQL. Please start it manually."
        print_status "On macOS: brew services start postgresql"
        print_status "On Linux: sudo systemctl start postgresql"
        exit 1
    fi
fi
print_success "PostgreSQL is running"

# Create database user if not exists
print_status "Setting up database user..."
psql -h $DB_HOST -p $DB_PORT -U postgres -tc "SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER'" 2>/dev/null | grep -q 1 || \
    psql -h $DB_HOST -p $DB_PORT -U postgres -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD' CREATEDB;" 2>/dev/null || \
    print_warning "User may already exist or you may need to create it manually"

# Create database if not exists
print_status "Setting up database..."
psql -h $DB_HOST -p $DB_PORT -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" 2>/dev/null | grep -q 1 || \
    psql -h $DB_HOST -p $DB_PORT -U postgres -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || \
    print_warning "Database may already exist or you may need to create it manually"

# Grant privileges
psql -h $DB_HOST -p $DB_PORT -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true
print_success "Database setup complete"

# Install backend dependencies
print_status "Installing backend dependencies..."
cd "$SCRIPT_DIR/backend"
npm install --silent
print_success "Backend dependencies installed"

# Install frontend dependencies
print_status "Installing frontend dependencies..."
cd "$SCRIPT_DIR/frontend"
npm install --silent
print_success "Frontend dependencies installed"

# Seed the database
print_status "Seeding database with sample data..."
cd "$SCRIPT_DIR/backend"
npm run seed 2>&1 | tail -20
print_success "Database seeded successfully"

# Start backend server with nodemon (hot-reload)
print_status "Starting backend server on port $BACKEND_PORT with hot-reload..."
cd "$SCRIPT_DIR/backend"
npm run dev > backend.log 2>&1 &
BACKEND_PID=$!
sleep 3

# Check if backend started successfully
if kill -0 $BACKEND_PID 2>/dev/null; then
    print_success "Backend server started (PID: $BACKEND_PID) - Hot-reload enabled"
else
    print_error "Backend server failed to start. Check backend/backend.log for details."
    cat backend.log
    exit 1
fi

# Start frontend server with Vite (hot-reload)
print_status "Starting frontend server on port $FRONTEND_PORT with hot-reload..."
cd "$SCRIPT_DIR/frontend"
npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
sleep 5

# Check if frontend started successfully
if kill -0 $FRONTEND_PID 2>/dev/null; then
    print_success "Frontend server started (PID: $FRONTEND_PID) - Hot-reload enabled"
else
    print_error "Frontend server failed to start. Check frontend/frontend.log for details."
    cat frontend.log
    exit 1
fi

echo ""
echo "=========================================="
echo -e "${GREEN}   Application Started Successfully!${NC}"
echo "=========================================="
echo ""
echo -e "  ${CYAN}Frontend:${NC} http://localhost:$FRONTEND_PORT"
echo -e "  ${CYAN}Backend:${NC}  http://localhost:$BACKEND_PORT"
echo ""
echo -e "  ${YELLOW}Demo Accounts:${NC}"
echo "  - Student: student@demo.com / password123"
echo "  - Teacher: teacher@demo.com / password123"
echo ""
echo -e "  ${GREEN}Hot-Reload Enabled:${NC}"
echo "  - Backend changes automatically restart (nodemon)"
echo "  - Frontend changes instantly refresh (Vite HMR)"
echo ""
echo -e "  ${YELLOW}AI Features Available:${NC}"
echo "  - Learning Style Detector"
echo "  - AI Quiz Generator"
echo "  - Progress Predictor"
echo "  - Concept Explainer"
echo "  - Study Schedule Optimizer"
echo "  - Homework Helper"
echo "  - Math Tutor"
echo "  - History Explorer"
echo "  - Science Lab Simulator"
echo "  - Flashcard Generator"
echo ""
echo "  Press Ctrl+C to stop all servers"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    print_status "Shutting down servers..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    # Kill any remaining node processes on our ports
    kill_port $BACKEND_PORT
    kill_port $FRONTEND_PORT
    print_success "Servers stopped"
    exit 0
}

# Trap SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM

# Wait for processes
wait $BACKEND_PID $FRONTEND_PID
