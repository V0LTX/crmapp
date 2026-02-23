@echo off
setlocal
set "ROOT=%~dp0.."

echo [1/3] Starting backend on port 5000...
start "CRM Backend" cmd /k "cd /d ""%ROOT%\backend"" && npm run dev"

echo [2/3] Starting frontend on port 5173...
start "CRM Frontend" cmd /k "cd /d ""%ROOT%\frontend"" && npm run dev -- --host 127.0.0.1"

echo [3/3] Waiting for services, then opening public trial link...
timeout /t 12 /nobreak >nul
cd /d "%ROOT%"

npx --yes localtunnel --port 5173

endlocal
