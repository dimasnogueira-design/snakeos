$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$settingsPath = 'data/private/ai-test-settings.json'
$settings = Get-Content -Raw -LiteralPath $settingsPath | ConvertFrom-Json
if (-not $settings.testContactId) { throw 'Cadastre o contato de teste antes de configurar IA.' }
Write-Host 'Teste de IA somente no contato cadastrado. Sem envio automatico. Limites: US$ 0,10/dia e US$ 0,50/mes.'
$secret = Read-Host 'Cole sua chave OpenAI API (entrada oculta)' -AsSecureString
if ($secret.Length -lt 20) { throw 'Chave incompleta; nenhuma alteracao realizada.' }
$secret | Export-Clixml -LiteralPath 'data/private/openai-key.xml'
$settings | Add-Member -NotePropertyName aiEnabled -NotePropertyValue $true -Force
[IO.File]::WriteAllText((Join-Path $PSScriptRoot $settingsPath), ($settings | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
Write-Host 'Chave protegida pelo Windows para este usuario. Reinicie o SNAKE pelo Iniciar-Snake.cmd.'
