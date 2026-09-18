param(
  [Parameter(Mandatory = $true)]
  [string]$MemoPath,

  [Parameter(Mandatory = $true)]
  [ValidateSet('APPROVE','REJECT','HOLD')]
  [string]$Result,

  [string]$OutDir = '.\startak-said-review-output',

  [switch]$Sign,

  [string]$PrivateKeyPath = '.\startak-said-e2f-independent-private.pem',

  [string]$PublicKeyPath = '.\startak-said-e2f-independent-public.pem'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Single-use constants for the frozen integrated RC. Do not reuse this script for another tuple.
$reviewRequestId = 'p26-review-startak-real-estate-rc-2026-09-16-e876208c19ff-said-1'
$reviewPacketHashSha256 = 'ed8a0ffb242081d308f89b1e177920d6bf2d6e058bceb5047ddedaf4f0eed107'
$proposalId = 'p24-startak-real-estate-rc-2026-09-16-e876208c19ff'
$proposalHashSha256 = 'b6575cb5c7c5ebd2a84ae71b2b31f1cb25a2562dc01d6e82608045e9d4d0557b'
$qualifiedSourceCommitSha = 'e876208c19ffbddd0dacd2bf8fce24aba1e52b55'
$releaseArtifactSha256 = 'c3ddcd7b4a66fd58c271fb08b9e5a3efb5e4237f0015d3771e7ab9818412017f'
$environmentConfigSha256 = '819183fb9f4fb09017c636d2d1d841dd086ac4ba4bbccd103dffbc4c5980bc73'
$reviewerId = 'reviewer-said-2026-09-17'
$actorRef = 'human:said'
$purpose = 'CANONICAL_REBASELINE_INDEPENDENT_REVIEW'
$signatureAlgorithm = 'RSA-SHA256'
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Assert-RealFile([string]$PathValue, [string]$Label) {
  if (-not (Test-Path -LiteralPath $PathValue -PathType Leaf)) {
    throw "$Label not found: $PathValue"
  }
}

function Sha256-File([string]$PathValue) {
  return (Get-FileHash -LiteralPath $PathValue -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Sha256-Utf8([string]$Text) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
    return (($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') }) -join '')
  }
  finally {
    $sha.Dispose()
  }
}

function J([string]$Value) {
  # ConvertTo-Json is used only for scalar string quoting. All payload values are ASCII.
  return ($Value | ConvertTo-Json -Compress)
}

function Write-Utf8NoBom([string]$PathValue, [string]$Text) {
  [System.IO.File]::WriteAllText($PathValue, $Text, $utf8NoBom)
}

Assert-RealFile $MemoPath 'Completed review memo'
$memoRaw = Get-Content -LiteralPath $MemoPath -Raw

$forbiddenMarkers = @(
  'يستكملها سعيد',
  'يكتب سعيد',
  'TEMPLATE_ONLY=true',
  '- [ ]'
)
foreach ($marker in $forbiddenMarkers) {
  if ($memoRaw.Contains($marker)) {
    throw "Review memo still contains an uncompleted template marker: $marker"
  }
}

$memoHash = Sha256-File $MemoPath
$now = [DateTimeOffset]::UtcNow
$decidedAt = $now.ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
$decisionId = 'said-independent-review-' + $now.ToString('yyyyMMddTHHmmssZ')
$decisionSourceRef = 'review-memo-sha256:' + $memoHash
$rationaleRef = $decisionSourceRef + '#section-6'

New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
$outResolved = (Resolve-Path $OutDir).Path

$unsignedAttestation = [ordered]@{
  decisionId = $decisionId
  reviewerId = $reviewerId
  actorRef = $actorRef
  purpose = $purpose
  releaseCandidateId = 'startak-real-estate-rc-2026-09-16-e876208c19ff'
  sourceCommitSha = $qualifiedSourceCommitSha
  artifactSha256 = $releaseArtifactSha256
  environmentRef = 'cloudflare-pages:startak-real-estate:production'
  environmentConfigSha256 = $environmentConfigSha256
  result = $Result
  decisionSourceRef = $decisionSourceRef
  decisionArtifactSha256 = $memoHash
  decidedAt = $decidedAt
  rationaleRef = $rationaleRef
  signatureAlgorithm = $signatureAlgorithm
  signatureBase64 = ''
}

$unsignedPath = Join-Path $outResolved 'said-review-attestation.unsigned.json'
Write-Utf8NoBom $unsignedPath (($unsignedAttestation | ConvertTo-Json -Depth 8) + "`n")

# IMPORTANT: this is the exact flat payload shape produced by
# src/qualification/canonical-rebaseline-review-attestation.js::createIndependentReviewSigningPayload.
# Keys are emitted in the same lexical order used by stableStringify().
$canonical = '{' +
  '"actorRef":' + (J $actorRef) + ',' +
  '"decidedAt":' + (J $decidedAt) + ',' +
  '"decisionArtifactSha256":' + (J $memoHash) + ',' +
  '"decisionId":' + (J $decisionId) + ',' +
  '"decisionSourceRef":' + (J $decisionSourceRef) + ',' +
  '"environmentConfigSha256":' + (J $environmentConfigSha256) + ',' +
  '"proposalHashSha256":' + (J $proposalHashSha256) + ',' +
  '"proposalId":' + (J $proposalId) + ',' +
  '"purpose":' + (J $purpose) + ',' +
  '"qualifiedSourceCommitSha":' + (J $qualifiedSourceCommitSha) + ',' +
  '"rationaleRef":' + (J $rationaleRef) + ',' +
  '"releaseArtifactSha256":' + (J $releaseArtifactSha256) + ',' +
  '"result":' + (J $Result) + ',' +
  '"reviewPacketHashSha256":' + (J $reviewPacketHashSha256) + ',' +
  '"reviewRequestId":' + (J $reviewRequestId) + ',' +
  '"reviewerId":' + (J $reviewerId) + ',' +
  '"schemaVersion":1,' +
  '"signatureAlgorithm":' + (J $signatureAlgorithm) +
'}'

$payloadPath = Join-Path $outResolved 'said-review-signing-payload.canonical.txt'
Write-Utf8NoBom $payloadPath $canonical
$payloadHash = Sha256-Utf8 $canonical
[System.IO.File]::WriteAllText((Join-Path $outResolved 'said-review-signing-payload.sha256.txt'), $payloadHash + "`n", [System.Text.Encoding]::ASCII)
[System.IO.File]::WriteAllText((Join-Path $outResolved 'said-review-signing-payload.base64.txt'), ([Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($canonical))) + "`n", [System.Text.Encoding]::ASCII)

$manifest = [ordered]@{
  schemaVersion = 1
  releaseCandidateId = 'startak-real-estate-rc-2026-09-16-e876208c19ff'
  sourceCommitSha = $qualifiedSourceCommitSha
  releaseArtifactSha256 = $releaseArtifactSha256
  environmentConfigSha256 = $environmentConfigSha256
  reviewRequestId = $reviewRequestId
  reviewPacketHashSha256 = $reviewPacketHashSha256
  proposalId = $proposalId
  proposalHashSha256 = $proposalHashSha256
  reviewerId = $reviewerId
  actorRef = $actorRef
  result = $Result
  memoPath = (Resolve-Path -LiteralPath $MemoPath).Path
  memoSha256 = $memoHash
  decidedAt = $decidedAt
  signingPayloadSha256 = $payloadHash
  signatureAlgorithm = $signatureAlgorithm
  signed = $false
  localPreparationOnly = $true
}

if ($Sign) {
  Assert-RealFile $PrivateKeyPath 'Private key'
  Assert-RealFile $PublicKeyPath 'Public key'

  $openssl = $null
  $cmd = Get-Command openssl -ErrorAction SilentlyContinue
  if ($cmd) { $openssl = $cmd.Source }
  if (-not $openssl) {
    $candidates = @(
      'C:\Program Files\Git\usr\bin\openssl.exe',
      'C:\Program Files\Git\mingw64\bin\openssl.exe',
      'C:\Program Files\OpenSSL-Win64\bin\openssl.exe'
    )
    foreach ($candidate in $candidates) {
      if (Test-Path -LiteralPath $candidate -PathType Leaf) { $openssl = $candidate; break }
    }
  }
  if (-not $openssl) {
    throw 'OpenSSL was not found. Preparation completed, but signing was not attempted. Install/use a trusted OpenSSL client locally and sign the canonical payload with RSA-SHA256; do not upload the private key.'
  }

  $sigBin = Join-Path $outResolved 'said-review-signature.bin'
  Write-Host 'OpenSSL will now ask Said for the private-key passphrase locally. Do not paste or share that passphrase.'
  & $openssl dgst -sha256 -sign $PrivateKeyPath -out $sigBin $payloadPath
  if ($LASTEXITCODE -ne 0) { throw "OpenSSL signing failed with exit code $LASTEXITCODE" }

  & $openssl dgst -sha256 -verify $PublicKeyPath -signature $sigBin $payloadPath | Out-Host
  if ($LASTEXITCODE -ne 0) { throw 'Local RSA-SHA256 verification failed; refusing to produce a signed attestation.' }

  $sigBase64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($sigBin))
  [System.IO.File]::WriteAllText((Join-Path $outResolved 'said-review-signature.base64.txt'), $sigBase64 + "`n", [System.Text.Encoding]::ASCII)

  $signedAttestation = [ordered]@{}
  foreach ($key in $unsignedAttestation.Keys) { $signedAttestation[$key] = $unsignedAttestation[$key] }
  $signedAttestation.signatureBase64 = $sigBase64
  $signedPath = Join-Path $outResolved 'said-review-attestation.signed.json'
  Write-Utf8NoBom $signedPath (($signedAttestation | ConvertTo-Json -Depth 8) + "`n")

  $manifest.signed = $true
  $manifest.localPreparationOnly = $false
  $manifest.signatureBase64Sha256 = Sha256-Utf8 $sigBase64
}

$manifestPath = Join-Path $outResolved 'said-review-signing-manifest.json'
Write-Utf8NoBom $manifestPath (($manifest | ConvertTo-Json -Depth 8) + "`n")

Write-Host ''
Write-Host 'STARTAK Said review signing package prepared.'
Write-Host "Memo SHA-256: $memoHash"
Write-Host "Canonical payload SHA-256: $payloadHash"
Write-Host "Output directory: $outResolved"
if ($Sign) {
  Write-Host 'Local signature verification: PASS'
  Write-Host 'Share only the completed memo, signed attestation, manifest, and signatureBase64 if requested. Never share the private key or passphrase.'
} else {
  Write-Host 'Signing was NOT performed. Re-run with -Sign only when Said personally performs the signature step.'
}
