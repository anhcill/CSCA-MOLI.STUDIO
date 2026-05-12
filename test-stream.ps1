$ErrorActionPreference = 'SilentlyContinue'
$uri = 'http://localhost:5000/api/ai/ask-stream'
$body = '{"question":"2+2 bằng mấy","attemptId":1}'

$sw = [Diagnostics.Stopwatch]::StartNew()
$found = $false

$resp = Invoke-WebRequest -Uri $uri -Method POST -ContentType 'application/json' -Body $body -TimeoutSec 45 -PassThru

$bytes = @()
$reader = $resp.Content.GetResponseStream()
$buffer = New-Object byte[] 4096
$encoding = New-Object System.Text.UTF8Encoding

while (($len = $reader.Read($buffer, 0, $buffer.Length)) -gt 0) {
    if (-not $found -and $len -gt 0) {
        $sw.Stop()
        Write-Host "Time to first chunk: $($sw.ElapsedMilliseconds)ms"
        $found = $true
    }
    $bytes += $buffer[0..($len-1)]
    if ($sw.ElapsedMilliseconds -gt 5000 -and -not $found) {
        Write-Host "No chunk after 5 seconds"
        break
    }
}

$sw.Stop()
$total = $sw.ElapsedMilliseconds
$text = $encoding.GetString($bytes)
Write-Host "Total time: ${total}ms"
Write-Host "Status: $($resp.StatusCode)"
Write-Host "Preview: $($text.Substring(0, [Math]::Min(300, $text.Length)))"
