#!/usr/bin/env bash
set -euo pipefail

cd frontend
npm install
VITE_API_URL=/api npm run build

mkdir -p ../backend/public
cp -r dist/* ../backend/public/

cd ../backend
npm install
