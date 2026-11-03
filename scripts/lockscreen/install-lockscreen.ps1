<#
  Tạo task trong Task Scheduler: cứ N phút chụp /widget và đặt làm ảnh màn hình khoá.
  Chạy trong Windows PowerShell:  powershell -ExecutionPolicy Bypass -File scripts\lockscreen\install-lockscreen.ps1
  -Minutes 15      chu kỳ (mặc định 15, khớp nhịp cập nhật giá của server)
  -UseRegistry     dùng PersonalizationCSP, phải mở PowerShell bằng "Run as administrator"
#>
param([int]$Minutes = 15, [switch]$UseRegistry)
$ErrorActionPreference = 'Stop'
$taskName = 'SFL Flip lockscreen'
$vbs = Join-Path $PSScriptRoot 'run-hidden.vbs'
$arg = "`"$vbs`"" + $(if ($UseRegistry) { ' -UseRegistry' } else { '' })

$action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument $arg
# Không thêm trigger lúc đăng nhập: loại đó thường đòi admin. StartWhenAvailable bù lượt bị lỡ khi máy ngủ
$triggers = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $Minutes)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive `
  -RunLevel $(if ($UseRegistry) { 'Highest' } else { 'Limited' })
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $triggers -Settings $settings -Principal $principal -Force | Out-Null
Write-Host "Đã tạo task '$taskName', $Minutes phút một lần. Chạy thử ngay..."

$runArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $PSScriptRoot 'update-lockscreen.ps1'))
if ($UseRegistry) { $runArgs += '-UseRegistry' }
& powershell.exe @runArgs
Write-Host "Xong. Xem log: $env:LOCALAPPDATA\sfl-widget\lockscreen.log (Win+L để xem màn hình khoá)"
Get-Content "$env:LOCALAPPDATA\sfl-widget\lockscreen.log" -Tail 3 -ErrorAction SilentlyContinue
