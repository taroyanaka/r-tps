import http.server
import socketserver
import json
import os
import zipfile
from datetime import datetime
from pathlib import Path

PORT = 8000
LOG_DIR = Path('log')
# ensure log directory exists
LOG_DIR.mkdir(exist_ok=True)
LOG_FILE_NAME = "log.txt"
PARAM_FILE = Path('param.json')
RESULT_FILE = LOG_DIR / 'result.json'

def _read_json_file(path, default):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return default

def _write_json_file(path, payload):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False)

def _load_result_map():
    data = _read_json_file(RESULT_FILE, [])
    if not isinstance(data, list):
        return {}
    result_map = {}
    for item in data:
        if isinstance(item, dict) and item.get('paramName'):
            result_map[item['paramName']] = item
    return result_map

def _save_result_map(result_map):
    ordered = list(result_map.values())
    _write_json_file(RESULT_FILE, ordered)

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
        log_files = sorted(p for p in LOG_DIR.iterdir() if p.is_file() and p.name != RESULT_FILE.name)

        with zipfile.ZipFile(zip_name, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
            for log_file in log_files:
                zf.write(log_file, arcname=log_file.name)
            if RESULT_FILE.exists():
                zf.write(RESULT_FILE, arcname=RESULT_FILE.name)

        return zip_name

    def do_GET(self):
        if self.path == '/params':
            try:
                if not PARAM_FILE.exists():
                    raise FileNotFoundError('param.json not found')
                configs = _read_json_file(PARAM_FILE, [])
                self._send_json(200, configs)
            except Exception as e:
                self._send_json(500, {"status": "error", "message": str(e)})
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
                log_file_path = LOG_DIR / (f"{param_name}_log.txt" if param_name else LOG_FILE_NAME)
                with open(log_file_path, 'a', encoding='utf-8') as f:
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
                if param_name:
                    log_file_path = LOG_DIR / (f"{param_name}_log.txt" if param_name else LOG_FILE_NAME)
                    with open(log_file_path, 'w', encoding='utf-8') as f:
                        f.write('')
                else:
                    for log_file in LOG_DIR.iterdir():
                        if log_file.is_file() and log_file.name != RESULT_FILE.name:
                            log_file.unlink()
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
        elif self.path == '/result':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length) if content_length > 0 else b'{}'
            try:
                data = json.loads(post_data.decode('utf-8'))
                param_name = data.get('paramName', None)
                result = data.get('result', None)
                if not param_name or not result:
                    raise ValueError('paramName and result are required')
                result_map = _load_result_map()
                result_map[param_name] = {"paramName": param_name, "result": result}
                _save_result_map(result_map)
                self._send_json(200, {"status": "ok"})
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

class ThreadingTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True

ThreadingTCPServer.allow_reuse_address = True
my_server = ThreadingTCPServer(("", PORT), handler_object)

print(f"Serving at port {PORT}")
try:
    my_server.serve_forever()
except KeyboardInterrupt:
    pass
my_server.server_close()
