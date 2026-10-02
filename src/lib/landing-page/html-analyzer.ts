import type { SafeStorefrontDocument } from './safe-fetch';
import {
  LANDING_PAGE_ANALYZER_VERSION,
  type LandingFinding,
  type LandingFindingConfidence,
  type LandingFindingSeverity,
  type LandingPageAnalysisResult,
  type LandingPageEvidencePack,
} from './types';

type Attributes = Record<string, string>;

const CTA_PATTERN = /(?:buy|shop|order|book|subscribe|start|contact|add to cart|checkout|اشتر|تسوق|اطلب|احجز|ابدأ|تواصل|أضف للسلة|الدفع)/i;
const WEAK_CTA_PATTERN = /^(?:click here|learn more|more|details|اضغط هنا|اعرف المزيد|المزيد|التفاصيل)$/i;

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity: string) => {
    if (entity[0] === '#') {
      const hex = entity[1]?.toLowerCase() === 'x';
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code) : '';
    }
    return named[entity.toLowerCase()] ?? '';
  });
}

function cleanText(value: string, max = 300): string {
  return decodeEntities(value.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function visibleHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]+\b(?:hidden|aria-hidden\s*=\s*["']?true|style\s*=\s*["'][^"']*display\s*:\s*none)[^>]*>[\s\S]*?<\/[^>]+>/gi, ' ');
}

function parseAttributes(raw: string): Attributes {
  const result: Attributes = Object.create(null) as Attributes;
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const match of raw.matchAll(pattern)) {
    const name = match[1].toLowerCase();
    if (name === '<' || name.startsWith('<')) continue;
    result[name] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return result;
}

function firstMeta(html: string, selector: (attrs: Attributes) => boolean): string | null {
  for (const match of html.matchAll(/<meta\b([^>]*)>/gi)) {
    const attrs = parseAttributes(match[1]);
    if (selector(attrs)) return cleanText(attrs.content ?? '', 500) || null;
  }
  return null;
}

function firstLink(html: string, rel: string): string | null {
  for (const match of html.matchAll(/<link\b([^>]*)>/gi)) {
    const attrs = parseAttributes(match[1]);
    if ((attrs.rel ?? '').toLowerCase().split(/\s+/).includes(rel)) {
      return (attrs.href ?? '').trim().slice(0, 500) || null;
    }
  }
  return null;
}

function regionForIndex(htmlLength: number, index: number): string {
  if (index <= htmlLength / 3) return 'document_first_third';
  if (index >= (htmlLength * 2) / 3) return 'document_last_third';
  return 'document_middle';
}

