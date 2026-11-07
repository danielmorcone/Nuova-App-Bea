$port = 8000
$serverInfoFile = Join-Path $env:TEMP 'app-bea-dev-server.json'

if (Test-Path -LiteralPath $serverInfoFile) {
    try {
        $serverInfo = Get-Content -Raw -LiteralPath $serverInfoFile | ConvertFrom-Json
        if ($serverInfo.port -ge 8000 -and $serverInfo.port -le 8010) {
            $port = [int]$serverInfo.port
        }
    } catch {
        # Se il file di stato non è valido, provo la porta standard.
    }
}

try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$port/__stop-app-bea__" -Method Post -TimeoutSec 3 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host 'Comando di arresto inviato al server App Bea.'
    } else {
        Write-Host 'La risposta non proviene dal server App Bea; non ho chiuso altri programmi.'
    }
} catch {
    Write-Host "Non ho trovato il server App Bea sulla porta $port. Non ho chiuso altri programmi."
}
