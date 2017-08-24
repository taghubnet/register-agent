#!/bin/sh
VERSION=$(cat package.json | jq -r .version)
docker build -t registry.taghub:5000/register-agent:$VERSION .
