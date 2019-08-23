#!/usr/bin/env bash
COREFILES="src/core/**/,src/react/**,src/index.ts"

WATCH='false'
while getopts ':w' option; do
  case "${option}" in
    'w') WATCH='true';;
    *) WATCH='false';;
  esac
done

rm -rf lib

if $WATCH; then
  # Build Node Watch mode
  BABEL_ENV=node yarn babel src --out-dir lib --extensions '.ts' --ignore "**/__tests__/**" --source-maps --watch
else
  # Build Core
  NODE_ENV=esm yarn babel src --out-dir lib --extensions '.ts' --only "$COREFILES" --source-maps
  # Modify file name
  find ./lib -name "*.js" -exec bash -c 'mv "$1" "${1/.js/.mjs}"' -- {} \;
  find ./lib -name "*.js.map" -exec bash -c 'mv "$1" "${1/.js.map/.mjs.map}"' -- {} \;
  # Build Core commonjs
  yarn babel src --out-dir lib --extensions '.ts' --only "$COREFILES" --source-maps
  # Build Node
  BABEL_ENV=node yarn babel src --out-dir lib --extensions '.ts' --ignore "**/__tests__/**,$COREFILES" --source-maps
fi


