"""Serve the static draft board on localhost."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os

ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)
print("R6 Draft Helper is running at http://localhost:8501")
ThreadingHTTPServer(("127.0.0.1", 8501), SimpleHTTPRequestHandler).serve_forever()

