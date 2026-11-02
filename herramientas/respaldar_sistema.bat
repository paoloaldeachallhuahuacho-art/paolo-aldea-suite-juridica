@echo off
chcp 65001 > nul
echo ==============================================================================
echo   PAOLO ALDEA & ABOGADOS - Sistema de Respaldo y Snapshot Versionado
echo   Sede Challhuahuacho ^& Multi-Sede Nacional
echo ==============================================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0respaldo_automatico.ps1"
pause
