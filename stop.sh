#!/bin/bash

set -e

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$SCRIPT_DIR"

# Load environment variables
set -a
if [ -f .env ]; then
    source .env
fi
set +a

# Set default values
PORT=${PORT:-3001}
FRONTEND_PORT=${FRONTEND_PORT:-9000}
LOG_DIR="$SCRIPT_DIR/logs"
PID_DIR="$LOG_DIR/pids"

# Logging function
log() {
    local level=$1
    local msg=$2
    echo "[$(date -u '+%Y-%m-%dT%H:%M:%S.%3NZ')] [$level] $msg"
}

# Function to gracefully stop a process
stop_process() {
    local pid=$1
    local name=$2
    
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        log "INFO" "Sending SIGTERM to $name (PID: $pid)"
        kill -TERM "$pid" 2>/dev/null || true
        
        # Wait for process to terminate gracefully
        local count=0
        while kill -0 "$pid" 2>/dev/null && [ $count -lt 10 ]; do
            sleep 0.5
            count=$((count + 1))
        done
        
        # Force kill if still running
        if kill -0 "$pid" 2>/dev/null; then
            log "WARN" "$name (PID: $pid) did not terminate gracefully, forcing..."
            kill -9 "$pid" 2>/dev/null || true
        else
            log "INFO" "$name (PID: $pid) terminated gracefully"
        fi
    fi
}

# Function to stop process using PID file
stop_by_pid_file() {
    local name=$1
    local pid_file="$PID_DIR/${name}.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        log "INFO" "Found $name in PID file (PID: $pid)"
        stop_process "$pid" "$name"
        rm -f "$pid_file"
    else
        log "INFO" "No PID file found for $name"
    fi
}

# Function to stop process on a given port
stop_by_port() {
    local port=$1
    local name=$2
    
    local pid=$(lsof -ti :$port 2>/dev/null || true)
    if [ -n "$pid" ]; then
        log "INFO" "Found process using port $port (PID: $pid)"
        stop_process "$pid" "$name"
    else
        echo "No $name server process found running on port $port"
    fi
}

# Stop processes by PID files first
stop_by_pid_file "backend"
stop_by_pid_file "frontend"

# Then try stopping by ports as fallback
stop_by_port "$PORT" "backend"
stop_by_port "$FRONTEND_PORT" "frontend"

log "INFO" "All services stopped."
