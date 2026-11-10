#Requires -Version 5.1
<#
.SYNOPSIS
  Waits until a pull request is safe to merge, then exits.

.DESCRIPTION
  Polls `gh pr view` and reports one of four outcomes through the exit code:
    0  ready to merge: open, mergeable, every check passed, no blocking review
    1  not open, or the read failed
    2  blocked: a check failed, a conflict, or a review asked for changes
    3  timed out before the PR settled

  The script never merges. It only answers "may I merge now". The caller merges
  with `gh pr merge --squash --delete-branch`.

  A repo with no checks passes as soon as the PR is mergeable, which is the
  common case for a personal config repo.

.PARAMETER Pr
  Pull request number.

.PARAMETER TimeoutMinutes
  Stop waiting after this many minutes. Defaults to 30.

.PARAMETER PollSeconds
  Seconds between polls. Defaults to 15.

.PARAMETER RequireChecks
  Wait for at least one check to appear before treating the PR as ready. Use it
  when CI is expected but may start a few seconds after the PR opens.

.EXAMPLE
  ./wait-for-pr.ps1 -Pr 42

.EXAMPLE
  ./wait-for-pr.ps1 -Pr 42 -TimeoutMinutes 45 -RequireChecks
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [int]$Pr,

  [int]$TimeoutMinutes = 30,
  [int]$PollSeconds = 15,
  [switch]$RequireChecks
)

# CheckRun conclusions that block a merge. StatusContext failures use `state`,
# not `conclusion`, and are handled in the state branch below.
$failureConclusions = @(
  'FAILURE', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED',
  'STALE', 'STARTUP_FAILURE'
)
$passConclusions = @('SUCCESS', 'NEUTRAL', 'SKIPPED')

function Get-PrState {
  param([int]$Number)

  $raw = gh pr view $Number --json state,mergeable,reviewDecision,statusCheckRollup 2>$null
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($raw)) {
    return $null
  }

  try {
    $parsed = $raw | ConvertFrom-Json
  } catch {
    return $null
  }

  # gh can print an error object with no state when the number is wrong.
  if ($null -eq $parsed -or -not ($parsed.PSObject.Properties.Name -contains 'state')) {
    return $null
  }
  return $parsed
}

function Get-CheckSummary {
  param($Rollup)

  $total = 0
  $pending = 0
  $failed = @()
  $passed = 0

  foreach ($check in @($Rollup)) {
    if ($null -eq $check) { continue }
    $total += 1

    if ($check.PSObject.Properties.Name -contains 'conclusion' -and $check.conclusion) {
      # CheckRun
      if ($check.conclusion -in $failureConclusions) { $failed += $check.name }
      elseif ($check.conclusion -in $passConclusions) { $passed += 1 }
      else { $pending += 1 }
    }
    elseif ($check.PSObject.Properties.Name -contains 'state' -and $check.state) {
      # StatusContext
      if ($check.state -in @('ERROR', 'FAILURE')) { $failed += $check.context }
      elseif ($check.state -eq 'SUCCESS') { $passed += 1 }
      else { $pending += 1 }
    }
    else {
      # A check with no conclusion yet is still running.
      $pending += 1
    }
  }

  return [pscustomobject]@{
    Total   = $total
    Pending = $pending
    Passed  = $passed
    Failed  = $failed
  }
}

$deadline = (Get-Date).AddMinutes($TimeoutMinutes)
$lastLine = ''

while ((Get-Date) -lt $deadline) {
  # Do not name this $pr: PowerShell is case-insensitive, so it would overwrite
  # the $Pr parameter.
  $prInfo = Get-PrState -Number $Pr
  if ($null -eq $prInfo) {
    Write-Output "Could not read PR #$Pr. Check 'gh auth status' and the number."
    exit 1
  }

  if ($prInfo.state -ne 'OPEN') {
    Write-Output "PR #$Pr is $($prInfo.state), not open."
    exit 1
  }

  $summary = Get-CheckSummary -Rollup $prInfo.statusCheckRollup

  if ($summary.Failed.Count -gt 0) {
    Write-Output "Blocked: check(s) failed: $($summary.Failed -join ', ')"
    exit 2
  }

  if ($prInfo.reviewDecision -eq 'CHANGES_REQUESTED') {
    Write-Output "Blocked: a review asked for changes."
    exit 2
  }

  if ($prInfo.mergeable -eq 'CONFLICTING') {
    Write-Output "Blocked: the branch conflicts with the base."
    exit 2
  }

  $checksSettled = ($summary.Total -eq 0 -and -not $RequireChecks) -or
                   ($summary.Total -gt 0 -and $summary.Pending -eq 0)
  $reviewSettled = $prInfo.reviewDecision -ne 'REVIEW_REQUIRED'

  if ($checksSettled -and $reviewSettled -and $prInfo.mergeable -eq 'MERGEABLE') {
    $count = $summary.Total
    Write-Output "Ready: PR #$Pr is mergeable, $count check(s) passed."
    exit 0
  }

  $line = "Waiting: mergeable=$($prInfo.mergeable) checks=$($summary.Passed)/$($summary.Total) pending=$($summary.Pending) review=$($prInfo.reviewDecision)"
  if ($line -ne $lastLine) {
    Write-Output $line
    $lastLine = $line
  }

  Start-Sleep -Seconds $PollSeconds
}

Write-Output "Timed out after $TimeoutMinutes minute(s) waiting on PR #$Pr."
exit 3
