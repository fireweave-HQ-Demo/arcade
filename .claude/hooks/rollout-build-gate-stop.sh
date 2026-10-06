#!/usr/bin/env bash
# Claude Code Stop-hook parity for the rollout-ready build gate.
set -uo pipefail
root="$(cd "$(dirname "$0")/../.." 2>/dev/null && pwd)" || exit 0
gate="$root/.fireweave/hooks/rollout-build-gate.sh"

payload="$(cat 2>/dev/null || true)"
case "$payload" in
  *'"stop_hook_active":true'* | *'"stop_hook_active": true'*) exit 0 ;;
esac

[ -f "$gate" ] || exit 0
if [ ! -x "$gate" ]; then
  echo "rollout-build-gate-stop: $gate is not executable — running it via bash. Repair with: chmod +x $gate" >&2
fi

out="$(mktemp 2>/dev/null)" || exit 0
err="$(mktemp 2>/dev/null)" || exit 0
trap 'rm -f "$out" "$err"' EXIT
if bash "$gate" >"$out" 2>"$err"; then exit 0; fi

reason="$(node -e "
const j = JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'));
console.log((j.findings || []).filter((f) => f.severity !== 'info').map((f) => (f.fix ? f.message + ' Fix: ' + f.fix : f.message)).join('; '));
" "$out" 2>/dev/null || true)"
if [ -z "$reason" ]; then
  reason="the gate produced no verdict: $(tr '\n' ' ' <"$err")"
fi
msg="FireWeave rollout-ready build gate FAILED: ${reason} Complete the rollout-ready package per .fireweave/agent-instructions.md — author the manifest via upsert_rollout_manifest, add // @fireweave-controlpoint at each evaluation site, append the stamp to its surface's FW_STAMPS — then re-run the gate. If a finding says \`fw sync\`, this worktree has no server projection and absence is NOT evidence: fetch it rather than authoring over a contract you cannot see."
node -e "console.log(JSON.stringify({ decision: 'block', reason: process.argv[1] }))" "$msg" 2>/dev/null \
  || printf '%s\n' "$msg"
exit 0
