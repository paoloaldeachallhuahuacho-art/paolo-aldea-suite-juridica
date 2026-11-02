' ==============================================================================
' PAOLO ALDEA & ABOGADOS - Lanzador Silencioso en Segundo Plano
' Ejecuta el notificador sin mostrar ninguna ventana de consola negra
' ==============================================================================
Set WshShell = CreateObject("WScript.Shell")
strPath = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
strCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & strPath & "\notificador_segundo_plano.ps1"""
WshShell.Run strCommand, 0, False
Set WshShell = Nothing
