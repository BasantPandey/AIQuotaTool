#!/bin/bash
set -euo pipefail

ISSUE_TITLE="${ISSUE_TITLE:-}"
ISSUE_BODY="${ISSUE_BODY:-}"
OPENCODE_MODEL="${OPENCODE_MODEL:-}"

if [ -z "$ISSUE_BODY" ]; then
    echo "ERROR: ISSUE_BODY environment variable is required"
    exit 1
fi

PROMPT_FILE=$(mktemp)
trap 'rm -f "$PROMPT_FILE"' EXIT

cat /home/opencode/agent-prompt.txt > "$PROMPT_FILE"

echo "" >> "$PROMPT_FILE"
if [ -n "$ISSUE_TITLE" ]; then
    echo "## Issue title: $ISSUE_TITLE" >> "$PROMPT_FILE"
    echo "" >> "$PROMPT_FILE"
fi
echo "## Issue body:" >> "$PROMPT_FILE"
echo "$ISSUE_BODY" >> "$PROMPT_FILE"
echo "" >> "$PROMPT_FILE"
echo "## Instructions" >> "$PROMPT_FILE"
echo "Complete the task described above. After implementing changes, run pnpm turbo type-check and pnpm turbo test to verify your work." >> "$PROMPT_FILE"

MODEL_ARG=()
if [ -n "$OPENCODE_MODEL" ]; then
    MODEL_ARG=("--model" "$OPENCODE_MODEL")
fi

echo "=== Running opencode with model: ${OPENCODE_MODEL:-deepseek/deepseek-chat} ==="
echo ""

opencode run "Complete the task described in the attached file." \
    --auto \
    --format json \
    "${MODEL_ARG[@]}" \
    --file "$PROMPT_FILE"

EXIT_CODE=$?

echo ""
echo "=== opencode exited with code $EXIT_CODE ==="
exit $EXIT_CODE
