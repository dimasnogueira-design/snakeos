$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$health = Invoke-RestMethod -Uri 'http://127.0.0.1:18788/health'
if ($health.autoSend -ne $false) { throw 'Esta instalação exige envio automatico desligado.' }
$localAccess = Get-Content -Raw -LiteralPath 'data/private/local-access.json' | ConvertFrom-Json
$protection = Get-Content -LiteralPath '.env' | Where-Object { $_ -like 'RAFAELLA_CONTACT_ID=*' } | Select-Object -First 1
if (-not $protection) { throw 'Cadastre Rafaella antes de conectar.' }
$env:RAFAELLA_CONTACT_ID = $protection.Split('=',2)[1].Trim()
$env:PROTECTED_CONTACT_IDS = $env:RAFAELLA_CONTACT_ID
$env:PROTECTED_CONTACT_NAMES = 'Rafaella'
$env:SNAKE_CORE_URL = 'http://127.0.0.1:18788'
$env:SNAKE_WORKER_KEY = $localAccess.workerKey
$env:WHATSAPP_ENABLED = 'true'
$env:WHATSAPP_SESSION_PATH = Join-Path $PSScriptRoot 'data/private/whatsapp'
$settingsPath = Join-Path $PSScriptRoot 'data/private/notebook-settings.json'
if (Test-Path -LiteralPath $settingsPath) {
  $notebookSettings = Get-Content -Raw -LiteralPath $settingsPath | ConvertFrom-Json
  if ($notebookSettings.whatsappSessionPath) { $env:WHATSAPP_SESSION_PATH = $notebookSettings.whatsappSessionPath }
  if ($notebookSettings.temporaryPath) {
    $env:TEMP = $notebookSettings.temporaryPath
    $env:TMP = $notebookSettings.temporaryPath
  }
}
$env:PUPPETEER_EXECUTABLE_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$env:PUPPETEER_HEADLESS = 'false'
Write-Host 'SNAKE em Observacao. No celular, abra WhatsApp > Aparelhos conectados > Conectar aparelho e escaneie o QR abaixo.'
$workerErrorLog = Join-Path (Split-Path -Parent $env:WHATSAPP_SESSION_PATH) 'worker-error.log'
Set-Location -LiteralPath 'workers/whatsapp'
$ErrorActionPreference = 'Continue'
& node --import tsx src/index.ts 2> $workerErrorLog
if ($LASTEXITCODE -ne 0) { Write-Host 'A conexao nao iniciou. O registro privado do erro foi salvo para diagnostico.' }
