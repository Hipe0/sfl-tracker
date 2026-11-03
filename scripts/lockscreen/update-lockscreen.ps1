<#
  Chụp trang /widget (top Mua + hàng đang giữ) thành PNG rồi đặt làm ảnh màn hình khoá Windows.
  Chạy bằng Windows PowerShell 5.1 (powershell.exe), KHÔNG dùng pwsh 7 (thiếu WinRT).

  Cấu hình đọc từ .env của repo: WIDGET_URL (mặc định http://localhost:3001) và FLIP_OWNER_KEY.
  Mặc định dùng API WinRT LockScreen (không cần admin). -UseRegistry: ghi PersonalizationCSP (cần admin,
  khoá luôn mục chọn ảnh khoá trong Settings) cho máy mà cách WinRT không ăn.
  Log: %LOCALAPPDATA%\sfl-widget\lockscreen.log
#>
param(
  [string]$Url,
  [string]$Key,
  [switch]$UseRegistry,
  [int]$Width,
  [int]$Height
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$outDir = Join-Path $env:LOCALAPPDATA 'sfl-widget'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$logFile = Join-Path $outDir 'lockscreen.log'
function Log([string]$m) {
  "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $m" | Add-Content -Path $logFile -Encoding UTF8
  if ((Get-Item $logFile).Length -gt 200KB) { Get-Content $logFile -Tail 200 | Set-Content $logFile -Encoding UTF8 }
}

function Get-EnvValue([string]$name) {
  $f = Join-Path $root '.env'
  if (-not (Test-Path $f)) { return $null }
  foreach ($line in Get-Content $f -Encoding UTF8) {
    if ($line -match "^\s*$name\s*=\s*(.*)$") { return $Matches[1].Trim().Trim('"').Trim("'") }
  }
  return $null
}

try {
  if (-not $Url) { $Url = Get-EnvValue 'WIDGET_URL' }
  if (-not $Url) { $Url = 'http://localhost:3001' }
  $Url = $Url.TrimEnd('/')
  if (-not $Key) { $Key = Get-EnvValue 'FLIP_OWNER_KEY' }
  if (-not $Key) { throw 'Thiếu FLIP_OWNER_KEY trong .env' }

  # Server tắt hoặc sai key thì giữ nguyên ảnh cũ, không chụp trang lỗi
  try {
    $null = Invoke-RestMethod -Uri "$Url/api/market/widget" -Headers @{ 'x-flip-key' = $Key } -TimeoutSec 60 -UseBasicParsing
  } catch {
    Log "Bỏ qua lượt này, không gọi được $Url/api/market/widget : $($_.Exception.Message)"
    exit 0
  }

  # Độ phân giải thật của màn hình + hệ số scale (125%, 150%...) để ảnh nét và chữ cùng cỡ với desktop
  $vc = Get-CimInstance Win32_VideoController | Where-Object { $_.CurrentHorizontalResolution } | Select-Object -First 1
  if (-not $Width) { $Width = if ($vc) { [int]$vc.CurrentHorizontalResolution } else { 1920 } }
  if (-not $Height) { $Height = if ($vc) { [int]$vc.CurrentVerticalResolution } else { 1080 } }
  $dpi = (Get-ItemProperty 'HKCU:\Control Panel\Desktop\WindowMetrics' -Name AppliedDPI -ErrorAction SilentlyContinue).AppliedDPI
  $scale = if ($dpi) { [double]$dpi / 96 } else { 1.0 }
  $cssW = [int][math]::Round($Width / $scale)
  $cssH = [int][math]::Round($Height / $scale)

  $browser = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
  ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
  if (-not $browser) { throw 'Không tìm thấy Edge hoặc Chrome' }

  $shot = Join-Path $outDir 'shot.png'
  Remove-Item $shot -ErrorAction SilentlyContinue
  # WIDGET_BG trong .env: soc1|soc2|soc3|none|<url ảnh> (mặc định soc3), WIDGET_POS: br|right|left|center
  $bg = Get-EnvValue 'WIDGET_BG'
  $pos = Get-EnvValue 'WIDGET_POS'
  $page = "$Url/widget#key=$([uri]::EscapeDataString($Key))&lock=1" + $(if ($bg) { "&bg=$([uri]::EscapeDataString($bg))" } else { '' }) + $(if ($pos) { "&pos=$pos" } else { '' })
  $inv = [Globalization.CultureInfo]::InvariantCulture
  $browserArgs = @(
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--mute-audio',
    "--user-data-dir=`"$(Join-Path $outDir 'browser-profile')`"",
    "--window-size=$cssW,$cssH",
    "--force-device-scale-factor=$($scale.ToString($inv))",
    '--virtual-time-budget=20000',
    "--screenshot=`"$shot`"",
    "`"$page`""
  )
  $proc = Start-Process -FilePath $browser -ArgumentList $browserArgs -WindowStyle Hidden -PassThru
  if (-not $proc.WaitForExit(90000)) { $proc.Kill(); throw 'Trình duyệt chụp quá 90 giây' }
  if (-not (Test-Path $shot) -or (Get-Item $shot).Length -lt 1000) { throw 'Chụp trang không ra ảnh' }

  $useCsp = $UseRegistry
  if (-not $useCsp) {
    try {
      # API WinRT LockScreen.SetImageFileAsync (Windows 10/11, không cần admin)
      $img = Join-Path $outDir 'lockscreen.png'
      Copy-Item $shot $img -Force
      Add-Type -AssemblyName System.Runtime.WindowsRuntime
      $null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
      $null = [Windows.System.UserProfile.LockScreen, Windows.System.UserProfile, ContentType = WindowsRuntime]
      $ext = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 }
      $asOp = ($ext | Where-Object { $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
      $asAction = ($ext | Where-Object { $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction' })[0]
      $t = $asOp.MakeGenericMethod([Windows.Storage.StorageFile]).Invoke($null, @([Windows.Storage.StorageFile]::GetFileFromPathAsync($img)))
      $null = $t.Wait(30000)
      $t2 = $asAction.Invoke($null, @([Windows.System.UserProfile.LockScreen]::SetImageFileAsync($t.Result)))
      $null = $t2.Wait(30000)
      if ($t2.Exception) { throw $t2.Exception }
      Log "OK (WinRT) ${Width}x${Height} scale $scale"
    } catch {
      Log "WinRT lỗi: $($_.Exception.Message)"
      $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
      if (-not $isAdmin) { throw 'WinRT không đặt được ảnh khoá; cài lại bằng install-lockscreen.ps1 -UseRegistry (cần admin)' }
      $useCsp = $true
    }
  }

  if ($useCsp) {
    # PersonalizationCSP: Windows cache theo đường dẫn, nên đổi qua lại 2 tên file để ảnh mới được nạp
    $csp = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\PersonalizationCSP'
    $cspDir = Join-Path $env:ProgramData 'sfl-widget'
    New-Item -ItemType Directory -Force -Path $cspDir | Out-Null
    $prev = (Get-ItemProperty $csp -Name LockScreenImagePath -ErrorAction SilentlyContinue).LockScreenImagePath
    $img = Join-Path $cspDir $(if ($prev -like '*lock-a.png') { 'lock-b.png' } else { 'lock-a.png' })
    Copy-Item $shot $img -Force
    if (-not (Test-Path $csp)) { New-Item -Path $csp -Force | Out-Null }
    Set-ItemProperty $csp -Name LockScreenImagePath -Value $img
    Set-ItemProperty $csp -Name LockScreenImageUrl -Value $img
    New-ItemProperty $csp -Name LockScreenImageStatus -Value 1 -PropertyType DWord -Force | Out-Null
    Log "OK (registry) $img"
  }
} catch {
  Log "LỖI: $($_.Exception.Message)"
  exit 1
}
