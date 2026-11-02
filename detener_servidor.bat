@echo off
title PAOLO ALDEA & ABOGADOS - Detener Servidor Local
chcp 65001 >nul
cls
echo ==============================================================================
echo    Deteniendo Servidor Web Local de PAOLO ALDEA & ABOGADOS (Puerto 8080)...
echo ==============================================================================
echo.
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*servidor_local.ps1*' -or $_.Name -eq 'servidor_local.exe' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host ('Servidor detenido (PID: ' + $_.ProcessId + ')') -ForegroundColor Green }"
taskkill /f /im servidor_local.exe >nul 2>&1
echo.
echo El servidor local ha sido detenido de forma segura.
echo.
pause
exit
