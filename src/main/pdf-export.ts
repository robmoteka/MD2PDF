import { BrowserWindow } from 'electron';
import * as fs from 'fs';
import { PdfOptions } from '../shared/types';

export async function exportPdf(
  html: string,
  css: string,
  outputPath: string,
  options: PdfOptions,
): Promise<void> {
  const orientation = options.landscape ? 'landscape' : 'portrait';

  const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
@page { size: ${options.pageSize} ${orientation}; }
${css}
/* override: scale images to page width — injected per export */
.pdf-body img {
  display: block;
  max-width: 100%;
  width: auto;
  height: auto;
}
.pdf-body .mermaid-rendered svg,
.pdf-body .laneflow-rendered svg {
  max-width: 100%;
  width: 100%;
  height: auto;
}
</style>
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

    // Ensure raster images don't overflow page width (CSS fallback in print mode).
    await pdfWindow.webContents.executeJavaScript(`
      (function () {
        var maxW = document.body.clientWidth;
        document.querySelectorAll('.pdf-body img').forEach(function (img) {
          if (!img.complete || img.naturalWidth === 0) return;
          if (img.naturalWidth > maxW) {
            img.style.width  = '100%';
            img.style.height = 'auto';
          }
        });
      })();
    `);

    const pdfData = await pdfWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: options.pageSize,
      landscape: options.landscape,
      margins: {
        marginType: 'custom',
        top: 0.39,    // ~1.0 cm
        bottom: 0.39, // ~1.0 cm
        left: 0.39,   // ~1.0 cm
        right: 0.39,  // ~1.0 cm
      },
    });

    fs.writeFileSync(outputPath, pdfData);
  } finally {
    pdfWindow.close();
  }
}
