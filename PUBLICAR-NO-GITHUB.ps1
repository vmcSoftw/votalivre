# VotaLivre 1.0 RC2: sincroniza o projeto com o repositório GitHub existente.
# O script NÃO inclui .env.local, chaves nem artefatos de execução.
$ErrorActionPreference = 'Stop'
$source = (Resolve-Path $PSScriptRoot).Path
Set-Location $source
if (!(Test-Path (Join-Path $source 'package.json'))) { throw 'Abra a pasta que contém package.json.' }
if (!(Get-Command git -ErrorAction SilentlyContinue)) { throw 'Instale Git para Windows em https://git-scm.com/downloads' }
$repo = 'https://github.com/vmcSoftw/votalivre.git'
$destination = Join-Path (Split-Path $source -Parent) 'votalivre-repositorio-github'
Write-Host 'Destino:' $repo
Write-Host 'IMPORTANTE: confira a visibilidade em https://github.com/vmcSoftw/votalivre/settings'
Write-Host 'Recomenda-se PRIVATE. Nenhuma senha ou chave será incluída.'
if ((Read-Host 'Digite CONTINUAR para preparar a atualização') -cne 'CONTINUAR') { throw 'Operação cancelada.' }
if (Test-Path $destination) { throw "A pasta $destination já existe. Renomeie/remova SOMENTE esta pasta de trabalho e tente novamente, ou atualize pelo Git manualmente." }
& git clone $repo $destination
if ($LASTEXITCODE -ne 0) { throw 'Falha ao clonar o GitHub. Confira autenticação do Git.' }
$base = $source.TrimEnd('\','/')
$excludeDirs = @('.git','node_modules','.next','.vercel','secrets','commission-keys','coverage','.vscode')
$files = @(Get-ChildItem -LiteralPath $source -Recurse -File -Force)
foreach ($file in $files) {
  $relative = $file.FullName.Substring($base.Length).TrimStart([char]'\',[char]'/')
  $parts = @($relative -split '[/\\]')
  $name = $file.Name
  if (@($parts | Where-Object { $excludeDirs -contains $_ }).Count -gt 0) { continue }
  if ($name -like '.env*' -and $name -ne '.env.example') { continue }
  if ($name -match '\.(pem|p8|key|p12|pfx|sqlite|sqlite3)$' -or $name -like '*.CONFIDENCIAL.json' -or $name -like '*.private.json') { continue }
  $destFile = Join-Path $destination $relative
  New-Item -ItemType Directory -Path (Split-Path $destFile -Parent) -Force | Out-Null
  Copy-Item -LiteralPath $file.FullName -Destination $destFile -Force
}
Set-Location $destination
& git add -A
if ($LASTEXITCODE -ne 0) { throw 'Falha no git add.' }
$staged = @(& git diff --cached --name-only)
foreach ($path in $staged) {
  $parts = @($path -split '[/\\]')
  if (($parts -contains 'node_modules') -or ($parts -contains '.next') -or ($parts -contains '.vercel') -or ($parts -contains 'secrets')) { throw "Arquivo indevido: $path" }
  if ($path -match '(^|/)\.env(?!\.example$)' -or $path -match '\.(pem|p8|key|p12|pfx)$') { throw "Arquivo sigiloso: $path" }
}
Write-Host 'Arquivos preparados:'
& git status --short
if ((Read-Host 'Revise a lista. Digite PUBLICAR para enviar a atualização') -cne 'PUBLICAR') { throw 'Envio cancelado antes do commit.' }
if ($staged.Count -gt 0) {
  & git commit -m 'VotaLivre Secure 1.0 RC2 - cadastro de administradores'
  if ($LASTEXITCODE -ne 0) { throw 'Falha no git commit. Configure git user.name e user.email.' }
  & git push origin main
  if ($LASTEXITCODE -ne 0) { throw 'Falha no push; confira se você tem permissão de escrita e a branch main não mudou. NÃO use --force.' }
}
Write-Host 'Concluído. Confira: https://github.com/vmcSoftw/votalivre'
Write-Host 'A Vercel já está vinculada a este GitHub e iniciará uma nova implantação após o push.'
