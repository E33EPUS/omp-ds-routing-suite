# install.ps1 — omp-ds-router-suite 一键安装
# 用法：powershell -ExecutionPolicy Bypass -File install.ps1
# 干三件事：装扩展 / 禁用冲突的 SeekAnchor / 提示重启

$ErrorActionPreference = 'Stop'

$agentRoot = if ($env:PI_CODING_AGENT_DIR) { $env:PI_CODING_AGENT_DIR } else { Join-Path $env:USERPROFILE '.omp\agent' }
$extRoot = Join-Path $agentRoot 'extensions'
$target = Join-Path $extRoot 'omp-ds-router-suite'
$source = Join-Path $PSScriptRoot '.'

Write-Host "== omp-ds-router-suite installer ==" -ForegroundColor Cyan
Write-Host "agent root: $agentRoot"
Write-Host "target:     $target"

# 1. 装扩展
if (Test-Path $target) {
    Write-Host "WARN: $target 已存在，跳过拷贝（如需覆盖请先删除该目录）" -ForegroundColor Yellow
} else {
    New-Item -ItemType Directory -Force -Path $target | Out-Null
    foreach ($file in @('index.ts', 'core.ts', 'state.ts', 'commands.ts', 'tools.ts')) {
        Copy-Item -Path (Join-Path $source $file) -Destination $target -Force
        Write-Host "  copied $file"
    }
    Write-Host "扩展已安装" -ForegroundColor Green
}

# 2. 禁用 SeekAnchor（deepseek-rl-anchor）—— 与新扩展冲突
$seekDir = Join-Path $extRoot 'deepseek-rl-anchor'
if (Test-Path $seekDir) {
    $backup = Join-Path $agentRoot 'extensions-disabled'
    New-Item -ItemType Directory -Force -Path $backup | Out-Null
    Move-Item -Path $seekDir -Destination (Join-Path $backup 'deepseek-rl-anchor') -Force
    Write-Host "SeekAnchor 已禁用（移到 $backup，可移回恢复）" -ForegroundColor Green
} else {
    Write-Host "SeekAnchor 未安装，跳过" -ForegroundColor DarkGray
}

# 3. 提示重启
Write-Host "`n完成。请完全退出 OMP（不是 /reload）再重新打开，扩展即自动生效。" -ForegroundColor Cyan
Write-Host "无需任何配置。默认弱路由模式：模型自己分类任务（build/fix），自动首轮锚定 + 近场引导。" -ForegroundColor DarkGray
