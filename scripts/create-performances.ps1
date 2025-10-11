# Create performances for specific event entry IDs with optional verification
# Usage examples:
#   .\scripts\create-performances.ps1 -EntryIds 'ID1','ID2','ID3'
#   .\scripts\create-performances.ps1 -EventId 'event-123' -EntryIds (Get-Content ids.txt)
#   .\scripts\create-performances.ps1 -EventId 'event-123' -EntryIds 'ID1','ID2' -Verify

param(
  [Parameter(Mandatory=$false)] [string] $EventId,
  [Parameter(Mandatory=$true)]  [string[]] $EntryIds,
  [Parameter(Mandatory=$false)] [string] $BaseUrl = 'https://eodsa.vercel.app',
  [switch] $Verify
)

function Invoke-CreatePerformance {
  param([string] $EntryId)
  $uri = "$BaseUrl/api/event-entries/$EntryId/create-performance"
  try {
    $res = Invoke-RestMethod -Method Post -Uri $uri -ContentType 'application/json' -ErrorAction Stop
    $perfId = $null
    if ($res -and $res.performance -and $res.performance.id) { $perfId = $res.performance.id }
    [pscustomobject]@{
      entryId = $EntryId
      success = $res.success
      message = $res.message
      performanceId = $perfId
      http = 200
    }
  } catch {
    $resp = $_.Exception.Response
    if ($resp) {
      $reader = New-Object IO.StreamReader($resp.GetResponseStream())
      $body = $reader.ReadToEnd()
      [pscustomobject]@{
        entryId = $EntryId
        success = $false
        message = $body
        performanceId = $null
        http = [int]$resp.StatusCode
      }
    } else {
      [pscustomobject]@{
        entryId = $EntryId
        success = $false
        message = $_.Exception.Message
        performanceId = $null
        http = $null
      }
    }
  }
}

Write-Host "Creating performances for $($EntryIds.Count) entries..." -ForegroundColor Cyan
$results = @()
foreach ($id in $EntryIds) {
  $r = Invoke-CreatePerformance -EntryId $id
  $results += $r
  Write-Host ("{0} -> success={1} http={2} {3}" -f $r.entryId,$r.success,$r.http,$r.message)
}

"" | Out-Null
Write-Host "Summary:" -ForegroundColor Yellow
$results | Sort-Object success | Format-Table entryId,success,http,performanceId -AutoSize

if ($Verify -and $EventId) {
  try {
    $perfUri = "$BaseUrl/api/events/$EventId/performances"
    $perfRes = Invoke-RestMethod -Method Get -Uri $perfUri -ErrorAction Stop
    $all = $perfRes.performances
    $live = @($all | Where-Object { ($_.entryType | ForEach-Object { if ($_){$_} else {'live'} }) -eq 'live' }).Count
    $virtual = @($all | Where-Object { $_.entryType -eq 'virtual' }).Count
    Write-Host ("Verify → total={0} live={1} virtual={2}" -f $all.Count,$live,$virtual) -ForegroundColor Green
  } catch {
    Write-Host "Verify step failed: $($_.Exception.Message)" -ForegroundColor Red
  }
}

exit 0


