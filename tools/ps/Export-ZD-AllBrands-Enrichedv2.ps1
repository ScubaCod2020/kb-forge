<#
.SYNOPSIS
  Export Zendesk Help Center data across ALL brands into one enriched CSV + JSON snapshots.
.DESCRIPTION
  - Lists brands from the PRIMARY admin subdomain (default: libertytax)
  - For each brand with Help Center enabled, fetches categories, sections, and articles from that brand's subdomain
  - Resolves names: sections, categories, permission groups, user segments, content tags, authors
  - Outputs date-stamped files (YYYY-MM-DD) in local folder
.NOTES
  PowerShell 5+ compatible (no ?. or ?? operators)
#>


param(
  #[string]$Email = 'steven.codling@libtax.com', #input username added my email
  [string]$Email,
  #[string]$Token = 'tCzR62u16P8GTqRPSRpKFqP8dtXIlLt5eq6R78GG', #input API token added my token
  [string]$Token, 
  [string]$PrimarySubdomain = 'libertytax',  # hard-coded default per request; override if ever needed
  [int]$PageDelayMs = 200
)

# Prompt interactively if not provided (so you can just double-click and run)
if (-not $Email) { $Email = Read-Host 'Enter Zendesk login email' }
if (-not $Token) {
  $sec = Read-Host 'Enter Zendesk API token' -AsSecureString
  $Token = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
}

function New-AuthHeader {
  param([string]$Email,[string]$Token)
  $raw = "$Email/token:$Token"
  $b64 = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($raw))
  return @{ Authorization = "Basic $b64"; Accept = "application/json" }
}

function Get-Paged {
  param(
    [Parameter(Mandatory=$true)][string]$StartUrl,
    [Parameter(Mandatory=$true)][hashtable]$Headers,
    [Parameter(Mandatory=$true)][string]$ArrayField, # e.g., 'articles','sections','categories','brands'
    [int]$DelayMs = 200
  )
  $url = $StartUrl; $all = @()
  while ($url) {
    try {
      $r = Invoke-RestMethod -Uri $url -Headers $Headers -Method Get
      $chunk = $null
      if ($r.PSObject.Properties.Name -contains $ArrayField) { $chunk = $r.$ArrayField }
      $countChunk = 0
      if ($null -ne $chunk) {
        if ($chunk -is [System.Array]) { $all += $chunk; $countChunk = $chunk.Count }
        else { $all += ,$chunk; $countChunk = 1 }
      }
      Write-Host ("Fetched {0} {1} (total so far: {2})" -f $countChunk, $ArrayField, $all.Count)
      if ($r.PSObject.Properties.Name -contains 'next_page' -and $r.next_page) { $url = $r.next_page } else { $url = $null }
      if ($DelayMs -gt 0) { Start-Sleep -Milliseconds $DelayMs }
    } catch {
    Write-Warning "Skipping $url : $_"
    break
    }

  }
  return ,$all
}

function Get-DateStamp {
  # Use America/New_York (Eastern) and format YYYY-MM-DD
  try {
    $tz = [System.TimeZoneInfo]::FindSystemTimeZoneById('Eastern Standard Time')
    $nowEastern = [System.TimeZoneInfo]::ConvertTime([DateTime]::UtcNow, $tz)
  } catch {
    $nowEastern = Get-Date
  }
  return $nowEastern.ToString('yyyy-MM-dd')
}

function HtmlToText {
  param([string]$Html)
  if ([string]::IsNullOrEmpty($Html)) { return "" }
  $s = $Html
  # Normalize some block elements to newlines
  $s = $s -replace '(?i)</(p|div|section|article|li|h[1-6]|br|tr)>', "`n"
  # Strip all tags
  $s = $s -replace '<[^>]+>', ''
  # Decode entities
  $s = [System.Net.WebUtility]::HtmlDecode($s)
  # Collapse all newlines (CR/LF) to a single space so CSV rows are one line
  $s = $s -replace '(\r\n|\r|\n)+', ' '
  # Collapse excessive spaces
  $s = ($s -replace '[ \t]+', ' ').Trim()
  return $s
}

