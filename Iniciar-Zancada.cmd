@echo off
setlocal
cd /d "%~dp0"
set "ZANCADA_NODE=%~dp0.tools\node.exe"
if not exist "%ZANCADA_NODE%" (
  where node >nul 2>nul
  if errorlevel 1 (
    echo Instala Node.js 22.13 o posterior y vuelve a abrir este archivo.
    pause
    exit /b 1
  )
  set "ZANCADA_NODE=node"
)
if not exist "node_modules\vinext\dist\cli.js" (
  echo Faltan dependencias. Ejecuta npm.cmd run install:ci en esta carpeta.
  pause
  exit /b 1
)
echo Zancada se abrira en http://localhost:5173
echo Manten esta ventana abierta. Para apagar Zancada pulsa Ctrl+C.
echo Si el navegador abre antes que el servidor, recarga unos segundos despues.
start "" "http://localhost:5173"
"%ZANCADA_NODE%" scripts\run-framework.mjs dev --hostname 127.0.0.1
if errorlevel 1 pause
