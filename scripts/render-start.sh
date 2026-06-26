#!/bin/bash
set -e

echo "Running database migrations..."
cd lib/db
node_modules/.bin/drizzle-kit push --config ./drizzle.config.ts
cd ../..

echo "Starting bot..."
node --enable-source-maps ./artifacts/api-server/dist/index.mjs
