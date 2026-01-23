#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const CONFIG_PATH = path.join(__dirname, '..', 'config', 'image-processing.json');
const IMAGES_DIR = path.join(__dirname, '..', 'public', 'images');

/**
 * Generate a radial gradient SVG mask for the glow effect
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} glowRadius - Glow radius (0.0-1.0)
 * @param {number} glowIntensity - Glow intensity (0.0-1.0)
 * @returns {Buffer} SVG buffer
 */
function createRadialGradientMask(width, height, glowRadius, glowIntensity) {
  const gradientSvg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="grad" cx="50%" cy="50%" r="70%">
          <stop offset="${glowRadius * 100}%" stop-color="white" stop-opacity="1"/>
          <stop offset="100%" stop-color="white" stop-opacity="${1 - glowIntensity}"/>
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#grad)"/>
    </svg>
  `;
  return Buffer.from(gradientSvg);
}

/**
 * Apply white glow effect to an image
 * @param {string} inputPath - Path to input image
 * @param {string} outputPath - Path to output image
 * @param {object} config - Configuration object
 */
async function addWhiteGlow(inputPath, outputPath, config) {
  try {
    // Load the original image and get metadata
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    const { width, height } = metadata;

    console.log(`  Image size: ${width}x${height}`);

    // Extract configuration with defaults
    const glowIntensity = config.glowIntensity || 0.75;
    const glowRadius = config.glowRadius || 0.82;
    const blurSigma = config.blurSigma || 85;
    const quality = config.quality || 90;
    const compressionLevel = config.compressionLevel || 9;

    console.log(`  Glow parameters: intensity=${glowIntensity}, radius=${glowRadius}, blur=${blurSigma}`);

    // Step 1: Create white canvas
    const whiteCanvas = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    }).png().toBuffer();

    // Step 2: Create radial gradient mask
    const gradientMask = createRadialGradientMask(width, height, glowRadius, glowIntensity);

    // Step 3: Apply Gaussian blur to the mask for soft transition
    const blurredMask = await sharp(gradientMask)
      .blur(blurSigma)
      .toBuffer();

    // Step 4: Composite original image over white canvas
    // First composite the white canvas with the original
    const compositeResult = await sharp(whiteCanvas)
      .composite([
        {
          input: inputPath,
          blend: 'over'
        }
      ])
      .toBuffer();

    // Step 5: Apply the blurred mask to create the glow vignette effect
    const finalImage = await sharp(compositeResult)
      .composite([
        {
          input: blurredMask,
          blend: 'dest-in'
        }
      ])
      .png({ quality, compressionLevel })
      .toFile(outputPath);

    console.log(`  Saved: ${outputPath} (${(finalImage.size / 1024).toFixed(2)} KB)`);
    return true;
  } catch (error) {
    console.error(`  Error processing image: ${error.message}`);
    return false;
  }
}

/**
 * Process a single image
 * @param {object} imageConfig - Image configuration
 * @param {object} defaults - Default configuration
 * @returns {Promise<boolean>} Success status
 */
async function processImage(imageConfig, defaults) {
  const { name, source, output } = imageConfig;
  const sourcePath = path.join(IMAGES_DIR, source);
  const outputPath = path.join(IMAGES_DIR, output);

  console.log(`Processing ${name}...`);

  // Check if source exists
  if (!fs.existsSync(sourcePath)) {
    console.error(`  Error: Source file not found: ${sourcePath}`);
    return false;
  }

  // Merge config with defaults
  const config = { ...defaults, ...imageConfig };

  // Process the image
  return await addWhiteGlow(sourcePath, outputPath, config);
}

/**
 * Main function
 */
async function main() {
  console.log('Image Processing Script - White Glow Effect\n');

  // Load configuration
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`Configuration file not found: ${CONFIG_PATH}`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  const { defaults, images } = config;

  // Get image name from CLI args (if any)
  const targetImageName = process.argv[2];

  // Filter images to process
  let imagesToProcess = images;
  if (targetImageName) {
    imagesToProcess = images.filter(img => img.name === targetImageName);
    if (imagesToProcess.length === 0) {
      console.error(`No image found with name: ${targetImageName}`);
      console.log(`Available images: ${images.map(img => img.name).join(', ')}`);
      process.exit(1);
    }
  }

  // Process images
  let successCount = 0;
  let failCount = 0;

  for (const imageConfig of imagesToProcess) {
    const success = await processImage(imageConfig, defaults);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    console.log('');
  }

  // Summary
  console.log(`Processing complete: ${successCount} succeeded, ${failCount} failed`);

  if (failCount > 0) {
    process.exit(1);
  }
}

// Run main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
