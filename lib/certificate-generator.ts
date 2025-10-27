export interface CertificateData {
  dancerName: string;
  percentage: number;
  style: string;
  title: string;
  medallion: 'Gold' | 'Silver' | 'Bronze' | '';
  date: string;
}

/**
 * Generate certificate HTML
 * Based on the EODSA Elements of Dance Nationals 2025 certificate design
 */
export function generateCertificateHTML(data: CertificateData): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Certificate of Achievement - ${data.dancerName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap');

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Montserrat', sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: #1a1a2e;
    }

    .certificate-container {
      position: relative;
      width: 1754px;
      height: 1240px;
      background-image: url('/Template.jpg');
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
    }

    .certificate-overlay {
      position: absolute;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .dancer-name {
      position: absolute;
      top: 580px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 72px;
      font-weight: 700;
      color: #FFFFFF;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 2px;
    }

    .details-container {
      position: absolute;
      top: 750px;
      left: 0;
      right: 0;
      display: flex;
      justify-content: space-between;
      padding: 0 200px;
    }

    .percentage-section {
      font-size: 96px;
      font-weight: 700;
      color: #FFFFFF;
    }

    .info-section {
      display: flex;
      flex-direction: column;
      gap: 20px;
      text-align: left;
    }

    .info-row {
      font-size: 48px;
      font-weight: 700;
      color: #FFFFFF;
      text-transform: uppercase;
    }

    .date-section {
      position: absolute;
      bottom: 50px;
      right: 274px;
      font-size: 32px;
      font-weight: 400;
      color: #FFFFFF;
    }
  </style>
</head>
<body>
  <div class="certificate-container">
    <div class="certificate-overlay">
      <div class="dancer-name">${data.dancerName}</div>

      <div class="details-container">
        <div class="percentage-section">
          ${data.percentage}%
        </div>

        <div class="info-section">
          <div class="info-row">STYLE: ${data.style}</div>
          <div class="info-row">TITLE: ${data.title}</div>
          <div class="info-row">MEDALLION: ${data.medallion}</div>
        </div>
      </div>

      <div class="date-section">${data.date}</div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Get medal type from percentage score
 */
export function getMedalFromPercentage(percentage: number): 'Elite' | 'Opus' | 'Legend' | 'Gold' | 'Silver+' | 'Silver' | 'Bronze' | '' {
  if (percentage >= 95) return 'Elite';
  if (percentage >= 90) return 'Opus';
  if (percentage >= 85) return 'Legend';
  if (percentage >= 80) return 'Gold';
  if (percentage >= 75) return 'Silver+';
  if (percentage >= 70) return 'Silver';
  if (percentage <= 69) return 'Bronze';
  return '';
}

/**
 * Format date for certificate (e.g., "October 11, 2025")
 */
export function formatCertificateDate(dateString: string): string {
  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  };
  return date.toLocaleDateString('en-US', options);
}
