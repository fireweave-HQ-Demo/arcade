#!/usr/bin/env bash
# Inject rollout-ready context when this repo is initialised.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
proj="$root/.fireweave/project.json"
inst="$root/.fireweave/agent-instructions.md"
if [[ ! -f "$proj" ]]; then exit 0; fi
bound="$(node -e "
const fs = require('node:fs');
const j = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
process.stdout.write(j.projectId || j.projects ? 'yes' : 'no');
" "$proj")" || exit 1
[[ "$bound" == "yes" ]] || exit 0
summary="FireWeave rollout-ready repo: follow .fireweave/agent-instructions.md on every feature change (anchor + manifest + stamp before /fw-rollout)."
if [[ -f "$inst" ]]; then
  summary="$summary See agent-instructions for harness paths and dev checklist."
fi
printf '%s\n' "{\"additional_context\":$(node -e "console.log(JSON.stringify(process.argv[1]))" "$summary")}"
