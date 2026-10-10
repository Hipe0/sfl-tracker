<#
.SYNOPSIS
  Tạo file Excel báo cáo FLIP tự làm mới (Power Query) từ API /api/flip của server.

.DESCRIPTION
  Chạy một lần. File tạo ra tự lấy dữ liệu từ server mỗi -RefreshMinutes phút khi đang mở,
  và khi mở file. Server phải đang chạy với FLIP_ENABLED=true.
  Mã FLIP_OWNER_KEY được ghi vào file Excel, nên đừng gửi file này cho người khác.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\flip\New-FlipWorkbook.ps1
#>
param(
  [string]$ApiUrl = 'http://localhost:3001',
  [string]$FarmId,
  [string]$Key,
  [ValidateSet('resource', 'nft', 'all')][string]$Category = 'resource',
  [int]$RefreshMinutes = 1,
  [int]$TzOffsetMinutes = 420,
  [string]$OutPath = (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'SFL-FLIP.xlsx')
)

$ErrorActionPreference = 'Stop'

# Đọc mặc định từ .env của project (không in ra màn hình)
$envFile = Join-Path $PSScriptRoot '..\..\.env'
$envVars = @{}
if (Test-Path $envFile) {
  foreach ($line in Get-Content $envFile -Encoding UTF8) {
    if ($line -match '^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$') { $envVars[$Matches[1]] = $Matches[2].Trim('"', "'") }
  }
}
if (-not $Key) { $Key = $envVars['FLIP_OWNER_KEY'] }
if (-not $FarmId) { $FarmId = @(($envVars['FLIP_FARM_IDS'] -split '[\s,;]+') | Where-Object { $_ })[0] }
if ($envVars['PORT'] -and $PSBoundParameters.Keys -notcontains 'ApiUrl') { $ApiUrl = "http://localhost:$($envVars['PORT'])" }
if (-not $Key -or -not $FarmId) { throw 'Thiếu FLIP_OWNER_KEY hoặc FLIP_FARM_IDS (trong .env hoặc tham số -Key / -FarmId).' }

# Kiểm tra server và mã trước khi tạo file
try {
  Invoke-RestMethod -Uri "$ApiUrl/api/flip/status" -Headers @{ 'x-flip-key' = $Key } | Out-Null
} catch {
  throw "Không gọi được $ApiUrl/api/flip/status. Server có đang chạy với FLIP_ENABLED=true và đúng mã không? ($($_.Exception.Message))"
}

function M-Text([string]$s) { '"' + $s.Replace('"', '""') + '"' }

$base = M-Text "$ApiUrl/api/flip/$FarmId"
$keyM = M-Text $Key
$catM = M-Text $Category

