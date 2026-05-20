$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$certsDir = Join-Path $root "certs"
$pfxPath = Join-Path $certsDir "localhost.pfx"
$pwdPlain = "prompt-studio"

if (Test-Path $pfxPath) {
  Write-Host "Certificate exists: $pfxPath"
  exit 0
}

New-Item -ItemType Directory -Force -Path $certsDir | Out-Null

Write-Host "Creating self-signed certificate for localhost..."

$cert = New-SelfSignedCertificate `
  -Subject "CN=localhost" `
  -DnsName @("localhost", "127.0.0.1") `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -KeyExportPolicy Exportable `
  -KeySpec Signature `
  -KeyLength 2048 `
  -KeyAlgorithm RSA `
  -HashAlgorithm SHA256 `
  -NotAfter (Get-Date).AddYears(2) `
  -FriendlyName "telegram-prompt-app-https"

$securePwd = ConvertTo-SecureString -String $pwdPlain -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $securePwd | Out-Null

Write-Host "Done: $pfxPath"
