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
      @('sellTradeId', 'Sell trade', 'type text'),
      @('buySource', 'Buy source', 'type text'),
      @('sellSource', 'Sell source', 'type text')
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
  # Lệnh bù (ước tính theo kho đồ) và lệnh nhập tay; sửa/xoá trong panel FLIP của app
  Adjustments = @{
    Path = 'adjustments'
    Cols = @(
      @('at', 'Time', 'time'),
      @('item', 'Resource', 'type text'),
      @('side', 'Side', 'type text'),
      @('qty', 'Qty', 'type number'),
      @('sfl', 'SFL (sell = after tax)', 'type number'),
      @('source', 'Source', 'type text'),
      @('note', 'Note', 'type text')
    )
  }
  # Khoảng có thể bị sót giao dịch (API chỉ trả 50 lệnh gần nhất)
  Gaps = @{
    Path = 'gaps'
    Cols = @(
      @('detectedAt', 'Detected at', 'time'),
      @('from', 'From', 'time'),
      @('to', 'To', 'time'),
      @('missingCount', 'Missing trades', 'type number'),
      @('status', 'Status', 'type text'),
      @('reason', 'Reason', 'type text'),
      @('estimatedCount', 'Estimated adjustments', 'type number')
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

  # Giao diện terminal đen - đỏ (màu Excel dạng BGR: r + g*256 + b*65536); lãi đỏ hồng, lỗ xanh lơ
  function RGB([int]$r, [int]$g, [int]$b) { $r + 256 * $g + 65536 * $b }
  $cBg = RGB 11 13 17; $cCard = RGB 16 19 24; $cHeader = RGB 18 21 27; $cBorder = RGB 58 26 34
  $cGrid = RGB 28 32 39; $cMuted = RGB 125 133 144; $cText = RGB 214 217 222
  $cRed = RGB 255 77 109; $cRedDim = RGB 143 29 51; $cAmber = RGB 245 184 61
  $cBlue = RGB 122 162 247; $cCyan = RGB 76 195 255; $cLine = RGB 158 197 232
  function Set-Dark($ws) {
    $ws.Cells.Interior.Color = $cBg
    $ws.Cells.Font.Name = 'Consolas'
    $ws.Cells.Font.Size = 10
    $ws.Cells.Font.Color = $cText
    $ws.Activate() | Out-Null
    $excel.ActiveWindow.DisplayGridlines = $false
    $ws.Tab.Color = $cRedDim
  }
  function Set-SignColors($range) {
    $range.FormatConditions.Delete() | Out-Null
    ($range.FormatConditions.Add(1, 5, '=0')).Font.Color = $cRed    # > 0
    ($range.FormatConditions.Add(1, 6, '=0')).Font.Color = $cCyan   # < 0
  }
  Set-Dark $summary

  $sheets = @{}
  $after = $summary
  foreach ($name in $tables.Keys) {
    $t = $tables[$name]
    $wb.Queries.Add($name, (Build-M $t)) | Out-Null
    $ws = $wb.Worksheets.Add([Type]::Missing, $after)
    $ws.Name = $name
    Set-Dark $ws
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
    $lo.TableStyle = 'TableStyleLight1'
    $lo.ShowTableStyleRowStripes = $false
    $hdr = $lo.HeaderRowRange
    $hdr.Interior.Color = $cHeader
    $hdr.Font.Color = $cMuted
    $hdr.Font.Bold = $true
    $hdr.Borders.Item(9).Color = $cBorder   # xlEdgeBottom
    $sheets[$name] = $ws
  }

  # Định dạng số
  $fmt = @{
    'Resources' = @{ 'Avg buy price' = '0.00000'; 'Avg sell price' = '0.00000'; 'Market price' = '0.00000'; 'ROI' = '+0.0%;-0.0%'; 'Avg hold (days)' = '0.0' }
    'Lots'      = @{ 'Buy price' = '0.00000'; 'Sell price' = '0.00000'; 'Tax rate' = '0%'; 'ROI' = '+0.0%;-0.0%'; 'Hold (days)' = '0.0'; 'Bought at' = 'yyyy-mm-dd hh:mm'; 'Sold at' = 'yyyy-mm-dd hh:mm' }
    'Daily'     = @{ 'Date' = 'yyyy-mm-dd' }
    'Holding'   = @{ 'Buy price' = '0.00000'; 'Market price' = '0.00000'; 'Bought at' = 'yyyy-mm-dd hh:mm' }
    'NonFlip'   = @{ 'Sold at' = 'yyyy-mm-dd hh:mm' }
    'Adjustments' = @{ 'Time' = 'yyyy-mm-dd hh:mm' }
    'Gaps'      = @{ 'Detected at' = 'yyyy-mm-dd hh:mm'; 'From' = 'yyyy-mm-dd hh:mm'; 'To' = 'yyyy-mm-dd hh:mm'; 'Missing trades' = '0'; 'Estimated adjustments' = '0' }
  }
  foreach ($name in $tables.Keys) {
    $lo = $sheets[$name].ListObjects.Item(1)
    foreach ($col in $lo.ListColumns) {
      $f = $fmt[$name][$col.Name]
      if (-not $f -and $col.Name -match 'qty') { $f = '#,##0' }
      if (-not $f -and @($tables[$name].Cols | Where-Object { $_[1] -eq $col.Name -and $_[2] -eq 'type number' }).Count) { $f = '#,##0.00' }
      if ($f -and $col.DataBodyRange) { Set-Fmt $col.DataBodyRange $f }
    }
    # Màu theo cột như ảnh mẫu (tô cả cột để dòng mới khi làm mới vẫn giữ màu)
    $ws = $sheets[$name]
    foreach ($col in $lo.ListColumns) {
      $whole = $ws.Range($ws.Cells(2, $col.Index), $ws.Cells(1048576, $col.Index))
      if ($col.Name -eq 'Resource') { $whole.Font.Color = RGB 255 255 255; $whole.Font.Bold = $true }
      elseif ($col.Name -match '^(Avg buy price|Buy price|Holding qty|Holding cost|Cost)$') { $whole.Font.Color = $cAmber }
      elseif ($col.Name -match '^(Avg sell price|Sell price|Tax paid|Sold after tax)$') { $whole.Font.Color = $cRed }
      elseif ($col.Name -match 'non-flip') { $whole.Font.Color = $cBlue }
      elseif ($col.Name -match '^(Realized profit|Profit|Unrealized profit|ROI|Cumulative profit|Realized \(USD\)|Profit \(USD\))$') { Set-SignColors $whole }
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
  $summary.Cells(1, 1).Value2 = "> FLIP · farm $FarmId · $Category"
  $summary.Cells(1, 1).Font.Size = 14
  $summary.Cells(1, 1).Font.Bold = $true
  $summary.Cells(1, 1).Font.Color = RGB 255 255 255
  $summary.Cells(2, 1).Value2 = "FIFO lots · tự làm mới mỗi $RefreshMinutes phút từ $ApiUrl · UTC+$([math]::Round($TzOffsetMinutes / 60, 1))"
  $summary.Cells(2, 1).Font.Color = $cMuted
  # Màu số liệu như ảnh mẫu: đỏ cho bán/thuế, vàng cho mua, xanh cho non-flip
  $kpiColors = @($cRed, $cRed, $cRed, $cAmber, $cBlue, $cRed, $cText, $cText, $cAmber, $cRed, $cRed)
  for ($i = 0; $i -lt $kpis.Count; $i++) {
    $col = $i + 1
    $label = $summary.Cells(4, $col)
    $value = $summary.Cells(5, $col)
    $label.Value2 = $kpis[$i][0].ToUpper()
    $label.Font.Size = 8
    $label.Font.Color = $cMuted
    $value.Formula = $kpis[$i][1]
    Set-Fmt $value $kpis[$i][2]
    $value.Font.Size = 18
    $value.Font.Bold = $true
    $value.Font.Color = $kpiColors[$i]
    $card = $summary.Range($label, $value)
    $card.Interior.Color = $cCard
    $card.HorizontalAlignment = -4108
    $card.VerticalAlignment = -4108
    foreach ($edge in 7, 8, 9, 10) { $card.Borders.Item($edge).Color = $cBorder; $card.Borders.Item($edge).Weight = 2 }
    $summary.Columns($col).ColumnWidth = 18
  }
  $summary.Range('A4:K4').WrapText = $true
  $summary.Rows(4).RowHeight = 30
  $summary.Rows(5).RowHeight = 34
  # Realized, ROI, Unrealized, USD: đỏ hồng khi lãi, xanh lơ khi lỗ
  foreach ($addr in @('A5', 'F5', 'J5', 'K5')) { Set-SignColors $summary.Range($addr) }

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
  $chart.ChartTitle.Format.TextFrame2.TextRange.Font.Fill.ForeColor.RGB = $cText
  $chart.ChartTitle.Format.TextFrame2.TextRange.Font.Size = 11
  $chart.Axes(1).TickLabelPosition = -4134
  $chart.HasLegend = $true
  $chart.Legend.Position = -4107
  $chart.Legend.Font.Color = $cMuted

  # Biểu đồ nền tối: cột đỏ sẫm (ngày lỗ xanh sẫm), đường luỹ kế xanh nhạt
  $chart.ChartArea.Format.Fill.ForeColor.RGB = $cBg
  $chart.ChartArea.Format.Line.ForeColor.RGB = $cBorder
  $chart.PlotArea.Format.Fill.ForeColor.RGB = $cBg
  $bar.Format.Fill.ForeColor.RGB = $cRedDim
  $bar.InvertIfNegative = $true
  $bar.InvertColor = RGB 31 78 107
  $chart.ChartGroups(1).GapWidth = 60
  $line.Format.Line.ForeColor.RGB = $cLine
  $line.Format.Line.Weight = 1.75
  foreach ($axis in @($chart.Axes(1), $chart.Axes(2, 1), $chart.Axes(2, 2))) {
    $axis.TickLabels.Font.Color = $cMuted
    $axis.TickLabels.Font.Size = 8
    $axis.Format.Line.ForeColor.RGB = $cGrid
  }
  $chart.Axes(2, 1).MajorGridlines.Format.Line.ForeColor.RGB = $cGrid

  $summary.Cells(29, 1).Value2 = 'Chi tiết: Resources (từng vật phẩm) · Lots (từng lô đã chốt) · Holding (lô đang giữ) · NonFlip (bán không có lô mua) · Adjustments (lệnh bù/nhập tay) · Gaps (khoảng có thể sót).'
  # Cảnh báo khi còn khoảng sót chưa bù được
  $summary.Cells(3, 1).Formula = '=IF(COUNTIF(Gaps[Status],"pending")+COUNTIF(Gaps[Status],"unresolved")>0,"⚠ Có "&(COUNTIF(Gaps[Status],"pending")+COUNTIF(Gaps[Status],"unresolved"))&" khoảng có thể sót giao dịch, xem sheet Gaps và thêm lệnh tay trong app","")'
  $summary.Cells(3, 1).Font.Color = $cAmber
  $summary.Cells(29, 1).Font.Color = $cMuted

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