function ExtractLinks {
  param(
    [string]$Html,
    [string]$BaseUrl
  )
  if ([string]::IsNullOrEmpty($Html)) { return @() }

  # Determine a solid base (strip any existing fragment)
  $base = $BaseUrl
  if ($base) {
    try {
      $u = [Uri]$BaseUrl
      if ($u.Fragment) {
        $noFrag = "$($u.Scheme)://$($u.Host)$($u.AbsolutePath)"
        if ($u.Port -and $u.Port -ne 80 -and $u.Port -ne 443) { $noFrag = "$($u.Scheme)://$($u.Host):$($u.Port)$($u.AbsolutePath)" }
        $base = $noFrag
      }
    } catch { }
  }

  $seen = New-Object System.Collections.Generic.HashSet[string]
  $out  = New-Object System.Collections.Generic.List[string]

  foreach ($m in [regex]::Matches($Html, '(?i)href\s*=\s*"([^"]+)"')) {
    $href = $m.Groups[1].Value.Trim()
    if (-not $href) { continue }

    $abs = $href
    try {
      if ($href -match '^(?i)https?://') {
        # already absolute
        $abs = $href
      } elseif ($base) {
        # resolve relative or fragment against the base article URL
        $abs = ([Uri](New-Object System.Uri($base), $href)).AbsoluteUri
      }
    } catch {
      # if resolution fails, leave original
      $abs = $href
    }

    if (-not $seen.Contains($abs)) {
      $null = $seen.Add($abs)
      $out.Add($abs)
    }
  }
  return ,$out.ToArray()
}


try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

$auth = New-AuthHeader -Email $Email -Token $Token
$datestamp = Get-DateStamp

Write-Host "== Listing brands from https://$PrimarySubdomain.zendesk.com/api/v2/brands.json ==" -ForegroundColor Cyan
$brandsUrl = "https://$PrimarySubdomain.zendesk.com/api/v2/brands.json?per_page=100`&page=1"
$brands = Get-Paged -StartUrl $brandsUrl -Headers $auth -ArrayField 'brands' -DelayMs $PageDelayMs

# Filter brands that have Help Center enabled
$hcBrands = @()
foreach ($b in $brands) {
  if ($b.PSObject.Properties.Name -contains 'has_help_center' -and $b.has_help_center -and
      $b.PSObject.Properties.Name -contains 'help_center_state' -and $b.help_center_state -eq 'enabled' -and
      $b.PSObject.Properties.Name -contains 'subdomain' -and $b.subdomain) {
    $hcBrands += $b
  }
}
Write-Host ("Brands with Help Center enabled: {0}" -f $hcBrands.Count)

# Permission groups and user segments (global / account-level)
Write-Host "== Fetching permission groups & user segments (account-level) ==" -ForegroundColor Cyan
$permGroups = Get-Paged -StartUrl "https://$PrimarySubdomain.zendesk.com/api/v2/guide/permission_groups.json?per_page=100`&page=1" -Headers $auth -ArrayField 'permission_groups' -DelayMs $PageDelayMs
$userSegments = Get-Paged -StartUrl "https://$PrimarySubdomain.zendesk.com/api/v2/help_center/user_segments.json?per_page=100`&page=1" -Headers $auth -ArrayField 'user_segments' -DelayMs $PageDelayMs

$permMap = @{}
foreach ($p in $permGroups) { if ($p -and $p.id) { $permMap[$p.id] = $p.name } }

$userSegMap = @{}
foreach ($u in $userSegments) { if ($u -and $u.id) { $userSegMap[$u.id] = $u.name } }

Write-Host "== Fetching content tags (account-level) ==" -ForegroundColor Cyan

[int]$CtPageSize = 30
$ctUrl = "https://$PrimarySubdomain.zendesk.com/api/v2/guide/content_tags?page[size]=$CtPageSize"
$contentTagsAll = @()

