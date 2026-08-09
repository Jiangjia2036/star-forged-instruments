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
#
# Every .py in this folder ships except the ones named here, so a new module
# is picked up automatically - no need to remember to add it to a list.
# Subfolders (micropython-legacy, __pycache__) are skipped: no -Recurse.
$skip = @(
    "code.py",       # copied last, on purpose
    "deploy.ps1",
    "audio_test.py"  # bench script, not part of the firmware
)

$modules = Get-ChildItem (Join-Path $source "*.py") -File |
    Where-Object { $skip -notcontains $_.Name }

foreach ($file in $modules) {
    Copy-Item $file.FullName -Destination "$drive\" -Force
    Write-Host ("  " + $file.Name)
}

# Backing tracks, if any. MP3 as well as WAV - track_player handles both, and
# AUDIO.md wants MP3: roughly 1 MB per minute against 5 MB for the same audio
# as WAV, on a board with about 2.5 MB total.
$audio = Join-Path $source "audio"
if (Test-Path $audio) {
    New-Item -ItemType Directory -Path "$drive\audio" -Force | Out-Null

    $tracks = Get-ChildItem "$audio\*" -File -Include *.mp3, *.wav -ErrorAction SilentlyContinue

    # A WAV whose MP3 twin exists is the pre-conversion source, not a second
    # track. Shipping both wastes flash and shows the song twice in the picker.
    $mp3Names = $tracks |
        Where-Object { $_.Extension -eq ".mp3" } |
        ForEach-Object { $_.BaseName }

    foreach ($track in $tracks) {
        if ($track.Extension -eq ".wav" -and $mp3Names -contains $track.BaseName) {
            Write-Host ("  skipping audio/" + $track.Name + " (audio/" + $track.BaseName + ".mp3 supersedes it)") -ForegroundColor DarkGray
            continue
        }

        # Check before copying: a mid-copy disk-full aborts the run and leaves
        # code.py stale, which is a far more confusing failure than a warning.
        $free = (Get-Volume -DriveLetter $vol.DriveLetter).SizeRemaining
        $existing = Get-Item (Join-Path "$drive\audio" $track.Name) -ErrorAction SilentlyContinue
        $needed = $track.Length - $(if ($existing) { $existing.Length } else { 0 })

        if ($needed -gt $free) {
            Write-Host ("  SKIPPED audio/" + $track.Name) -ForegroundColor Yellow
            Write-Host ("    needs {0:N2} MB, only {1:N2} MB free. Convert it to MP3 - see AUDIO.md." -f ($needed / 1MB), ($free / 1MB)) -ForegroundColor Yellow
            continue
        }

        Copy-Item $track.FullName -Destination "$drive\audio\" -Force
        Write-Host ("  audio/" + $track.Name)
    }
}

Copy-Item (Join-Path $source "code.py") -Destination "$drive\" -Force
Write-Host "  code.py  (board restarting)" -ForegroundColor Green

$free = (Get-Volume -DriveLetter $vol.DriveLetter).SizeRemaining / 1MB
Write-Host ("Done. {0:N2} MB free on the board." -f $free) -ForegroundColor Cyan
