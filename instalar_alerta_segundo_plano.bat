@echo off
title PAOLO ALDEA & ABOGADOS - Instalador de Alertas en Segundo Plano
chcp 65001 >nul
cls
echo ==============================================================================
echo    PAOLO ALDEA & ABOGADOS - Instalación de Alertas en Segundo Plano (PC y Laptop)
echo    PAOLO ALDEA ^& ABOGADOS - Sede Challhuahuacho
echo ==============================================================================
echo.
echo Este instalador configurará el Notificador para que inicie automáticamente
echo cada vez que encienda su computadora o laptop.
echo.
echo De este modo, recibirá avisos de plazos fatales, audiencias y vencimientos
echo directamente en Windows aun cuando tenga el navegador o la app cerrada.
echo.

set SCRIPT_DIR=%~dp0
set VBS_TARGET=%SCRIPT_DIR%iniciar_notificador_segundo_plano.vbs

powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$s = $ws.CreateShortcut([System.Environment]::GetFolderPath('Startup') + '\Paolo AldeaPro_Notificador.lnk'); " ^
  "$s.TargetPath = 'wscript.exe'; " ^
  "$s.Arguments = '\"%VBS_TARGET%\"'; " ^
  "$s.WorkingDirectory = '%SCRIPT_DIR%'; " ^
  "$s.Save(); " ^
  "Write-Host 'Acceso directo de inicio creado exitosamente en la carpeta de Inicio de Windows.' -ForegroundColor Green;"

echo.
echo Iniciando el notificador ahora mismo en segundo plano...
wscript.exe "%VBS_TARGET%"

echo.
echo ==============================================================================
echo ¡LISTO! El notificador en segundo plano está activo y configurado.
echo Verá una notificación de confirmación en la esquina inferior derecha de Windows.
echo ==============================================================================
echo.
pause
exit
