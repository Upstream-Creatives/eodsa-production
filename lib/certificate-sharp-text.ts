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
  medallion: 'Gold' | 'Silver' | 'Bronze' | '';
  date: string;
  positions?: CertificatePositions;
}

/**
 * Generate a certificate image using Sharp with text overlay
 * Uses Pango markup which should work on Vercel
 */
export async function generateCertificateWithSharpText(data: CertificateImageData): Promise<Buffer> {
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
    const pos = data.positions || {
      nameTop: 48.5,
      nameLeft: 50,
      nameFontSize: 65,
      percentageTop: 65.5,
      percentageLeft: 15.5,
      percentageFontSize: 76,
      styleTop: 67.5,
      styleLeft: 62.5,
      styleFontSize: 33,
      titleTop: 74,
      titleLeft: 60,
      titleFontSize: 29,
      medallionTop: 80.5,
      medallionLeft: 65.5,
      medallionFontSize: 46,
      dateTop: 90.5,
      dateLeft: 52,
      dateFontSize: 39,
    };

    // Create text overlays using Sharp's text() method
    const createTextOverlay = async (text: string, fontSize: number, color: string = 'white') => {
      // Use Pango markup for text
      const svg = Buffer.from(`
        <svg width="${width}" height="${height}">
          <style>
            .text { 
              fill: ${color};
              font-family: sans-serif;
              font-size: ${fontSize}px;
              font-weight: bold;
            }
          </style>
          <text x="0" y="${fontSize}" class="text">${text}</text>
        </svg>
      `);
      
      return sharp(svg)
        .png()
        .toBuffer();
    };

    // Start with base image
    let image = sharp(templatePath);

    // Create composites array
    const composites: any[] = [];

    // Dancer Name
    const nameBuffer = await createTextOverlay(data.dancerName, pos.nameFontSize);
    const nameWidth = await sharp(nameBuffer).metadata().then(m => m.width || 0);
    composites.push({
      input: nameBuffer,
      top: Math.floor(height * (pos.nameTop / 100)),
      left: Math.floor(width * (pos.nameLeft / 100) - nameWidth / 2),
      blend: 'over'
    });

    // Percentage
    const percentageBuffer = await createTextOverlay(data.percentage.toString(), pos.percentageFontSize);
    composites.push({
      input: percentageBuffer,
      top: Math.floor(height * (pos.percentageTop / 100)),
      left: Math.floor(width * (pos.percentageLeft / 100)),
      blend: 'over'
    });

    // Style
    const styleBuffer = await createTextOverlay(data.style.toUpperCase(), pos.styleFontSize);
    composites.push({
      input: styleBuffer,
      top: Math.floor(height * (pos.styleTop / 100)),
      left: Math.floor(width * (pos.styleLeft / 100)),
      blend: 'over'
    });

    // Title
    const titleBuffer = await createTextOverlay(data.title.toUpperCase(), pos.titleFontSize);
    composites.push({
      input: titleBuffer,
      top: Math.floor(height * (pos.titleTop / 100)),
      left: Math.floor(width * (pos.titleLeft / 100)),
      blend: 'over'
    });

    // Medallion
    const medallionBuffer = await createTextOverlay(data.medallion.toUpperCase(), pos.medallionFontSize);
    composites.push({
      input: medallionBuffer,
      top: Math.floor(height * (pos.medallionTop / 100)),
      left: Math.floor(width * (pos.medallionLeft / 100)),
      blend: 'over'
    });

    // Date
    const dateBuffer = await createTextOverlay(data.date, pos.dateFontSize);
    composites.push({
      input: dateBuffer,
      top: Math.floor(height * (pos.dateTop / 100)),
      left: Math.floor(width * (pos.dateLeft / 100)),
      blend: 'over'
    });

    // Apply all composites
    const certificateBuffer = await image
      .composite(composites)
      .jpeg({ quality: 95 })
      .toBuffer();

    return certificateBuffer;
  } catch (error) {
    console.error('Error generating certificate with Sharp:', error);
    throw new Error(`Failed to generate certificate: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

