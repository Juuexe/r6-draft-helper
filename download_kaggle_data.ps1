$ErrorActionPreference = 'Stop'
$rawFolder = Join-Path $PSScriptRoot 'data\raw'
New-Item -ItemType Directory -Force -Path $rawFolder | Out-Null
$listUrl = 'https://www.kaggle.com/api/v1/datasets/list/maxcobra/rainbow-six-siege-s5-ranked-dataset'
$files = @()
do {
    $page = Invoke-RestMethod -Uri $listUrl
    $files += $page.datasetFiles
    if ($page.nextPageToken) {
        $listUrl = 'https://www.kaggle.com/api/v1/datasets/list/maxcobra/rainbow-six-siege-s5-ranked-dataset?pageToken=' + [uri]::EscapeDataString($page.nextPageToken)
    }
} while ($page.nextPageToken)

Write-Host "Found $($files.Count) Kaggle files. Downloading and extracting them into $rawFolder"
foreach ($file in $files) {
    $csvPath = Join-Path $rawFolder $file.name
    if (Test-Path -LiteralPath $csvPath) {
        Write-Host "Already extracted: $($file.name)"
        continue
    }
    $zipPath = Join-Path $rawFolder ($file.name + '.zip')
    $encodedName = [uri]::EscapeDataString($file.name)
    $downloadUrl = "https://www.kaggle.com/api/v1/datasets/download/maxcobra/rainbow-six-siege-s5-ranked-dataset?fileName=$encodedName"
    Write-Host "Downloading $($file.name)"
    Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath
    Write-Host "Extracting $($file.name)"
    Expand-Archive -LiteralPath $zipPath -DestinationPath $rawFolder -Force
    Remove-Item -LiteralPath $zipPath
}
Write-Host 'Download complete.'

