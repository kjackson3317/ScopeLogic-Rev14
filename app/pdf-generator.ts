import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont, type PDFImage } from 'pdf-lib';

export type PdfKind = 'sow' | 'clarifications' | 'rfi' | 'checklist' | 'snippets';

export type PdfProject = {
  name: string;
  client: string;
  versionDate: string;
  revision: string;
};

export type PdfIssue = {
  uid: string;
  id: string;
  system: string;
  customSystem: string;
  title: string;
  status: string;
  concern: string;
  rfiQuestion: string;
  basis: string;
  reference: string;
  rfi: string;
  resolution: string;
  snippet: string;
  sow: boolean;
  clarification: boolean;
  formalRfi: boolean;
  checklist: boolean;
  checklistItem: string;
  response: string;
  responseReason: string;
};

type PdfConfig = {
  title: string;
  headers: string[];
  ratios: number[];
  values: (issue: PdfIssue) => string[];
};

type BrandAssets = {
  full: Uint8Array;
  mark: Uint8Array;
  wordmark: Uint8Array;
};

type EmbeddedBrand = {
  full: PDFImage;
  mark: PDFImage;
  wordmark: PDFImage;
};

let brandAssetsPromise: Promise<BrandAssets> | null = null;

async function fetchBytes(path: string) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load brand asset: ${path}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function loadBrandAssets(): Promise<BrandAssets> {
  if (!brandAssetsPromise) {
    brandAssetsPromise = Promise.all([
      fetchBytes('/brand/scopelogic-logo-full.png'),
      fetchBytes('/brand/scopelogic-logo-mark.png'),
      fetchBytes('/brand/scopelogic-wordmark.png'),
    ]).then(([full, mark, wordmark]) => ({ full, mark, wordmark }));
  }
  return brandAssetsPromise;
}

async function embedBrand(document: PDFDocument, assets: BrandAssets): Promise<EmbeddedBrand> {
  return {
    full: await document.embedPng(assets.full),
    mark: await document.embedPng(assets.mark),
    wordmark: await document.embedPng(assets.wordmark),
  };
}

const systemName = (issue: PdfIssue) =>
  issue.system === 'Other' ? issue.customSystem || 'Other' : issue.system;

const safe = (value: string) =>
  String(value || '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');

function configFor(kind: PdfKind): PdfConfig {
  if (kind === 'sow') {
    return {
      title: 'Recommended SOW Matrix',
      headers: ['SLR', 'System', 'Scope Item', 'Scope Concern', 'Recommended Bid Basis', 'Reference'],
      ratios: [0.055, 0.09, 0.13, 0.245, 0.29, 0.19],
      values: (i) => [i.id, systemName(i), i.title, i.concern, i.basis, i.reference],
    };
  }
  if (kind === 'clarifications') {
    return {
      title: 'Clarification Matrix',
      headers: ['SLR / RFI', 'System', 'Question / Issue', 'Recommended Bid Basis', 'Resolution', 'Status', 'Reference'],
      ratios: [0.075, 0.085, 0.215, 0.22, 0.17, 0.08, 0.155],
      values: (i) => [[i.id, i.rfi].filter(Boolean).join('\n'), systemName(i), i.concern, i.basis, i.resolution, i.status, i.reference],
    };
  }
  if (kind === 'rfi') {
    return {
      title: 'Formal RFI',
      headers: ['RFI No.', 'System', 'Question', 'Answer'],
      ratios: [0.13, 0.18, 0.43, 0.26],
      values: (i) => [i.rfi, systemName(i), i.rfiQuestion || i.concern, i.resolution],
    };
  }
  if (kind === 'checklist') {
    return {
      title: 'Contractor Response Checklist',
      headers: ['SLR', 'System', 'Scope Item', 'Response', 'Reason'],
      ratios: [0.07, 0.11, 0.31, 0.19, 0.32],
      values: (i) => [i.id, systemName(i), i.checklistItem, i.response || 'Included', i.responseReason || ''],
    };
  }
  return {
    title: 'Snippet Register',
    headers: ['Snippet No.', 'SLR', 'System', 'Reference', 'Caption'],
    ratios: [0.09, 0.07, 0.13, 0.26, 0.45],
    values: (i) => [i.snippet, i.id, systemName(i), i.reference, i.title],
  };
}

