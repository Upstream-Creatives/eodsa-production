'use client';

import { useState, useEffect } from 'react';

export default function CertificateAdjustPage() {
  // Position controls (as percentages)
  const [positions, setPositions] = useState({
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
  });

  // Force image refresh
  const [imageKey, setImageKey] = useState(0);

  const updatePosition = (field: string, value: number) => {
    setPositions(prev => ({ ...prev, [field]: value }));
  };

  // Trigger image refresh when positions change
  useEffect(() => {
    setImageKey(prev => prev + 1);
  }, [positions]);

  // Build the query string for the image URL
  const buildImageUrl = () => {
    const params = new URLSearchParams();
    Object.entries(positions).forEach(([key, value]) => {
      params.append(key, value.toString());
    });
    return `/api/certificates/adjust/image?${params.toString()}&v=${imageKey}`;
  };

  const copyValues = () => {
    const values = `
Dancer Name:
- Top: ${positions.nameTop}%
- Left: ${positions.nameLeft}%
- Font Size: ${positions.nameFontSize}px

Percentage:
- Top: ${positions.percentageTop}%
- Left: ${positions.percentageLeft}%
- Font Size: ${positions.percentageFontSize}px

Style:
- Top: ${positions.styleTop}%
- Left: ${positions.styleLeft}%
- Font Size: ${positions.styleFontSize}px

Title:
- Top: ${positions.titleTop}%
- Left: ${positions.titleLeft}%
- Font Size: ${positions.titleFontSize}px

Medallion:
- Top: ${positions.medallionTop}%
- Left: ${positions.medallionLeft}%
- Font Size: ${positions.medallionFontSize}px

Date:
- Top: ${positions.dateTop}%
- Left: ${positions.dateLeft}%
- Font Size: ${positions.dateFontSize}px
    `;
    navigator.clipboard.writeText(values);
    alert('Values copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Certificate Preview - Now using actual generated image */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <h2 className="text-white text-xl font-bold mb-4">Certificate Preview (Live Generated)</h2>
          <div className="relative w-full" style={{ aspectRatio: '904/1280' }}>
            <img
              src={buildImageUrl()}
              alt="Generated Certificate"
              className="w-full h-full object-contain"
              key={imageKey}
            />
          </div>
          <p className="text-gray-400 text-sm mt-2 text-center">
            ✅ This is the actual generated certificate image - what you see is what you get!
          </p>
        </div>

        {/* Controls */}
        <div className="bg-gray-800 p-6 rounded-lg overflow-y-auto max-h-screen">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-white text-xl font-bold">Position Controls</h2>
            <button
              onClick={copyValues}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-bold"
            >
              Copy Values
            </button>
          </div>

          <div className="space-y-6">
            {/* Dancer Name Controls */}
            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-white font-bold mb-3">Dancer Name</h3>
              <div className="space-y-2">
                <label className="text-white text-sm">Top: {positions.nameTop}%</label>
                <input type="range" min="0" max="100" step="0.5" value={positions.nameTop}
                  onChange={(e) => updatePosition('nameTop', parseFloat(e.target.value))}
                  className="w-full" />
                <label className="text-white text-sm">Left: {positions.nameLeft}%</label>
                <input type="range" min="0" max="100" step="0.5" value={positions.nameLeft}
                  onChange={(e) => updatePosition('nameLeft', parseFloat(e.target.value))}
                  className="w-full" />
                <label className="text-white text-sm">Font Size: {positions.nameFontSize}px</label>
                <input type="range" min="20" max="120" value={positions.nameFontSize}
                  onChange={(e) => updatePosition('nameFontSize', parseInt(e.target.value))}
                  className="w-full" />
              </div>
            </div>

            {/* Percentage Controls */}
            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-white font-bold mb-3">Percentage (92)</h3>
              <div className="space-y-2">
                <label className="text-white text-sm">Top: {positions.percentageTop}%</label>
                <input type="range" min="0" max="100" step="0.5" value={positions.percentageTop}
                  onChange={(e) => updatePosition('percentageTop', parseFloat(e.target.value))}
                  className="w-full" />
                <label className="text-white text-sm">Left: {positions.percentageLeft}%</label>
                <input type="range" min="0" max="100" step="0.5" value={positions.percentageLeft}
                  onChange={(e) => updatePosition('percentageLeft', parseFloat(e.target.value))}
                  className="w-full" />
                <label className="text-white text-sm">Font Size: {positions.percentageFontSize}px</label>
                <input type="range" min="30" max="150" value={positions.percentageFontSize}
                  onChange={(e) => updatePosition('percentageFontSize', parseInt(e.target.value))}
                  className="w-full" />
              </div>
            </div>

            {/* Style Controls */}
            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-white font-bold mb-3">Style</h3>
              <div className="space-y-2">
                <label className="text-white text-sm">Top: {positions.styleTop}%</label>
                <input type="range" min="0" max="100" step="0.5" value={positions.styleTop}
                  onChange={(e) => updatePosition('styleTop', parseFloat(e.target.value))}
                  className="w-full" />
                <label className="text-white text-sm">Left: {positions.styleLeft}%</label>
                <input type="range" min="0" max="100" step="0.5" value={positions.styleLeft}
                  onChange={(e) => updatePosition('styleLeft', parseFloat(e.target.value))}
                  className="w-full" />
                <label className="text-white text-sm">Font Size: {positions.styleFontSize}px</label>
                <input type="range" min="20" max="80" value={positions.styleFontSize}
                  onChange={(e) => updatePosition('styleFontSize', parseInt(e.target.value))}
                  className="w-full" />
              </div>
            </div>

            {/* Title Controls */}
            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-white font-bold mb-3">Title</h3>
              <div className="space-y-2">
                <label className="text-white text-sm">Top: {positions.titleTop}%</label>
                <input type="range" min="0" max="100" step="0.5" value={positions.titleTop}
                  onChange={(e) => updatePosition('titleTop', parseFloat(e.target.value))}
                  className="w-full" />
                <label className="text-white text-sm">Left: {positions.titleLeft}%</label>
                <input type="range" min="0" max="100" step="0.5" value={positions.titleLeft}
                  onChange={(e) => updatePosition('titleLeft', parseFloat(e.target.value))}
                  className="w-full" />
                <label className="text-white text-sm">Font Size: {positions.titleFontSize}px</label>
                <input type="range" min="20" max="80" value={positions.titleFontSize}
                  onChange={(e) => updatePosition('titleFontSize', parseInt(e.target.value))}
                  className="w-full" />
              </div>
            </div>

            {/* Medallion Controls */}
            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-white font-bold mb-3">Medallion</h3>
              <div className="space-y-2">
                <label className="text-white text-sm">Top: {positions.medallionTop}%</label>
                <input type="range" min="0" max="100" step="0.5" value={positions.medallionTop}
                  onChange={(e) => updatePosition('medallionTop', parseFloat(e.target.value))}
                  className="w-full" />
                <label className="text-white text-sm">Left: {positions.medallionLeft}%</label>
                <input type="range" min="0" max="100" step="0.5" value={positions.medallionLeft}
                  onChange={(e) => updatePosition('medallionLeft', parseFloat(e.target.value))}
                  className="w-full" />
                <label className="text-white text-sm">Font Size: {positions.medallionFontSize}px</label>
                <input type="range" min="20" max="80" value={positions.medallionFontSize}
                  onChange={(e) => updatePosition('medallionFontSize', parseInt(e.target.value))}
                  className="w-full" />
              </div>
            </div>

            {/* Date Controls */}
            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-white font-bold mb-3">Date</h3>
              <div className="space-y-2">
                <label className="text-white text-sm">Top: {positions.dateTop}%</label>
                <input type="range" min="0" max="100" step="0.5" value={positions.dateTop}
                  onChange={(e) => updatePosition('dateTop', parseFloat(e.target.value))}
                  className="w-full" />
                <label className="text-white text-sm">Left: {positions.dateLeft}%</label>
                <input type="range" min="0" max="100" step="0.5" value={positions.dateLeft}
                  onChange={(e) => updatePosition('dateLeft', parseFloat(e.target.value))}
                  className="w-full" />
                <label className="text-white text-sm">Font Size: {positions.dateFontSize}px</label>
                <input type="range" min="12" max="48" value={positions.dateFontSize}
                  onChange={(e) => updatePosition('dateFontSize', parseInt(e.target.value))}
                  className="w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
