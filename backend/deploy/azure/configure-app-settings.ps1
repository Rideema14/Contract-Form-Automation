[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ResourceGroup,
    [Parameter(Mandatory = $true)][string]$WebAppName,
    [Parameter(Mandatory = $true)][string]$KeyVaultName,
    [Parameter(Mandatory = $true)][string]$FrontendOrigin,
    [Parameter(Mandatory = $true)][string]$AllowedExtensions,
    [Parameter(Mandatory = $true)][long]$MaxFileSizeBytes,
    [Parameter(Mandatory = $true)][int]$MaxFileCount,
    [Parameter(Mandatory = $true)][string]$DatabaseUrlSecretUri,
    [Parameter(Mandatory = $true)][string]$JwtSecretUri,
    [string]$ApplicationInsightsConnectionString = ""
)

$ErrorActionPreference = "Stop"
if ($MaxFileSizeBytes -lt 1) { throw "MaxFileSizeBytes must be greater than zero." }
if ($MaxFileCount -lt 1) { throw "MaxFileCount must be greater than zero." }

# Verify Azure CLI session and target resources before changing app settings.
az account show --only-show-errors | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Run 'az login' and select the correct subscription first." }

$webApp = az webapp show --resource-group $ResourceGroup --name $WebAppName --only-show-errors | ConvertFrom-Json
if (-not $webApp) { throw "Web App '$WebAppName' was not found in '$ResourceGroup'." }
$keyVault = az keyvault show --name $KeyVaultName --resource-group $ResourceGroup --only-show-errors | ConvertFrom-Json
if (-not $keyVault) { throw "Key Vault '$KeyVaultName' was not found in '$ResourceGroup'." }

# Enable managed identity. Grant this identity 'Key Vault Secrets User' on the vault
# (RBAC) or equivalent Get-secret access (access-policy model) before relying on references.
az webapp config set --resource-group $ResourceGroup --name $WebAppName --linux-fx-version "NODE|22-lts" --startup-file "npm start" --only-show-errors | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Failed to set the Node.js runtime and startup command." }
$identity = az webapp identity assign --resource-group $ResourceGroup --name $WebAppName --only-show-errors | ConvertFrom-Json
Write-Host "Managed identity principal ID: $($identity.principalId)"
Write-Warning "Grant the managed identity Key Vault Secrets User on '$KeyVaultName' before restarting the app."

$settings = @(
    "NODE_ENV=production",
    "FRONTEND_ORIGIN=$FrontendOrigin",
    "DATABASE_URL=@Microsoft.KeyVault(SecretUri=$DatabaseUrlSecretUri)",
    "JWT_SECRET=@Microsoft.KeyVault(SecretUri=$JwtSecretUri)",
    "DOCUMENT_ALLOWED_EXTENSIONS=$AllowedExtensions",
    "DOCUMENT_MAX_FILE_SIZE_BYTES=$MaxFileSizeBytes",
    "DOCUMENT_MAX_FILE_COUNT=$MaxFileCount"
)
if ($ApplicationInsightsConnectionString) {
    $settings += "APPLICATIONINSIGHTS_CONNECTION_STRING=$ApplicationInsightsConnectionString"
}

az webapp config appsettings set `
    --resource-group $ResourceGroup `
    --name $WebAppName `
    --settings $settings `
    --only-show-errors | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Failed to configure App Service settings." }

Write-Host "Backend App Service settings configured. Restart only after Key Vault access is granted and the app package is deployed."