while ($ctUrl) {
  try {
    $resp = Invoke-RestMethod -Uri $ctUrl -Headers $auth -Method Get

    # Items live under 'records'
    $chunk = if ($resp.PSObject.Properties.Name -contains 'records') { $resp.records } else { @() }
    $contentTagsAll += $chunk
    Write-Host ("Fetched {0} content_tag records (total so far: {1})" -f ($chunk.Count), $contentTagsAll.Count)

    # Next page: prefer links.next; else synthesize from meta.after_cursor
    $next = $null
    if ($resp.PSObject.Properties.Name -contains 'links' -and $resp.links -and $resp.links.next) {
      $next = $resp.links.next
    } elseif ($resp.PSObject.Properties.Name -contains 'meta' -and $resp.meta -and $resp.meta.has_more -and $resp.meta.after_cursor) {
      $cursor = [System.Web.HttpUtility]::UrlEncode($resp.meta.after_cursor)
      $next = "https://$PrimarySubdomain.zendesk.com/api/v2/guide/content_tags?page[size]=$CtPageSize&page[after]=$cursor"
    }
    $ctUrl = $next

    if ($PageDelayMs -gt 0) { Start-Sleep -Milliseconds $PageDelayMs }

  } catch {
    # Optional: light backoff on 429s
    try { $code = $_.Exception.Response.StatusCode.value__ } catch { $code = $null }
    if ($code -eq 429) {
      Write-Warning "Rate limited on content_tags; backing off 2s..."
      Start-Sleep -Seconds 2
      continue
    }
    Write-Warning "Skipping $ctUrl : $_"
    break
  }
}

# Build id -> name map (ids are strings)
$contentTagMap = @{}
foreach ($t in $contentTagsAll) {
  if ($t -and $t.id -and $t.name) {
    $contentTagMap[[string]$t.id] = $t.name
  }
}


$allCategories = @()
$allSections   = @()
$allArticles   = @()

foreach ($b in $hcBrands) {
  $bId   = $b.id
  $bName = $b.name
  $bSub  = $b.subdomain
  Write-Host "`n== Brand: $bName ($bId) - $bSub ==" -ForegroundColor Yellow

  $base = "https://$bSub.zendesk.com/api/v2/help_center"

  # Categories (per brand)
  $cats = Get-Paged -StartUrl "$base/categories.json?per_page=100`&page=1" -Headers $auth -ArrayField 'categories' -DelayMs $PageDelayMs
  foreach ($c in $cats) {
    $c | Add-Member -NotePropertyName brand_id -NotePropertyValue $bId -Force
    $c | Add-Member -NotePropertyName brand_name -NotePropertyValue $bName -Force
    $c | Add-Member -NotePropertyName brand_subdomain -NotePropertyValue $bSub -Force
  }
  $allCategories += $cats

  # Sections (per brand)
  $secs = Get-Paged -StartUrl "$base/sections.json?per_page=100`&page=1" -Headers $auth -ArrayField 'sections' -DelayMs $PageDelayMs
  foreach ($s in $secs) {
    $s | Add-Member -NotePropertyName brand_id -NotePropertyValue $bId -Force
    $s | Add-Member -NotePropertyName brand_name -NotePropertyValue $bName -Force
    $s | Add-Member -NotePropertyName brand_subdomain -NotePropertyValue $bSub -Force
  }
  $allSections += $secs

  # Content tags (optional; present only if enabled)
 # $ctags = Get-Paged -StartUrl "$base/content_tags.json?per_page=100`&page=1" -Headers $auth -ArrayField 'content_tags' -DelayMs $PageDelayMs
 # foreach ($t in $ctags) { if ($t -and $t.id -and $t.name) { $contentTagMap[$t.id] = $t.name } }

  # Articles (per brand)
  $arts = Get-Paged -StartUrl "$base/articles.json?per_page=100`&page=1" -Headers $auth -ArrayField 'articles' -DelayMs $PageDelayMs
  foreach ($a in $arts) {
    $a | Add-Member -NotePropertyName brand_id -NotePropertyValue $bId -Force
    $a | Add-Member -NotePropertyName brand_name -NotePropertyValue $bName -Force
    $a | Add-Member -NotePropertyName brand_subdomain -NotePropertyValue $bSub -Force
  }
  $allArticles += $arts
}

# Build quick lookup maps for categories and sections
$catMap = @{}
foreach ($c in $allCategories) { if ($c -and $c.id) { $catMap[$c.id] = $c.name } }

$secMap = @{}
$secCatIdMap = @{}
foreach ($s in $allSections) {
  if ($s -and $s.id) {
    $secMap[$s.id] = $s.name
    if ($s.PSObject.Properties.Name -contains 'category_id') { $secCatIdMap[$s.id] = $s.category_id }
  }
}

# Resolve authors (batched show_many)
$authorIds = @()
foreach ($a in $allArticles) {
  if ($a -and $a.author_id) { $authorIds += $a.author_id }
}
$authorIds = $authorIds | Select-Object -Unique

