const handlePDFExport = async () => {
    setMessage("Generating PDF...");
    const result = await window.api.exportPDF();
    if (result.success) {
        setMessage(`PDF saved to: ${result.path}`);
    } else {
        setMessage("PDF export failed or cancelled.");
    }
  };

const handlePrintFromList = async (report) => {
    setMessage(`Preparing PDF for ${report.name}...`);

    // 1. Tell the hidden template to use this report's data
    setSelectedReport(report);

    // 2. Wait 100ms for the UI to update the hidden div, then trigger PDF
    setTimeout(async () => {
        await window.api.exportPDF();
        setSelectedReport(null); // Reset back to "Editor Mode"
        setMessage("PDF Generated.");
    }, 100);
};