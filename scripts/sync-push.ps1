param(
    [string]$VaultPath = "D:\Obsidian\王者之剑",
    [string]$CommitMessage = "自动同步：$(Get-Date -Format 'yyyy-MM-dd HH:mm')"
)

Set-Location $VaultPath

# Check for changes
$status = git status --porcelain 2>&1
if (-not $status) {
    Write-Output "[$(Get-Date -Format 'HH:mm:ss')] 没有变更需要同步"
    exit 0
}

# Stage, commit, push
git add -A
git commit -m $CommitMessage
$pushResult = git push origin main 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Output "[$(Get-Date -Format 'HH:mm:ss')] 同步完成"
} else {
    Write-Output "[$(Get-Date -Format 'HH:mm:ss')] 推送失败: $pushResult"
}
