const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const crypto = require('crypto');
const axios = require('axios');

/**
 * Add a watermark to an image
 * @param {string} imagePath - The path to the image
 * @param {string} watermarkText - The text to use as a watermark
 */
const addWatermark = async (imagePath, watermarkText) => {
    const image = await loadImage(imagePath);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');

    // Draw the original image
    ctx.drawImage(image, 0, 0);

    // Set the watermark style
    ctx.font = '30px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText(watermarkText, 20, 50);

    return canvas.toBuffer();
};

/**
 * Calculate hash of an image
 * @param {string} imagePath - Path to the image file
 * @returns {string} - Hash of the image
 */
const calculateHash = (imagePath) => {
    const fileBuffer = fs.readFileSync(imagePath);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    return hash;
};

/**
 * Download an image from a URL
 * @param {string} url - The URL of the image
 * @param {string} outputPath - The path to save the image
 */
const downloadImage = async (url, outputPath) => {
    const response = await axios({ url, responseType: 'stream' });
    const writer = fs.createWriteStream(outputPath);
    
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
};

// Export functions for use in other modules
module.exports = {
    addWatermark,
    calculateHash,
    downloadImage,
};
