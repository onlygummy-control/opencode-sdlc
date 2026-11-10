#Requires -Version 5.1
<#
.SYNOPSIS
  Finds and optionally rewrites long dashes in prose files.

.DESCRIPTION
  The humanizer skill bans long dashes in prose. This script is the
  deterministic guard: it reports every em dash, en dash, and horizontal bar,
  and with -Fix it rewrites them. It defaults to report-only so a run never
  changes a file by accident.

  Replacement rules:
  - Em dash and horizontal bar become a comma and a space, the safe reading
    for a parenthetical break.
  - En dash becomes a hyphen, the safe reading for a number or date range.

  A comma is not always the best punctuation. Read the rewritten lines and
  fix the ones where a colon or period reads better.

.PARAMETER Path
  File or directory to scan. Defaults to the current directory.

.PARAMETER Extension
  File extensions to include when Path is a directory. Defaults to .md and .txt.

.PARAMETER Fix
  Rewrite the files in place instead of only reporting.

.EXAMPLE
  ./strip-dashes.ps1 -Path README.md

.EXAMPLE
  ./strip-dashes.ps1 -Path ./docs -Fix
#>
[CmdletBinding()]
param(
  [string]$Path = ".",
  [string[]]$Extension = @(".md", ".txt"),
  [switch]$Fix
)

$emDash = [char]0x2014   # em dash
$enDash = [char]0x2013   # en dash
$hbar = [char]0x2015     # horizontal bar
$dashChars = [char[]]@($emDash, $enDash, $hbar)

function Get-TargetFiles {
  param([string]$Root, [string[]]$Ext)

  if (Test-Path -LiteralPath $Root -PathType Leaf) {
    return @(Get-Item -LiteralPath $Root)
  }

  $patterns = $Ext | ForEach-Object { "*$_" }
  Get-ChildItem -LiteralPath $Root -Recurse -File -Include $patterns |
    Where-Object { $_.FullName -notmatch '[\\/](node_modules|\.git)[\\/]' }
}

$files = Get-TargetFiles -Root $Path -Ext $Extension
$total = 0

foreach ($file in $files) {
  # Read and write as UTF-8 so the multi-byte dash characters survive the trip.
  # Windows PowerShell 5.1 defaults to the ANSI code page, which would mangle them.
  $text = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8
  if ([string]::IsNullOrEmpty($text)) { continue }

  $count = 0
  foreach ($ch in $text.ToCharArray()) {
    if ($dashChars -contains $ch) { $count += 1 }
  }
  if ($count -eq 0) { continue }

  $total += $count
  Write-Output "$($file.FullName): $count long dash(es)"

  $lineNo = 0
  foreach ($line in ($text -split "`n")) {
    $lineNo += 1
    if ($line.IndexOfAny($dashChars) -ge 0) {
      Write-Output "  line ${lineNo}: $($line.Trim())"
    }
  }

  if ($Fix) {
    # Keep line breaks: only spaces and tabs sit between the dash and the
    # surrounding words, so the newline is never swallowed.
    $fixed = $text -replace '[ \t]*[\u2014\u2015][ \t]*', ', ' -replace '[\u2013]', '-'
    # Write UTF-8 without a BOM. Set-Content -Encoding UTF8 adds a BOM on
    # Windows PowerShell 5.1, which would corrupt a Markdown frontmatter block.
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($file.FullName, $fixed, $utf8NoBom)
    Write-Output "  fixed"
  }
}

if ($total -eq 0) {
  Write-Output "No long dashes found."
} else {
  Write-Output "Total: $total long dash(es) across $($files.Count) file(s) scanned."
  if (-not $Fix) { Write-Output "Run again with -Fix to rewrite them." }
}