$authorMap = @{}
if ($authorIds.Count -gt 0) {
  Write-Host "`n== Resolving Authors ==" -ForegroundColor Cyan
  $chunks = @()
  for ($i=0; $i -lt $authorIds.Count; $i += 100) {
    $end = [Math]::Min($i+99,$authorIds.Count-1)
    $chunks += ,($authorIds[$i..$end])
  }
  foreach ($chunk in $chunks) {
    $idsCsv = ($chunk -join ',')
    $url = "https://$PrimarySubdomain.zendesk.com/api/v2/users/show_many.json?ids=$idsCsv"
    try {
      $res = Invoke-RestMethod -Uri $url -Headers $auth -Method Get
      if ($res -and $res.users) {
        foreach ($u in $res.users) {
          if ($u -and $u.id) {
            $nm = $u.name
            if (-not $nm -and $u.email) { $nm = $u.email }
            $authorMap[$u.id] = $nm
          }
        }
      }
      if ($PageDelayMs -gt 0) { Start-Sleep -Milliseconds $PageDelayMs }
    } catch {
      Write-Warning "Author lookup failed for chunk starting with $($chunk[0]): $_"
    }
  }
  Write-Host "`n== Authors Lookup completed ==" -ForegroundColor green
}

# Compose enriched rows
function JoinList([object[]]$arr) {
  if ($null -eq $arr) { return "" }
  return ($arr -join '| ')
}

$enriched = @()
foreach ($a in $allArticles) {
  $secId = $a.section_id
  $secName = $null; if ($secMap.ContainsKey($secId)) { $secName = $secMap[$secId] }
  $catId = $null; if ($secCatIdMap.ContainsKey($secId)) { $catId = $secCatIdMap[$secId] }
  $catName = $null; if ($catId -and $catMap.ContainsKey($catId)) { $catName = $catMap[$catId] }

  # Label names (array of strings)
  $labels = ""
  if ($a.PSObject.Properties.Name -contains 'label_names' -and $a.label_names) { $labels = JoinList $a.label_names }

  # Content tags (ids -> names)
  $ctIds = @()
if ($a.PSObject.Properties.Name -contains 'content_tag_ids' -and $a.content_tag_ids) { $ctIds = $a.content_tag_ids }
$ctIdStr = JoinList $ctIds

$ctNames = @()
foreach ($tid in $ctIds) {
  $sid = [string]$tid
  if ($contentTagMap.ContainsKey($sid)) { $ctNames += $contentTagMap[$sid] }
}
$ctNameStr = JoinList $ctNames


  # User segments (single + array)
  $userSegId = $null; if ($a.PSObject.Properties.Name -contains 'user_segment_id') { $userSegId = $a.user_segment_id }
  $userSegIds = @(); if ($a.PSObject.Properties.Name -contains 'user_segment_ids' -and $a.user_segment_ids) { $userSegIds = $a.user_segment_ids }
  $userSegIdStr = JoinList $userSegIds

  $userSegNameSingle = $null; if ($userSegId -and $userSegMap.ContainsKey($userSegId)) { $userSegNameSingle = $userSegMap[$userSegId] }
  $userSegNames = @(); foreach ($usid in $userSegIds) { if ($userSegMap.ContainsKey($usid)) { $userSegNames += $userSegMap[$usid] } }
  $userSegNamesStr = JoinList $userSegNames

  # Permission group name
  $permName = $null
  if ($a.PSObject.Properties.Name -contains 'permission_group_id' -and $a.permission_group_id -and $permMap.ContainsKey($a.permission_group_id)) {
    $permName = $permMap[$a.permission_group_id]
  }

  # Author name
  $authorName = $null; if ($a.author_id -and $authorMap.ContainsKey($a.author_id)) { $authorName = $authorMap[$a.author_id] }

  # Body text
  $bodyText = $null
  if ($a.PSObject.Properties.Name -contains 'body') { $bodyText = HtmlToText -Html $a.body }

# Extract body links from original HTML, resolving #anchors/relative paths against html_url
$bodyLinks = @()
if ($a.PSObject.Properties.Name -contains 'body' -and $a.body) {
    $baseForLinks = $a.html_url
    $bodyLinks = ExtractLinks -Html $a.body -BaseUrl $baseForLinks
}
$bodyLinksStr = JoinList $bodyLinks

  $enriched += [pscustomobject]@{
    brand_id              = $a.brand_id
    brand_name            = $a.brand_name
    brand_subdomain       = $a.brand_subdomain
    id                    = $a.id
    title                 = $a.title
    name                  = $a.name
    html_url              = $a.html_url
    section_id            = $secId
    section_name          = $secName
    category_id           = $catId
    category_name         = $catName
    permission_group_id   = $a.permission_group_id
    permission_group_name = $permName
    user_segment_id       = $userSegId
    user_segment_ids      = $userSegIdStr
    user_segment_name     = $userSegNameSingle
    user_segment_names    = $userSegNamesStr
    label_names           = $labels
    content_tag_ids       = $ctIdStr
    content_tag_names     = $ctNameStr
    comments_disabled     = $a.comments_disabled
    draft                 = $a.draft
    promoted              = $a.promoted
    position              = $a.position
    vote_sum              = $a.vote_sum
    vote_count            = $a.vote_count
    outdated              = $a.outdated
    created_at            = $a.created_at
    edited_at             = $a.edited_at
    updated_at            = $a.updated_at
    author_id             = $a.author_id
    author_name           = $authorName
    body_text             = $bodyText
    body_links            = $bodyLinksStr
  }
}

