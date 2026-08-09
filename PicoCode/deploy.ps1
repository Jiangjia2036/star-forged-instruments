# Copies this folder's firmware onto the Pico.
#
# Run it from anywhere:
#     powershell -File C:\Users\gamer\star-forged-instruments\PicoCode\deploy.ps1
#
# Why this is needed: the repo folder and the board are two different places.
# Editing a file here does NOT change the board. What IS automatic is the
# other half - once a file lands on the CIRCUITPY drive, CircuitPython
# restarts and runs it immediately.

$ErrorActionPreference = "Stop"

$source = $PSScriptRoot

$vol = Get-Volume | Where-Object { $_.FileSystemLabel -eq "CIRCUITPY" }

if (-not $vol) {
    Write-Host "CIRCUITPY drive not found. Is the Pico plugged in?" -ForegroundColor Red
    exit 1
}

$drive = $vol.DriveLetter + ":"
Write-Host "Deploying to $drive" -ForegroundColor Cyan

# Modules first. code.py is deliberately last: its arrival triggers the
# restart, so everything it imports must already be in place.
$modules = @(
    "config.py",
    "tuning.py",
    "waveforms.py",
    "synth_engine.py",
    "effects.py",
    "inputs.py",
    "serial_link.py",
    "track_player.py"
)

foreach ($file in $modules) {
    $path = Join-Path $source $file
    if (Test-Path $path) {
        Copy-Item $path -Destination "$drive\" -Force
        Write-Host "  $file"
    }
}

# Backing tracks, if any
$audio = Join-Path $source "audio"
if (Test-Path $audio) {
    New-Item -ItemType Directory -Path "$drive\audio" -Force | Out-Null
    Get-ChildItem "$audio\*.wav" -ErrorAction SilentlyContinue | ForEach-Object {
        Copy-Item $_.FullName -Destination "$drive\audio\" -Force
        Write-Host ("  audio/" + $_.Name)
    }
}

Copy-Item (Join-Path $source "code.py") -Destination "$drive\" -Force
Write-Host "  code.py  (board restarting)" -ForegroundColor Green

$free = (Get-Volume -DriveLetter $vol.DriveLetter).SizeRemaining / 1MB
Write-Host ("Done. {0:N2} MB free on the board." -f $free) -ForegroundColor Cyan
