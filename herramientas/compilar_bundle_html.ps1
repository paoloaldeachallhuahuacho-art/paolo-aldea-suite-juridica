# ==============================================================================
# PAOLO ALDEA & ABOGADOS - Compilador de Bundle HTML (Desarrollo a Distribución)
# Reensambla index.html integrando las vistas actualizadas desde views/*.html
# ==============================================================================

$baseDir = Split-Path -Parent $PSScriptRoot
$viewsDir = Join-Path $baseDir "views"
$htmlFile = Join-Path $baseDir "index.html"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

if (-not (Test-Path $viewsDir)) {
    Write-Host "[ERROR] Carpeta views/ no encontrada." -ForegroundColor Red
    exit 1
}

$mainViews = @(
    "view-kpis.html",
    "view-caja_chica.html",
    "view-casos.html",
    "view-citas.html",
    "view-presupuestos.html",
    "view-inventario.html",
    "view-documentos.html",
    "view-asistencia.html",
    "view-personal.html",
    "view-roles_permisos.html",
    "view-master_admin.html"
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
if ($mainCloseIdx -gt 0 -and $modalsStartIdx -gt $mainCloseIdx) {
    $middleBridge = $original[$mainCloseIdx..($modalsStartIdx - 1)]
}

$modalsContent = @()
$modalsPath = Join-Path $viewsDir "view-modals.html"
if (Test-Path $modalsPath) {
    $modalsContent = [System.IO.File]::ReadAllLines($modalsPath, [System.Text.Encoding]::UTF8)
}

$newHtml = [string[]]($header + $combinedMain + $middleBridge + $modalsContent + $footer)
[System.IO.File]::WriteAllLines($htmlFile, $newHtml, $utf8NoBom)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Bundle HTML reensamblado satisfactoriamente!" -ForegroundColor Green
Write-Host "  Total de líneas resultantes: $($newHtml.Count)" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