# Write outputs
Write-Host "`n== Writing Outputs ==" -ForegroundColor green
$prefix = "helpcenter_{0}" -f $datestamp

$allArticlesPath   = "$prefix.all_articles.json"
$allSectionsPath   = "$prefix.all_sections.json"
$allCategoriesPath = "$prefix.all_categories.json"
$csvPath           = "$prefix.all_articles_enriched.csv"

$allArticles   | ConvertTo-Json -Depth 10 | Out-File -Encoding utf8 $allArticlesPath
$allSections   | ConvertTo-Json -Depth 10 | Out-File -Encoding utf8 $allSectionsPath
$allCategories | ConvertTo-Json -Depth 10 | Out-File -Encoding utf8 $allCategoriesPath

# Export CSV (UTF-8; Excel-friendly)
$enriched | Export-Csv -NoTypeInformation -Encoding UTF8 -Path $csvPath
$tsvPath = "$prefix.all_articles_enriched.tsv"
$enriched | Export-Csv -NoTypeInformation -Encoding UTF8 -Delimiter "`t" -Path $tsvPath

function To-ExcelText {
  param([object]$v)
  if ($null -eq $v) { return "" }
  if ($v -is [datetime]) { return $v.ToString("yyyy-MM-dd HH:mm:ss") }
  if ($v -is [bool]) { return $(if ($v) { "TRUE" } else { "FALSE" }) }
  # Everything else as string (covers ints, longs, decimals, etc.)
  return [string]$v
}

# === Excel export with progress logs ===
$xlsxPath = "$prefix.all_articles_enriched.xlsx"

# Make a copy of $enriched with ID columns coerced to strings (prevent scientific notation)
$toExcel = $enriched | ForEach-Object {
  [pscustomobject]@{
    brand_id              = "$($_.brand_id)"
    brand_name            = $_.brand_name
    brand_subdomain       = $_.brand_subdomain
    id                    = "$($_.id)"
    title                 = $_.title
    name                  = $_.name
    html_url              = $_.html_url
    section_id            = "$($_.section_id)"
    section_name          = $_.section_name
    category_id           = "$($_.category_id)"
    category_name         = $_.category_name
    permission_group_id   = "$($_.permission_group_id)"
    permission_group_name = $_.permission_group_name
    user_segment_id       = if($_.user_segment_id){ "$($_.user_segment_id)" } else { "" }
    user_segment_ids      = $_.user_segment_ids
    user_segment_name     = $_.user_segment_name
    user_segment_names    = $_.user_segment_names
    label_names           = $_.label_names
    content_tag_ids       = $_.content_tag_ids
    content_tag_names     = $_.content_tag_names
    comments_disabled     = $_.comments_disabled
    draft                 = $_.draft
    promoted              = $_.promoted
    position              = $_.position
    vote_sum              = $_.vote_sum
    vote_count            = $_.vote_count
    outdated              = $_.outdated
    created_at            = $_.created_at
    edited_at             = $_.edited_at
    updated_at            = $_.updated_at
    author_id             = "$($_.author_id)"
    author_name           = $_.author_name
    body_links            = $_.body_links
    body_text             = $_.body_text
  }
}