# Mỗi bảng: tên query, đường dẫn, các cột (tên trong API -> tiêu đề, kiểu M)
$tables = [ordered]@{
  Resources = @{
    Path = 'resources'
    Cols = @(
      @('item', 'Resource', 'type text'),
      @('boughtQty', 'Bought qty', 'type number'),
      @('boughtCost', 'Bought (SFL)', 'type number'),
      @('avgBuyPrice', 'Avg buy price', 'type number'),
      @('soldQty', 'Sold qty', 'type number'),
      @('soldAfterTax', 'Sold after tax', 'type number'),
      @('avgSellPrice', 'Avg sell price', 'type number'),
      @('taxPaid', 'Tax paid', 'type number'),
      @('realizedProfit', 'Realized profit', 'type number'),
      @('roi', 'ROI', 'type number'),
      @('wins', 'Wins', 'Int64.Type'),
      @('losses', 'Losses', 'Int64.Type'),
      @('avgHoldDays', 'Avg hold (days)', 'type number'),
      @('nonFlipQty', 'Sold non-flip qty', 'type number'),
      @('nonFlipAfterTax', 'Sold non-flip (after tax)', 'type number'),
      @('lotsUsed', 'Lots used', 'Int64.Type'),
      @('matchedCost', 'Matched cost', 'type number'),
      @('openQty', 'Holding qty', 'type number'),
      @('openCost', 'Holding cost', 'type number'),
      @('marketPrice', 'Market price', 'type number'),
      @('unrealizedProfit', 'Unrealized profit', 'type number'),
      @('realizedUsd', 'Realized (USD)', 'type number')
    )
  }
  Lots = @{
    Path = 'lots'
    Cols = @(
      @('item', 'Resource', 'type text'),
      @('buyTime', 'Bought at', 'time'),
      @('sellTime', 'Sold at', 'time'),
      @('qty', 'Qty', 'type number'),
      @('buyPrice', 'Buy price', 'type number'),
      @('sellPrice', 'Sell price', 'type number'),
      @('taxRate', 'Tax rate', 'type number'),
      @('cost', 'Cost', 'type number'),
      @('taxPaid', 'Tax paid', 'type number'),
      @('proceeds', 'Proceeds after tax', 'type number'),
      @('profit', 'Profit', 'type number'),
      @('roi', 'ROI', 'type number'),
      @('holdDays', 'Hold (days)', 'type number'),
      @('profitUsd', 'Profit (USD)', 'type number'),
      @('buyTradeId', 'Buy trade', 'type text'),
      @('sellTradeId', 'Sell trade', 'type text')
    )
  }
  Daily = @{
    Path = 'daily'
    Cols = @(
      @('date', 'Date', 'type date'),
      @('realizedProfit', 'Realized profit', 'type number'),
      @('cumulativeProfit', 'Cumulative profit', 'type number'),
      @('bought', 'Bought', 'type number'),
      @('soldAfterTax', 'Sold after tax', 'type number'),
      @('taxPaid', 'Tax paid', 'type number')
    )
  }
  Holding = @{
    Path = 'openLots'
    Cols = @(
      @('item', 'Resource', 'type text'),
      @('buyTime', 'Bought at', 'time'),
      @('qty', 'Qty', 'type number'),
      @('buyPrice', 'Buy price', 'type number'),
      @('cost', 'Cost', 'type number'),
      @('marketPrice', 'Market price', 'type number'),
      @('marketValueAfterTax', 'Value after tax', 'type number'),
      @('unrealizedProfit', 'Unrealized profit', 'type number'),
      @('buyTradeId', 'Buy trade', 'type text')
    )
  }
  NonFlip = @{
    Path = 'nonFlip'
    Cols = @(
      @('item', 'Resource', 'type text'),
      @('sellTime', 'Sold at', 'time'),
      @('qty', 'Qty', 'type number'),
      @('afterTax', 'After tax', 'type number'),
      @('sellTradeId', 'Sell trade', 'type text')
    )
  }
}

