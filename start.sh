#!/bin/bash

# Load environment variables
set -a
source .env
set +a

# Create logs directory if it doesn't exist
mkdir -p logs

# Function to start a service
start_service() {
    local name=$1
    local cmd=$2
    local log_file=$3
    
    echo "Starting $name..."
    nohup $cmd >> "$log_file" 2>&1 &
    local pid=$!
    echo "$name started with PID: $pid"
    echo $pid > "logs/${name}_pid.txt"
}

# Stop any running services first
if [ -f stop.sh ]; then
    echo "Stopping any running services..."
    ./stop.sh
fi

# Start backend server
start_service "backend" "node server.js" "logs/backend.log"

# Start frontend server (simple HTTP server)
if [ -n "$FRONTEND_PORT" ]; then
    cd public
    start_service "frontend" "python3 -m http.server $FRONTEND_PORT" "../logs/frontend.log"
    cd ..
fi

echo "\nServices started successfully!"
echo "Backend URL: http://localhost:$PORT"
echo "Frontend URL: http://localhost:$FRONTEND_PORT"
echo "\nTo stop services, run: ./stop.sh"

# Show logs for a few seconds
echo -e "\nTailing logs (Ctrl+C to stop)...\n"
tail -f logs/backend.log logs/frontend.log 2>/dev/null || echo "No logs to display yet"
