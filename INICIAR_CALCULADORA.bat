@echo off
title Calculadora de Pagos - Servidor Web
cd /d "%~dp0CALCULADORA_PAGOS\app"

echo ===================================================
echo   INICIANDO CALCULADORA DE PAGOS - SERVIDOR WEB
echo ===================================================
echo.

:: 1. Intentar con 'py' (Lanzador oficial de Python para Windows)
where py >nul 2>&1
if %errorlevel% equ 0 (
    echo Iniciando servidor con Python Launcher [py]...
    start "" http://localhost:8546
    py server.py
    goto end
)

:: 2. Intentar con la ruta directa de instalacion en AppData
if exist "%LOCALAPPDATA%\Python\bin\python.exe" (
    echo Iniciando servidor con Python local...
    start "" http://localhost:8546
    "%LOCALAPPDATA%\Python\bin\python.exe" server.py
    goto end
)

:: 3. Intentar con 'python' tradicional
where python >nul 2>&1
if %errorlevel% equ 0 (
    echo Iniciando con python del sistema...
    start "" http://localhost:8546
    python server.py
    goto end
)

echo [ERROR] No se encontro un ejecutable funcional de Python en el equipo.
echo Por favor verifica que Python este instalado en Windows.
pause

:end
