$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$secretPath = Join-Path $PSScriptRoot 'data/private/openai-key.xml'
if (Test-Path -LiteralPath $secretPath) {
  $secret = Import-Clixml -LiteralPath $secretPath
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
  try { $env:OPENAI_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}
if (-not (Test-Path -LiteralPath 'admin/.next/BUILD_ID')) { throw 'O painel precisa ser compilado antes de iniciar. Consulte README-NOTEBOOK.md.' }
& node --import tsx scripts/notebook.ts
