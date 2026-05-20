@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$n=@((Get-Command node -EA SilentlyContinue).Source,'D:\cursor\resources\app\resources\helpers\node.exe','$env:ProgramFiles\cursor\resources\app\resources\helpers\node.exe')|?{$_ -and (Test-Path $_)}|Select -First 1;" ^
  "if(-not $n){Write-Host 'Нужен Node.js'; exit 1}; & $n '.\scripts\telegram-bot.mjs'"
pause
