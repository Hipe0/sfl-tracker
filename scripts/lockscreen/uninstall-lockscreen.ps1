<# Gỡ task. Nếu đã cài bằng -UseRegistry thì chạy bằng admin để xoá luôn khoá PersonalizationCSP. #>
$taskName = 'SFL Flip lockscreen'
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
$csp = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\PersonalizationCSP'
if (Test-Path $csp) {
  try { Remove-Item $csp -Recurse -Force -ErrorAction Stop; Write-Host 'Đã xoá PersonalizationCSP' }
  catch { Write-Host 'Còn khoá PersonalizationCSP, mở PowerShell admin rồi chạy lại để xoá' }
}
Write-Host "Đã gỡ task '$taskName'. Ảnh khoá hiện tại giữ nguyên, đổi lại trong Settings > Personalization > Lock screen."
