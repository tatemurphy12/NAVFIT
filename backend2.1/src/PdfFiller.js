const fs = require('fs');
const { PDFDocument, PDFCheckBox, PDFTextField, StandardFonts, rgb } = require('pdf-lib');

/**
 * PdfFiller
 * Handles the low-level logic of mapping JSON data into a PDF Form.
 */
class PdfFiller {

    /**
     * Fills a PDF template with data from a JSON object.
     * @param {Object} jsonData - Key-value pairs of field names and values.
     * @param {string} templatePath - Path to the blank PDF form template.
     * @param {string} outputPath - Destination path for the filled PDF.
     */
    static async fill(jsonData, templatePath, outputPath) {
        try {
            if (!fs.existsSync(templatePath)) {
                throw new Error(`Template not found at: ${templatePath}`);
            }

            // 1. Load the Template
            const templateBytes = fs.readFileSync(templatePath);
            const pdfDoc = await PDFDocument.load(templateBytes);
            const form = pdfDoc.getForm();

            // Embed Courier as the standard font for all fields
            const courierFont = await pdfDoc.embedFont(StandardFonts.Courier);

            // Determine the font size for the comments box (default 10, configurable via jsonData)
            const commentsFontSize = jsonData._commentsFontSize || 10;
            // Remove the meta key so it doesn't get mapped to a PDF field
            delete jsonData._commentsFontSize;

            // 2. Iterate through data and map to fields
            for (const [key, value] of Object.entries(jsonData)) {
                try {
                    const field = form.getField(key);

                    if (field instanceof PDFCheckBox) {
                        // Checkbox Logic: Draw an 'X' character instead of a filled square
                        if (value === 'Yes') {
                            // Get the checkbox widget to find its position and size
                            const widgets = field.acroField.getWidgets();
                            for (const widget of widgets) {
                                const rect = widget.getRectangle();
                                // Find which page this widget is on
                                const pages = pdfDoc.getPages();
                                for (const page of pages) {
                                    const pageRef = page.ref;
                                    const annotRefs = page.node.Annots();
                                    if (annotRefs) {
                                        const annots = annotRefs.asArray ? annotRefs.asArray() : [];
                                        for (const annotRef of annots) {
                                            const resolved = pdfDoc.context.lookupMaybe(annotRef);
                                            if (resolved === widget.dict) {
                                                // Draw 'X' centered in the checkbox rectangle
                                                const xFontSize = Math.min(rect.width, rect.height) * 0.85;
                                                page.drawText('X', {
                                                    x: rect.x + (rect.width - xFontSize * 0.6) / 2,
                                                    y: rect.y + (rect.height - xFontSize) / 2 + xFontSize * 0.15,
                                                    size: xFontSize,
                                                    font: courierFont,
                                                    color: rgb(0, 0, 0),
                                                });
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                            // Don't call field.check() — we drew the X manually
                        }
                        // For unchecked, do nothing (leave blank)
                    } else if (field instanceof PDFTextField) {
                        // Use the comments font size for the comments field, 10pt for everything else
                        const fontSize = (key === 'f1_41') ? commentsFontSize : 10;
                        // Set Courier font and size, falling back to updating the default
                        // appearance first for fields missing a /DA entry
                        try {
                            field.updateAppearances(courierFont);
                            field.setFontSize(fontSize);
                        } catch (_) {
                            field.defaultUpdateAppearances(courierFont);
                            field.setFontSize(fontSize);
                        }
                        field.setText(String(value));

                        // For fields with multiple widgets (e.g. Block 1 fields
                        // that appear on both pages), force Courier font and size
                        // on every widget so the second-page copy is formatted
                        // identically to the first.
                        const widgets = field.acroField.getWidgets();
                        if (widgets.length > 1) {
                            for (const widget of widgets) {
                                widget.setFontSize(fontSize);
                            }
                            field.updateAppearances(courierFont);
                        }
                    }
                } catch (err) {
                    console.warn(`[PdfFiller] Skipping field '${key}':`, err.message);
                }
            }

            // 3. Save to file
            const pdfBytes = await pdfDoc.save();
            fs.writeFileSync(outputPath, pdfBytes);
            console.log(`[PdfFiller] Successfully generated: ${outputPath}`);
            
            return outputPath;

        } catch (error) {
            console.error(`[PdfFiller] Error: ${error.message}`);
            throw error;
        }
    }
}

module.exports = PdfFiller;
