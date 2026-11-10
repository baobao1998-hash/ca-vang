# Sao lưu toàn bộ dự án (kể cả lịch sử Git) thành 1 file zip trong thư mục _sao-luu
# Cách chạy: chuột phải file này -> "Run with PowerShell"
# Giữ lại 20 bản mới nhất.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $root "_sao-luu"
New-Item -ItemType Directory -Force $dest | Out-Null

$stamp = Get-Date -Format "yyyyMMdd-HHmm"
$zip = Join-Path $dest "CaVang-$stamp.zip"
$tmp = Join-Path $env:TEMP "cavang-backup-$stamp"

robocopy $root $tmp /E /XD "$dest" /NFL /NDL /NJH /NJS /NP | Out-Null
Compress-Archive -Path (Join-Path $tmp "*") -DestinationPath $zip -Force
Remove-Item -Recurse -Force $tmp

Get-ChildItem $dest -Filter "CaVang-*.zip" | Sort-Object Name -Descending | Select-Object -Skip 20 | Remove-Item -Force

Write-Host "Da sao luu: $zip"
Write-Host "Meo: copy file nay vao thu muc Google Drive de co ban du phong tren may."
