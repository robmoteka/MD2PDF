import { BrowserWindow } from 'electron';
import * as fs from 'fs';

export async function exportPdf(html: string, css: string, outputPath: string): Promise<void> {
  const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>${css}</style>
</head>
<body class="pdf-body">
${html}
</body>
</html>`;

  const pdfWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  try {
    await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);

    // Wait for Mermaid SVGs and images to finish rendering
    await new Promise(resolve => setTimeout(resolve, 1000));

    const pdfData = await pdfWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: {
        marginType: 'custom',
        top: 1.5,
        bottom: 1.5,
        left: 1.5,
        right: 1.5,
      },
    });

    fs.writeFileSync(outputPath, pdfData);
  } finally {
    pdfWindow.close();
  }
}
