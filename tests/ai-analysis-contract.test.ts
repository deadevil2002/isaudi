import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AI_ANALYSIS_RESPONSE_FORMAT,
  insufficientAnalysisNarrative,
  parseAiAnalysisNarrative,
} from '../src/lib/ai/contracts';

const validAnalysis = {
  type: 'analysis',
  summary: 'المنتج الأعلى يحقق معظم الإيراد مع هامش واضح.',
  primary_problem: 'تركيز الإيراد مرتفع في منتج واحد.',
  why_it_matters: 'أي تراجع في المنتج الأعلى سيؤثر مباشرة على الإيراد.',
  evidence: ['المنتج أ حقق 700 ر.س من أصل 1000 ر.س.'],
  business_impact: 'المتجر معرض لتذبذب الإيراد.',
  priority_action: 'راجع توفر المنتج أ واستمرارية مخزونه أولاً.',
  conversion_insight: 'بيانات التحويل غير متاحة ولا يمكن استنتاجها من الطلبات.',
  pricing_suggestions: ['لا تغير السعر قبل توفر مقارنة أو إشارة هامش داعمة.'],
  growth_opportunities: ['اختبر توسيع توزيع المبيعات على المنتج ب.'],
  confidence: 'medium',
  insufficient_evidence: ['لا توجد فترة مقارنة.'],
};

test('strict generation contract requires every meaningful analysis field', () => {
  assert.equal(AI_ANALYSIS_RESPONSE_FORMAT.type, 'json_schema');
  assert.equal(AI_ANALYSIS_RESPONSE_FORMAT.json_schema.strict, true);
  const parsed = parseAiAnalysisNarrative(JSON.stringify(validAnalysis));
  assert.deepEqual(parsed, validAnalysis);
  assert.ok(parsed.summary.length > 0);
  assert.ok(parsed.conversion_insight.length > 0);
  assert.ok(parsed.pricing_suggestions.length > 0);
  assert.ok(parsed.growth_opportunities.length > 0);
});

test('generation contract rejects valid JSON with empty required fields', () => {
  assert.throws(
    () => parseAiAnalysisNarrative(JSON.stringify({ ...validAnalysis, summary: '' })),
    /Invalid AI field: summary/
  );
  assert.throws(
    () => parseAiAnalysisNarrative(JSON.stringify({
      ...validAnalysis,
      pricing_suggestions: [],
    })),
    /empty required recommendations/
  );
});

test('generation contract rejects invalid provider JSON', () => {
  assert.throws(() => parseAiAnalysisNarrative('{invalid'), SyntaxError);
});

test('insufficient evidence fallback is explicit and never generic filler', () => {
  const fallback = insufficientAnalysisNarrative('لا توجد فترة مقارنة.');
  assert.equal(fallback.type, 'insufficient_data');
  assert.equal(fallback.confidence, 'low');
  assert.deepEqual(fallback.insufficient_evidence, ['لا توجد فترة مقارنة.']);
  assert.deepEqual(fallback.pricing_suggestions, []);
  assert.deepEqual(fallback.growth_opportunities, []);
});
