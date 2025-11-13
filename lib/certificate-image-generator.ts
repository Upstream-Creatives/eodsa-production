import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

export interface CertificatePositions {
  nameTop: number;
  nameLeft: number;
  nameFontSize: number;
  percentageTop: number;
  percentageLeft: number;
  percentageFontSize: number;
  styleTop: number;
  styleLeft: number;
  styleFontSize: number;
  titleTop: number;
  titleLeft: number;
  titleFontSize: number;
  medallionTop: number;
  medallionLeft: number;
  medallionFontSize: number;
  dateTop: number;
  dateLeft: number;
  dateFontSize: number;
}

export interface CertificateImageData {
  dancerName: string;
  percentage: number;
  style: string;
  title: string;
  medallion: 'Elite' | 'Opus' | 'Legend' | 'Gold' | 'Silver+' | 'Silver' | 'Bronze' | '';
  date: string;
  positions?: CertificatePositions;
}

/**
 * Generate a certificate image with text overlaid using SVG
 */
export async function generateCertificateImage(data: CertificateImageData): Promise<Buffer> {
  try {
    // Read the template image
    const templatePath = path.join(process.cwd(), 'public', 'Template.jpg');

    if (!fs.existsSync(templatePath)) {
      throw new Error('Certificate template not found');
    }

    // Get image dimensions
    const metadata = await sharp(templatePath).metadata();
    const width = metadata.width || 904;
    const height = metadata.height || 1280;

    // Use custom positions if provided, otherwise use defaults
    // Standardized font sizes (26px) for style, title, and medallion to ensure text always fits
    const pos = data.positions || {
      nameTop: 48.5,
      nameLeft: 50,
      nameFontSize: 65,
      percentageTop: 65.5,
      percentageLeft: 15.5,
      percentageFontSize: 76,
      styleTop: 67.5,
      styleLeft: 62.5,
      styleFontSize: 26, // Standardized to 26px
      titleTop: 74,
      titleLeft: 60,
      titleFontSize: 26, // Standardized to 26px
      medallionTop: 80.5,
      medallionLeft: 65.5,
      medallionFontSize: 26, // Standardized to 26px
      dateTop: 90.5,
      dateLeft: 52,
      dateFontSize: 39,
    };

    // Helper function to create text SVG
    const createTextSVG = (text: string, x: number, y: number, fontSize: number, bold: boolean = true, centered: boolean = false) => {
      return `<svg width="${width}" height="${height}">
        <text 
          x="${x}" 
          y="${y}"
          font-family="Arial, Helvetica, sans-serif"
          font-size="${fontSize}"
          font-weight="${bold ? 'bold' : 'normal'}"
          fill="white"
          ${centered ? 'text-anchor="middle"' : ''}
        >${text}</text>
      </svg>`;
    };

    // Start with the base template
    let sharpInstance = sharp(templatePath);

    // Add each text element as a separate composite layer
    const composites = [];

    // Dancer Name (centered)
    composites.push({
      input: Buffer.from(createTextSVG(
        data.dancerName,
        width * (pos.nameLeft / 100),
        height * (pos.nameTop / 100),
        pos.nameFontSize,
        true,
        true
      )),
      top: 0,
      left: 0
    });

    // Percentage
    composites.push({
      input: Buffer.from(createTextSVG(
        data.percentage.toString(),
        width * (pos.percentageLeft / 100),
        height * (pos.percentageTop / 100),
        pos.percentageFontSize,
        true,
        false
      )),
      top: 0,
      left: 0
    });

    // Style
    composites.push({
      input: Buffer.from(createTextSVG(
        data.style.toUpperCase(),
        width * (pos.styleLeft / 100),
        height * (pos.styleTop / 100),
        pos.styleFontSize,
        true,
        false
      )),
      top: 0,
      left: 0
    });

    // Title
    composites.push({
      input: Buffer.from(createTextSVG(
        data.title.toUpperCase(),
        width * (pos.titleLeft / 100),
        height * (pos.titleTop / 100),
        pos.titleFontSize,
        true,
        false
      )),
      top: 0,
      left: 0
    });

    // Medallion
    composites.push({
      input: Buffer.from(createTextSVG(
        data.medallion.toUpperCase(),
        width * (pos.medallionLeft / 100),
        height * (pos.medallionTop / 100),
        pos.medallionFontSize,
        true,
        false
      )),
      top: 0,
      left: 0
    });

    // Date
    composites.push({
      input: Buffer.from(createTextSVG(
        data.date,
        width * (pos.dateLeft / 100),
        height * (pos.dateTop / 100),
        pos.dateFontSize,
        false,
        false
      )),
      top: 0,
      left: 0
    });

    // Apply all composites
    const certificateBuffer = await sharpInstance
      .composite(composites)
      .jpeg({ quality: 95 })
      .toBuffer();

    return certificateBuffer;
  } catch (error) {
    console.error('Error generating certificate image:', error);
    throw new Error(`Failed to generate certificate image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Escape XML special characters
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
