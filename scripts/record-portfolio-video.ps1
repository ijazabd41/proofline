$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$outputRoot = Join-Path $projectRoot 'docs/evidence/portfolio'
$summary = Get-Content (Join-Path $outputRoot 'summary.json') -Raw | ConvertFrom-Json
$recorded = ([datetime]$summary.sourceRecordedAt).ToString('yyyy-MM-dd')
$captions = @(
    "BUG-TO-PROOF / PROOFLINE`nRecorded browser evidence | source run: $recorded`n`n1. REPRODUCE`nKeyboard 10 + Mouse Pad 20 should total 30.`nThe seeded first-item-only defect shows 10.`nBaseline outcome: $($summary.baselineOutcome)`n`nConfigured MiniShop reference | deterministic proposal",
    "2. REVIEW THE REFERENCE PATCH`n`nBefore:`n  total: () => get().items[0]?.price ?? 0`n`nAfter:`n  total: () => get().items.reduce(`n    (sum, item) => sum + item.price * item.quantity, 0)`n`nThe patch is applied in an isolated workspace.`nProposal: deterministic. Approval: scripted.`nNo live-model repair or independent human review is shown.",
    "3. VERIFY THE IDENTICAL TEST`nThe same two browser assertions now pass.`nPost-patch outcome: $($summary.postPatchOutcome)`nTest fingerprints match before and after.`n`nRecorded browser evidence | source run: $recorded",
    "4. CHECK THE EVIDENCE`n`nRecorded reference gates: typecheck / build / unit tests passed.`nProof ZIP extracted; $($summary.validatedPayloadFiles) payload SHA-256 digests revalidated.`n`nThis is an edited walkthrough of retained browser evidence.`nIt does not verify the current checkout or broad autonomous repair.`nSeparate live reproduction evaluation: 10/12 reviewed matches.`n`nSource run: $($summary.sourceRunId)`nFull provenance: docs/evidence/portfolio/summary.json"
)
$workRoot = Join-Path $projectRoot 'artifacts/portfolio-release/video'
New-Item -ItemType Directory -Force $workRoot | Out-Null
Push-Location $workRoot
try {
    for ($i = 0; $i -lt $captions.Count; $i++) {
        [IO.File]::WriteAllText((Join-Path $workRoot "caption$i.txt"), $captions[$i])
        $segmentArgs = @('-y', '-hide_banner', '-loglevel', 'error')
        if ($i -eq 0 -or $i -eq 2) {
            $imageName = if ($i -eq 0) { 'before.png' } else { 'after.png' }
            $segmentArgs += @('-loop', '1', '-i', (Join-Path $outputRoot $imageName))
            $filter = "scale=1280:720,pad=1280:1080:0:360:color=0x111827,drawtext=fontfile='C\:/Windows/Fonts/segoeui.ttf':textfile=caption$i.txt:fontcolor=white:fontsize=22:x=35:y=20:line_spacing=6"
        } else {
            $segmentArgs += @('-f', 'lavfi', '-i', 'color=c=0x111827:s=1280x1080:r=25')
            $filter = "drawtext=fontfile='C\:/Windows/Fonts/segoeui.ttf':textfile=caption$i.txt:fontcolor=white:fontsize=29:x=55:y=100:line_spacing=15"
        }
        $segmentArgs += @('-vf', $filter, '-t', '9', '-r', '25', '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p', "part$i.mp4")
        & ffmpeg @segmentArgs
        if ($LASTEXITCODE -ne 0) { throw "Video segment $i failed" }
    }
    [IO.File]::WriteAllText((Join-Path $workRoot 'concat.txt'), "file 'part0.mp4'`nfile 'part1.mp4'`nfile 'part2.mp4'`nfile 'part3.mp4'`n")
    & ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 -i concat.txt -c copy -movflags +faststart (Join-Path $outputRoot 'reference-walkthrough.mp4')
    if ($LASTEXITCODE -ne 0) { throw 'Video concatenation failed' }
} finally { Pop-Location }
