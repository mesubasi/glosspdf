# GlossPDF 📄✨
> **Sleek, modern, and open-source desktop PDF workstation.**  
> *A bloat-free, local-first, privacy-respecting desktop application.*

---

## 🌟 Overview

**GlossPDF** is an advanced desktop PDF viewer and editor built from scratch adhering to the official **ISO 32000** standard. It delivers a fast, distraction-free desktop experience with zero telemetry, local processing, and instant startup times.

---

## ✨ Features

### 📖 1. High-Performance Viewing & Navigation
- **Virtual Page Rendering:** Fast scrolling through documents of 1,000+ pages without memory bloat.
- **Accurate Zoom Engine:** 15 discrete zoom steps from **8.33% up to 6400%**, plus instant **Fit Page** and **Fit Width** modes.
- **Multi-Tab Interface:** Seamlessly work on multiple documents side by side.
- **Document Navigation:** Page thumbnails, interactive bookmarks outline, and full-text search with match highlighting.

### ✏️ 2. Annotations & Markups (ISO 32000 Standard)
- **Text Markups:** Highlight, underline, and strikeout with automatic text bounding box detection.
- **Sticky Notes / Comments:** Add comments anywhere; view and manage them in the dedicated Comments sidebar.
- **Freehand Pen (Ink):** Smooth pen drawing and vector ink annotations.
- **Shapes & Text Boxes:** Draw rectangles or insert standalone formatted text.
- **Full Interoperability:** Annotations are written as authentic `/Highlight`, `/Underline`, `/StrikeOut`, `/Text`, and `/Ink` dictionaries readable by all standard PDF viewers.
- **Undo / Redo:** Full history tracking (`Ctrl+Z` / `Ctrl+Y`).

### 📑 3. Page Management (Organize Pages)
- **Visual Page Grid:** Inspect all pages as thumbnail cards.
- **Reorder & Rotate:** Drag or use arrow controls to reorder pages; rotate 90° clockwise/counter-clockwise.
- **Delete & Insert:** Remove unwanted pages or insert blank pages.
- **Extract Pages:** Save selected pages as independent PDF files.

### 🔄 4. Merge & Split
- **Merge PDFs:** Combine multiple PDF documents into a single file with custom ordering.
- **Split PDF:** Extract every page individually or define custom page ranges (e.g., `1-3, 4-8`).

### 🖋️ 5. Signatures, Stamps & Watermarks
- **Handwritten Signature:** Draw your wet signature on an interactive canvas and place it precisely on any page.
- **Official Stamps:** Predefined stamps (e.g., *APPROVED*, *CONFIDENTIAL*, *DRAFT*, *REJECTED*) with automated dates.
- **Diagonal Watermarks:** Semi-transparent text watermarks with customizable opacity, color, and size.

### 🛡️ 6. Privacy & System Language
- **100% Local-First:** All operations execute locally on your machine. Zero cloud dependency, zero telemetry.
- **Automatic System Language Detection:** Automatically starts in your OS language (English / Turkish) with single-click manual toggle.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/)

### Installation & Development

```bash
# Clone the repository
git clone https://github.com/mesubasi/glosspdf.git

# Enter project directory
cd glosspdf

# Install dependencies
npm install

# Start in development mode
npm run dev
```

---

## 📦 Packaging & Building Installers

To create standalone Windows binaries and installers:

```bash
# Type check, bundle Vite and package with electron-builder
npm run build
```

This generates:
- **Windows NSIS Installer (`.exe`):**  
  `release/GlossPDF Setup 1.0.0.exe`
- **Portable Unpacked Application:**  
  `release/win-unpacked/GlossPDF.exe`

---

## 🛠️ Technology Stack

- **Runtime & Desktop:** Electron 29 (`contextIsolation: true`, `nodeIntegration: false`)
- **Frontend:** React 18 + TypeScript + Vite 5 + Tailwind CSS
- **State Management:** Zustand
- **PDF Rendering:** `pdfjs-dist` (Apache 2.0)
- **PDF Engine & ISO 32000 Manipulation:** `pdf-lib` (MIT)
- **Packaging:** `electron-builder`

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
