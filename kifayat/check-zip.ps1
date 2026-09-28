Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead('Kifayat-project-v2.zip')
$backendCount = $zip.Entries | Where-Object { $_.FullName -like 'kifayat-backend/*' } | Measure-Object | Select-Object -ExpandProperty Count
$frontendCount = $zip.Entries | Where-Object { $_.FullName -like 'kifayat-frontend/*' } | Measure-Object | Select-Object -ExpandProperty Count
$totalCount = $zip.Entries.Count
Write-Host "Total files in zip: $totalCount"
Write-Host "Backend files: $backendCount"
Write-Host "Frontend files: $frontendCount"
$zip.Dispose()