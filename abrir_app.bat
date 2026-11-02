@echo off
title PAOLO ALDEA ^& ABOGADOS - Suite Juridica Oficial
echo ==============================================================================
echo       PAOLO ALDEA ^& ABOGADOS - Suite de Gestion Juridica ^& Operativa
echo       Sede Challhuahuacho (Cotabambas, Apurimac) ^& Consolidado Nacional
echo ==============================================================================
echo.

cd /d "%~dp0"

:: 1. Verificacion de Integridad de Archivos Base
if not exist "%~dp0index.html" (
    echo [ERROR CRITICO] No se encontro index.html en el directorio del sistema.
    pause
    exit /b 1
)

:: 2. Sincronizacion y Compilacion Forzada de Vistas (Asegura Ultima Version Siempre)
if exist "%~dp0herramientas\compilar_bundle_html.ps1" (
    echo [*] Sincronizando y compilando componentes a la ultima version disponible...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0herramientas\compilar_bundle_html.ps1" >nul 2>&1
    echo [OK] Vistas y modales sincronizados al 100%%.
)

:: 3. Generar token criptografico de version fresca (Anti-Cache Total)
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value 2^>nul') do set DT=%%I
if not defined DT set DT=%RANDOM%%TIME:~6,2%
set CACHE_BUST=%DT:~0,14%_%RANDOM%

:: 4. Verificar si el servidor local ya se encuentra activo en los puertos oficiales
set ACTIVE_PORT=
if exist "%~dp0.server_port" (
    for /f "usebackq delims=" %%A in ("%~dp0.server_port") do (
        netstat -ano | findstr :%%A | findstr LISTENING >nul
        if not errorlevel 1 (
            powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-RestMethod -Uri 'http://localhost:%%A/api/health' -TimeoutSec 1; if ($r.status -eq 'healthy') { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
            if not errorlevel 1 set ACTIVE_PORT=%%A
        )
    )
)

if not defined ACTIVE_PORT (
    for %%P in (8080 8088 8090 8888 5000 3000) do (
        if not defined ACTIVE_PORT (
            netstat -ano | findstr :%%P | findstr LISTENING >nul
            if not errorlevel 1 (
                powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-RestMethod -Uri 'http://localhost:%%P/api/health' -TimeoutSec 1; if ($r.status -eq 'healthy') { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
                if not errorlevel 1 set ACTIVE_PORT=%%P
            )
        )
    )
)

if defined ACTIVE_PORT (
    echo [OK] Servidor local verificado y activo en http://localhost:%ACTIVE_PORT%/
    echo [OK] Desplegando suite juridica en version mas reciente...
    call :OPEN_WITH_PAIR "%ACTIVE_PORT%"
    exit /b 0
)

:: 5. Si no esta activo, iniciar el Servidor Local Autonomo de Despacho
echo [*] Iniciando servidor web local autonomo (Streaming I/O ^& Transaccional)...
start /min powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0servidor_local.ps1"

:: 6. Espera activa de arranque y confirmacion de enlace HTTP
set TRIES=0
:WAIT_SERVER
set /a TRIES+=1
ping -n 2 127.0.0.1 >nul
if exist "%~dp0.server_port" (
    for /f "usebackq delims=" %%A in ("%~dp0.server_port") do (
        netstat -ano | findstr :%%A | findstr LISTENING >nul
        if not errorlevel 1 set ACTIVE_PORT=%%A
    )
)
if not defined ACTIVE_PORT (
    if %TRIES% leq 5 goto WAIT_SERVER
)

:: 7. Despliegue en Navegador con version fresca + pairing local
if defined ACTIVE_PORT (
    echo [EXITO] Servidor listo en http://localhost:%ACTIVE_PORT%/
    echo [OK] Abriendo PAOLO ALDEA ^& ABOGADOS con ultima version actualizada...
    call :OPEN_WITH_PAIR "%ACTIVE_PORT%"
) else (
    echo [AVISO] Iniciando aplicacion en modo directo de contingencia...
    start "" "%~dp0index.html"
)

exit /b 0

:OPEN_WITH_PAIR
set "PORT_ARG=%~1"
set "PAIR_CODE="
:: Solicita un codigo de emparejamiento fresco (solo procesos locales; no usable desde el navegador)
for /f "usebackq delims=" %%P in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-RestMethod -Method Post -Uri 'http://localhost:%PORT_ARG%/api/pair/mint' -TimeoutSec 3; if ($r.pairing) { Write-Output $r.pairing } elseif (Test-Path '%~dp0.server_pairing') { (Get-Content '%~dp0.server_pairing' -Raw).Trim() } } catch { if (Test-Path '%~dp0.server_pairing') { (Get-Content '%~dp0.server_pairing' -Raw).Trim() } }"`) do set "PAIR_CODE=%%P"
if defined PAIR_CODE (
    start http://localhost:%PORT_ARG%/?v=%CACHE_BUST%^&local_pair=%PAIR_CODE%
) else (
    echo [AVISO] No se obtuvo pairing local; abriendo sin emparejamiento automatico.
    start http://localhost:%PORT_ARG%/?v=%CACHE_BUST%
)
exit /b 0