function rowsFor(kind: PdfKind, issues: PdfIssue[]) {
  if (kind === 'sow') return issues.filter((i) => i.sow);
  if (kind === 'clarifications') return issues.filter((i) => i.clarification);
  if (kind === 'rfi') return issues.filter((i) => i.formalRfi);
  if (kind === 'checklist') return issues.filter((i) => Boolean(i.checklistItem?.trim()));
  return issues.filter((i) => i.snippet);
}

function exactWidths(ratios: number[], total: number) {
  let used = 0;
  return ratios.map((ratio, index) => {
    if (index === ratios.length - 1) return total - used;
    const width = total * ratio;
    used += width;
    return width;
  });
}

function wrapText(text: string, maxWidth: number, font: PDFFont, fontSize: number) {
  const result: string[] = [];
  const paragraphs = safe(text).split(/\r?\n/);
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      result.push('');
      continue;
    }
    const words = paragraph.replace(/\s+/g, ' ').trim().split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, fontSize) <= maxWidth) {
        line = test;
        continue;
      }
      if (line) result.push(line);
      if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
        line = word;
        continue;
      }
      let fragment = '';
      for (const character of word) {
        if (font.widthOfTextAtSize(fragment + character, fontSize) <= maxWidth) {
          fragment += character;
        } else {
          if (fragment) result.push(fragment);
          fragment = character;
        }
      }
      line = fragment;
    }
    if (line) result.push(line);
  }
  return result.length ? result : [''];
}

function drawWrapped(
  page: PDFPage,
  lines: string[],
  x: number,
  yTop: number,
  font: PDFFont,
  size: number,
  lineHeight: number,
  color = rgb(0.08, 0.1, 0.08),
) {
  lines.forEach((line, index) => {
    if (!line) return;
    page.drawText(line, { x, y: yTop - index * lineHeight, size, font, color });
  });
}

function fitText(text: string, font: PDFFont, preferred: number, maxWidth: number, minimum = 6) {
  let size = preferred;
  let value = safe(text);
  while (size > minimum && font.widthOfTextAtSize(value, size) > maxWidth) size -= 0.25;
  if (font.widthOfTextAtSize(value, size) > maxWidth) {
    const suffix = '...';
    while (value.length > 1 && font.widthOfTextAtSize(value + suffix, size) > maxWidth) value = value.slice(0, -1);
    value += suffix;
  }
  return { text: value, size };
}

