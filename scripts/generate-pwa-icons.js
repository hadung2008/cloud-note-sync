#!/usr/bin/env node

/**
 * PWA Icon Generator
 * This script creates PNG icons from favicon.svg for PWA
 * Requires: npm install -g sharp
 * 
 * Usage: node scripts/generate-pwa-icons.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const INPUT_SVG = path.join(__dirname, '../public/favicon.svg');
const OUTPUT_DIR = path.join(__dirname, '../public');

const ICON_SIZES = [
  { size: 192, name: 'icon-192.png', maskable: false },
  { size: 512, name: 'icon-512.png', maskable: false },
  { size: 192, name: 'icon-192-maskable.png', maskable: true },
  { size: 512, name: 'icon-512-maskable.png', maskable: true }
];

async function generateIcons() {
  try {
    console.log('🎨 Generating PWA icons from favicon.svg...');
    
    for (const icon of ICON_SIZES) {
      const outputPath = path.join(OUTPUT_DIR, icon.name);
      
      await sharp(INPUT_SVG)
        .resize(icon.size, icon.size, {
          fit: 'contain',
          background: { r: 248, g: 245, b: 230, alpha: 1 } // #F8F5E6 light background
        })
        .png()
        .toFile(outputPath);
      
      console.log(`✅ Created ${icon.name} (${icon.size}x${icon.size})`);
    }
    
    console.log('\n✨ PWA icons generated successfully!');
    console.log('📱 Icons are ready for:');
    console.log('   - Installation on home screen');
    console.log('   - App shelf/taskbar (maskable icons)');
    console.log('   - App drawer and notifications');
  } catch (error) {
    console.error('❌ Error generating icons:', error.message);
    console.error('\n💡 To fix this:');
    console.error('   1. Install sharp: npm install sharp');
    console.error('   2. Run: node scripts/generate-pwa-icons.js');
    process.exit(1);
  }
}

generateIcons();
