#!/usr/bin/env python3
from http.server import SimpleHTTPRequestHandler, HTTPServer
import socketserver
import os
import sys
import socket
import logging
import signal
import json
from datetime import datetime
from typing import Optional

def is_port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

class EnhancedHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        self.logger = logging.getLogger('EnhancedServer')
        super().__init__(*args, **kwargs)

    def handle_one_request(self):
        try:
            return super().handle_one_request()
        except (ConnectionResetError, BrokenPipeError):
            self.close_connection = True
            self.logger.debug(f'Connection closed by {self.client_address}')
            return
        except Exception as e:
            self.logger.error(f'Error handling request: {str(e)}')
            raise

    def log_message(self, format, *args):
        self.logger.info(
            '%s - - [%s] %s',
            self.address_string(),
            self.log_date_time_string(),
            format % args
        )

    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            health_data = {
                'status': 'healthy',
                'timestamp': datetime.now().isoformat(),
                'uptime': self.server.get_uptime()
            }
            self.wfile.write(json.dumps(health_data).encode())
            return
        return super().do_GET()

class EnhancedHTTPServer(socketserver.TCPServer):
    def __init__(self, *args, **kwargs):
        self.start_time = datetime.now()
        super().__init__(*args, **kwargs)

    def get_uptime(self):
        return (datetime.now() - self.start_time).total_seconds()

    def server_close(self):
        self.logger.info('Shutting down server...')
        super().server_close()

def setup_logging(log_file: Optional[str] = None):
    logger = logging.getLogger('EnhancedServer')
    logger.setLevel(logging.INFO)
    formatter = logging.Formatter(
        '[%(asctime)s] [%(levelname)s] %(message)s',
        datefmt='%Y-%m-%dT%H:%M:%S%z'
    )

    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # File handler if log file specified
    if log_file:
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    return logger

def run(port=8000, directory=None, log_file=None):
    logger = setup_logging(log_file)

    if directory:
        os.chdir(directory)
        logger.info(f'Serving files from directory: {directory}')

    if is_port_in_use(port):
        logger.error(f'Port {port} is already in use')
        sys.exit(1)

    server_address = ('', port)
    try:
        httpd = EnhancedHTTPServer(server_address, EnhancedHandler)
        httpd.logger = logger

        def handle_shutdown(signum, frame):
            logger.info('Received shutdown signal')
            httpd.server_close()
            sys.exit(0)

        signal.signal(signal.SIGTERM, handle_shutdown)
        signal.signal(signal.SIGINT, handle_shutdown)

        logger.info(f'🚀 Server running on port {port}')
        logger.info(f'🏥 Health check available at: http://localhost:{port}/health')
        httpd.serve_forever()
    except Exception as e:
        logger.error(f'Server error: {str(e)}')
        sys.exit(1)

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Enhanced HTTP Server')
    parser.add_argument('--port', type=int, default=8088, help='Port to serve on')
    parser.add_argument('--directory', type=str, default=os.getcwd(),
                      help='Directory to serve files from')
    parser.add_argument('--log-file', type=str, help='Log file path')
    args = parser.parse_args()
    
    run(port=args.port, directory=args.directory, log_file=args.log_file)