function hrefEvidence(href: string | undefined, baseUrl: string): string | null {
  if (!href || href.startsWith('#')) return href?.slice(0, 200) ?? null;
  try {
    const parsed = new URL(href, baseUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    parsed.username = '';
    parsed.password = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.origin === new URL(baseUrl).origin
      ? parsed.pathname.slice(0, 300)
      : parsed.origin.slice(0, 300);
  } catch {
    return null;
  }
}

function keywordSignals(text: string, entries: Array<[string, RegExp]>): string[] {
  return entries.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}

function finding(
  findingCode: string,
  title: string,
  description: string,
  evidence: LandingFinding['evidence'],
  potentialImpact: string,
  recommendation: string,
  confidence: LandingFindingConfidence,
  severity: LandingFindingSeverity,
  eligibleServiceCategories: string[]
): LandingFinding {
  return {
    findingCode,
    title,
    description,
    evidence,
    potentialImpact,
    recommendation,
    confidence,
    severity,
    source: 'deterministic',
    analyzerVersion: LANDING_PAGE_ANALYZER_VERSION,
    eligibleServiceCategories,
  };
}

export function analyzeStorefrontHtml(
  document: SafeStorefrontDocument,
  input: { id: string; userId: string; merchantId: string; analyzedAt: number }
): LandingPageAnalysisResult {
  const startedAt = Date.now();
  const html = document.html.slice(0, 1024 * 1024);
  const visible = visibleHtml(html);
  const visibleText = cleanText(visible, 20_000);
  const title = cleanText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1] ?? '', 300) || null;
  const description = firstMeta(html, (attrs) => (attrs.name ?? '').toLowerCase() === 'description');
  const robots = firstMeta(html, (attrs) => (attrs.name ?? '').toLowerCase() === 'robots');
  const canonical = firstLink(html, 'canonical');
  const language = html.match(/<html\b([^>]*)>/i)
    ? parseAttributes(html.match(/<html\b([^>]*)>/i)![1]).lang?.slice(0, 20) ?? null
    : null;

  const headings = Array.from(html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi))
    .map((match) => ({ level: Number(match[1]), text: cleanText(match[2], 300) }));
  const h1Count = headings.filter((item) => item.level === 1).length;
  const h1Text = headings.filter((item) => item.level === 1 && item.text).map((item) => item.text).slice(0, 5);
  let hierarchySkips = 0;
  for (let index = 1; index < headings.length; index += 1) {
    if (headings[index].level > headings[index - 1].level + 1) hierarchySkips += 1;
  }

  const ctaItems: LandingPageEvidencePack['cta']['items'] = [];
  for (const match of html.matchAll(/<(a|button)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi)) {
    const attrs = parseAttributes(match[2]);
    const text = cleanText(match[3], 160);
    if (!text || !(CTA_PATTERN.test(text) || match[1].toLowerCase() === 'button')) continue;
    ctaItems.push({
      text,
      href: hrefEvidence(attrs.href, document.finalUrl),
      location: regionForIndex(html.length, match.index ?? 0),
    });
    if (ctaItems.length >= 20) break;
  }
  const distinctCtaText = new Set(ctaItems.map((item) => item.text.toLowerCase()));

  const firstParagraph = cleanText(html.match(/<p\b[^>]*>([\s\S]*?)<\/p\s*>/i)?.[1] ?? '', 400) || null;
  const textLower = visibleText.toLowerCase();
  const trustSignals = keywordSignals(textLower, [
    ['secure_payment', /secure payment|دفع آمن|مدفوعات آمنة/i],
    ['guarantee', /guarantee|warranty|ضمان/i],
    ['verified', /verified|موثق|معروف/i],
  ]);
  const contactSignals = keywordSignals(textLower, [
    ['contact', /contact|تواصل|اتصل بنا/i],
    ['whatsapp', /whatsapp|واتساب/i],
  ]);
  const shippingSignals = keywordSignals(textLower, [['shipping', /shipping|delivery|شحن|توصيل/i]]);
  const returnsSignals = keywordSignals(textLower, [['returns', /returns?|refund|استرجاع|استبدال/i]]);
  const paymentSignals = keywordSignals(textLower, [['payment', /payment|visa|mada|apple pay|دفع|مدى/i]]);
  const reviewSignals = keywordSignals(textLower, [['reviews', /reviews?|ratings?|تقييم|آراء العملاء/i]]);
  const valuePropositionSignals = keywordSignals(textLower, [
    ['benefit', /save|faster|easy|quality|وفر|أسرع|سهولة|جودة/i],
    ['offer', /free|discount|exclusive|مجاني|خصم|حصري/i],
  ]).length;
  const productSignals = (visibleText.match(/product|item|منتج|سلعة/gi) ?? []).length;
  const categorySignals = (visibleText.match(/categor(?:y|ies)|collection|قسم|تصنيف|مجموعة/gi) ?? []).length;

  const images = Array.from(html.matchAll(/<img\b([^>]*)>/gi)).map((match) => parseAttributes(match[1]));
  const missingAlt = images.filter((attrs) => !('alt' in attrs) || !attrs.alt.trim()).length;
  const obviousBroken = images.filter((attrs) =>
    !attrs.src || attrs.src.trim() === '#' || /^javascript:/i.test(attrs.src)
  ).length;
  const largeDimensionIndicators = images.filter((attrs) =>
    Number(attrs.width) > 1600 || Number(attrs.height) > 1600
  ).length;

  const viewport = firstMeta(html, (attrs) => (attrs.name ?? '').toLowerCase() === 'viewport');
  const fixedWidthOverflowRisks = Array.from(html.matchAll(/(?:min-width|width)\s*:\s*(\d{3,5})px/gi))
    .filter((match) => Number(match[1]) > 390).length;

  const labels = new Set(
    Array.from(html.matchAll(/<label\b([^>]*)>/gi))
      .map((match) => parseAttributes(match[1]).for)
      .filter(Boolean)
  );
  const controls = Array.from(html.matchAll(/<(input|select|textarea)\b([^>]*)>/gi))
    .map((match) => parseAttributes(match[2]));
  const unlabeledFormControls = controls.filter((attrs) => {
    const type = (attrs.type ?? '').toLowerCase();
    if (['hidden', 'submit', 'button', 'reset'].includes(type)) return false;
    return !attrs['aria-label'] && !attrs['aria-labelledby'] && !(attrs.id && labels.has(attrs.id));
  }).length;
  const buttonLikeNonSemanticElements = Array.from(
    html.matchAll(/<(div|span)\b([^>]*)>/gi)
  ).filter((match) => (parseAttributes(match[2]).role ?? '').toLowerCase() === 'button').length;

  const resourceCount = Array.from(html.matchAll(/<(?:img|script|link)\b/gi)).length;
  const blockingScriptCount = Array.from(html.matchAll(/<script\b([^>]*)>/gi))
    .map((match) => parseAttributes(match[1]))
    .filter((attrs) => attrs.src && !('async' in attrs) && !('defer' in attrs) && attrs.type !== 'module').length;
  const scriptCount = Array.from(html.matchAll(/<script\b/gi)).length;
  const jsRequiresRendering = visibleText.length < 80 && scriptCount > 0;
  const suspiciousInstructionSignals = (
    visibleText.match(/ignore (?:all |the )?(?:previous|prior) instructions|reveal (?:the )?system prompt|api[_ -]?key|تجاهل التعليمات|اكشف موجه النظام/gi) ?? []
  ).length;

  const evidence: LandingPageEvidencePack = {
    page: {
      httpStatus: document.httpStatus,
      https: true,
      title,
      description,
      canonical,
      indexability: robots == null ? 'unknown' : /\bnoindex\b/i.test(robots) ? 'noindex' : 'indexable',
      language,
    },
    headings: { h1Count, h1Text, hierarchySkips },
    hero: {
      headline: h1Text[0] ?? null,
      supportingText: firstParagraph,
      ctaPresent: ctaItems.some((item) => item.location === 'document_first_third'),
    },
    cta: { count: ctaItems.length, distinctTextCount: distinctCtaText.size, items: ctaItems },
    content: {
      visibleTextLength: visibleText.length,
      valuePropositionSignals,
      productSignals,
      categorySignals,
      trustSignals,
      contactSignals,
      shippingSignals,
      returnsSignals,
      paymentSignals,
      reviewSignals,
      businessType: 'unknown',
    },
    images: { count: images.length, missingAlt, obviousBroken, largeDimensionIndicators },
    mobile: {
      viewportConfigured: Boolean(viewport && /width\s*=\s*device-width/i.test(viewport)),
      fixedWidthOverflowRisks,
      ctaVisibility: 'unavailable_without_rendering',
      navigationAssessment: 'unavailable_without_rendering',
      exact390x844Measured: false,
      reason: 'browser_rendering_not_used',
    },
    accessibility: { unlabeledFormControls, buttonLikeNonSemanticElements },
    performance: { resourceCount, blockingScriptCount, measuredCoreWebVitals: false },
    rendering: {
      used: false,
      required: jsRequiresRendering,
      reason: jsRequiresRendering ? 'javascript_content_requires_rendering' : 'deterministic_html_sufficient',
    },
    promptInjection: { treatedAsData: true, suspiciousInstructionSignals },
  };

  const findings: LandingFinding[] = [];
  const sufficient = !jsRequiresRendering && visibleText.length >= 80;
  if (sufficient) {
    if (!title) findings.push(finding(
      'landing.seo.title_missing.v1', 'Page title is missing',
      'The fetched storefront HTML does not include a usable title element.',
      [{ signal: 'page.title', observed: false, expected: 'A concise, descriptive title' }],
      'Search previews and browser context may be less clear.',
      'Add a concise title that identifies the store and primary offer.', 'high', 'medium', ['seo_optimization']
    ));
    if (!description) findings.push(finding(
      'landing.seo.description_missing.v1', 'Meta description is missing',
      'No usable meta description was detected in the fetched HTML.',
      [{ signal: 'page.description', observed: false, expected: 'A relevant meta description' }],
      'Search result messaging may be less informative.',
      'Add a specific description of the store value and main offer.', 'high', 'low', ['seo_optimization', 'content_optimization']
    ));
    if (evidence.page.indexability === 'noindex') findings.push(finding(
      'landing.seo.noindex.v1', 'Landing page is marked noindex',
      'The robots metadata explicitly asks search engines not to index this page.',
      [{ signal: 'page.indexability', observed: 'noindex', expected: 'indexable when organic discovery is intended' }],
      'The page may be excluded from organic search results.',
      'Confirm this is intentional; otherwise remove the noindex directive.', 'high', 'high', ['seo_optimization']
    ));
    if (evidence.headings.h1Count === 0) findings.push(finding(
      'landing.heading.h1_missing.v1', 'Primary heading is missing',
      'No visible H1 was detected in the server-delivered HTML.',
      [{ signal: 'headings.h1Count', observed: 0, expected: '1' }],
      'Visitors may need more effort to understand the primary offer.',
      'Add one descriptive H1 that communicates the main offer.', 'high', 'high', ['content_optimization', 'landing_page_optimization']
    ));
    if (evidence.headings.h1Count > 1) findings.push(finding(
      'landing.heading.multiple_h1.v1', 'Multiple primary headings detected',
      'The page contains more than one H1 in the fetched HTML.',
      [{ signal: 'headings.h1Count', observed: evidence.headings.h1Count, expected: '1 clear primary heading' }],
      'Competing primary headings may weaken content hierarchy.',
      'Keep one primary H1 and demote secondary section headings.', 'high', 'medium', ['content_optimization']
    ));
    if (evidence.cta.count === 0) findings.push(finding(
      'landing.cta.missing.v1', 'No clear call to action detected',
      'No action-oriented link or button was detected in the server-delivered HTML.',
      [{ signal: 'cta.count', observed: 0, expected: 'At least one clear primary action' }],
      'Visitors may not know the next step to take.',
      'Add a clear, specific primary action near the main offer.', 'high', 'high', ['landing_page_optimization', 'conversion_optimization']
    ));
    if (evidence.cta.count > 0 && evidence.cta.items.every((item) => WEAK_CTA_PATTERN.test(item.text))) {
      findings.push(finding(
        'landing.cta.weak_text.v1', 'Call-to-action wording is generic',
        'All detected calls to action use generic wording.',
        [{ signal: 'cta.text', observed: evidence.cta.items.map((item) => item.text).join(', '), expected: 'Specific action wording' }],
        'Generic labels may add uncertainty about what happens next.',
        'Use action text that names the intended outcome.', 'high', 'medium', ['conversion_copywriting']
      ));
    }
    if (evidence.cta.distinctTextCount > 4) findings.push(finding(
      'landing.cta.competing_actions.v1', 'Many competing calls to action detected',
      'The page exposes several distinct action labels.',
      [{ signal: 'cta.distinctTextCount', observed: evidence.cta.distinctTextCount, expected: 'A focused primary action hierarchy' }],
      'Several competing actions may increase decision friction.',
      'Prioritize one primary action and reduce or visually demote secondary actions.', 'medium', 'medium', ['landing_page_optimization', 'conversion_optimization']
    ));
    if (missingAlt > 0) findings.push(finding(
      'landing.accessibility.image_alt_missing.v1', 'Images are missing alternative text',
      'One or more image elements have no usable alt attribute.',
      [{ signal: 'images.missingAlt', observed: missingAlt, expected: 'Meaningful alt text or an explicit empty alt for decorative images' }],
      'Assistive-technology users may miss important image meaning.',
      'Add meaningful alt text and mark decorative images with alt="".', 'high', 'medium', ['accessibility_optimization']
    ));
    if (obviousBroken > 0) findings.push(finding(
      'landing.image.obvious_broken_source.v1', 'Image source is missing or invalid',
      'At least one image has an empty or obviously invalid source.',
      [{ signal: 'images.obviousBroken', observed: obviousBroken, expected: 0 }],
      'Broken imagery may reduce trust and obscure product information.',
      'Replace or remove image elements with invalid sources.', 'high', 'medium', ['landing_page_optimization']
    ));
    if (!evidence.mobile.viewportConfigured) findings.push(finding(
      'landing.mobile.viewport_missing.v1', 'Mobile viewport configuration is missing',
      'The fetched HTML does not declare a device-width viewport.',
      [{ signal: 'mobile.viewportConfigured', observed: false, expected: true }],
      'Mobile browsers may render the page at a desktop-style width.',
      'Add a responsive viewport meta tag.', 'high', 'high', ['mobile_optimization']
    ));
    if (fixedWidthOverflowRisks > 0) findings.push(finding(
      'landing.mobile.fixed_width_risk.v1', 'Fixed-width mobile overflow risk detected',
      'Inline styles contain widths greater than the 390px target viewport.',
      [{ signal: 'mobile.fixedWidthOverflowRisks', observed: fixedWidthOverflowRisks, expected: 0 }],
      'These elements may cause horizontal scrolling or clipping on narrow screens.',
      'Replace fixed widths with responsive constraints and verify at 390×844.', 'medium', 'medium', ['mobile_optimization', 'landing_page_optimization']
    ));
    const commerceContext = /product|shop|store|cart|منتج|متجر|سلة/i.test(visibleText);
    if (
      commerceContext &&
      trustSignals.length + shippingSignals.length + returnsSignals.length +
        paymentSignals.length + reviewSignals.length === 0
    ) findings.push(finding(
      'landing.trust.signals_absent.v1', 'No clear trust or policy signals detected',
      'The storefront text contains commerce context but no detectable trust, shipping, returns, payment, or review signals.',
      [{ signal: 'content.trustSignals', observed: 0, expected: 'Relevant trust or policy information' }],
      'Visitors may have unanswered questions before taking action.',
      'Surface the policies and trust information that are relevant to this business.', 'medium', 'low', ['content_optimization', 'landing_page_optimization']
    ));
    if (unlabeledFormControls > 0) findings.push(finding(
      'landing.accessibility.form_labels_missing.v1', 'Form controls lack detectable labels',
      'One or more form controls have no associated label or ARIA label.',
      [{ signal: 'accessibility.unlabeledFormControls', observed: unlabeledFormControls, expected: 0 }],
      'Users of assistive technology may not understand the requested input.',
      'Associate each control with a visible label or an appropriate ARIA label.', 'high', 'medium', ['accessibility_optimization']
    ));
  }

  const attention = (prefixes: string[]) => findings.some((item) =>
    prefixes.some((prefix) => item.findingCode.startsWith(prefix))
  );
  const status = sufficient ? 'succeeded' as const : 'insufficient_evidence' as const;
  return {
    id: input.id,
    userId: input.userId,
    merchantId: input.merchantId,
    storefrontOrigin: document.origin,
    finalUrl: document.finalUrl,
    contentHash: document.contentHash,
    analyzerVersion: LANDING_PAGE_ANALYZER_VERSION,
    analyzedAt: input.analyzedAt,
    status,
    cached: false,
    fetchDurationMs: document.fetchDurationMs,
    analysisDurationMs: Math.max(0, Date.now() - startedAt),
    evidence,
    findings,
    categories: {
      clarity: sufficient ? (attention(['landing.heading']) ? 'attention' : 'good') : 'insufficient_evidence',
      cta: sufficient ? (attention(['landing.cta']) ? 'attention' : 'good') : 'insufficient_evidence',
      trust: sufficient
        ? (attention(['landing.trust'])
            ? 'attention'
            : (trustSignals.length + shippingSignals.length + returnsSignals.length + paymentSignals.length + reviewSignals.length
                ? 'good' : 'unavailable'))
        : 'insufficient_evidence',
      mobile: jsRequiresRendering ? 'unavailable' : (attention(['landing.mobile']) ? 'attention' : 'unavailable'),
      seo: sufficient ? (attention(['landing.seo']) ? 'attention' : 'good') : 'insufficient_evidence',
      accessibility: sufficient ? (attention(['landing.accessibility']) ? 'attention' : 'good') : 'insufficient_evidence',
      performance: 'unavailable',
      contentHierarchy: sufficient ? (attention(['landing.heading']) ? 'attention' : 'good') : 'insufficient_evidence',
    },
    aiAssisted: false,
    browserRendered: false,
  };
}
