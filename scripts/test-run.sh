#!/bin/bash
set -e

# 使用 xvfb-run 启动 Electron 并截图验证
xvfb-run --auto-servernum --server-args="-screen 0 1024x768x24" bash <<'EOF'
  XAUTH_FILE=$(ls /tmp/xvfb-run.*/Xauthority 2>/dev/null | head -1)
  echo "XAUTH: $XAUTH_FILE"
  echo "DISPLAY: $DISPLAY"

  cd /workspace/cockatiel-pet
  COCKATIEL_SCREENSHOT=1 ./node_modules/.bin/electron . --no-sandbox
EOF
