[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ResourceGroup,
    [Parameter(Mandatory = $true)][string]$WebAppName,
    [Parameter(Mandatory = $true)][ValidatePattern('^https://[^/]+/api$')][string]$ApiBaseUrl
)

$ErrorActionPreference = "Stop"
az account show --only-show-errors | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Run 'az login' and select the correct subscription first." }

$webApp = az webapp show --resource-group $ResourceGroup --name $WebAppName --only-show-errors | ConvertFrom-Json
if (-not $webApp) { throw "Web App '$WebAppName' was not found in '$ResourceGroup'." }

az webapp config set `
    --resource-group $ResourceGroup `
    --name $WebAppName `
    --linux-fx-version "NODE|22-lts" `
    --startup-file "npm start" `
    --only-show-errors | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Failed to select the Node.js 22 runtime." }

# NEXT_PUBLIC_API_BASE_URL is embedded into the browser bundle by Next.js.
# Set it before the source deployment/build, not only after the build completes.
az webapp config appsettings set `
    --resource-group $ResourceGroup `
    --name $WebAppName `
    --settings "NODE_ENV=production" "NEXT_PUBLIC_API_BASE_URL=$ApiBaseUrl" "SCM_DO_BUILD_DURING_DEPLOYMENT=true" `
    --only-show-errors | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Failed to configure frontend App Service settings." }

Write-Host "Frontend App Service settings configured. Deploy/build the Next.js source after this step."
