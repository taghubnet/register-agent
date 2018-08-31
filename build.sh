#!/bin/sh
VERSION=$(cat package.json | jq -r .version)
npm run build
docker build -t registry.taghub.net:5000/register-agent:$VERSION .
