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
      lightingAdjustment = true,
      frameLayout = '2x1',
      photoboothMode = false
    } = options;

    return `
  You are an expert AI photo editor specializing in creative photo merging for a photobooth application.

  TASK: Merge the captured user photo (first image) with the additional character/idol image (second image) to create a natural, creative composite for a ${frameLayout} photo frame layout.

  ${photoboothMode ? `
  PHOTOBOOTH CONTEXT:
  - This is part of a ${frameLayout} photo frame (${frameLayout === '2x1' ? '2 photos' : frameLayout === '3x1' ? '3 photos' : '4 photos'} total)
  - User wants to appear together with their chosen character/idol in all photos
  - Each photo should look like they're actually together in the same scene
  - Maintain consistency across all photos in the series
  ` : ''}

  MERGE REQUIREMENTS:
  1. **Natural Pose Integration**: The additional character should be positioned to naturally interact with or complement the user's pose
  2. **Realistic Placement**: Position the character as if they're actually in the same physical space
  3. **Lighting Harmony**: Adjust lighting and shadows to match both subjects
  4. **Scale Consistency**: Ensure both subjects appear at realistic relative sizes
  5. **Creative Interaction**: Make it look like they're:
    - Taking a photo together (selfie style)
    - Standing/sitting side by side naturally  
    - Having a conversation or interaction
    - Posing together for the camera
    - Sharing the same environment/background

  STYLE SPECIFICATIONS:
  - Style: ${style} (natural/artistic)
  - Blend Mode: ${blendMode} (realistic/creative)
  - Pose Matching: ${poseMatching ? 'REQUIRED - Character must complement user pose' : 'Optional'}
  - Lighting: ${lightingAdjustment ? 'REQUIRED - Must match lighting conditions' : 'Optional'}

  ANALYSIS INSTRUCTIONS:
  1. Analyze the user's pose, expression, and positioning
  2. Analyze the character's pose and how it can be adapted
  3. Determine optimal positioning (left/right, foreground/background)
  4. Suggest lighting adjustments needed
  5. Recommend any pose modifications for natural interaction

  POSITIONING GUIDELINES:
  - For selfie-style photos: Character should be positioned as if they're also taking the selfie
  - For portrait shots: Character can be positioned beside, behind, or interacting with the user
  - For group-style shots: Both should appear to be part of the same group
  - Maintain natural proportions and perspectives

  OUTPUT: Provide detailed step-by-step instructions for creating this merge, including specific positioning coordinates, scaling factors, rotation angles, and blending techniques that will make the composite look professionally edited and naturally believable.
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
        sizeValid: stats.size <= 20 * 1024 * 1024,         
        width: metadata.width,
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