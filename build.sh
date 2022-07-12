#!/bin/sh

VERSION=$(cat package.json | jq -r .version)
npm run build
docker build -t taghub/register-agent:$VERSION .
docker push taghub/register-agent:$VERSION