#!/bin/sh
npm version minor
git push --tags

VERSION=$(cat package.json | jq -r .version)
npm run build
docker build -t taghub/register-agent:$VERSION .
