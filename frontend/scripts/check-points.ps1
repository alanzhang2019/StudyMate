$json = Get-Content -Raw 'd:\AItrade\ai-math-mistake-machine\frontend\data\classrooms\cm_imp_cspj2021j_v1.json' | ConvertFrom-Json
$total = 0
$qcount = 0
$missingPts = @()
$breakdown = @{}
foreach ($scene in $json.scenes) {
  if ($scene.type -eq 'quiz') {
    $stype = $scene.category
    if (-not $breakdown.ContainsKey($stype)) { $breakdown[$stype] = 0 }
    foreach ($q in $scene.content.questions) {
      $qcount++
      if ($q.type -ne 'code_section') {
        if ($null -eq $q.PSObject.Properties['points'] -or $null -eq $q.points) {
          $missingPts += "$($scene.id):$($q.id)"
        } else {
          $total += $q.points
          $breakdown[$stype] += $q.points
        }
      }
    }
  }
}
Write-Host "Total questions: $qcount"
Write-Host "Total points: $total"
Write-Host "Breakdown:"
foreach ($k in $breakdown.Keys) {
  Write-Host "  $k : $($breakdown[$k])"
}
Write-Host "Missing points: $($missingPts -join ', ')"
