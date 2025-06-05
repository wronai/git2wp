#!/bin/bash

# Exit on error
set -e

echo "Starting Git2WP services..."

# Start backend server
node server.js & 
BACKEND_PID=$!

# Start frontend server
cd public && python3 simple_server.py --port $FRONTEND_PORT --log-file /app/logs/frontend.log &
FRONTEND_PID=$!

# Wait for any process to exit
wait -n

# Exit with status of process that exited first
exit $?
