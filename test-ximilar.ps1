param(
  [Parameter(Mandatory=$true)]
  [string]$ImagePath,

  [Parameter(Mandatory=$true)]
  [string]$XimilarToken
)

$XimilarEndpoint = "https://api.ximilar.com/tagging/collectibles/v2/comics_id"

if (-not (Test-Path $ImagePath)) {
  throw "Image file not found: $ImagePath"
}

# Read image and Base64 encode
$bytes = [System.IO.File]::ReadAllBytes($ImagePath)
$b64 = [System.Convert]::ToBase64String($bytes)

$bodyObj = @{
  records = @(
    @{
      _base64 = $b64
    }
  )
}

$bodyJson = $bodyObj | ConvertTo-Json -Depth 10

$headers = @{
  "Content-Type"  = "application/json"
  "Authorization" = "Token $XimilarToken"
}

Write-Host "POST $XimilarEndpoint" -ForegroundColor Cyan
Write-Host "Image bytes: $($bytes.Length)" -ForegroundColor DarkGray

try {
  $resp = Invoke-RestMethod `
    -Method Post `
    -Uri $XimilarEndpoint `
    -Headers $headers `
    -Body $bodyJson

  Write-Host "`n✅ SUCCESS" -ForegroundColor Green
  $resp | ConvertTo-Json -Depth 20
}
catch {
  Write-Host "`n❌ REQUEST FAILED" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Yellow

  if ($_.Exception.Response) {
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    Write-Host "StatusCode: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
    Write-Host ($reader.ReadToEnd())
  }
}
