@echo off
title PAOLO ALDEA & ABOGADOS - Detener Notificador
chcp 65001 >nul
cls
echo ==============================================================================
echo    Deteniendo Notificador en Segundo Plano de PAOLO ALDEA & ABOGADOS...
echo ==============================================================================
echo.
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*notificador_segundo_plano.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host ('Proceso finalizado (PID: ' + $_.ProcessId + ')') -ForegroundColor Yellow }"
echo.
echo El notificador ha sido detenido.
echo.
pause
exit
