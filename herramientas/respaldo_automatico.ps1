# ==============================================================================
# PAOLO ALDEA & ABOGADOS - Respaldo y Snapshot Versionado Local
# Permite control de versiones sin dependencias externas
# ==============================================================================

$baseDir = Split-Path -Parent $PSScriptRoot
$backupRoot = Join-Path $baseDir "_backups"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$targetZip = Join-Path $backupRoot "snapshot_$timestamp.zip"
$tempStage = Join-Path $env:TEMP "lex_stage_$timestamp"

if (-not (Test-Path $backupRoot)) {
    New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
}

try {
    # 1. Copiar elementos a stage temporal
    New-Item -ItemType Directory -Path $tempStage -Force | Out-Null
    $items = Get-ChildItem -Path $baseDir -Exclude "_backups"
    foreach ($item in $items) {
        Copy-Item -Path $item.FullName -Destination $tempStage -Recurse -Force
    }

    # 2. Comprimir en archivo .zip óptimo
    Compress-Archive -Path "$tempStage\*" -DestinationPath $targetZip -CompressionLevel Optimal -Force
    Remove-Item -Path $tempStage -Recurse -Force

    # 3. Mantener un registro log de versiones
    $logFile = Join-Path $backupRoot "historial_versiones.txt"
    $zipSizeKB = [math]::Round(((Get-Item $targetZip).Length / 1KB), 1)
    $logEntry = "[$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))] Snapshot ZIP comprimido: snapshot_$timestamp.zip ($zipSizeKB KB) por $((Get-Item env:USERNAME).Value)"
    Add-Content -Path $logFile -Value $logEntry -Encoding UTF8

    # 4. Política de Retención Inteligente: Mantener solo los 5 snapshots ZIP más recientes
    $maxSnapshots = 5
    $zipBackups = Get-ChildItem -Path $backupRoot -Filter "snapshot_*.zip" | Sort-Object CreationTime -Descending
    if ($zipBackups.Count -gt $maxSnapshots) {
        $obsolete = $zipBackups | Select-Object -Skip $maxSnapshots
        foreach ($oldZip in $obsolete) {
            Remove-Item -Path $oldZip.FullName -Force
            Add-Content -Path $logFile -Value "[$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))] Rotacion automatica: Eliminado snapshot ZIP $($oldZip.Name)" -Encoding UTF8
        }
    }

    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "  Respaldo ZIP completado satisfactoriamente!" -ForegroundColor Green
    Write-Host "  Archivo: $targetZip ($zipSizeKB KB)" -ForegroundColor Yellow
    Write-Host "  Registro actualizado en: $logFile" -ForegroundColor Gray
    Write-Host "============================================================" -ForegroundColor Cyan
} catch {
    if (Test-Path $tempStage) { Remove-Item -Path $tempStage -Recurse -Force -ErrorAction SilentlyContinue }
    Write-Host "Error al generar respaldo: $_" -ForegroundColor Red
}
