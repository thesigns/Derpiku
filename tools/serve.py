"""Local dev server for Derpiku.

Serves the repository root on http://localhost:8765 with caching disabled (so the browser always
loads fresh files) and a larger connection backlog than `python -m http.server`, which can drop
connections when the browser requests many ES modules at once.

Usage: python tools/serve.py [port]
"""
import functools
import http.server
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class Server(http.server.ThreadingHTTPServer):
    request_queue_size = 128
    daemon_threads = True


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    handler = functools.partial(NoCacheHandler, directory=str(ROOT))
    with Server(("127.0.0.1", port), handler) as httpd:
        print(f"Derpiku: http://localhost:{port}/  (Ctrl+C to stop)")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
