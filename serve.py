"""Serve the local studio. No Python packages or build step required."""
import argparse
import functools
import http.server
import webbrowser
from pathlib import Path

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.mjs': 'text/javascript'}

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

    def list_directory(self, path):
        self.send_error(404)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=5177)
    parser.add_argument('--open', action='store_true', help='Open the studio in your default browser')
    args = parser.parse_args()
    handler = functools.partial(Handler, directory=str(Path(__file__).parent))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', args.port), handler)
    print(f'DigiPoly Studio: http://127.0.0.1:{args.port}', flush=True)
    print('Local only. Press Ctrl+C to stop.', flush=True)
    if args.open:
        webbrowser.open(f'http://127.0.0.1:{args.port}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
