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

    // Calculate baseline offsets (approximate font size * 0.9)
    const nameBaselineOffset = pos.nameFontSize * 0.9;
    const percentageBaselineOffset = pos.percentageFontSize * 0.9;
    const styleBaselineOffset = pos.styleFontSize * 0.9;
    const titleBaselineOffset = pos.titleFontSize * 0.9;
    const medallionBaselineOffset = pos.medallionFontSize * 0.9;
    const dateBaselineOffset = pos.dateFontSize * 0.9;

    // Create SVG overlay with text
    const svgOverlay = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <style>
          .dancer-name {
            fill: white;
            font-family: 'Montserrat', Arial, sans-serif;
            font-weight: bold;
            font-size: ${pos.nameFontSize}px;
            text-anchor: middle;
            letter-spacing: 4px;
          }
          .percentage {
            fill: white;
            font-family: 'Montserrat', Arial, sans-serif;
            font-weight: bold;
            font-size: ${pos.percentageFontSize}px;
          }
          .style-text {
            fill: white;
            font-family: 'Montserrat', Arial, sans-serif;
            font-weight: bold;
            font-size: ${pos.styleFontSize}px;
            text-transform: uppercase;
          }
          .title-text {
            fill: white;
            font-family: 'Montserrat', Arial, sans-serif;
            font-weight: bold;
            font-size: ${pos.titleFontSize}px;
            text-transform: uppercase;
          }
          .medallion-text {
            fill: white;
            font-family: 'Montserrat', Arial, sans-serif;
            font-weight: bold;
            font-size: ${pos.medallionFontSize}px;
            text-transform: uppercase;
          }
          .date-text {
            fill: white;
            font-family: 'Montserrat', Arial, sans-serif;
            font-size: ${pos.dateFontSize}px;
          }
        </style>

        <!-- Dancer Name -->
        <text x="${width * (pos.nameLeft / 100)}" y="${height * (pos.nameTop / 100) + nameBaselineOffset}" class="dancer-name">${escapeXml(data.dancerName)}</text>

        <!-- Percentage -->
        <text x="${width * (pos.percentageLeft / 100)}" y="${height * (pos.percentageTop / 100) + percentageBaselineOffset}" class="percentage">${data.percentage}</text>

        <!-- Style -->
        <text x="${width * (pos.styleLeft / 100)}" y="${height * (pos.styleTop / 100) + styleBaselineOffset}" class="style-text">${escapeXml(data.style)}</text>

        <!-- Title -->
        <text x="${width * (pos.titleLeft / 100)}" y="${height * (pos.titleTop / 100) + titleBaselineOffset}" class="title-text">${escapeXml(data.title)}</text>

        <!-- Medallion -->
        <text x="${width * (pos.medallionLeft / 100)}" y="${height * (pos.medallionTop / 100) + medallionBaselineOffset}" class="medallion-text">${escapeXml(data.medallion)}</text>

        <!-- Date -->
        <text x="${width * (pos.dateLeft / 100)}" y="${height * (pos.dateTop / 100) + dateBaselineOffset}" class="date-text">${escapeXml(data.date)}</text>
      </svg>
    `;

    // Composite the SVG overlay onto the template
    const certificateBuffer = await sharp(templatePath)
      .composite([
        {
          input: Buffer.from(svgOverlay),
          top: 0,
          left: 0,
        },
      ])
      .jpeg({ quality: 95 })
      .toBuffer();

    return certificateBuffer;
  } catch (error) {
    console.error('Error generating certificate image:', error);
    throw new Error('Failed to generate certificate image');
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
