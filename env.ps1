$nodePath = Resolve-Path ".\node-v18.16.0-win-x64"
$jdkPath = Resolve-Path ".\jdk-17.0.7+7"
$sdkPath = Resolve-Path ".\sdk"

$env:PATH = "$nodePath;$jdkPath\bin;$sdkPath\cmdline-tools\latest\bin;$sdkPath\platform-tools;$env:PATH"
$env:JAVA_HOME = "$jdkPath"
$env:ANDROID_HOME = "$sdkPath"

Write-Host "Environment Prepared!"
Write-Host "Node: $(node -v)"
Write-Host "Java: $(java -version 2>&1 | Select-Object -First 1)"
