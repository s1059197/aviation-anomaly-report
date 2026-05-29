$ErrorActionPreference = "Stop"

$python = "C:\Users\pwitt\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
$port = if ($args.Count -gt 0) { [int]$args[0] } else { 4173 }

Write-Host "Serving Aviation Anomaly Report at http://localhost:$port"
& $python -m http.server $port
