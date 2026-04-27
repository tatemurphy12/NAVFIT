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

class PdfFiller {

    static wrapTextForCourier(text, maxChars) {
        if (!text) return "";
        let result = "";
        
        text = text.replace(/\r\n/g, '\n');
        const lines = text.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            let lineLen = 0;
            const tokens = lines[i].match(/ +|[^ ]+/g) || [];
            
            for (let token of tokens) {
                if (lineLen + token.length > maxChars) {
                    if (token.trim() === '') continue;
                    
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

    static findWidgetPage(pdfDoc, widget) {
        const pages = pdfDoc.getPages();
        for (const page of pages) {
            try {
                const annots = page.node.Annots();
                if (!annots) continue;
                for (let i = 0; i < annots.size(); i++) {
                    try {
                        const rawAnnot = annots.getRaw(i);
                        const resolvedAnnot = pdfDoc.context.lookup(rawAnnot);
                        if (resolvedAnnot === widget.dict) {
                            return page;
                        }
                    } catch (_) {}
                }
            } catch (_) {}
        }
        return null;
    }

    static async fill(jsonData, templatePath, outputPath) {
        try {
            if (!fs.existsSync(templatePath)) {
                throw new Error(`Template not found at: ${templatePath}`);
            }

            const templateBytes = fs.readFileSync(templatePath);
            const pdfDoc = await PDFDocument.load(templateBytes);
            const form = pdfDoc.getForm();
            
            const courierFont = await pdfDoc.embedFont(StandardFonts.Courier);
            const commentsFontSize = jsonData._commentsFontSize || 10;

            // Single constant to tune all checkbox X sizes. Adjust and rebuild to test.
            const CHECKBOX_FONT_SIZE = 8;

            for (const [key, value] of Object.entries(jsonData)) {
                if (key === '_commentsFontSize') continue;
                if (value === null || value === undefined || value === '') continue;

                try {
                    const field = form.getFieldMaybe(key);
                    if (!field) continue;

                    // --- CHECKBOX LOGIC ---
                    if (field instanceof PDFCheckBox) {
                        if (value === 'Yes' || String(value).toUpperCase() === 'X' || value === true) {
                            const widgets = field.acroField.getWidgets();
                            for (const widget of widgets) {
                                const rect = widget.getRectangle();
                                const targetPage = PdfFiller.findWidgetPage(pdfDoc, widget);

                                if (targetPage) {
                                    // Clear ALL appearance-related entries so only our drawn X shows
                                    try { widget.dict.delete(PDFName.of('AP')); } catch (_) {}
                                    try { widget.dict.delete(PDFName.of('MK')); } catch (_) {}
                                    try { widget.dict.delete(PDFName.of('AS')); } catch (_) {}
                                    try { field.acroField.dict.delete(PDFName.of('V')); } catch (_) {}
                                    try { field.acroField.dict.delete(PDFName.of('DV')); } catch (_) {}

                                    targetPage.drawText('X', {
                                        x: rect.x + (rect.width - CHECKBOX_FONT_SIZE * 0.6) / 2,
                                        y: rect.y + (rect.height - CHECKBOX_FONT_SIZE) / 2,
                                        size: CHECKBOX_FONT_SIZE,
                                        font: courierFont,
                                        color: rgb(0, 0, 0),
                                    });
                                } else {
                                    try { field.check(); } catch (_) {}
                                }
                            }
                        }
                    } 
                    
                    // --- RADIO GROUP LOGIC ---
                    else if (field instanceof PDFRadioGroup) {
                        field.select(String(value));
                    } 
                    
                    // --- TEXT FIELD LOGIC ---
                    else if (field instanceof PDFTextField) {
                        const fontSize = (key === 'f1_41') ? commentsFontSize : 9;
                        let stringValue = String(value);

                        if (!field.acroField.dict.has(PDFName.of('DA'))) {
                            field.acroField.dict.set(PDFName.of('DA'), PDFString.of('/Helv 10 Tf 0 g'));
                        }

                        const widgets = field.acroField.getWidgets();
                        const rect = widgets.length > 0 ? widgets[0].getRectangle() : { width: 100, height: 12 };
                        const maxChars = Math.max(1, Math.floor((rect.width - 4) / (fontSize * 0.6)));
                        const isSmallBox = rect.width < 35 && rect.height < 35;

                        if (isSmallBox && (stringValue === 'Yes' || stringValue === 'true')) {
                            stringValue = 'X';
                        }

                        if (isSmallBox && stringValue.trim().toUpperCase() === 'X' && stringValue.length <= 3) {
                            const fillSize = Math.min(rect.width, rect.height) * 0.85;
                            field.setAlignment(TextAlignment.Center);
                            field.setText('X');
                            field.setFontSize(fillSize);
                        } else {
                            if (stringValue.length > maxChars) {
                                stringValue = this.wrapTextForCourier(stringValue, maxChars);
                                field.enableMultiline(); 
                            }
                            field.setText(stringValue);
                            field.setFontSize(fontSize);
                        }

                        if (widgets.length > 1) {
                            for (const widget of widgets) {
                                try { widget.dict.delete(PDFName.of('DA')); } catch (_) {}
                            }
                        }

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