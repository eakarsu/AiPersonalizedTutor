#!/bin/bash

# AI Personalized Tutor - Startup Script
# This script sets up the database, seeds data, and starts the application

set -e

echo "=========================================="
echo "   AI Personalized Tutor - Setup Script"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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
    print_error ".env file not found. Please create one based on the template."
    exit 1
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

# Clean up ports
print_status "Cleaning up ports..."
kill_port $BACKEND_PORT
kill_port $FRONTEND_PORT
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
npm run seed 2>&1 | tail -10
print_success "Database seeded successfully"

# Start backend server in background
print_status "Starting backend server on port $BACKEND_PORT..."
cd "$SCRIPT_DIR/backend"
npm run dev > backend.log 2>&1 &
BACKEND_PID=$!
sleep 3

# Check if backend started successfully
if kill -0 $BACKEND_PID 2>/dev/null; then
    print_success "Backend server started (PID: $BACKEND_PID)"
else
    print_error "Backend server failed to start. Check backend/backend.log for details."
    exit 1
fi

# Start frontend server
print_status "Starting frontend server on port $FRONTEND_PORT..."
cd "$SCRIPT_DIR/frontend"
npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
sleep 3

# Check if frontend started successfully
if kill -0 $FRONTEND_PID 2>/dev/null; then
    print_success "Frontend server started (PID: $FRONTEND_PID)"
else
    print_error "Frontend server failed to start. Check frontend/frontend.log for details."
    exit 1
fi

echo ""
echo "=========================================="
echo -e "${GREEN}   Application Started Successfully!${NC}"
echo "=========================================="
echo ""
echo "  Frontend: http://localhost:$FRONTEND_PORT"
echo "  Backend:  http://localhost:$BACKEND_PORT"
echo ""
echo "  Demo Accounts:"
echo "  - Student: student@demo.com / password123"
echo "  - Teacher: teacher@demo.com / password123"
echo ""
echo "  Press Ctrl+C to stop all servers"
echo ""

# Function to cleanup on exit
cleanup() {
    print_status "Shutting down servers..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    print_success "Servers stopped"
    exit 0
}

# Trap SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM

# Wait for processes
wait $BACKEND_PID $FRONTEND_PID
