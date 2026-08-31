'use strict';

function decodeXmlEntities(value) {
  return String(value || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractLocalTagTexts(xml, localName) {
  const tag = escapeRegex(localName);
  const regex = new RegExp(`<(?:(?:[A-Za-z_][\\w.-]*):)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:(?:[A-Za-z_][\\w.-]*):)?${tag}>`, 'gi');
  const out = [];
  let match;
  while ((match = regex.exec(String(xml || '')))) {
    out.push(decodeXmlEntities(match[1].replace(/<[^>]+>/g, '')));
  }
  return out;
}

function extractElements(xml, localName) {
  const tag = escapeRegex(localName);
  const regex = new RegExp(`<(?:(?:[A-Za-z_][\\w.-]*):)?${tag}\\b([^>]*)>([\\s\\S]*?)<\\/(?:(?:[A-Za-z_][\\w.-]*):)?${tag}>`, 'gi');
  const out = [];
  let match;
  while ((match = regex.exec(String(xml || '')))) out.push({ attributes: match[1] || '', innerXml: match[2] || '' });
  return out;
}

function attributeValue(attributes, name) {
  const escaped = escapeRegex(name);
  const regex = new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i');
  const match = regex.exec(String(attributes || ''));
  return match ? decodeXmlEntities(match[1] !== undefined ? match[1] : match[2]) : null;
}

function textOfFirstLocalTag(xml, localName) {
  const values = extractLocalTagTexts(xml, localName);
  return values.length ? values[0] : null;
}

module.exports = { decodeXmlEntities, extractLocalTagTexts, extractElements, attributeValue, textOfFirstLocalTag };
