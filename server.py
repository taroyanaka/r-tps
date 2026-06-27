import http.server
import socketserver
import json
import os
import zipfile
from datetime import datetime
from pathlib import Path

PORT = 8000
LOG_FILE = "log.txt"

class MyHttpRequestHandler(http.server.SimpleHTTPRequestHandler):
    def _send_json(self, status_code, payload):
        self.send_response(status_code)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode('utf-8'))

    def _build_results_zip(self):
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        zip_name = f"regulation_result_{timestamp}.zip"
        log_files = sorted(Path('.').glob('*_log.txt'))

        with zipfile.ZipFile(zip_name, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
            for log_file in log_files:
                zf.write(log_file, arcname=log_file.name)

        return zip_name

    def do_GET(self):
        if self.path == '/params':
            try:
                import csv
                configs = []
                json_path = Path('param.json')
                txt_path = Path('param.txt')
                if json_path.exists():
                    with open(json_path, 'r', encoding='utf-8') as f:
                        configs = json.load(f)
                elif txt_path.exists():
                    with open(txt_path, 'r', encoding='utf-8') as f:
                        reader = csv.DictReader(f)
                        for row in reader:
                            configs.append(row)
                self._send_json(200, configs)
            except Exception as e:
                self.send_response(500)
                self.end_headers()
        elif self.path == '/zip_results':
            try:
                zip_name = self._build_results_zip()
                self._send_json(200, {"status": "ok", "zip_file": zip_name})
            except Exception as e:
                self._send_json(500, {"status": "error", "message": str(e)})
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/log':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                message = data.get('message', '')
                param_name = data.get('param_name', None)
                log_file = f"{param_name}_log.txt" if param_name else LOG_FILE
                with open(log_file, 'a', encoding='utf-8') as f:
                    f.write(message + '\n')
                self._send_json(200, {"status": "ok"})
            except Exception as e:
                self.send_response(500)
                self.end_headers()
        elif self.path == '/clear_log':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length) if content_length > 0 else b'{}'
            try:
                data = json.loads(post_data.decode('utf-8'))
                param_name = data.get('param_name', None)
                log_file = f"{param_name}_log.txt" if param_name else LOG_FILE
                with open(log_file, 'w', encoding='utf-8') as f:
                    f.write('')
                self._send_json(200, {"status": "ok"})
            except Exception as e:
                self.send_response(500)
                self.end_headers()
        elif self.path == '/zip_results':
            try:
                zip_name = self._build_results_zip()
                self._send_json(200, {"status": "ok", "zip_file": zip_name})
            except Exception as e:
                self.send_response(500)
                self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

handler_object = MyHttpRequestHandler
handler_object.extensions_map.update({
    ".js": "application/javascript",
})

socketserver.TCPServer.allow_reuse_address = True
my_server = socketserver.TCPServer(("", PORT), handler_object)

print(f"Serving at port {PORT}")
try:
    my_server.serve_forever()
except KeyboardInterrupt:
    pass
my_server.server_close()
