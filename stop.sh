#!/bin/bash

# Load environment variables
set -a
source .env
set +a

# Function to stop process on a given port
stop_port() {
    local port=$1
    local name=$2
    
    echo "Stopping $name on port $port..."
    local pid=$(lsof -t -i :$port)
    
    if [ -n "$pid" ]; then
        echo "Found process $pid running on port $port"
        kill -9 $pid
        echo "Successfully stopped $name (PID: $pid)"
    else
        echo "No $name process found running on port $port"
    fi
}

# Stop backend server
stop_port $PORT "backend server"

# Stop frontend server
if [ -n "$FRONTEND_PORT" ]; then
    stop_port $FRONTEND_PORT "frontend server"
fi

echo "All services stopped"
