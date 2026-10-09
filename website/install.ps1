# Aquadro POS — Windows Direct & Safe One-Click Installer
# يقوم بتنزيل وتثبيت البرنامج مباشرة مع إزالة تحذيرات الأمان (Unblock-File) تلقائياً

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "                Aquadro POS - الجزائر                    " -ForegroundColor Yellow
Write-Host "           برنامج إدارة نقاط البيع والمخزون              " -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " جارٍ التنزيل والتثبيت الفوري دون أي قيود أمان..." -ForegroundColor Green
Write-Host ""

$releaseApi = "https://api.github.com/repos/sigoulojia/aquadro-releases/releases/latest"
$fallbackUrl = "https://github.com/sigoulojia/aquadro-releases/releases/latest/download/AquadroPOS_1.0.0_x64-setup.exe"
$downloadUrl = $fallbackUrl

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $res = Invoke-RestMethod -Uri $releaseApi -UseBasicParsing -TimeoutSec 10
    $exeAsset = $res.assets | Where-Object { $_.name -like "*.exe" -and $_.name -notlike "*.sig" } | Select-Object -First 1
    if ($exeAsset) {
        $downloadUrl = $exeAsset.browser_download_url
    }
} catch {
    Write-Host "[*] استخدام الرابط المباشر للمثبت..." -ForegroundColor DarkGray
}

$tempDir = [System.IO.Path]::GetTempPath()
$installerPath = Join-Path $tempDir "AquadroPOS_Setup.exe"

Write-Host "[1/3] جارٍ تنزيل المثبت الخفيف (~4.4 MB)..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $downloadUrl -OutFile $installerPath -UseBasicParsing

Write-Host "[2/3] فك حظر الأمان وإلغاء شاشة التحذير (Unblocking SmartScreen)..." -ForegroundColor Cyan
if (Get-Command Unblock-File -ErrorAction SilentlyContinue) {
    Unblock-File -Path $installerPath
}

Write-Host "[3/3] تشغيل مثبت Aquadro POS الآن..." -ForegroundColor Green
Start-Process -FilePath $installerPath

Write-Host ""
Write-Host "✓ اكتمل التنزيل بنجاح وتم تشغيل برنامج التثبيت!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
