import { createCanvas, loadImage, registerFont } from 'canvas';
import fs from 'fs';
import path from 'path';

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
 * Generate a certificate image using Canvas (works better on Vercel)
 */
export async function generateCertificateWithCanvas(data: CertificateImageData): Promise<Buffer> {
  try {
    // Load the template image
    const templatePath = path.join(process.cwd(), 'public', 'Template.jpg');

    if (!fs.existsSync(templatePath)) {
      throw new Error('Certificate template not found');
    }

    // Load the template image
    const templateImage = await loadImage(templatePath);
    const width = templateImage.width;
    const height = templateImage.height;

    // Create canvas
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Draw template image
    ctx.drawImage(templateImage, 0, 0, width, height);

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

    // Set text properties
    ctx.fillStyle = 'white';
    ctx.textBaseline = 'top';

    // Dancer Name (centered)
    ctx.font = `bold ${pos.nameFontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(
      data.dancerName,
      width * (pos.nameLeft / 100),
      height * (pos.nameTop / 100)
    );

    // Percentage
    ctx.font = `bold ${pos.percentageFontSize}px Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(
      data.percentage.toString(),
      width * (pos.percentageLeft / 100),
      height * (pos.percentageTop / 100)
    );

    // Style
    ctx.font = `bold ${pos.styleFontSize}px Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(
      data.style.toUpperCase(),
      width * (pos.styleLeft / 100),
      height * (pos.styleTop / 100)
    );

    // Title
    ctx.font = `bold ${pos.titleFontSize}px Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(
      data.title.toUpperCase(),
      width * (pos.titleLeft / 100),
      height * (pos.titleTop / 100)
    );

    // Medallion
    ctx.font = `bold ${pos.medallionFontSize}px Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(
      data.medallion.toUpperCase(),
      width * (pos.medallionLeft / 100),
      height * (pos.medallionTop / 100)
    );

    // Date
    ctx.font = `${pos.dateFontSize}px Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(
      data.date,
      width * (pos.dateLeft / 100),
      height * (pos.dateTop / 100)
    );

    // Convert canvas to buffer
    return canvas.toBuffer('image/jpeg', { quality: 0.95 });
  } catch (error) {
    console.error('Error generating certificate with canvas:', error);
    throw new Error(`Failed to generate certificate: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

