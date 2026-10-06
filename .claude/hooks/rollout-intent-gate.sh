#!/usr/bin/env bash
set -uo pipefail
root="$(cd "$(dirname "$0")/../.." 2>/dev/null && pwd)" || exit 0
proj="$root/.fireweave/project.json"
[[ -f "$proj" ]] || exit 0
bound="$(node -e "try{const j=JSON.parse(require('node:fs').readFileSync(process.argv[1],'utf8'));process.stdout.write(j.projectId||j.projects?'yes':'no')}catch{process.stdout.write('no')}" "$proj" 2>/dev/null)" || exit 0
[[ "$bound" == "yes" ]] || exit 0
# UserPromptSubmit: JSON on stdin. SessionStart: empty → always remind.
prompt=""
if [[ ! -t 0 ]]; then
  stdin="$(cat 2>/dev/null || true)"
  if [[ -n "$stdin" ]]; then
    prompt="$(node -e "try{const j=JSON.parse(process.argv[1]);const p=j.prompt??j.user_prompt??j.userPrompt??j.message??'';process.stdout.write(typeof p==='string'?p:JSON.stringify(p))}catch{}" "$stdin" 2>/dev/null || true)"
  fi
fi
[[ -z "$prompt" ]] && prompt="${1:-${CLAUDE_USER_PROMPT:-}}"
msg="FireWeave rollout-ready repo (promote-not-wrap). FIRST classify this task in one line — change | inquiry | brainstorm | infra-only — because this reminder fired on a KEYWORD match and the keyword cannot tell 'fix the checkout bug' from 'how do I fix this typo'. Only 'change' runs the package; when genuinely unclear treat it as change (skipping wrongly ships unflagged behaviour, running wrongly costs a few tool calls). For a change task the rollout-ready package comes FIRST — author the manifest via upsert_rollout_manifest (FireWeave stores it; do not write a manifest file yourself) + mint chg_/stmp_ + append each stamp to its own surface's FW_STAMPS (one shared stamp only when single-project + every surface's harness is surface-aware), add // @fireweave-controlpoint <key> as you code, then assert_dev_checklist + reconcile(build) before done. No backfill. Absence has names: only never-authored means author one; not-fetched=fw sync, not-authorized=withheld not absent, queued=drain .fireweave/.queue. Ship via /fireweave:safe-rollout. See .fireweave/agent-instructions.md."
if [[ -n "$prompt" ]] && ! echo "$prompt" | grep -qiE '\b(add|implement|feature|feat|fix|ship|build|wrap|change|refactor|rollout|flag)\b'; then exit 0; fi
node -e "console.log(JSON.stringify({hookSpecificOutput:{hookEventName:process.argv[2]||'UserPromptSubmit',additionalContext:process.argv[1]}}))" "$msg" "${HOOK_EVENT:-}" 2>/dev/null || printf '%s\n' "$msg"
exit 0
