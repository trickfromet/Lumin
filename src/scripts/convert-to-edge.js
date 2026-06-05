const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      callback(dirPath);
    }
  });
}

const appDir = path.join(__dirname, '../app');

// 1. Update layout.tsx
const layoutPath = path.join(appDir, 'layout.tsx');
if (fs.existsSync(layoutPath)) {
  let content = fs.readFileSync(layoutPath, 'utf8');
  if (!content.includes('export const runtime')) {
    content = 'export const runtime = "edge";\n' + content;
    fs.writeFileSync(layoutPath, content, 'utf8');
    console.log('Updated layout.tsx to use Edge runtime');
  } else {
    console.log('layout.tsx already configured for Edge runtime');
  }
}

// 2. Update all route.ts files
walkDir(appDir, (filePath) => {
  if (path.basename(filePath) === 'route.ts') {
    let content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes('export const runtime')) {
      content = 'export const runtime = "edge";\n' + content;
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated API Route: ${path.relative(appDir, filePath)}`);
    } else {
      console.log(`API Route already configured: ${path.relative(appDir, filePath)}`);
    }
  }
});

console.log('Successfully completed Edge runtime conversion!');