async function appendDeliverable(
  document: PDFDocument,
  kind: PdfKind,
  project: PdfProject,
  allIssues: PdfIssue[],
  brand: EmbeddedBrand,
  formPrefix: string,
) {
  const legalLandscape: [number, number] = [1008, 612];
  const legalPortrait: [number, number] = [612, 1008];
  const landscape = kind !== 'rfi';
  const pageSize = landscape ? legalLandscape : legalPortrait;
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const config = configFor(kind);
  const rows = rowsFor(kind, allIssues);
  const form = kind === 'checklist' ? document.getForm() : null;

  const darkGreen = rgb(0.14, 0.19, 0.09);
  const mediumGreen = rgb(0.28, 0.36, 0.14);
  const lightGreen = rgb(0.95, 0.97, 0.93);
  const alternate = rgb(0.982, 0.987, 0.976);
  const border = rgb(0.64, 0.68, 0.59);
  const muted = rgb(0.35, 0.4, 0.35);
  const white = rgb(1, 1, 1);
  const black = rgb(0.08, 0.1, 0.08);

  const margin = 28;
  const footerY = 14;
  const footerLimit = 30;
  const fontSize = 7;
  const lineHeight = 9;
  const headerBarHeight = 64;
  const metaHeight = 42;
  const instructionHeight = kind === 'checklist' ? 28 : 0;
  const tableHeaderHeight = 22;
  const contentWidth = pageSize[0] - margin * 2;
  const widths = exactWidths(config.ratios, contentWidth);
  const xPositions = [margin];
  widths.forEach((width) => xPositions.push(xPositions[xPositions.length - 1] + width));

  let page: PDFPage;
  let y = 0;
  const createdPages: PDFPage[] = [];

  const drawHeaderGrid = (target: PDFPage, topY: number) => {
    target.drawRectangle({ x: margin, y: topY - tableHeaderHeight, width: contentWidth, height: tableHeaderHeight, color: mediumGreen });
    xPositions.forEach((x) => target.drawLine({ start: { x, y: topY }, end: { x, y: topY - tableHeaderHeight }, thickness: 0.45, color: white }));
    target.drawLine({ start: { x: margin, y: topY }, end: { x: margin + contentWidth, y: topY }, thickness: 0.45, color: border });
    target.drawLine({ start: { x: margin, y: topY - tableHeaderHeight }, end: { x: margin + contentWidth, y: topY - tableHeaderHeight }, thickness: 0.45, color: border });
    config.headers.forEach((header, index) => {
      const fitted = fitText(header, bold, 6.5, widths[index] - 8, 5.25);
      target.drawText(fitted.text, { x: xPositions[index] + 4, y: topY - 14, size: fitted.size, font: bold, color: white });
    });
  };

  const addPage = () => {
    page = document.addPage(pageSize);
    createdPages.push(page);
    const { width, height } = page.getSize();

    page.drawRectangle({ x: 0, y: height - headerBarHeight, width, height: headerBarHeight, color: white });
    const markSize = brand.mark.scaleToFit(44, 44);
    page.drawImage(brand.mark, { x: margin, y: height - 55, width: markSize.width, height: markSize.height });
    const wordSize = brand.wordmark.scaleToFit(190, 28);
    page.drawImage(brand.wordmark, { x: margin + 52, y: height - 43, width: wordSize.width, height: wordSize.height });
    page.drawText('DIVISION 27/28 SCOPE CONSULTING', { x: margin + 54, y: height - 55, size: 5.5, font: bold, color: mediumGreen });

    const titleFit = fitText(config.title, bold, 14, width * 0.46, 9);
    const titleWidth = bold.widthOfTextAtSize(titleFit.text, titleFit.size);
    page.drawText(titleFit.text, { x: width - margin - titleWidth, y: height - 35, size: titleFit.size, font: bold, color: black });
    page.drawLine({ start: { x: margin, y: height - headerBarHeight + 2 }, end: { x: width - margin, y: height - headerBarHeight + 2 }, thickness: 2, color: darkGreen });

    const metaTop = height - headerBarHeight - 4;
    page.drawRectangle({ x: margin, y: metaTop - metaHeight, width: contentWidth, height: metaHeight, color: lightGreen, borderColor: border, borderWidth: 0.5 });
    const metaRatios = [0.34, 0.28, 0.19, 0.19];
    const metaWidths = exactWidths(metaRatios, contentWidth);
    const metaValues = [
      ['Project', project.name || 'Not entered'],
      ['GC / Client', project.client || 'Not entered'],
      ['Version Date', project.versionDate || 'Not set'],
      ['Revision', project.revision || 'Rev 0'],
    ];
    let metaX = margin;
    metaValues.forEach(([label, value], index) => {
      if (index > 0) page.drawLine({ start: { x: metaX, y: metaTop }, end: { x: metaX, y: metaTop - metaHeight }, thickness: 0.45, color: border });
      page.drawText(label.toUpperCase(), { x: metaX + 6, y: metaTop - 12, size: 5.5, font: bold, color: muted });
      const fitted = fitText(value, font, 7.5, metaWidths[index] - 12, 5.5);
      page.drawText(fitted.text, { x: metaX + 6, y: metaTop - 28, size: fitted.size, font, color: black });
      metaX += metaWidths[index];
    });

    let tableTop = metaTop - metaHeight - 12;
    if (kind === 'checklist') {
      page.drawRectangle({ x: margin, y: tableTop - instructionHeight, width: contentWidth, height: instructionHeight, color: rgb(0.98, 0.96, 0.88), borderColor: border, borderWidth: 0.5 });
      const note = 'CONTRACTOR INSTRUCTION: Every selection other than Included requires a written response in the Reason field.';
      const noteFit = fitText(note, bold, 7, contentWidth - 12, 5.5);
      page.drawText(noteFit.text, { x: margin + 6, y: tableTop - 18, size: noteFit.size, font: bold, color: black });
      tableTop -= instructionHeight + 8;
    }

    drawHeaderGrid(page, tableTop);
    y = tableTop - tableHeaderHeight;
  };

  const drawRowFragment = (
    issue: PdfIssue,
    rowIndex: number,
    linesByCell: string[][],
    rowHeight: number,
    firstFragment: boolean,
  ) => {
    const fill = rowIndex % 2 ? white : alternate;
    page.drawRectangle({ x: margin, y: y - rowHeight, width: contentWidth, height: rowHeight, color: fill });
    page.drawLine({ start: { x: margin, y }, end: { x: margin + contentWidth, y }, thickness: 0.45, color: border });
    page.drawLine({ start: { x: margin, y: y - rowHeight }, end: { x: margin + contentWidth, y: y - rowHeight }, thickness: 0.45, color: border });
    xPositions.forEach((x) => page.drawLine({ start: { x, y }, end: { x, y: y - rowHeight }, thickness: 0.45, color: border }));

    linesByCell.forEach((lines, columnIndex) => {
      const cellX = xPositions[columnIndex];
      const cellWidth = widths[columnIndex];
      const isChecklistField = kind === 'checklist' && (columnIndex === 3 || columnIndex === 4);
      if (isChecklistField && firstFragment && form) {
        if (columnIndex === 3) {
          const dropdown = form.createDropdown(`${formPrefix}_response_${rowIndex + 1}`);
          const options = ['Included', 'Excluded', 'Included as Alternate', 'Clarification Required', 'Not Applicable'];
          dropdown.addOptions(options);
          dropdown.select(options.includes(issue.response) ? issue.response : 'Included');
          // addToPage generates the field's /DA entry. setFontSize must run
          // afterwards or pdf-lib throws: No /DA (default appearance) entry found.
          dropdown.addToPage(page, {
            x: cellX + 5,
            y: y - rowHeight + 6,
            width: cellWidth - 10,
            height: rowHeight - 12,
            borderWidth: 0.6,
            borderColor: mediumGreen,
            backgroundColor: white,
            textColor: black,
            font,
          });
          dropdown.setFontSize(6);
          dropdown.updateAppearances(font);
        } else {
          const field = form.createTextField(`${formPrefix}_reason_${rowIndex + 1}`);
          field.enableMultiline();
          if (issue.responseReason) field.setText(safe(issue.responseReason));
          // As with dropdowns, add the widget first so pdf-lib creates /DA.
          field.addToPage(page, {
            x: cellX + 5,
            y: y - rowHeight + 6,
            width: cellWidth - 10,
            height: rowHeight - 12,
            borderWidth: 0.6,
            borderColor: mediumGreen,
            backgroundColor: white,
            textColor: black,
            font,
          });
          field.setFontSize(6);
          field.updateAppearances(font);
        }
      } else if (isChecklistField && !firstFragment) {
        page.drawText('Continued', { x: cellX + 4, y: y - 13, size: 6, font, color: muted });
      } else {
        drawWrapped(page, lines, cellX + 4, y - 11, font, fontSize, lineHeight, black);
      }
    });
    y -= rowHeight;
  };

  addPage();

  rows.forEach((issue, rowIndex) => {
    const values = config.values(issue);
    const allLines = values.map((value, columnIndex) => wrapText(value, widths[columnIndex] - 8, font, fontSize));
    const offsets = allLines.map(() => 0);
    let firstFragment = true;

    while (offsets.some((offset, index) => offset < allLines[index].length)) {
      const minimumRowHeight = kind === 'checklist' && firstFragment ? 34 : 28;
      if (y - minimumRowHeight < footerLimit) addPage();
      const availableHeight = y - footerLimit;
      const linesFit = Math.max(1, Math.floor((availableHeight - 8) / lineHeight));
      const remainingMax = Math.max(...allLines.map((lines, index) => lines.length - offsets[index]));
      const take = Math.min(remainingMax, linesFit);
      const fragmentLines = allLines.map((lines, index) => lines.slice(offsets[index], offsets[index] + take));
      const usedLineCount = Math.max(1, ...fragmentLines.map((lines) => lines.length));
      const rowHeight = Math.max(minimumRowHeight, usedLineCount * lineHeight + 8);

      drawRowFragment(issue, rowIndex, fragmentLines, rowHeight, firstFragment);
      fragmentLines.forEach((lines, index) => {
        offsets[index] += lines.length;
      });
      firstFragment = false;
      if (offsets.some((offset, index) => offset < allLines[index].length)) addPage();
    }
  });

  if (!rows.length) {
    page.drawRectangle({ x: margin, y: y - 44, width: contentWidth, height: 44, color: alternate, borderColor: border, borderWidth: 0.45 });
    page.drawText('No submitted entries are assigned to this deliverable.', { x: margin + 8, y: y - 25, size: 8, font, color: muted });
  }

  createdPages.forEach((target, index) => {
    const footerText = `ScopeLogic LLC | Confidential | ${safe(project.name)} | ${config.title} | Page ${index + 1} of ${createdPages.length}`;
    target.drawLine({ start: { x: margin, y: footerY + 10 }, end: { x: target.getWidth() - margin, y: footerY + 10 }, thickness: 0.35, color: border });
    const footerFit = fitText(footerText, font, 6.25, target.getWidth() - margin * 2, 5);
    target.drawText(footerFit.text, { x: margin, y: footerY, size: footerFit.size, font, color: muted });
  });

  if (form) form.updateFieldAppearances(font);
}

