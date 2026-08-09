[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$MongoUri,
  [string]$BackupRoot = (Join-Path $PSScriptRoot '..\backups')
)

$ErrorActionPreference = 'Stop'
$composeFile = Join-Path $PSScriptRoot '..\docker-compose.yml'
$backupRootPath = [System.IO.Path]::GetFullPath($BackupRoot)
$timestamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
$stagingPath = Join-Path $backupRootPath ".$timestamp.incomplete"
$backupPath = Join-Path $backupRootPath $timestamp
$backendContainer = $null
$backendWasRunning = $false

function Invoke-CheckedCommand {
  param([string]$Command, [string[]]$Arguments)

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Command failed with exit code $LASTEXITCODE."
  }
}

if (-not (Get-Command mongodump -ErrorAction SilentlyContinue)) {
  throw 'mongodump is required. Install the MongoDB Database Tools first.'
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Docker is required to copy the images volume.'
}

New-Item -ItemType Directory -Path $backupRootPath -Force | Out-Null
if (Test-Path -LiteralPath $stagingPath -PathType Any) {
  throw "Staging path already exists: $stagingPath"
}
New-Item -ItemType Directory -Path $stagingPath | Out-Null

try {
  $backendContainer = (& docker compose -f $composeFile ps -q backend).Trim()
  if (-not $backendContainer) {
    throw 'The Compose backend container does not exist. Start it before creating a backup.'
  }

  $runningState = (& docker inspect --format '{{.State.Running}}' $backendContainer).Trim()
  if ($LASTEXITCODE -ne 0) {
    throw 'Unable to inspect the backend container.'
  }
  $backendWasRunning = $runningState -eq 'true'
  if ($backendWasRunning) {
    Invoke-CheckedCommand docker @('compose', '-f', $composeFile, 'stop', '-t', '15', 'backend')
  }

  $mongoArchive = Join-Path $stagingPath 'mongodb.archive.gz'
  Invoke-CheckedCommand mongodump @("--uri=$MongoUri", "--archive=$mongoArchive", '--gzip')

  $imagesPath = Join-Path $stagingPath 'images'
  New-Item -ItemType Directory -Path $imagesPath | Out-Null
  Invoke-CheckedCommand docker @('cp', "${backendContainer}:/app/images/.", $imagesPath)

  $manifest = [ordered]@{
    createdAtUtc = [DateTime]::UtcNow.ToString('o')
    mongoArchive = 'mongodb.archive.gz'
    mongoSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $mongoArchive).Hash.ToLowerInvariant()
    imagesDirectory = 'images'
    imageFileCount = @(Get-ChildItem -LiteralPath $imagesPath -File -Recurse).Count
    images = @(
      Get-ChildItem -LiteralPath $imagesPath -File -Recurse | ForEach-Object {
        [ordered]@{
          path = [System.IO.Path]::GetRelativePath($imagesPath, $_.FullName).Replace('\', '/')
          sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash.ToLowerInvariant()
        }
      }
    )
  }
  $manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $stagingPath 'manifest.json') -Encoding utf8
  Move-Item -LiteralPath $stagingPath -Destination $backupPath
  Write-Output "Backup created: $backupPath"
}
catch {
  if (Test-Path -LiteralPath $stagingPath -PathType Container) {
    Remove-Item -LiteralPath $stagingPath -Recurse -Force
  }
  throw
}
finally {
  if ($backendWasRunning) {
    Invoke-CheckedCommand docker @('compose', '-f', $composeFile, 'start', 'backend')
  }
}
