#!/usr/bin/env bash
# mmwx-probe 部署脚本(CF Workers)
# 用法: ./scripts/deploy.sh
# ProbeHub Durable Object 由 wrangler.jsonc 自动创建/绑定;
# 运行时变量 MMWX_ORIGIN / PROBE_TOKEN 在 CF 控制台配置。
# 从 src/runtime-defaults.ts 自动补齐缺失的延迟与网速单位设置项，
# 已存在的设置不覆盖，其他变量 / Secret 也保持不变。
set -euo pipefail
cd "$(dirname "$0")/.."

npm run build
node scripts/deploy-worker.mjs

# 可选：设置 PROBE_VERIFY_URL（如 https://tz.mmwx.org）后，等待线上 index.html
# 换成本次构建的 main-*.js，90 秒内不一致则报错；未设置时跳过。
node scripts/verify-deploy.mjs
