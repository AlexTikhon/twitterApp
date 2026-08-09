[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$BackupDirectory,
  [Parameter(Mandatory = $true)]
  [string]$MongoUri,
  [switch]$ConfirmDataReplacement
)

$ErrorActionPreference = 'Stop'
$composeFile = Join-Path $PSScriptRoot '..\docker-compose.yml'
$backupPath = (Resolve-Path -LiteralPath $BackupDirectory -ErrorAction Stop).Path
$manifestPath = Join-Path $backupPath 'manifest.json'
$mongoArchive = Join-Path $backupPath 'mongodb.archive.gz'
$imagesPath = Join-Path $backupPath 'images'
$backendWasRunning = $false

function Invoke-CheckedCommand {
  param([string]$Command, [string[]]$Arguments)

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Command failed with exit code $LASTEXITCODE."
  }
}

if (-not $ConfirmDataReplacement) {
  throw 'Restore replaces the current database and images. Re-run with -ConfirmDataReplacement.'
}
if (-not (Get-Command mongorestore -ErrorAction SilentlyContinue)) {
  throw 'mongorestore is required. Install the MongoDB Database Tools first.'
}
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf) -or
    -not (Test-Path -LiteralPath $mongoArchive -PathType Leaf) -or
    -not (Test-Path -LiteralPath $imagesPath -PathType Container)) {
  throw 'The backup is incomplete: manifest, MongoDB archive, or images directory is missing.'
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$actualMongoHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $mongoArchive).Hash.ToLowerInvariant()
if ($actualMongoHash -ne $manifest.mongoSha256) {
  throw 'MongoDB archive checksum does not match the backup manifest.'
}

$imagesRoot = [System.IO.Path]::GetFullPath($imagesPath)
$actualImageFiles = @(Get-ChildItem -LiteralPath $imagesRoot -File -Recurse)
if ($actualImageFiles.Count -ne $manifest.imageFileCount -or
    $actualImageFiles.Count -ne @($manifest.images).Count) {
  throw 'The image file count does not match the backup manifest.'
}
foreach ($image in $manifest.images) {
  $imagePath = [System.IO.Path]::GetFullPath((Join-Path $imagesRoot $image.path))
  if (-not $imagePath.StartsWith($imagesRoot + [System.IO.Path]::DirectorySeparatorChar)) {
    throw "Unsafe image path in backup manifest: $($image.path)"
  }
  if (-not (Test-Path -LiteralPath $imagePath -PathType Leaf)) {
    throw "Image listed in backup manifest is missing: $($image.path)"
  }
  $actualImageHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $imagePath).Hash.ToLowerInvariant()
  if ($actualImageHash -ne $image.sha256) {
    throw "Image checksum mismatch: $($image.path)"
  }
}

$backendContainer = (& docker compose -f $composeFile ps -q backend).Trim()
if (-not $backendContainer) {
  throw 'The Compose backend container does not exist. Create it before restoring a backup.'
}
$runningState = (& docker inspect --format '{{.State.Running}}' $backendContainer).Trim()
if ($LASTEXITCODE -ne 0) {
  throw 'Unable to inspect the backend container.'
}
$backendWasRunning = $runningState -eq 'true'

try {
  if ($backendWasRunning) {
    Invoke-CheckedCommand docker @('compose', '-f', $composeFile, 'stop', '-t', '15', 'backend')
  }

  Invoke-CheckedCommand mongorestore @(
    "--uri=$MongoUri",
    "--archive=$mongoArchive",
    '--gzip',
    '--drop'
  )
  Invoke-CheckedCommand docker @(
    'compose',
    '-f',
    $composeFile,
    'run',
    '--rm',
    '--no-deps',
    '--entrypoint',
    'sh',
    'backend',
    '-c',
    'find /app/images -mindepth 1 -maxdepth 1 -delete'
  )
  Invoke-CheckedCommand docker @('cp', "${imagesPath}/.", "${backendContainer}:/app/images")
  Write-Output "Backup restored: $backupPath"
}
finally {
  if ($backendWasRunning) {
    Invoke-CheckedCommand docker @('compose', '-f', $composeFile, 'start', 'backend')
  }
}
