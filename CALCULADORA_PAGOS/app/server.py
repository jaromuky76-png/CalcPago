import http.server
import socketserver
import socket
import os
import json
import urllib.parse
from contract_generator import generate_contract_document

# Definir un puerto inicial para esta aplicación
PORT = 8546
PROVIDERS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "proveedores_registrados.json")

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/api/providers':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            if os.path.exists(PROVIDERS_FILE):
                with open(PROVIDERS_FILE, 'r', encoding='utf-8') as f:
                    self.wfile.write(f.read().encode('utf-8'))
            else:
                self.wfile.write(b"[]")
            return
            
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        content_len = int(self.headers.get('Content-Length', 0))
        post_body = self.rfile.read(content_len) if content_len > 0 else b"{}"

        if parsed.path == '/api/generate-contract':
            try:
                data = json.loads(post_body.decode('utf-8'))
                docx_stream = generate_contract_document(data)
                docx_bytes = docx_stream.getvalue()
                prov_name = data.get('nombre_comercial', 'PROVEEDOR').replace(' ', '_')
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
                self.send_header('Content-Disposition', f'attachment; filename="CONTRATO_{prov_name}.docx"')
                self.send_header('Content-Length', str(len(docx_bytes)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(docx_bytes)
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
            return

        elif parsed.path == '/api/save-provider':
            try:
                provider_data = json.loads(post_body.decode('utf-8'))
                providers = []
                if os.path.exists(PROVIDERS_FILE):
                    try:
                        with open(PROVIDERS_FILE, 'r', encoding='utf-8') as f:
                            providers = json.load(f)
                    except Exception:
                        providers = []
                
                # Check if provider already exists and update, or append
                prov_key = provider_data.get('nombre_comercial') or provider_data.get('nombre')
                idx_found = -1
                for i, p in enumerate(providers):
                    k = p.get('nombre_comercial') or p.get('nombre')
                    if k and k.strip().upper() == prov_key.strip().upper():
                        idx_found = i
                        break
                
                if idx_found >= 0:
                    providers[idx_found] = provider_data
                else:
                    providers.append(provider_data)

                with open(PROVIDERS_FILE, 'w', encoding='utf-8') as f:
                    json.dump(providers, f, ensure_ascii=False, indent=2)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'ok', 'count': len(providers)}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
            return

        return super().do_POST()

# Corrección para Windows: forzar el MIME type correcto para CSS
Handler.extensions_map['.css'] = 'text/css'
Handler.extensions_map['.js'] = 'application/javascript'

def get_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # No necesita ser alcanzable
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

class ThreadingTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True

if __name__ == "__main__":
    # Cambiar al directorio donde está el script para servir los archivos HTML/JS
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    local_ip = get_ip()
    
    httpd = None
    while PORT < 9000:
        try:
            httpd = ThreadingTCPServer(("", PORT), Handler)
            break
        except OSError as e:
            # Si el puerto está en uso (WinError 10048), intenta el siguiente
            PORT += 1

    if httpd:
        print("="*50)
        print("[ SERVIDOR DE CALCULADORA DE PAGOS INICIADO ]")
        print("="*50)
        print(f"La aplicación está corriendo. Puedes acceder desde:")
        print(f"-> En esta computadora:  http://localhost:{PORT}")
        print(f"-> Desde la red local:   http://{local_ip}:{PORT}")
        print("="*50)
        print("Copia y pega la nueva dirección en tu navegador.")
        print("Presiona Ctrl+C para detener el servidor.")
        httpd.serve_forever()
