const fs = require('fs');
const { PDFDocument, PDFCheckBox, PDFTextField, StandardFonts } = require('pdf-lib');

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

            // Embed a default font for fields that are missing a /DA entry
            const defaultFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

            // 2. Iterate through data and map to fields
            for (const [key, value] of Object.entries(jsonData)) {
                try {
                    const field = form.getField(key);

                    if (field instanceof PDFCheckBox) {
                        // Checkbox Logic: Check if value is 'Yes'
                        if (value === 'Yes') {
                            field.check();
                        } else {
                            field.uncheck();
                        }
                    } else if (field instanceof PDFTextField) {
                        // Set font size, falling back to updating the default
                        // appearance first for fields missing a /DA entry
                        try {
                            field.setFontSize(10);
                        } catch (_) {
                            field.defaultUpdateAppearances(defaultFont);
                            field.setFontSize(10);
                        }
                        field.setText(String(value));
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
