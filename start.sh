#!/bin/bash

# Exit on error, but allow for proper cleanup
set -e
trap cleanup EXIT

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$SCRIPT_DIR"

# Load environment variables
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

# Default values
BACKEND_PORT=${PORT:-3001}
FRONTEND_PORT=${FRONTEND_PORT:-9000}
LOG_DIR=logs
PID_DIR="$LOG_DIR/pids"

# Create necessary directories
mkdir -p "$LOG_DIR" "$PID_DIR"
touch "$LOG_DIR/frontend.log" "$LOG_DIR/backend.log"

# Logging function
log() {
    local level=$1
    local msg=$2
    echo "[$(date -u '+%Y-%m-%dT%H:%M:%S.%3NZ')] [$level] $msg"
}

# Check if a port is in use
check_port() {
    local port=$1
    if lsof -i:"$port" > /dev/null 2>&1; then
        return 0
    fi
    return 1
}

# Function to start a service
start_service() {
    local name=$1
    local cmd=$2
    local log_file=$3
    local port=$4
    
    # Check if service is already running
    if [ -f "$PID_DIR/${name}.pid" ]; then
        local old_pid=$(cat "$PID_DIR/${name}.pid")
        if kill -0 "$old_pid" 2>/dev/null; then
            log "ERROR" "$name is already running with PID $old_pid"
            return 1
        fi
    fi

    # Check if port is available
    if [ -n "$port" ] && check_port "$port"; then
        log "ERROR" "Port $port is already in use"
        return 1
    fi

    log "INFO" "Starting $name..."
    nohup $cmd >> "$log_file" 2>&1 &
    local pid=$!
    
    # Wait briefly to check if process is still running
    sleep 1
    if ! kill -0 "$pid" 2>/dev/null; then
        log "ERROR" "$name failed to start"
        return 1
    fi

    echo "$pid" > "$PID_DIR/${name}.pid"
    log "INFO" "$name started with PID: $pid"
    echo $pid
}

# Cleanup function
cleanup() {
    log "INFO" "Cleaning up..."
    if [ -f stop.sh ]; then
        ./stop.sh
    fi
}

# Stop any running services
if [ -f stop.sh ]; then
    log "INFO" "Stopping any running services..."
    ./stop.sh
    sleep 2  # Give services time to stop
fi

# Start backend
backend_pid=$(start_service "backend" "node server.js" "$LOG_DIR/backend.log" "$BACKEND_PORT")

# Start frontend
if [ -n "$FRONTEND_PORT" ]; then
    (
        cd public
        frontend_pid=$(start_service "frontend" "python3 simple_server.py --port $FRONTEND_PORT --log-file $SCRIPT_DIR/$LOG_DIR/frontend.log" "$SCRIPT_DIR/$LOG_DIR/frontend.log" "$FRONTEND_PORT")
    )
fi

echo -e "\nServices started successfully!"
echo "Backend URL: http://localhost:$BACKEND_PORT"
[ -n "$FRONTEND_PORT" ] && echo "Frontend URL: http://localhost:$FRONTEND_PORT"
echo -e "\nTo stop services, run: ./stop.sh"

# Tail logs
echo -e "\nTailing logs (Ctrl+C to stop)...\n"
tail -f "$LOG_DIR/backend.log" "$LOG_DIR/frontend.log" 2>/dev/null || echo "No log files found"