export async function buildPdfBytes(kind: PdfKind, project: PdfProject, issues: PdfIssue[]) {
  const document = await PDFDocument.create();
  const brand = await embedBrand(document, await loadBrandAssets());
  await appendDeliverable(document, kind, project, issues, brand, kind);
  return document.save();
}

export async function buildReleasePackageBytes(project: PdfProject, issues: PdfIssue[], selectedKinds: PdfKind[] = ['sow', 'clarifications', 'rfi', 'checklist', 'snippets'], releaseNotes = '') {
  const output = await PDFDocument.create();
  const font = await output.embedFont(StandardFonts.Helvetica);
  const bold = await output.embedFont(StandardFonts.HelveticaBold);
  const brand = await embedBrand(output, await loadBrandAssets());
  const page = output.addPage([612, 792]);
  const { width, height } = page.getSize();
  const green = rgb(0.14, 0.19, 0.09);
  const mediumGreen = rgb(0.28, 0.36, 0.14);
  const lightGreen = rgb(0.95, 0.97, 0.93);
  const muted = rgb(0.35, 0.4, 0.35);
  const black = rgb(0.08, 0.1, 0.08);

  const logoSize = brand.full.scaleToFit(360, 250);
  page.drawImage(brand.full, {
    x: (width - logoSize.width) / 2,
    y: height - 300,
    width: logoSize.width,
    height: logoSize.height,
  });
  page.drawLine({ start: { x: 48, y: height - 325 }, end: { x: width - 48, y: height - 325 }, thickness: 2.2, color: green });
  page.drawText('OFFICIAL DELIVERABLE RELEASE', { x: 48, y: height - 365, size: 11, font: bold, color: mediumGreen });
  const projectFit = fitText(project.name || 'ScopeLogic Project', bold, 24, width - 96, 15);
  page.drawText(projectFit.text, { x: 48, y: height - 405, size: projectFit.size, font: bold, color: black });
  const clientFit = fitText(project.client || 'GC / Client not entered', font, 12, width - 96, 8);
  page.drawText(clientFit.text, { x: 48, y: height - 433, size: clientFit.size, font, color: muted });

  page.drawRectangle({ x: 48, y: height - 545, width: width - 96, height: 82, color: lightGreen, borderColor: mediumGreen, borderWidth: 0.6 });
  page.drawText('DOCUMENT REVISION', { x: 64, y: height - 490, size: 7, font: bold, color: muted });
  page.drawText(project.revision || 'Rev 0', { x: 64, y: height - 520, size: 18, font: bold, color: black });
  page.drawText('VERSION DATE', { x: 310, y: height - 490, size: 7, font: bold, color: muted });
  page.drawText(project.versionDate || 'Not set', { x: 310, y: height - 520, size: 13, font: bold, color: black });

  page.drawText('Included Deliverables', { x: 48, y: height - 585, size: 12, font: bold, color: black });
  const titles = selectedKinds.map((kind) => configFor(kind).title);
  titles.forEach((title, index) => {
    const itemY = height - 616 - index * 25;
    page.drawRectangle({ x: 50, y: itemY - 3, width: 9, height: 9, color: mediumGreen });
    const titleFit = fitText(title, font, 9, 220, 7);
    page.drawText(titleFit.text, { x: 70, y: itemY, size: titleFit.size, font, color: black });
  });
  if (safe(releaseNotes).trim()) {
    const noteX = 332;
    const noteTop = height - 585;
    page.drawText('Release Note', { x: noteX, y: noteTop, size: 8, font: bold, color: mediumGreen });
    const noteLines = wrapText(releaseNotes, width - noteX - 48, font, 8).slice(0, 10);
    drawWrapped(page, noteLines, noteX, noteTop - 17, font, 8, 11, black);
  }
  page.drawLine({ start: { x: 48, y: 62 }, end: { x: width - 48, y: 62 }, thickness: 0.5, color: mediumGreen });
  page.drawText('Prepared by ScopeLogic LLC | Confidential', { x: 48, y: 42, size: 7, font, color: muted });

  for (const kind of selectedKinds) {
    await appendDeliverable(output, kind, project, issues, brand, `release_${kind}`);
  }
  return output.save();
}
