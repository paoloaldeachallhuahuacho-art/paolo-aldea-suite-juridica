# ==============================================================================
# PAOLO ALDEA & ABOGADOS - Servidor Web Local Autónomo y Resiliente (Fase 2)
# Arquitectura: Streaming I/O de Alta Eficiencia, Persistencia Atómica ACID y Self-Healing
# Sede Challhuahuacho & Consolidado Multi-Sede Nacional
# ==============================================================================

param(
    [int]$Port = 8080
)

$baseDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $baseDir
$baseDirFull = [System.IO.Path]::GetFullPath($baseDir).TrimEnd('\', '/') + '\'
$serverStartTime = Get-Date

# Tipos MIME reconocidos
$mimeTypes = @{
    ".html"  = "text/html; charset=utf-8"
    ".htm"   = "text/html; charset=utf-8"
    ".css"   = "text/css; charset=utf-8"
    ".js"    = "application/javascript; charset=utf-8"
    ".json"  = "application/json; charset=utf-8"
    ".jpg"   = "image/jpeg"
    ".jpeg"  = "image/jpeg"
    ".png"   = "image/png"
    ".webp"  = "image/webp"
    ".svg"   = "image/svg+xml"
    ".ico"   = "image/x-icon"
    ".woff"  = "font/woff"
    ".woff2" = "font/woff2"
    ".ttf"   = "font/ttf"
    ".pdf"   = "application/pdf"
    ".txt"   = "text/plain; charset=utf-8"
    ".csv"   = "text/csv; charset=utf-8"
}

# Inicializar Listener HTTP en localhost con detección dinámica de puertos
$candidatePorts = @($Port, 8088, 8090, 8888, 5000, 3000)
$started = $false
foreach ($p in $candidatePorts) {
    $listener = New-Object System.Net.HttpListener
    $prefix = "http://localhost:$p/"
    $listener.Prefixes.Add($prefix)
    try {
        $listener.Start()
        $Port = $p
        $started = $true
        [System.IO.File]::WriteAllText((Join-Path $baseDir ".server_port"), $Port.ToString())
        break
    } catch {
        if ($listener) { $listener.Close() }
    }
}

if (-not $started) {
    Write-Error "No se pudo iniciar el listener HTTP en ningún puerto candidato."
    exit 1
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  PAOLO ALDEA & ABOGADOS - Servidor Web Local Iniciado" -ForegroundColor Green
Write-Host "  Estudio: PAOLO ALDEA & ABOGADOS (Sede Challhuahuacho)" -ForegroundColor Yellow
Write-Host "  URL: $prefix" -ForegroundColor White
Write-Host "  Arquitectura: Streaming I/O + Transacciones Atómicas (Fase 2)" -ForegroundColor Green
Write-Host "  APIs: /api/cloud_sync, /api/cloud_snapshot, /api/alertas_sync, /api/health, /api/backup" -ForegroundColor Gray
Write-Host "  Presione Ctrl+C para detener el servidor" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
# =====================================================================
# SEGURIDAD Y CONTROL DE ACCESO API (Bearer + cookie + pairing one-time)
# Semana 1 hardening: sin GET /api/token abierto, sin token en HTML/query
# =====================================================================
$serverTokenPath = Join-Path $baseDir ".server_token"
$pairingPath = Join-Path $baseDir ".server_pairing"
$globalServerToken = ""
if (Test-Path $serverTokenPath) {
    $readToken = (Get-Content $serverTokenPath -Raw).Trim()
    if ($readToken) { $globalServerToken = $readToken }
}
if (-not $globalServerToken) {
    $globalServerToken = [System.Guid]::NewGuid().ToString("N")
    [System.IO.File]::WriteAllText($serverTokenPath, $globalServerToken, $utf8NoBom)
}

# Código de emparejamiento de un solo uso por arranque (lo inyecta abrir_app.bat en la URL)
$globalPairingCode = [System.Guid]::NewGuid().ToString("N").Substring(0, 24)
[System.IO.File]::WriteAllText($pairingPath, $globalPairingCode, $utf8NoBom)
$script:pairingConsumed = $false
$script:cookieName = "PA_LOCAL_SESSION"

function Get-RequestCookieValue($req, $name) {
    $raw = $req.Headers["Cookie"]
    if (-not $raw) { return $null }
    foreach ($part in ($raw -split ";")) {
        $kv = $part.Trim()
        if ($kv -like "$name=*") {
            return $kv.Substring($name.Length + 1).Trim()
        }
    }
    return $null
}

function Test-ApiAuthorized($req) {
    $authHeader = $req.Headers["Authorization"]
    if ($authHeader -and ($authHeader -match "^Bearer\s+(.+)$")) {
        $token = $Matches[1].Trim()
        if ($token -eq $globalServerToken) { return $true }
    }
    $cookieTok = Get-RequestCookieValue $req $script:cookieName
    if ($cookieTok -and ($cookieTok -eq $globalServerToken)) { return $true }
    # Query token deshabilitado a propósito (fuga por logs/Referer/historial)
    return $false
}

function Test-IsLocalBrowserOrigin($req) {
    $origin = $req.Headers["Origin"]
    $referer = $req.Headers["Referer"]
    $allowed = @("http://localhost:$Port", "http://127.0.0.1:$Port")
    if ($origin) {
        foreach ($a in $allowed) { if ($origin -eq $a) { return $true } }
        return $false
    }
    if ($referer) {
        foreach ($a in $allowed) { if ($referer.StartsWith($a, [System.StringComparison]::OrdinalIgnoreCase)) { return $true } }
        return $false
    }
    # Same-origin navegación directa sin Origin (p. ej. address bar) desde loopback
    if ($req.IsLocal) { return $true }
    return $false
}

function Send-Unauthorized($resp, $utf8) {
    $resp.StatusCode = 401
    $errObj = @{ error = "Acceso no autorizado: Token Bearer o cookie de sesion local requeridos"; status = 401 }
    $bytes = $utf8.GetBytes((ConvertTo-Json $errObj -Compress))
    $resp.ContentType = "application/json; charset=utf-8"
    $resp.ContentLength64 = $bytes.Length
    $resp.OutputStream.Write($bytes, 0, $bytes.Length)
    $resp.Close()
}

function Set-SessionCookie($resp) {
    $cookie = "$($script:cookieName)=$globalServerToken; Path=/; HttpOnly; SameSite=Strict"
    $resp.Headers.Add("Set-Cookie", $cookie)
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        # Cabeceras de seguridad y restricción estricta de CORS al origen local
        $origin = $request.Headers["Origin"]
        $allowedOrigin = "http://localhost:$Port"
        if ($origin -and ($origin -eq $allowedOrigin -or $origin -eq "http://127.0.0.1:$Port")) {
            $response.Headers.Add("Access-Control-Allow-Origin", $origin)
        } else {
            $response.Headers.Add("Access-Control-Allow-Origin", $allowedOrigin)
        }
        $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD")
        $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
        $response.Headers.Add("X-Content-Type-Options", "nosniff")
        $response.Headers.Add("X-Frame-Options", "SAMEORIGIN")
        $response.Headers.Add("Referrer-Policy", "strict-origin-when-cross-origin")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 204
            $response.Close()
            continue
        }

        $urlPath = $request.Url.LocalPath
        if ($urlPath -eq "/" -or $urlPath -eq "") {
            $urlPath = "/index.html"
        }

        # ----------------------------------------------------------------------
        # ENDPOINT 0.9: Emparejamiento de sesión local (POST /api/session)
        # Reemplaza el antiguo GET /api/token abierto. Requiere pairing one-time
        # emitido al arranque (.server_pairing) e Origin/Referer localhost.
        # ----------------------------------------------------------------------
        if ($urlPath -eq "/api/session" -and $request.HttpMethod -eq "POST") {
            if (-not (Test-IsLocalBrowserOrigin $request)) {
                Send-Unauthorized $response $utf8NoBom
                continue
            }
            if ($request.ContentLength64 -gt 4096) {
                $response.StatusCode = 413
                $resBytes = $utf8NoBom.GetBytes('{"status":"error","message":"Carga util demasiado grande"}')
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $resBytes.Length
                $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
                $response.Close()
                continue
            }
            $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
            $body = $reader.ReadToEnd()
            $reader.Close()
            $parsed = ConvertFrom-Json $body -ErrorAction SilentlyContinue
            $pairing = ""
            if ($parsed -and $parsed.pairing) { $pairing = [string]$parsed.pairing.Trim() }

            $authorizedAlready = Test-ApiAuthorized $request
            $pairingOk = $false
            if ($pairing -and (-not $script:pairingConsumed) -and ($pairing -eq $globalPairingCode)) {
                $pairingOk = $true
                $script:pairingConsumed = $true
                try { if (Test-Path $pairingPath) { Remove-Item $pairingPath -Force -ErrorAction SilentlyContinue } } catch {}
            }

            if (-not $authorizedAlready -and -not $pairingOk) {
                Send-Unauthorized $response $utf8NoBom
                continue
            }

            Set-SessionCookie $response
            $tokenObj = @{
                status = "ok"
                port = $Port
                token = $globalServerToken
                powerBiUrl = "http://localhost:$Port/api/powerbi/dataset"
                authMode = "bearer_or_cookie"
                message = "Sesion local emparejada. Use Authorization: Bearer o cookie HttpOnly."
            }
            $jsonResp = ConvertTo-Json -InputObject $tokenObj -Compress
            $resBytes = $utf8NoBom.GetBytes($jsonResp)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $resBytes.Length
            $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
            $response.Close()
            continue
        }

        # ----------------------------------------------------------------------
        # ENDPOINT 0.85: Emitir pairing fresco (solo procesos locales sin Origin)
        # Usado por abrir_app.bat; los navegadores envían Origin y quedan bloqueados.
        # ----------------------------------------------------------------------
        if ($urlPath -eq "/api/pair/mint" -and $request.HttpMethod -eq "POST") {
            $hasOrigin = [string]$request.Headers["Origin"]
            if ((-not $request.IsLocal) -or ($hasOrigin -and $hasOrigin.Trim().Length -gt 0)) {
                Send-Unauthorized $response $utf8NoBom
                continue
            }
            $globalPairingCode = [System.Guid]::NewGuid().ToString("N").Substring(0, 24)
            $script:pairingConsumed = $false
            [System.IO.File]::WriteAllText($pairingPath, $globalPairingCode, $utf8NoBom)
            $mintObj = @{ status = "ok"; pairing = $globalPairingCode; port = $Port }
            $jsonResp = ConvertTo-Json -InputObject $mintObj -Compress
            $resBytes = $utf8NoBom.GetBytes($jsonResp)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $resBytes.Length
            $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
            $response.Close()
            continue
        }

        # Compatibilidad: GET /api/token ya no entrega el secreto (410 Gone)
        if ($urlPath -eq "/api/token") {
            $response.StatusCode = 410
            $gone = @{
                status = "gone"
                message = "GET /api/token fue retirado. Use POST /api/session con codigo de emparejamiento."
                sessionEndpoint = "/api/session"
            }
            $jsonResp = ConvertTo-Json -InputObject $gone -Compress
            $resBytes = $utf8NoBom.GetBytes($jsonResp)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $resBytes.Length
            $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
            $response.Close()
            continue
        }

        # ----------------------------------------------------------------------
        # ENDPOINT 1: Estado y Diagnóstico del Servidor (/api/health)
        # Público: solo status mínimo. Detalle → autenticado.
        # ----------------------------------------------------------------------
        if ($urlPath -eq "/api/health" -and ($request.HttpMethod -eq "GET" -or $request.HttpMethod -eq "HEAD")) {
            $uptime = [int]((Get-Date) - $serverStartTime).TotalSeconds
            if (Test-ApiAuthorized $request) {
                $cloudDbPath = Join-Path $baseDir "central_cloud_data.json"
                $cloudSize = 0
                $cloudExists = Test-Path $cloudDbPath -PathType Leaf
                if ($cloudExists) { $cloudSize = (Get-Item $cloudDbPath).Length }
                $healthData = @{
                    status = "healthy"
                    server = "PAOLO ALDEA & ABOGADOS - Servidor Local Resiliente v2.1"
                    uptimeSeconds = $uptime
                    cloudDataExists = $cloudExists
                    cloudDataSizeBytes = $cloudSize
                    port = $Port
                    timestamp = (Get-Date).ToString("o")
                }
            } else {
                $healthData = @{
                    status = "healthy"
                    port = $Port
                }
            }
            $jsonResp = ConvertTo-Json -InputObject $healthData -Depth 4 -Compress
            $resBytes = $utf8NoBom.GetBytes($jsonResp)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $resBytes.Length
            if ($request.HttpMethod -eq "GET") {
                $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
            }
            $response.Close()
            continue
        }

        # ----------------------------------------------------------------------
        # ENDPOINT 1.5: Conector Analítico Power BI (/api/powerbi/dataset)
        # Permite importar datos directamente a Power BI Desktop / Service vía Web
        # ----------------------------------------------------------------------
        if ($urlPath -like "/api/powerbi*" -and ($request.HttpMethod -eq "GET" -or $request.HttpMethod -eq "HEAD")) {
            if (-not (Test-ApiAuthorized $request)) { Send-Unauthorized $response $utf8NoBom; continue }
            $cloudDbPath = Join-Path $baseDir "central_cloud_data.json"
            $dataset = @{
                caja_chica = @()
                casos = @()
                citas = @()
                inventario = @()
                documentos = @()
                presupuestos = @()
                attendance = @()
                timestamp = (Get-Date).ToString("o")
            }
            if (Test-Path $cloudDbPath -PathType Leaf) {
                try {
                    $rawJson = [System.IO.File]::ReadAllText($cloudDbPath, [System.Text.Encoding]::UTF8)
                    $parsed = ConvertFrom-Json $rawJson -ErrorAction SilentlyContinue
                    if ($parsed) {
                        $source = if ($parsed.data) { $parsed.data } else { $parsed }
                        if ($source.caja_chica) { $dataset.caja_chica = $source.caja_chica }
                        if ($source.casos) { $dataset.casos = $source.casos }
                        if ($source.citas) { $dataset.citas = $source.citas }
                        if ($source.inventario) { $dataset.inventario = $source.inventario }
                        if ($source.documentos) { $dataset.documentos = $source.documentos }
                        if ($source.presupuestos) { $dataset.presupuestos = $source.presupuestos }
                        if ($source.attendance) { $dataset.attendance = $source.attendance }
                    }
                } catch {}
            }

            $outputObj = $dataset
            if ($urlPath -eq "/api/powerbi/caja_chica" -or $urlPath -eq "/api/powerbi/caja") { $outputObj = $dataset.caja_chica }
            elseif ($urlPath -eq "/api/powerbi/casos") { $outputObj = $dataset.casos }
            elseif ($urlPath -eq "/api/powerbi/presupuestos") { $outputObj = $dataset.presupuestos }
            elseif ($urlPath -eq "/api/powerbi/inventario") { $outputObj = $dataset.inventario }
            elseif ($urlPath -eq "/api/powerbi/asistencia" -or $urlPath -eq "/api/powerbi/attendance") { $outputObj = $dataset.attendance }

            $jsonResp = ConvertTo-Json -InputObject $outputObj -Depth 6 -Compress
            $resBytes = $utf8NoBom.GetBytes($jsonResp)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $resBytes.Length
            if ($request.HttpMethod -eq "GET") {
                $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
            }
            $response.Close()
            continue
        }

        # ----------------------------------------------------------------------
        # ENDPOINT 2: Respaldo Snapshot Automatizado (/api/backup)
        # ----------------------------------------------------------------------
        if ($urlPath -eq "/api/backup") {
            if (-not (Test-ApiAuthorized $request)) { Send-Unauthorized $response $utf8NoBom; continue }
            $backupRoot = Join-Path $baseDir "_backups"
            $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
            $targetZip = Join-Path $backupRoot "snapshot_$timestamp.zip"
            $tempStage = Join-Path $env:TEMP "lex_stage_$timestamp"

            try {
                if (-not (Test-Path $backupRoot)) {
                    New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
                }
                New-Item -ItemType Directory -Path $tempStage -Force | Out-Null

                # Allowlist: no incluir secretos, node_modules ni dumps de nube
                $backupAllow = @(
                    "index.html", "manifest.json", "sw.js", "package.json", "package-lock.json",
                    "README.md", "firebase.json", "firestore.rules", "firestore.indexes.json",
                    "netlify.toml", ".env.example", ".gitignore",
                    "js", "css", "assets", "views", "lib", "tests", "herramientas", "netlify"
                )
                $backupDenyNames = @(
                    ".server_token", ".server_port", ".server_pairing",
                    "central_cloud_data.json", "central_cloud_data.json.bak", "central_cloud_data.json.tmp",
                    "alertas_locales.json", "alertas_locales.json.tmp",
                    "node_modules", "_backups"
                )
                foreach ($name in $backupAllow) {
                    $src = Join-Path $baseDir $name
                    if (Test-Path $src) {
                        $leaf = Split-Path $src -Leaf
                        if ($backupDenyNames -contains $leaf) { continue }
                        Copy-Item -Path $src -Destination $tempStage -Recurse -Force
                    }
                }

                Compress-Archive -Path "$tempStage\*" -DestinationPath $targetZip -CompressionLevel Optimal -Force
                Remove-Item -Path $tempStage -Recurse -Force

                $logFile = Join-Path $backupRoot "historial_versiones.txt"
                $zipSizeKB = [math]::Round(((Get-Item $targetZip).Length / 1KB), 1)
                $logEntry = "[$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))] Snapshot ZIP via Web API: snapshot_$timestamp.zip ($zipSizeKB KB)"
                Add-Content -Path $logFile -Value $logEntry -Encoding UTF8

                # Política de Retención Inteligente: Mantener solo los 5 snapshots ZIP más recientes
                $maxSnapshots = 5
                $zipBackups = Get-ChildItem -Path $backupRoot -Filter "snapshot_*.zip" | Sort-Object CreationTime -Descending
                if ($zipBackups.Count -gt $maxSnapshots) {
                    $obsolete = $zipBackups | Select-Object -Skip $maxSnapshots
                    foreach ($oldZip in $obsolete) {
                        Remove-Item -Path $oldZip.FullName -Force
                        Add-Content -Path $logFile -Value "[$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))] Rotacion automatica: Eliminado snapshot ZIP $($oldZip.Name)" -Encoding UTF8
                    }
                }

                $backupRes = @{
                    status = "ok"
                    snapshot = "snapshot_$timestamp.zip"
                    path = $targetZip
                    sizeKB = $zipSizeKB
                    timestamp = (Get-Date).ToString("o")
                }
                $jsonResp = ConvertTo-Json -InputObject $backupRes -Depth 3 -Compress
                $resBytes = $utf8NoBom.GetBytes($jsonResp)
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $resBytes.Length
                $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
            } catch {
                $response.StatusCode = 500
                $errPkg = @{ status = "error"; message = $_.Exception.Message }
                $jsonResp = ConvertTo-Json -InputObject $errPkg -Compress
                $resBytes = $utf8NoBom.GetBytes($jsonResp)
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $resBytes.Length
                $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
            }
            $response.Close()
            continue
        }

        # ----------------------------------------------------------------------
        # ENDPOINT 3: Alertas Locales con Escritura Atómica (/api/alertas_sync)
        # ----------------------------------------------------------------------
        if ($urlPath -eq "/api/alertas_sync" -and $request.HttpMethod -eq "POST") {
            if (-not (Test-ApiAuthorized $request)) { Send-Unauthorized $response $utf8NoBom; continue }
            if ($request.ContentLength64 -gt 2097152) {
                $response.StatusCode = 413
                $resBytes = $utf8NoBom.GetBytes('{"status":"error","message":"Carga util demasiado grande"}')
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $resBytes.Length
                $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
                $response.Close()
                continue
            }

            $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
            $body = $reader.ReadToEnd()
            $reader.Close()

            $parsed = ConvertFrom-Json $body -ErrorAction SilentlyContinue
            if ($null -eq $parsed) {
                $response.StatusCode = 400
                $resBytes = $utf8NoBom.GetBytes('{"status":"error","message":"JSON no válido"}')
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $resBytes.Length
                $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
                $response.Close()
                continue
            }
            
            $alertFilePath = Join-Path $baseDir "alertas_locales.json"
            $alertTmpPath = Join-Path $baseDir "alertas_locales.json.tmp"
            
            # Escritura atómica para evitar corrupción por apagado imprevisto
            [System.IO.File]::WriteAllText($alertTmpPath, $body, $utf8NoBom)
            if (Test-Path $alertTmpPath) {
                Move-Item -Path $alertTmpPath -Destination $alertFilePath -Force
            }

            $resBytes = $utf8NoBom.GetBytes('{"status":"ok","message":"Alertas sincronizadas localmente de forma segura"}')
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $resBytes.Length
            $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
            $response.Close()
            continue
        }

        # ----------------------------------------------------------------------
        # ENDPOINT 4: Sincronización Multi-Sede Transaccional (/api/cloud_sync)
        # ----------------------------------------------------------------------
        if ($urlPath -eq "/api/cloud_sync") {
            if (-not (Test-ApiAuthorized $request)) { Send-Unauthorized $response $utf8NoBom; continue }
            if ($request.HttpMethod -eq "GET" -or $request.HttpMethod -eq "HEAD") {
                $cloudStatus = @{
                    status = "online"
                    server = "Paolo Aldea Cloud Hub Multi-Sede (Transaccional)"
                    version = "7.0"
                    timestamp = (Get-Date).ToString("o")
                    storageReady = $true
                    collections = @("caja_chica", "casos", "citas", "inventario", "documentos", "presupuestos", "attendance", "workers")
                }
                $jsonResp = ConvertTo-Json -InputObject $cloudStatus -Depth 5 -Compress
                $resBytes = $utf8NoBom.GetBytes($jsonResp)
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $resBytes.Length
                if ($request.HttpMethod -eq "GET") {
                    $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
                }
                $response.Close()
                continue
            }

            if ($request.HttpMethod -eq "POST") {
                if ($request.ContentLength64 -gt 15728640) {
                    $response.StatusCode = 413
                    $resBytes = $utf8NoBom.GetBytes('{"status":"error","message":"Carga útil excede 15MB"}')
                    $response.ContentType = "application/json; charset=utf-8"
                    $response.ContentLength64 = $resBytes.Length
                    $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
                    $response.Close()
                    continue
                }

                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd()
                $reader.Close()

                $parsed = ConvertFrom-Json $body -ErrorAction SilentlyContinue
                if ($null -eq $parsed -or $null -eq $parsed.data) {
                    $response.StatusCode = 400
                    $resBytes = $utf8NoBom.GetBytes('{"status":"error","message":"Paquete de sincronización no válido"}')
                    $response.ContentType = "application/json; charset=utf-8"
                    $response.ContentLength64 = $resBytes.Length
                    $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
                    $response.Close()
                    continue
                }

                $cloudDbPath = Join-Path $baseDir "central_cloud_data.json"
                $cloudDbTmp = Join-Path $baseDir "central_cloud_data.json.tmp"
                $cloudDbBak = Join-Path $baseDir "central_cloud_data.json.bak"
                $existingCloud = @{}
                $existingTombstones = @{}
                $collectionNames = @("caja_chica", "casos", "citas", "inventario", "documentos", "presupuestos", "attendance", "workers")

                # Carga con auto-recuperación (Self-Healing)
                if (Test-Path $cloudDbPath -PathType Leaf) {
                    try {
                        $rawJson = [System.IO.File]::ReadAllText($cloudDbPath, [System.Text.Encoding]::UTF8)
                        $loaded = ConvertFrom-Json $rawJson -ErrorAction SilentlyContinue
                        if ($null -ne $loaded) {
                            $loadedSource = if ($null -ne $loaded.data -and $null -eq $loaded.workers) { $loaded.data } else { $loaded }
                            $deletedSource = if ($null -ne $loaded._deletedIds) { $loaded._deletedIds } elseif ($null -ne $loaded.deletedIds) { $loaded.deletedIds } else { $null }
                            foreach ($col in $collectionNames) {
                                if ($null -ne $loadedSource.$col) {
                                    $existingCloud[$col] = [System.Collections.ArrayList]::new(@($loadedSource.$col))
                                }
                                if ($null -ne $deletedSource -and $null -ne $deletedSource.$col) {
                                    $existingTombstones[$col] = [System.Collections.ArrayList]::new(@($deletedSource.$col))
                                }
                            }
                        }
                    } catch {
                        # Si hubo daño, intentar restaurar de .bak
                        if (Test-Path $cloudDbBak -PathType Leaf) {
                            try {
                                $rawBak = [System.IO.File]::ReadAllText($cloudDbBak, [System.Text.Encoding]::UTF8)
                                $loadedBak = ConvertFrom-Json $rawBak -ErrorAction SilentlyContinue
                                if ($null -ne $loadedBak) {
                                    foreach ($col in $collectionNames) {
                                        if ($null -ne $loadedBak.$col) {
                                            $existingCloud[$col] = [System.Collections.ArrayList]::new([object[]]$loadedBak.$col)
                                        }
                                        if ($null -ne $loadedBak._deletedIds -and $null -ne $loadedBak._deletedIds.$col) {
                                            $existingTombstones[$col] = [System.Collections.ArrayList]::new([object[]]$loadedBak._deletedIds.$col)
                                        }
                                    }
                                }
                            } catch {}
                        }
                    }
                }

                foreach ($col in $collectionNames) {
                    if (-not $existingCloud.ContainsKey($col) -or $null -eq $existingCloud[$col]) {
                        $existingCloud[$col] = [System.Collections.ArrayList]::new()
                    }
                    if (-not $existingTombstones.ContainsKey($col) -or $null -eq $existingTombstones[$col]) {
                        $existingTombstones[$col] = [System.Collections.ArrayList]::new()
                    }

                    # 1. Consolidar Tombstones (IDs eliminados) para esta colección
                    $tombstoneSet = [System.Collections.Generic.HashSet[string]]::new()
                    foreach ($tid in $existingTombstones[$col]) {
                        if ($null -ne $tid) { [void]$tombstoneSet.Add([string]$tid) }
                    }
                    if ($null -ne $parsed.deletedIds -and $null -ne $parsed.deletedIds.$col) {
                        foreach ($inDelId in $parsed.deletedIds.$col) {
                            if ($null -ne $inDelId) {
                                $delStr = [string]$inDelId
                                if ($tombstoneSet.Add($delStr)) {
                                    [void]$existingTombstones[$col].Add($delStr)
                                }
                            }
                        }
                    }

                    # 2. Purgar registros que estén en tombstones
                    if ($tombstoneSet.Count -gt 0) {
                        $filteredList = [System.Collections.ArrayList]::new()
                        foreach ($it in $existingCloud[$col]) {
                            if ($null -ne $it -and $null -ne $it.id -and -not $tombstoneSet.Contains([string]$it.id)) {
                                [void]$filteredList.Add($it)
                            }
                        }
                        $existingCloud[$col] = $filteredList
                    }

                    # 3. Fusionar registros entrantes (ignorando eliminados)
                    $incomingItems = $parsed.data.$col
                    if ($null -ne $incomingItems) {
                        $idxMap = @{}
                        for ($i = 0; $i -lt $existingCloud[$col].Count; $i++) {
                            $it = $existingCloud[$col][$i]
                            if ($null -ne $it -and $null -ne $it.id) {
                                $idxMap[[string]$it.id] = $i
                            }
                        }

                        foreach ($inItem in @($incomingItems)) {
                            if ($null -eq $inItem -or $null -eq $inItem.id) { continue }
                            $itemId = [string]$inItem.id
                            if ($tombstoneSet.Contains($itemId)) { continue }
                            if ($idxMap.ContainsKey($itemId)) {
                                $existingCloud[$col][$idxMap[$itemId]] = $inItem
                            } else {
                                [void]$existingCloud[$col].Add($inItem)
                                $idxMap[$itemId] = $existingCloud[$col].Count - 1
                            }
                        }
                    }
                }

                # Guardar también _deletedIds en el archivo central para persistencia de tombstones
                $toSaveDisk = @{}
                foreach ($k in $existingCloud.Keys) { $toSaveDisk[$k] = $existingCloud[$k] }
                $toSaveDisk["_deletedIds"] = $existingTombstones

                # Persistencia Atómica ACID: Escribir a .tmp, respaldar a .bak y mover a destino final
                # Una sola serialización pesada (Semana 4 / P4) — la respuesta POST es ACK liviano
                $cloudDbJson = ConvertTo-Json -InputObject $toSaveDisk -Depth 10 -Compress
                [System.IO.File]::WriteAllText($cloudDbTmp, $cloudDbJson, $utf8NoBom)
                
                if (Test-Path $cloudDbTmp) {
                    if (Test-Path $cloudDbPath) {
                        Copy-Item -Path $cloudDbPath -Destination $cloudDbBak -Force
                    }
                    Move-Item -Path $cloudDbTmp -Destination $cloudDbPath -Force
                }

                $counts = @{}
                foreach ($col in $collectionNames) {
                    $counts[$col] = @($existingCloud[$col]).Count
                }

                # ACK liviano: evita un segundo ConvertTo-Json del dataset completo.
                # El cliente hidrata con GET /api/cloud_snapshot (stream del archivo).
                $wantFull = $false
                try {
                    $qs = $request.Url.Query
                    if ($qs -and ($qs -match "[?&]full=1")) { $wantFull = $true }
                } catch {}

                if ($wantFull) {
                    $outPkg = @{
                        protocol = "LEX_MULTI_SEDE_SYNC_V2"
                        status = "ok"
                        message = "Sincronización multi-sede completada (respuesta completa)"
                        timestamp = (Get-Date).ToString("o")
                        data = $existingCloud
                        deletedIds = $existingTombstones
                        counts = $counts
                    }
                    $resJson = ConvertTo-Json -InputObject $outPkg -Depth 10 -Compress
                } else {
                    $outPkg = @{
                        protocol = "LEX_MULTI_SEDE_SYNC_V2"
                        status = "ok"
                        ackOnly = $true
                        message = "Sincronización multi-sede completada; usar /api/cloud_snapshot para hidratar"
                        timestamp = (Get-Date).ToString("o")
                        deletedIds = $existingTombstones
                        counts = $counts
                    }
                    $resJson = ConvertTo-Json -InputObject $outPkg -Depth 6 -Compress
                }
                $resBytes = $utf8NoBom.GetBytes($resJson)
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $resBytes.Length
                $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
                $response.Close()
                continue
            }
        }

        # ----------------------------------------------------------------------
        # ENDPOINT: Snapshot cloud (GET /api/cloud_snapshot) — stream sin re-serializar
        # Semana 4 / P4: sirve central_cloud_data.json tal cual desde disco
        # ----------------------------------------------------------------------
        if ($urlPath -eq "/api/cloud_snapshot" -and ($request.HttpMethod -eq "GET" -or $request.HttpMethod -eq "HEAD")) {
            if (-not (Test-ApiAuthorized $request)) { Send-Unauthorized $response $utf8NoBom; continue }
            $cloudDbPath = Join-Path $baseDir "central_cloud_data.json"
            if (-not (Test-Path $cloudDbPath -PathType Leaf)) {
                $empty = '{"caja_chica":[],"casos":[],"citas":[],"inventario":[],"documentos":[],"presupuestos":[],"attendance":[],"workers":[],"_deletedIds":{}}'
                $resBytes = $utf8NoBom.GetBytes($empty)
                $response.StatusCode = 200
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $resBytes.Length
                if ($request.HttpMethod -eq "GET") {
                    $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
                }
                $response.Close()
                continue
            }
            $fileInfo = Get-Item -LiteralPath $cloudDbPath
            $response.StatusCode = 200
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $fileInfo.Length
            if ($request.HttpMethod -eq "GET") {
                $fs = [System.IO.File]::OpenRead($cloudDbPath)
                try {
                    $fs.CopyTo($response.OutputStream)
                } finally {
                    $fs.Close()
                }
            }
            $response.Close()
            continue
        }

        # ----------------------------------------------------------------------
        # SERVIR ARCHIVOS ESTÁTICOS CON STREAMING DE ALTA EFICIENCIA
        # ----------------------------------------------------------------------
        $relativeFile = [System.Uri]::UnescapeDataString($urlPath.TrimStart("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar))
        $filePath = [System.IO.Path]::GetFullPath((Join-Path $baseDir $relativeFile))

        # Validación estricta de Path Traversal
        if (-not $filePath.StartsWith($baseDirFull, [System.StringComparison]::OrdinalIgnoreCase) -and ($filePath -ne $baseDir.TrimEnd('\', '/'))) {
            $response.StatusCode = 403
            $forbiddenBytes = [System.Text.Encoding]::UTF8.GetBytes("Acceso denegado (Path Traversal Protection).")
            $response.ContentType = "text/plain; charset=utf-8"
            $response.ContentLength64 = $forbiddenBytes.Length
            $response.OutputStream.Write($forbiddenBytes, 0, $forbiddenBytes.Length)
            $response.Close()
            continue
        }

        # Bloqueo estricto de acceso estático a archivos internos de sistema
        $reqFileName = [System.IO.Path]::GetFileName($filePath).ToLowerInvariant()
        $blockedExts = @(".ps1", ".bat", ".vbs", ".sql", ".bak", ".tmp")
        $blockedFiles = @(".server_token", ".server_port", ".server_pairing", "central_cloud_data.json", "alertas_locales.json", "database_cloud_schema.sql")
        if ($reqFileName.StartsWith(".") -or $blockedFiles -contains $reqFileName -or $blockedExts -contains [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()) {
            $response.StatusCode = 403
            $forbiddenBytes = [System.Text.Encoding]::UTF8.GetBytes("Acceso denegado a recurso interno del despacho.")
            $response.ContentType = "text/plain; charset=utf-8"
            $response.ContentLength64 = $forbiddenBytes.Length
            $response.OutputStream.Write($forbiddenBytes, 0, $forbiddenBytes.Length)
            $response.Close()
            continue
        }

        if (-not (Test-Path $filePath -PathType Leaf)) {
            $response.StatusCode = 404
            $notFoundBytes = [System.Text.Encoding]::UTF8.GetBytes("Recurso no encontrado: $urlPath")
            $response.ContentType = "text/plain; charset=utf-8"
            $response.ContentLength64 = $notFoundBytes.Length
            $response.OutputStream.Write($notFoundBytes, 0, $notFoundBytes.Length)
            $response.Close()
            continue
        }

        $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
        $contentType = "application/octet-stream"
        if ($mimeTypes.ContainsKey($extension)) {
            $contentType = $mimeTypes[$extension]
        }
        $response.ContentType = $contentType

        # Control de Caché inteligente (Sin caché para código vivo de despacho)
        if ($urlPath.EndsWith(".html") -or $urlPath.EndsWith(".json") -or $urlPath.EndsWith(".js") -or $urlPath.EndsWith(".css")) {
            $response.Headers.Add("Cache-Control", "no-cache, no-store, must-revalidate")
            $response.Headers.Add("Pragma", "no-cache")
            $response.Headers.Add("Expires", "0")
        } else {
            $response.Headers.Add("Cache-Control", "public, max-age=3600")
        }

        if ($request.HttpMethod -eq "HEAD") {
            $fileInfo = Get-Item $filePath
            $response.ContentLength64 = $fileInfo.Length
            $response.StatusCode = 200
            $response.Close()
            continue
        }

        # Solo metadatos no secretos en index.html (el Bearer se obtiene vía POST /api/session)
        if ($urlPath -eq "/index.html") {
            $htmlRaw = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)
            $metaScript = "<script>window.__LOCAL_SERVER_PORT__=$Port;window.__LOCAL_SERVER_SESSION_API__='/api/session';</script>"
            if ($htmlRaw.Contains("</head>")) {
                $htmlRaw = $htmlRaw.Replace("</head>", "$metaScript</head>")
            }
            $htmlBytes = $utf8NoBom.GetBytes($htmlRaw)
            $response.ContentLength64 = $htmlBytes.Length
            $response.OutputStream.Write($htmlBytes, 0, $htmlBytes.Length)
            $response.Close()
            continue
        }

        # Streaming directo mediante FileStream (ahorro de memoria RAM y arranque ultra rápido)
        $fileStream = [System.IO.File]::OpenRead($filePath)
        try {
            $response.ContentLength64 = $fileStream.Length
            $fileStream.CopyTo($response.OutputStream)
        } finally {
            $fileStream.Close()
        }
        $response.Close()

    } catch {
        try {
            if ($response -and $response.OutputStream) {
                $response.StatusCode = 500
                $errBytes = [System.Text.Encoding]::UTF8.GetBytes('{"status":"error","message":"Error interno del servidor local"}')
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $errBytes.Length
                $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
                $response.Close()
            }
        } catch {}
    }
}