function Build-M($t) {
  $fields = ($t.Cols | ForEach-Object { M-Text $_[0] }) -join ', '
  $timeCols = @($t.Cols | Where-Object { $_[2] -eq 'time' })
  $toTime = ''
  if ($timeCols.Count) {
    $pairs = ($timeCols | ForEach-Object { '{' + (M-Text $_[0]) + ', each if _ = null then null else #datetime(1970,1,1,0,0,0) + #duration(0,0,0,(_ / 1000) + ' + ($TzOffsetMinutes * 60) + '), type datetime}' }) -join ', '
    $toTime = "    Times = Table.TransformColumns(Typed0, {$pairs}),`n"
  } else {
    $toTime = "    Times = Typed0,`n"
  }
  $typePairs = ($t.Cols | Where-Object { $_[2] -ne 'time' -and $_[2] -ne 'type date' } | ForEach-Object { '{' + (M-Text $_[0]) + ', ' + $_[2] + '}' }) -join ', '
  $dateCols = @($t.Cols | Where-Object { $_[2] -eq 'type date' })
  $datePairs = ($dateCols | ForEach-Object { '{' + (M-Text $_[0]) + ', each Date.FromText(_), type date}' }) -join ', '
  $renames = ($t.Cols | ForEach-Object { '{' + (M-Text $_[0]) + ', ' + (M-Text $_[1]) + '}' }) -join ', '
  $dateStep = if ($dateCols.Count) { "    Dated = Table.TransformColumns(Times, {$datePairs}),`n" } else { "    Dated = Times,`n" }
@"
let
    Source = Json.Document(Web.Contents($base, [RelativePath = "$($t.Path)", Query = [category = $catM], Headers = [#"x-flip-key" = $keyM]])),
    Typed0 = Table.FromRecords(Source, {$fields}, MissingField.UseNull),
$toTime$dateStep    Typed = Table.TransformColumnTypes(Dated, {$typePairs}),
    Renamed = Table.RenameColumns(Typed, {$renames})
in
    Renamed
"@
}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
try {
  $wb = $excel.Workbooks.Add()
  while ($wb.Worksheets.Count -gt 1) { $wb.Worksheets.Item($wb.Worksheets.Count).Delete() }
  $summary = $wb.Worksheets.Item(1)
  $summary.Name = 'FLIP'

  # Định dạng số viết kiểu en-US rồi đổi sang dấu thập phân/nghìn của máy (NumberFormat qua COM bị đọc theo locale)
  $decSep = $excel.International(3)
  $thouSep = $excel.International(4)
  function Set-Fmt($range, [string]$f) {
    $range.NumberFormatLocal = $f.Replace(',', [string][char]1).Replace('.', $decSep).Replace([string][char]1, $thouSep)
  }

  $sheets = @{}
  $after = $summary
  foreach ($name in $tables.Keys) {
    $t = $tables[$name]
    $wb.Queries.Add($name, (Build-M $t)) | Out-Null
    $ws = $wb.Worksheets.Add([Type]::Missing, $after)
    $ws.Name = $name
    $after = $ws
    $conn = "OLEDB;Provider=Microsoft.Mashup.OleDb.1;Data Source=`$Workbook`$;Location=$name;Extended Properties=`"`""
    $lo = $ws.ListObjects.Add(0, $conn, [Type]::Missing, 1, $ws.Range('A1'))
    $lo.Name = $name
    $qt = $lo.QueryTable
    $qt.CommandType = 2
    $qt.CommandText = "SELECT * FROM [$name]"
    $qt.RefreshStyle = 1
    $qt.AdjustColumnWidth = $true
    $qt.PreserveFormatting = $true
    $qt.BackgroundQuery = $false
    $qt.Refresh() | Out-Null
    $lo.TableStyle = 'TableStyleMedium2'
    $sheets[$name] = $ws
  }

  # Định dạng số
  $fmt = @{
    'Resources' = @{ 'Avg buy price' = '0.00000'; 'Avg sell price' = '0.00000'; 'Market price' = '0.00000'; 'ROI' = '+0.0%;-0.0%'; 'Avg hold (days)' = '0.0' }
    'Lots'      = @{ 'Buy price' = '0.00000'; 'Sell price' = '0.00000'; 'Tax rate' = '0%'; 'ROI' = '+0.0%;-0.0%'; 'Hold (days)' = '0.0'; 'Bought at' = 'yyyy-mm-dd hh:mm'; 'Sold at' = 'yyyy-mm-dd hh:mm' }
    'Daily'     = @{ 'Date' = 'yyyy-mm-dd' }
    'Holding'   = @{ 'Buy price' = '0.00000'; 'Market price' = '0.00000'; 'Bought at' = 'yyyy-mm-dd hh:mm' }
    'NonFlip'   = @{ 'Sold at' = 'yyyy-mm-dd hh:mm' }
  }
  foreach ($name in $tables.Keys) {
    $lo = $sheets[$name].ListObjects.Item(1)
    foreach ($col in $lo.ListColumns) {
      $f = $fmt[$name][$col.Name]
      if (-not $f -and $col.Name -match 'qty') { $f = '#,##0' }
      if (-not $f -and @($tables[$name].Cols | Where-Object { $_[1] -eq $col.Name -and $_[2] -eq 'type number' }).Count) { $f = '#,##0.00' }
      if ($f -and $col.DataBodyRange) { Set-Fmt $col.DataBodyRange $f }
    }
    # Lãi xanh, lỗ đỏ
    foreach ($pc in @('Realized profit', 'Profit', 'Unrealized profit', 'ROI', 'Cumulative profit')) {
      $col = $lo.ListColumns | Where-Object { $_.Name -eq $pc } | Select-Object -First 1
      if ($col -and $col.DataBodyRange) {
        $r = $sheets[$name].Range($sheets[$name].Cells(2, $col.Index), $sheets[$name].Cells(1048576, $col.Index))
        $r.FormatConditions.Delete() | Out-Null
        ($r.FormatConditions.Add(1, 5, '=0')).Font.Color = 0x50B000   # > 0
        ($r.FormatConditions.Add(1, 6, '=0')).Font.Color = 0x3C14DC   # < 0
      }
    }
    $sheets[$name].Activate() | Out-Null
    $excel.ActiveWindow.SplitRow = 1
    $excel.ActiveWindow.FreezePanes = $true
  }

  # Trang tổng quan: các ô tính bằng công thức trên bảng dữ liệu
  $kpis = @(
    @('Realized profit', '=SUM(Resources[Realized profit])', '#,##0.00'),
    @('Tax paid', '=SUM(Resources[Tax paid])', '#,##0.00'),
    @('Sold after tax', '=SUM(Resources[Sold after tax])', '#,##0.00'),
    @('Bought', '=SUM(Resources[Bought (SFL)])', '#,##0.00'),
    @('Sold non-flip (after tax)', '=SUM(Resources[Sold non-flip (after tax)])', '#,##0.00'),
    @('ROI', '=IFERROR(SUM(Resources[Realized profit])/SUM(Resources[Matched cost]),0)', '+0.0%;-0.0%'),
    @('Win rate', '=IFERROR(SUM(Resources[Wins])/(SUM(Resources[Wins])+SUM(Resources[Losses])),0)', '0%'),
    @('Avg hold (days)', '=IFERROR(SUMPRODUCT(Lots[Hold (days)],Lots[Qty])/SUM(Lots[Qty]),0)', '0.0'),
    @('Holding cost', '=SUM(Resources[Holding cost])', '#,##0.00'),
    @('Unrealized profit', '=SUM(Resources[Unrealized profit])', '+#,##0.00;-#,##0.00'),
    @('Realized (USD)', '=SUM(Resources[Realized (USD)])', '$#,##0.00')
  )
  $summary.Cells(1, 1).Value2 = "FLIP · farm $FarmId · $Category"
  $summary.Cells(1, 1).Font.Size = 16
  $summary.Cells(1, 1).Font.Bold = $true
  $summary.Cells(2, 1).Value2 = "Tự làm mới mỗi $RefreshMinutes phút từ $ApiUrl (server phải đang chạy)."
  $summary.Cells(2, 1).Font.Color = 0x808080
  for ($i = 0; $i -lt $kpis.Count; $i++) {
    $col = $i + 1
    $summary.Cells(4, $col).Value2 = $kpis[$i][0]
    $summary.Cells(4, $col).Font.Bold = $true
    $summary.Cells(4, $col).Font.Color = 0x808080
    $summary.Cells(5, $col).Formula = $kpis[$i][1]
    Set-Fmt $summary.Cells(5, $col) $kpis[$i][2]
    $summary.Cells(5, $col).Font.Size = 16
    $summary.Cells(5, $col).Font.Bold = $true
    $summary.Columns($col).ColumnWidth = 17
  }
  $summary.Range('A4:K4').WrapText = $true
  # Realized, ROI, Unrealized: xanh khi lãi, đỏ khi lỗ
  foreach ($addr in @('A5', 'F5', 'J5')) {
    ($summary.Range($addr).FormatConditions.Add(1, 5, '=0')).Font.Color = 0x50B000
    ($summary.Range($addr).FormatConditions.Add(1, 6, '=0')).Font.Color = 0x3C14DC
  }

  # Biểu đồ: cột lãi theo ngày + đường lãi luỹ kế
  $daily = $sheets['Daily'].ListObjects.Item(1)
  $chartObj = $summary.ChartObjects().Add($summary.Range('A7').Left, $summary.Range('A7').Top, 900, 300)
  $chart = $chartObj.Chart
  while ($chart.SeriesCollection().Count -gt 0) { $chart.SeriesCollection(1).Delete() }
  $bar = $chart.SeriesCollection().NewSeries()
  $bar.Name = 'Daily realized'
  $bar.Values = "='Daily'!" + $daily.ListColumns.Item('Realized profit').DataBodyRange.Address()
  $bar.XValues = "='Daily'!" + $daily.ListColumns.Item('Date').DataBodyRange.Address()
  $bar.ChartType = 51
  $line = $chart.SeriesCollection().NewSeries()
  $line.Name = 'Cumulative profit'
  $line.Values = "='Daily'!" + $daily.ListColumns.Item('Cumulative profit').DataBodyRange.Address()
  $line.XValues = "='Daily'!" + $daily.ListColumns.Item('Date').DataBodyRange.Address()
  $line.ChartType = 4
  $line.AxisGroup = 2
  $chart.HasTitle = $true
  $chart.ChartTitle.Text = 'Realized profit (SFL)'
  $chart.Axes(1).TickLabelPosition = -4134
  $chart.HasLegend = $true
  $chart.Legend.Position = -4107

  # Bảng top vật phẩm ngay dưới biểu đồ: dùng công thức trỏ vào bảng Resources
  $summary.Cells(29, 1).Value2 = 'Xem chi tiết từng vật phẩm ở sheet Resources, từng lô ở Lots, hàng đang giữ ở Holding.'
  $summary.Cells(29, 1).Font.Color = 0x808080

  # Tự làm mới định kỳ và khi mở file
  foreach ($c in $wb.Connections) {
    if ($c.Type -eq 1) {
      $c.OLEDBConnection.BackgroundQuery = $true
      $c.OLEDBConnection.RefreshOnFileOpen = $true
      $c.OLEDBConnection.RefreshPeriod = $RefreshMinutes
    }
  }

  $summary.Activate() | Out-Null
  $outFull = [IO.Path]::GetFullPath($OutPath)
  if (Test-Path $outFull) { Remove-Item $outFull -Force }
  $wb.SaveAs($outFull, 51)
  $wb.Close($false)
  Write-Host "Đã tạo $outFull"
} finally {
  $excel.Quit()
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
}