$rowsTotal = $toExcel.Count
if ($rowsTotal -eq 0) {
  Write-Host "No rows to export to XLSX, skipping Excel step."
} else {
  $cols = $toExcel[0].psobject.Properties.Name
  $colsTotal = $cols.Count
  $progressEvery = 100  # <- change this if you want more/less frequent updates

  Write-Host ("Starting Excel export: {0} rows x {1} columns" -f $rowsTotal, $colsTotal) -ForegroundColor Cyan
  $sw = [System.Diagnostics.Stopwatch]::StartNew()

  # Spin up Excel (requires Excel installed)
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $wb = $excel.Workbooks.Add()
  $ws = $wb.Worksheets.Item(1)
  Write-Host "Excel COM objects created." -ForegroundColor DarkCyan

  # Pre-format entire sheet as Text (no auto-detection)
  $ws.Cells.NumberFormat = "@"

  # Write headers
  for ($c=0; $c -lt $colsTotal; $c++) { $ws.Cells.Item(1, $c+1).Value2 = $cols[$c] }
  Write-Host ("Headers written in {0:n1}s" -f $sw.Elapsed.TotalSeconds)

  # Helper to force text for Excel
  function To-ExcelText {
    param([object]$v)
    if ($null -eq $v) { return "" }
    if ($v -is [datetime]) { return $v.ToString("yyyy-MM-dd HH:mm:ss") }
    if ($v -is [bool]) { return $(if ($v) { "TRUE" } else { "FALSE" }) }
    return [string]$v
  }

  # Write rows (all values coerced to text for Excel)
  $row = 2
  $written = 0
  foreach ($r in $toExcel) {
    for ($c=0; $c -lt $colsTotal; $c++) {
      $colName = $cols[$c]
      $rawVal  = $r.$colName
      $valText = To-ExcelText $rawVal
      $ws.Cells.Item($row, $c+1).Value2 = $valText
    }
    $row++
    $written++

    if (($written % $progressEvery) -eq 0) {
      Write-Host ("  Wrote {0}/{1} rows... ({2:n1}s elapsed)" -f $written, $rowsTotal, $sw.Elapsed.TotalSeconds)
    }
  }
  Write-Host ("All rows written in {0:n1}s" -f $sw.Elapsed.TotalSeconds) -ForegroundColor DarkGreen

  # Format ID columns explicitly as Text (belt & suspenders)
  $textCols = @("brand_id","id","section_id","category_id","permission_group_id","author_id")
  foreach ($tc in $textCols) {
    $idx = ($cols.IndexOf($tc) + 1)
    if ($idx -gt 0) { $ws.Columns.Item($idx).NumberFormat = "@" }
  }

  # Autosize columns a bit (optional)
  $ws.UsedRange.EntireColumn.AutoFit() | Out-Null

  # Save as XLSX (51 = xlOpenXMLWorkbook)
  $savePath = (Join-Path (Get-Location) $xlsxPath)
  $wb.SaveAs($savePath, 51)
  Write-Host ("Saved Excel file: {0} ({1:n1}s elapsed)" -f $savePath, $sw.Elapsed.TotalSeconds) -ForegroundColor Green

# -- BEGIN: Excel COM cleanup --
try {
    if (Get-Variable -Name worksheet -ErrorAction SilentlyContinue) {
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($worksheet) | Out-Null
    }
    if (Get-Variable -Name ws -ErrorAction SilentlyContinue) {
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ws) | Out-Null
    }
    if (Get-Variable -Name workbook -ErrorAction SilentlyContinue) {
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($workbook) | Out-Null
    }
    if (Get-Variable -Name wb -ErrorAction SilentlyContinue) {
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($wb) | Out-Null
    }
    if (Get-Variable -Name excel -ErrorAction SilentlyContinue) {
        $excel.Quit()
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
    }
}
finally {
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
# -- END: Excel COM cleanup --
}
Write-Host ""
Write-Host "Done!" -ForegroundColor Green

Write-Host "  $xlsxPath"
Write-Host "  $csvPath"
Write-Host "  $allArticlesPath"
Write-Host "  $allSectionsPath"
Write-Host "  $allCategoriesPath"
