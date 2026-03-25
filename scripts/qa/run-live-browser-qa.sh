#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNNER_LINUX_PATH="$ROOT_DIR/scripts/qa/live-browser-qa-runner.cjs"
RUNNER_WINDOWS_SOURCE="$(wslpath -w "$RUNNER_LINUX_PATH")"
RUNNER_WINDOWS_TARGET='C:\Temp\mise-live-qa\runner.cjs'
QA_FRIDGE_LINUX_PATH="$ROOT_DIR/public/qa-fridge.svg"
QA_FRIDGE_WINDOWS_SOURCE="$(wslpath -w "$QA_FRIDGE_LINUX_PATH")"
QA_FRIDGE_WINDOWS_TARGET='C:\Temp\mise-live-qa\qa-fridge.svg'

export MISE_QA_OUTPUT_WINDOWS='C:\Temp\mise-live-qa'
export MISE_QA_EDGE_PORT='9223'

POWERSHELL=${POWERSHELL:-powershell.exe}
NODE_WINDOWS='C:\Program Files\nodejs\node.exe'

"$POWERSHELL" -NoProfile -Command "
  if (-not (Test-Path '$MISE_QA_OUTPUT_WINDOWS')) {
    New-Item -ItemType Directory -Path '$MISE_QA_OUTPUT_WINDOWS' | Out-Null
  }

  Copy-Item '$RUNNER_WINDOWS_SOURCE' '$RUNNER_WINDOWS_TARGET' -Force
  Copy-Item '$QA_FRIDGE_WINDOWS_SOURCE' '$QA_FRIDGE_WINDOWS_TARGET' -Force

  try {
    Invoke-WebRequest -UseBasicParsing http://127.0.0.1:$MISE_QA_EDGE_PORT/json/version -TimeoutSec 2 | Out-Null
  } catch {
    Start-Process -FilePath 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' -ArgumentList '--headless=new --disable-gpu --remote-debugging-port=$MISE_QA_EDGE_PORT --user-data-dir=C:\Temp\mise-codex-edge about:blank'
    Start-Sleep -Seconds 2
  }

  \$env:MISE_CDP_HTTP = 'http://127.0.0.1:$MISE_QA_EDGE_PORT'
  \$env:MISE_QA_OUTPUT = '$MISE_QA_OUTPUT_WINDOWS'
  \$env:MISE_QA_FRIDGE_FILE = '$QA_FRIDGE_WINDOWS_TARGET'
  & '$NODE_WINDOWS' '$RUNNER_WINDOWS_TARGET'
"
