const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');

class GeminiAIImage {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  }

  /**
   * Convert image file to base64 format for Gemini API
   */
  async fileToGenerativePart(imagePath, mimeType) {
    try {
      const imageBuffer = await fs.readFile(imagePath);
      return {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType
        }
      };
    } catch (error) {
      console.error('Error converting file to generative part:', error);
      throw error;
    }
  }

  /**
   * Get MIME type from file extension
   */
  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };
    return mimeTypes[ext] || 'image/jpeg';
  }

  /**
   * Merge captured photo with additional image using AI
   * @param {string} capturedPhotoPath - Path to captured photo
   * @param {string} additionalImagePath - Path to additional image (idol/waifu)
   * @param {Object} options - Merge options
   * @returns {Promise<string>} - Base64 encoded merged image
   */
  async mergePhotos(capturedPhotoPath, additionalImagePath, options = {}) {
    try {
      console.log('🤖 Starting AI photo merge process...');
      console.log(`   Captured photo: ${capturedPhotoPath}`);
      console.log(`   Additional image: ${additionalImagePath}`);

      const capturedPart = await this.fileToGenerativePart(
        capturedPhotoPath, 
        this.getMimeType(capturedPhotoPath)
      );
      
      const additionalPart = await this.fileToGenerativePart(
        additionalImagePath, 
        this.getMimeType(additionalImagePath)
      );

      const prompt = this.createMergePrompt(options);

      console.log('🎨 Sending request to Gemini AI...');

      const result = await this.model.generateContent([
        prompt,
        capturedPart,
        additionalPart
      ]);

      const response = await result.response;
      const generatedText = response.text();

      console.log('✅ Gemini AI response received');




      const mergedImageBase64 = await this.compositeImages(
        capturedPhotoPath, 
        additionalImagePath, 
        generatedText,
        options
      );

      return mergedImageBase64;

    } catch (error) {
      console.error('❌ Error in AI photo merge:', error);
      throw new Error(`AI photo merge failed: ${error.message}`);
    }
  }

  /**
   * Create detailed prompt for photo merging
   */
  createMergePrompt(options = {}) {
    const {
      style = 'natural',
      blendMode = 'creative',
      poseMatching = true,
      lightingAdjustment = true
    } = options;

    return `
You are an expert photo editor and AI artist. I need you to analyze two images and provide detailed instructions for merging them naturally.

TASK: Merge the captured photo (first image) with the additional character image (second image) to create a creative, natural-looking composite.

REQUIREMENTS:
1. **Pose Matching**: The character from the additional image should match or complement the pose of the person in the captured photo
2. **Natural Integration**: The merge should look realistic and natural, not like a simple overlay
3. **Lighting Consistency**: Adjust lighting to match between both images
4. **Style Harmony**: Ensure both images blend well in terms of color, contrast, and overall aesthetic
5. **Creative Positioning**: Position the character creatively - they could be:
   - Standing next to the person
   - In the background naturally
   - Interacting with the scene
   - Mirroring poses or gestures

ANALYSIS NEEDED:
- Describe the pose and positioning of the person in the captured photo
- Describe the character in the additional image
- Suggest the best way to position and blend the character
- Recommend lighting adjustments needed
- Suggest any pose modifications for natural interaction

STYLE: ${style}
BLEND MODE: ${blendMode}
POSE MATCHING: ${poseMatching ? 'Required' : 'Optional'}
LIGHTING ADJUSTMENT: ${lightingAdjustment ? 'Required' : 'Optional'}

Please provide detailed step-by-step instructions for creating this merge, including specific positioning, scaling, rotation, and blending techniques.
    `.trim();
  }

  /**
   * Composite images based on AI instructions
   * This is a simplified version - you might want to use more advanced image processing
   */
  async compositeImages(capturedPhotoPath, additionalImagePath, aiInstructions, _options = {}) {
    try {
      console.log('🖼️ Creating image composite based on AI instructions...');

      const capturedImage = sharp(capturedPhotoPath);
      const additionalImage = sharp(additionalImagePath);

      const capturedMeta = await capturedImage.metadata();
      const additionalMeta = await additionalImage.metadata();

      console.log(`   Captured image: ${capturedMeta.width}x${capturedMeta.height}`);
      console.log(`   Additional image: ${additionalMeta.width}x${additionalMeta.height}`);

      const maxSize = Math.min(capturedMeta.width, capturedMeta.height) * 0.6;
      const resizedAdditional = additionalImage.resize({
        width: Math.round(maxSize),
        height: Math.round(maxSize),
        fit: 'inside',
        withoutEnlargement: true
      });

      const left = Math.round(capturedMeta.width * 0.1);
      const top = Math.round(capturedMeta.height * 0.1);

      const composite = await capturedImage
        .composite([{
          input: await resizedAdditional.png().toBuffer(),
          left,
          top,
          blend: 'over'         }])
        .jpeg({ quality: 85 })
        .toBuffer();

      const base64Image = composite.toString('base64');
      
      console.log('✅ Image composite created successfully');
      return base64Image;

    } catch (error) {
      console.error('❌ Error creating image composite:', error);
      throw error;
    }
  }

  /**
   * Enhanced merge with multiple poses and creative positioning
   */
  async createCreativeMerge(capturedPhotoPath, additionalImagePath, creativityLevel = 'medium') {
    const options = {
      style: creativityLevel === 'high' ? 'artistic' : 'natural',
      blendMode: creativityLevel === 'high' ? 'creative' : 'realistic',
      poseMatching: true,
      lightingAdjustment: true,
      creativityLevel
    };

    return await this.mergePhotos(capturedPhotoPath, additionalImagePath, options);
  }

  /**
   * Batch process multiple photos with the same additional image
   */
  async batchMergePhotos(capturedPhotoPaths, additionalImagePath, options = {}) {
    try {
      console.log(`🔄 Starting batch merge for ${capturedPhotoPaths.length} photos...`);
      
      const results = [];
      
      for (let i = 0; i < capturedPhotoPaths.length; i++) {
        const photoPath = capturedPhotoPaths[i];
        console.log(`   Processing photo ${i + 1}/${capturedPhotoPaths.length}: ${path.basename(photoPath)}`);
        
        try {
          const mergedImage = await this.mergePhotos(photoPath, additionalImagePath, {
            ...options,
            batchIndex: i,
            totalBatch: capturedPhotoPaths.length
          });
          
          results.push({
            index: i,
            originalPath: photoPath,
            mergedImage,
            success: true
          });
          
        } catch (error) {
          console.error(`   Failed to process photo ${i + 1}:`, error.message);
          results.push({
            index: i,
            originalPath: photoPath,
            error: error.message,
            success: false
          });
        }
      }

      console.log(`✅ Batch merge completed: ${results.filter(r => r.success).length}/${results.length} successful`);
      return results;

    } catch (error) {
      console.error('❌ Batch merge error:', error);
      throw error;
    }
  }

  /**
   * Validate image for AI processing
   */
  async validateImage(imagePath) {
    try {
      const stats = await fs.stat(imagePath);
      const image = sharp(imagePath);
      const metadata = await image.metadata();

      const validation = {
        exists: true,
        size: stats.size,
        sizeValid: stats.size <= 20 * 1024 * 1024,         width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        formatValid: ['jpeg', 'png', 'webp', 'gif'].includes(metadata.format),
        valid: true
      };

      validation.valid = validation.sizeValid && validation.formatValid;

      return validation;

    } catch (error) {
      return {
        exists: false,
        valid: false,
        error: error.message
      };
    }
  }
}

module.exports = new GeminiAIImage();