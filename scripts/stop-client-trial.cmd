@echo off
setlocal

echo Closing trial windows...
for /f "tokens=2" %%p in ('tasklist /v /fo csv ^| findstr /i "CRM Backend"') do taskkill /pid %%~p /f >nul 2>&1
for /f "tokens=2" %%p in ('tasklist /v /fo csv ^| findstr /i "CRM Frontend"') do taskkill /pid %%~p /f >nul 2>&1
for /f "tokens=2" %%p in ('tasklist /v /fo csv ^| findstr /i "localtunnel"') do taskkill /pid %%~p /f >nul 2>&1

echo Done.
endlocal
