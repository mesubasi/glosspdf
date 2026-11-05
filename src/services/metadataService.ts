import { PDFDict, PDFHexString, PDFName, PDFRawStream, PDFRef, decodePDFRawStream } from 'pdf-lib';
import type { PDFDocument } from 'pdf-lib';
import type { DocMetadata } from '../types/pdf';

// Yalnızca pdf-lib ve tiplere bağlı kalır: node --experimental-strip-types ile doğrudan test edilebilir.

const NS_DC = 'http://purl.org/dc/elements/1.1/';
const NS_PDF = 'http://ns.adobe.com/pdf/1.3/';
const NS_XMP = 'http://ns.adobe.com/xap/1.0/';

// rdf:Description açılış etiketi; tırnak içindeki '>' etiketi bitirmez
const DESC_TAG = /<rdf:Description\b(?:[^>"']|"[^"]*"|'[^']*')*>/g;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// XML 1.0'da geçersiz kontrol karakterleri paketi bozmasın diye atılır
const escapeXml = (s: string) =>
  s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** Başlık/Yazar/Konu/Anahtar kelimeleri Info sözlüğüne ve varsa XMP'ye yazar. */
export function writeMetadata(doc: PDFDocument, metadata: DocMetadata): void {
  const { context } = doc;
  const existing = context.lookup(context.trailerInfo.Info);
  const info = existing instanceof PDFDict ? existing : context.obj({});
  if (info !== existing) context.trailerInfo.Info = context.register(info);
  const fields: [string, string][] = [
    ['Title', metadata.title],
    ['Author', metadata.author],
    ['Subject', metadata.subject],
    ['Keywords', metadata.keywords]
  ];
  for (const [key, value] of fields) {
    if (value) info.set(PDFName.of(key), PDFHexString.fromText(value));
    else info.delete(PDFName.of(key));
  }

  // XMP yazılamazsa Info yine de kaydedilir
  try {
    writeXmp(doc, metadata);
  } catch (err) {
    console.warn('XMP metadata not updated:', err);
  }
}

/** Acrobat XMP'yi Info'ya tercih eder: aynı alanlar kataloğun /Metadata paketinde de güncellenir */
function writeXmp(doc: PDFDocument, metadata: DocMetadata): void {
  const { context, catalog } = doc;
  const entry = catalog.get(PDFName.of('Metadata'));
  const stream = context.lookup(entry);
  if (!(stream instanceof PDFRawStream)) return;
  const packet = new TextDecoder('utf-8', { fatal: true }).decode(decodePDFRawStream(stream).decode());
  const updated = editPacket(packet, metadata, new Date().toISOString());
  if (!updated) return;
  const newStream = context.stream(new TextEncoder().encode(updated), { Type: 'Metadata', Subtype: 'XML' });
  if (entry instanceof PDFRef) context.assign(entry, newStream);
  else catalog.set(PDFName.of('Metadata'), context.register(newStream));
}

/**
 * Özelliklerin eski hâllerini (eleman ve öznitelik biçimi) siler, yenilerini ilk rdf:Description'a
 * eleman olarak ekler. Paket güvenle anlaşılamıyorsa undefined döner ve XMP'ye dokunulmaz.
 * shortcut: XML ayrıştırıcısı yerine düzenli ifade; yalnızca bu yedi düz özellik için yeterli.
 */
function editPacket(xml: string, m: DocMetadata, now: string): string | undefined {
  if (!/<rdf:RDF[\s>]/.test(xml) || !/<\/rdf:RDF\s*>/.test(xml)) return undefined;
  const descTags = xml.match(DESC_TAG) ?? [];
  const openCount = descTags.filter((tag) => !tag.endsWith('/>')).length;
  if (descTags.length === 0 || openCount !== (xml.match(/<\/rdf:Description\s*>/g) ?? []).length) return undefined;

  const alt = (v: string) => `<rdf:Alt><rdf:li xml:lang="x-default">${v}</rdf:li></rdf:Alt>`;
  const plain = (v: string) => v;
  const props: [string, string, string, string, (v: string) => string][] = [
    [NS_DC, 'dc', 'title', m.title, alt],
    [NS_DC, 'dc', 'creator', m.author, (v) => `<rdf:Seq><rdf:li>${v}</rdf:li></rdf:Seq>`],
    [NS_DC, 'dc', 'description', m.subject, alt],
    [NS_PDF, 'pdf', 'Keywords', m.keywords, plain],
    [NS_PDF, 'pdf', 'Producer', 'GlossPDF', plain],
    [NS_XMP, 'xmp', 'ModifyDate', now, plain],
    [NS_XMP, 'xmp', 'MetadataDate', now, plain]
  ];

  let added = '';
  const declare = new Map<string, string>();
  for (const [ns, fallbackPrefix, local, value, wrap] of props) {
    // Eski paketler aynı ad alanı için farklı önek kullanabilir (ör. xmp yerine xap)
    const declared = xml.match(new RegExp(`xmlns:([\\w.-]+)\\s*=\\s*["']${escapeRegExp(ns)}["']`));
    const prefix = declared?.[1] ?? fallbackPrefix;
    const name = escapeRegExp(`${prefix}:${local}`);
    xml = xml
      .replace(new RegExp(`<${name}(?=[\\s/>])(?:[^>"']|"[^"]*"|'[^']*')*?(?:/>|>[\\s\\S]*?</${name}\\s*>)`, 'g'), '')
      .replace(DESC_TAG, (tag) => tag.replace(new RegExp(`\\s${name}\\s*=\\s*(?:"[^"]*"|'[^']*')`, 'g'), ''));
    // Kapanmamış bir eleman kaldıysa paket bozuktur
    if (new RegExp(`<${name}[\\s/>]`).test(xml)) return undefined;
    if (value) {
      added += `<${prefix}:${local}>${wrap(escapeXml(value))}</${prefix}:${local}>`;
      declare.set(prefix, ns);
    }
  }

  const first = new RegExp(DESC_TAG.source).exec(xml);
  if (!first) return undefined;
  const end = first.index + first[0].length;
  // Önek ilk Description'da ya da atalarında tanımlı değilse burada tanımlanır
  const inScope = xml.slice(0, end);
  let decls = '';
  for (const [prefix, ns] of declare) {
    if (!new RegExp(`xmlns:${escapeRegExp(prefix)}\\s*=`).test(inScope)) decls += ` xmlns:${prefix}="${ns}"`;
  }
  const tag = first[0];
  const selfClosing = tag.endsWith('/>');
  const open = (selfClosing ? tag.slice(0, -2).trimEnd() : tag.slice(0, -1)) + decls + '>';
  return xml.slice(0, first.index) + open + added + (selfClosing ? '</rdf:Description>' : '') + xml.slice(end);
}
