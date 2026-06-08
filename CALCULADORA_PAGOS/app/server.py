import http.server
import socketserver
import socket
import os

# Definir un puerto inicial para esta aplicación
PORT = 8546

class Handler(http.server.SimpleHTTPRequestHandler):
    pass

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
