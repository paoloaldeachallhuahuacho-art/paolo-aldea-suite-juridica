# ==============================================================================
# PAOLO ALDEA & ABOGADOS - Notificador en Segundo Plano para Windows (PC & Laptop)
# PAOLO ALDEA & ABOGADOS - Sede Challhuahuacho
# Monitor Autónomo 100% Offline de Plazos Fatales, Audiencias y Diligencias
# ==============================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$baseDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $baseDir

$alertFile = Join-Path $baseDir "alertas_locales.json"
$lastAlertStateHash = ""
$notifiedItems = @{}

# Función para emitir notificación Toast nativa de Windows 10 / 11
function Show-ToastNotification {
    param(
        [string]$Title,
        [string]$Message,
        [string]$Sound = "Reminder"
    )

    try {
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null

        $safeTitle = [System.Security.SecurityElement]::Escape($Title)
        $safeMsg = [System.Security.SecurityElement]::Escape($Message)

        $audioSrc = "ms-winsoundevent:Notification.$Sound"

        $template = @"
<toast duration="long">
    <visual>
        <binding template="ToastGeneric">
            <text>$safeTitle</text>
            <text>$safeMsg</text>
            <text placement="attribution">PAOLO ALDEA & ABOGADOS — PAOLO ALDEA &amp; ABOGADOS</text>
        </binding>
    </visual>
    <audio src="$audioSrc"/>
</toast>
"@
        $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
        $xml.LoadXml($template)
        $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
        $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("PAOLO ALDEA & ABOGADOS — Sede Challhuahuacho")
        $notifier.Show($toast)
    }
    catch {
        # Fallback mediante NotifyIcon en caso de que WinRT no esté disponible
        try {
            Add-Type -AssemblyName System.Windows.Forms
            $balloon = New-Object System.Windows.Forms.NotifyIcon
            $balloon.Icon = [System.Drawing.SystemIcons]::Warning
            $balloon.BalloonTipTitle = $Title
            $balloon.BalloonTipText = $Message
            $balloon.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Warning
            $balloon.Visible = $true
            $balloon.ShowBalloonTip(7000)
        } catch {}
    }
}

# Aviso inicial de activación
Show-ToastNotification -Title "⚖️ PAOLO ALDEA & ABOGADOS - Monitor de Despacho Activo" -Message "Vigilancia local autónoma de plazos procesales perentorios y audiencias judiciales en Cotabambas iniciada." -Sound "Default"

while ($true) {
    try {
        # Limpieza periódica de memoria para evitar saturación de la tabla de notificaciones
        if ($notifiedItems.Count -gt 250) {
            $threshold = (Get-Date).AddHours(-24)
            $keysToRemove = @()
            foreach ($key in $notifiedItems.Keys) {
                if ($notifiedItems[$key] -lt $threshold) {
                    $keysToRemove += $key
                }
            }
            foreach ($k in $keysToRemove) {
                $notifiedItems.Remove($k)
            }
        }

        # 1. Monitoreo del archivo de estado local de la suite (100% Offline)
        if (Test-Path $alertFile) {
            $currentContent = [System.IO.File]::ReadAllText($alertFile, [System.Text.Encoding]::UTF8)
            $currentHash = [System.BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash([System.Text.Encoding]::UTF8.GetBytes($currentContent)))

            if ($currentHash -ne $lastAlertStateHash) {
                $lastAlertStateHash = $currentHash
                $alertData = ConvertFrom-Json $currentContent -ErrorAction SilentlyContinue

                if ($alertData -and $alertData.urgentAlerts) {
                    foreach ($alert in $alertData.urgentAlerts) {
                        $key = "$($alert.id)_$($alert.expediente)"
                        if (-not $notifiedItems.ContainsKey($key)) {
                            $notifiedItems[$key] = [DateTime]::Now
                            Show-ToastNotification -Title "🚨 PLAZO PERENTORIO: $($alert.expediente)" -Message "$($alert.detalle) | Vence: $($alert.vencimiento)" -Sound "Looping.Alarm"
                        }
                    }
                }

                if ($alertData -and $alertData.audienciasHoy) {
                    foreach ($aud in $alertData.audienciasHoy) {
                        $keyAud = "AUD_$($aud.id)_$($aud.hora)"
                        if (-not $notifiedItems.ContainsKey($keyAud)) {
                            $notifiedItems[$keyAud] = [DateTime]::Now
                            Show-ToastNotification -Title "⚖️ AUDIENCIA JUDICIAL HOY: $($aud.hora)" -Message "$($aud.juzgado) | Caso: $($aud.expediente)" -Sound "Reminder"
                        }
                    }
                }
            }
        }
    } catch {
        # Operación silenciosa y continua
    }

    # Esperar 20 segundos entre ciclos de verificación local
    Start-Sleep -Seconds 20
}
