#!/bin/bash

# Script para fazer build e testar localmente antes de fazer push

echo "🔨 Building for GitHub Pages..."
DEPLOY_TARGET=ghpages pnpm build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo ""
    echo "Output directory: ./out"
    echo "Files ready for GitHub Pages"
    echo ""
    echo "Next steps:"
    echo "1. Commit changes: git add . && git commit -m 'Add GH Pages deployment'"
    echo "2. Push: git push origin main"
    echo "3. GitHub Actions will automatically deploy"
    echo ""
    echo "Access your site at: https://avilaops.github.io/middas-studio"
else
    echo "❌ Build failed!"
    exit 1
fi
