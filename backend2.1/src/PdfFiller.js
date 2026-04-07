const fs = require('fs');
const { 
    PDFDocument, 
    PDFCheckBox, 
    PDFTextField, 
    PDFRadioGroup, 
    StandardFonts, 
    rgb, 
    PDFName, 
    PDFString,
    TextAlignment 
} = require('pdf-lib');

/**
 * PdfFiller
 * Handles the low-level logic of mapping JSON data into a PDF Form.
 */
class PdfFiller {

    /**
     * Custom text wrapper for monospaced Courier font.
     * Calculates line breaks mathematically to bypass PDF-lib's buggy wrapping.
     * Smartly handles space padding to ensure text anchors correctly.
     */
    static wrapTextForCourier(text, maxChars) {
        if (!text) return "";
        let result = "";
        
        // Normalize newlines and split into existing lines
        text = text.replace(/\r\n/g, '\n');
        const lines = text.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            let lineLen = 0;
            // Split by words AND spaces, preserving the exact space padding injected
            const tokens = lines[i].match(/ +|[^ ]+/g) || [];
            
            for (let token of tokens) {
                if (lineLen + token.length > maxChars) {
                    if (token.trim() === '') continue; // Drop trailing space on wrap
                    
                    // If the line so far is ONLY spaces (our indent), do NOT drop 
                    // the word to the next line. Hard-break the token to fill the gap.
                    const isIndentOnly = lineLen > 0 && result.substring(result.lastIndexOf('\n') + 1).trim() === '';
                    
                    if (isIndentOnly || token.length > maxChars) {
                        const spaceLeft = maxChars - lineLen;
                        if (spaceLeft > 0) {
                            result += token.substring(0, spaceLeft) + "\n";
                            token = token.substring(spaceLeft);
                        } else {
                            result += "\n";
                        }
                        lineLen = 0;
                        while (token.length > maxChars) {
                            result += token.substring(0, maxChars) + "\n";
                            token = token.substring(maxChars);
                        }
                    } else {
                        result += "\n";
                        lineLen = 0;
                    }
                }
                result += token;
                lineLen += token.length;
            }
            
            if (i < lines.length - 1) {
                result += "\n";
            }
        }
        return result;
    }

    /**
     * Fills a PDF template with data from a JSON object.
     */
    static async fill(jsonData, templatePath, outputPath) {
        try {
            if (!fs.existsSync(templatePath)) {
                throw new Error(`Template not found at: ${templatePath}`);
            }

            const templateBytes = fs.readFileSync(templatePath);
            const pdfDoc = await PDFDocument.load(templateBytes);
            const form = pdfDoc.getForm();
            
            // Embed Courier as the absolute standard font
            const courierFont = await pdfDoc.embedFont(StandardFonts.Courier);

            const commentsFontSize = jsonData._commentsFontSize || 10;

            for (const [key, value] of Object.entries(jsonData)) {
                if (key === '_commentsFontSize') continue;
                if (value === null || value === undefined || value === '') continue;

                try {
                    const field = form.getFieldMaybe(key);
                    if (!field) continue;

                    // --- CHECKBOX LOGIC ---
                    if (field instanceof PDFCheckBox) {
                        if (value === 'Yes' || String(value).toUpperCase() === 'X' || value === true) {
                            
                            // Logically check the box
                            try { field.check(); } catch (_) {}
                            
                            const widgets = field.acroField.getWidgets();
                            for (const widget of widgets) {
                                const rect = widget.getRectangle();
                                
                                // Robust Widget Page Locator (Fixes PDFDict crashes)
                                let targetPage = null;
                                const pRef = widget.dict.getRaw(PDFName.of('P'));
                                const pages = pdfDoc.getPages();
                                
                                if (pRef) {
                                    targetPage = pages.find(p => p.ref && pRef && p.ref.toString() === pRef.toString());
                                }
                                
                                if (!targetPage) {
                                    for (const page of pages) {
                                        const annots = page.node.Annots();
                                        if (annots) {
                                            for (let i = 0; i < annots.size(); i++) {
                                                const rawAnnot = annots.getRaw(i);
                                                // Safely resolve annotation avoiding lookup crashes
                                                let resolvedAnnot = null;
                                                try { resolvedAnnot = pdfDoc.context.lookup(rawAnnot); } catch(_) {}
                                                
                                                if (resolvedAnnot === widget.dict) {
                                                    targetPage = page;
                                                    break;
                                                }
                                            }
                                        }
                                        if (targetPage) break;
                                    }
                                }

                                if (targetPage) {
                                    // Strip native appearances and backgrounds to prevent occlusion
                                    widget.dict.delete(PDFName.of('AP'));
                                    widget.dict.delete(PDFName.of('MK'));
                                    
                                    // Draw perfect 10pt Courier 'X' mathematically centered
                                    targetPage.drawText('X', {
                                        x: rect.x + (rect.width - 6.0) / 2,
                                        y: rect.y + (rect.height - 7.0) / 2,
                                        size: 10,
                                        font: courierFont,
                                        color: rgb(0, 0, 0),
                                    });
                                }
                            }
                        }
                    } 
                    
                    // --- RADIO GROUP LOGIC (Fallback) ---
                    else if (field instanceof PDFRadioGroup) {
                        field.select(String(value));
                    } 
                    
                    // --- TEXT FIELD LOGIC ---
                    else if (field instanceof PDFTextField) {
                        const fontSize = (key === 'f1_41') ? commentsFontSize : 10;
                        let stringValue = String(value);

                        // 1. CRITICAL FIX: Ensure a Default Appearance (/DA) exists to prevent crashes
                        if (!field.acroField.dict.has(PDFName.of('DA'))) {
                            field.acroField.dict.set(PDFName.of('DA'), PDFString.of('/Helv 10 Tf 0 g'));
                        }

                        // 2. Get physical width of PDF box
                        const widgets = field.acroField.getWidgets();
                        const rect = widgets.length > 0 ? widgets[0].getRectangle() : { width: 100, height: 12 };
                        
                        // 3. Calculate exact max characters (Courier 10pt is exactly 6.0 width)
                        const maxChars = Math.max(1, Math.floor((rect.width - 4) / (fontSize * 0.6)));
                        
                        // Detect if box is a small checkbox-style field
                        const isSmallBox = rect.width < 35 && rect.height < 35;

                        // Safely convert boolean/Yes triggers to 'X' for small boxes
                        if (isSmallBox && (stringValue === 'Yes' || stringValue === 'true')) {
                            stringValue = 'X';
                        }

                        // 4. Trait Boxes (Acting as checkboxes)
                        if (isSmallBox && stringValue.trim().toUpperCase() === 'X' && stringValue.length <= 3) {
                            field.setAlignment(TextAlignment.Center);
                            field.setText('X');
                        } 
                        // 5. Standard Text / Long Text Wrap
                        else {
                            if (stringValue.length > maxChars) {
                                // Inject hard line breaks mathematically
                                stringValue = this.wrapTextForCourier(stringValue, maxChars);
                                field.enableMultiline(); 
                            }
                            field.setText(stringValue);
                        }

                        field.setFontSize(fontSize);

                        // Ensure Page 2 copies inherit the Courier font 
                        if (widgets.length > 1) {
                            for (const widget of widgets) {
                                widget.dict.delete(PDFName.of('DA'));
                            }
                        }

                        // Safely apply appearances
                        try {
                            field.updateAppearances(courierFont);
                        } catch (_) {
                            field.defaultUpdateAppearances(courierFont);
                        }
                    }
                } catch (err) {
                    console.warn(`[PdfFiller] Unexpected error processing field '${key}':`, err.message);
                }
            }

            // 6. Save output
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