# ==============================================================================
# PAOLO ALDEA & ABOGADOS - Compilador de Bundle HTML (Semana 3 — shell liviano)
# Solo inyecta vistas de arranque (asistencia + kpis). El resto y los modales
# se cargan bajo demanda vía ComponentLoader (views/*.html).
# ==============================================================================

$baseDir = Split-Path -Parent $PSScriptRoot
$viewsDir = Join-Path $baseDir "views"
$htmlFile = Join-Path $baseDir "index.html"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

if (-not (Test-Path $viewsDir)) {
    Write-Host "[ERROR] Carpeta views/ no encontrada." -ForegroundColor Red
    exit 1
}

# P1: cold-start mínimo — el resto lo trae ComponentLoader al cambiar de pestaña
$mainViews = @(
    "view-kpis.html",
    "view-asistencia.html"
)

$original = [System.IO.File]::ReadAllLines($htmlFile, [System.Text.Encoding]::UTF8)

$startIdx = -1
$mainCloseIdx = -1
$modalsStartIdx = -1
$endIdx = -1

for ($i = 0; $i -lt $original.Count; $i++) {
    if ($startIdx -eq -1 -and $original[$i] -match 'id="view-kpis"') {
        $startIdx = $i
    }
    if ($mainCloseIdx -eq -1 -and $original[$i] -match '^\s*</main>') {
        $mainCloseIdx = $i
    }
    if ($modalsStartIdx -eq -1 -and $original[$i] -match 'id="modalMasterAuth"') {
        $modalsStartIdx = $i
    }
    if ($endIdx -eq -1 -and $original[$i] -match '<!-- Scripts del Sistema -->') {
        $endIdx = $i
    }
}

if ($startIdx -eq -1 -or $endIdx -eq -1) {
    Write-Host "[ERROR] No se pudieron localizar los delimitadores de vistas en index.html." -ForegroundColor Red
    exit 1
}

$header = $original[0..($startIdx - 1)]
$footer = $original[$endIdx..($original.Count - 1)]

$combinedMain = @()
foreach ($vf in $mainViews) {
    $vPath = Join-Path $viewsDir $vf
    if (Test-Path $vPath) {
        $content = [System.IO.File]::ReadAllLines($vPath, [System.Text.Encoding]::UTF8)
        $combinedMain += $content
    } else {
        Write-Host "[ADVERTENCIA] No se encontró el archivo $vf" -ForegroundColor Yellow
    }
}

$middleBridge = @()
if ($mainCloseIdx -gt 0) {
    if ($modalsStartIdx -gt $mainCloseIdx) {
        $middleBridge = $original[$mainCloseIdx..($modalsStartIdx - 1)]
    } else {
        # Ya no hay bloque de modales inlined: tomar desde </main> hasta scripts
        $middleBridge = $original[$mainCloseIdx..($endIdx - 1)]
    }
}

# Modales NO se inlined (P1) — se cargan con ensureModalsLoaded()
$modalsPlaceholder = @(
    "  <!-- Modales diferidos: views/view-modals.html vía ComponentLoader (Semana 3) -->"
)

$newHtml = [string[]]($header + $combinedMain + $middleBridge + $modalsPlaceholder + $footer)
[System.IO.File]::WriteAllLines($htmlFile, $newHtml, $utf8NoBom)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Bundle HTML liviano reensamblado (kpis + asistencia)!" -ForegroundColor Green
Write-Host "  Total de líneas resultantes: $($newHtml.Count)" -ForegroundColor Yellow
Write-Host "  Modales y resto de vistas: carga bajo demanda" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan
