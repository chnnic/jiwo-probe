#!/usr/bin/env bash
# mmwx-probe 部署脚本(CF Workers)
# 用法: ./scripts/deploy.sh
# ProbeHub Durable Object 由 wrangler.jsonc 自动创建/绑定;
# 运行时变量 MMWX_ORIGIN / PROBE_TOKEN 在 CF 控制台配置。
# 三组延迟默认配置已内置在 src/ping-groups.ts 顶部的 PING_GROUP_SCRIPT_VARS，
# 安装无需填写 PROBE_PING_*；不通过 --var 重置站长在后台自定义的组数和目标。
set -euo pipefail
cd "$(dirname "$0")/.."

npm run build
npx wrangler deploy
