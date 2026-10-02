$ErrorActionPreference='Stop'
Set-Location -LiteralPath $PSScriptRoot
$cloudflare=(Resolve-Path -LiteralPath '../../work/tools/cloudflared.exe').Path
$vercel=(Resolve-Path -LiteralPath '../../work/tools/node_modules/vercel/dist/index.js').Path
$log=Join-Path $PSScriptRoot 'data/private/tunnel-restart.log'
if(Test-Path -LiteralPath $log){ Move-Item -LiteralPath $log -Destination ($log+'.'+[DateTime]::Now.ToString('yyyyMMddHHmmss')) }
Invoke-RestMethod 'http://127.0.0.1:18788/health' | Out-Null
Start-Process -FilePath $cloudflare -ArgumentList @('tunnel','--url','http://127.0.0.1:18788','--protocol','http2','--no-autoupdate','--logfile',$log) -WindowStyle Hidden
$url=$null
for($attempt=0;$attempt -lt 30;$attempt++){
  Start-Sleep -Seconds 2
  if(Test-Path -LiteralPath $log){ $match=[regex]::Match((Get-Content -Raw -LiteralPath $log),'https://[a-z0-9-]+\.trycloudflare\.com');if($match.Success){$url=$match.Value;break} }
}
if(-not $url){throw 'A conexao nao iniciou. Confira a internet e tente novamente.'}
Set-Location -LiteralPath 'admin'
$url | & node $vercel env add SNAKE_CORE_URL production --sensitive --yes --force --scope dimasnogueira-9864
if($LASTEXITCODE -ne 0){throw 'A Vercel precisa de login. Nenhuma senha foi mostrada.'}
& node $vercel deploy --prod --yes --scope dimasnogueira-9864
if($LASTEXITCODE -ne 0){throw 'A publicacao nao concluiu.'}
Write-Host 'Painel remoto reconectado: https://snake-control.vercel.app'
