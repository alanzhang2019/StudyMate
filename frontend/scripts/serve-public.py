#!/usr/bin/env python3
import http.server
import socketserver
import os
import sys

PORT = 3002
ROOT = r'D:\AItrade\ai-math-mistake-machine\frontend'

os.chdir(ROOT)

Handler = http.server.SimpleHTTPRequestHandler

with socketserver.TCPServer(('127.0.0.1', PORT), Handler) as httpd:
    print(f'Serving {ROOT} at http://127.0.0.1:{PORT}', flush=True)
    httpd.serve_forever()
