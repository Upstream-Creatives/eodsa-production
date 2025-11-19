# 📐 Certificate Template Dimensions Guide

## ✅ Recommended Dimensions

### **Standard Certificate Template Size**

- **Width**: `904 pixels`
- **Height**: `1280 pixels`
- **Aspect Ratio**: `904:1280` (approximately `0.706:1`)
- **Orientation**: **Portrait** (vertical)
- **Format**: JPG or PNG

---

## 📏 Why These Dimensions?

The certificate generation system is designed around these dimensions:

1. **Default Template**: The system uses `904x1280` pixels as the default template size
2. **Text Positioning**: All text overlays use percentage-based positioning that's calibrated for this size
3. **Aspect Ratio**: The certificate display uses `aspectRatio: '904/1280'` to maintain proper proportions

---

## 🎨 Template Requirements

### **File Format**
- ✅ **JPG** (`.jpg` or `.jpeg`) - Recommended for photos/designs
- ✅ **PNG** (`.png`) - Recommended for graphics with transparency
- ❌ **PDF** - Not supported (only images)

### **Image Quality**
- **Resolution**: At least 904x1280 pixels (higher is fine, will be scaled)
- **Quality**: High quality recommended (the system uses JPEG quality 95)
- **Color Mode**: RGB

### **Design Considerations**

1. **Text Placement Areas**: Make sure your template has clear areas for:
   - **Dancer Name** (centered, top ~48.5%)
   - **Percentage** (left side, ~65.5% from top)
   - **Style** (right side, ~67.5% from top)
   - **Title** (right side, ~74% from top)
   - **Medallion** (right side, ~80.5% from top)
   - **Date** (center-right, ~88% from top)

2. **Background**: 
   - Dark backgrounds work best (text is white)
   - Ensure good contrast for readability

3. **Lines/Guides**: 
   - If your template has lines for text (like "STYLE: ___________"), position them where text will overlay
   - The system overlays text at specific percentages, so align your template accordingly

---

## 🔄 What Happens with Different Sizes?

The system is **flexible** and will work with different dimensions:

- ✅ **Larger sizes** (e.g., 1808x2560): Will be automatically scaled down
- ✅ **Same aspect ratio** (e.g., 452x640): Will work perfectly
- ⚠️ **Different aspect ratio**: Text positioning may need adjustment

### **How It Works**

```typescript
// The system reads your template dimensions
const metadata = await sharp(templateBuffer).metadata();
const width = metadata.width || 904;  // Falls back to 904 if not detected
const height = metadata.height || 1280; // Falls back to 1280 if not detected

// Text is positioned using percentages, so it scales with your template
textX = width * (percentageLeft / 100)
textY = height * (percentageTop / 100)
```

---

## 📋 Quick Reference

| Property | Value |
|----------|-------|
| **Width** | 904 px |
| **Height** | 1280 px |
| **Aspect Ratio** | 904:1280 (0.706:1) |
| **Orientation** | Portrait |
| **Format** | JPG or PNG |
| **Min Resolution** | 904x1280 |
| **Recommended** | 904x1280 or higher (maintain aspect ratio) |

---

## 🎯 Best Practices

1. **Use Exact Dimensions**: For best results, create templates at exactly `904x1280` pixels
2. **Maintain Aspect Ratio**: If scaling, keep the `904:1280` ratio
3. **Test First**: Upload a test template and use `/certificates/test` to verify text alignment
4. **High Quality**: Use high-resolution images (at least 300 DPI if printing)
5. **File Size**: Keep files under 10MB for faster uploads

---

## 🔍 Testing Your Template

After uploading a template:

1. Go to: `/certificates/test`
2. Select your event from the dropdown
3. Fill in test data
4. Click "Preview Certificate"
5. Verify text alignment matches your template design

---

## 📝 Example Template Creation

### In Photoshop/Design Software:

1. Create new document: `904 x 1280 pixels`
2. Set resolution: `300 DPI` (for print quality)
3. Design your certificate
4. Export as:
   - **JPG**: Quality 90-95, RGB color
   - **PNG**: 24-bit, RGB color

### In Canva/Online Tools:

1. Create custom size: `904 x 1280 pixels`
2. Design your certificate
3. Download as JPG or PNG
4. Ensure dimensions are exactly `904x1280`

---

## ⚠️ Common Issues

### **Text Not Aligning**
- **Cause**: Template has different dimensions or aspect ratio
- **Solution**: Resize template to exactly `904x1280` pixels

### **Text Too Small/Large**
- **Cause**: Template is much larger/smaller than expected
- **Solution**: The system uses fixed font sizes, so ensure your template is close to `904x1280`

### **Text Cut Off**
- **Cause**: Text positioned outside template bounds
- **Solution**: Adjust your template design to accommodate text areas (see positioning percentages above)

---

## 📞 Need Help?

If your template doesn't align correctly:
1. Check template dimensions match `904x1280`
2. Test using `/certificates/test` page
3. Verify aspect ratio is `904:1280`
4. Ensure file format is JPG or PNG

