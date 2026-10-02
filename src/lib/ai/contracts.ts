import type { OpenAIResponseFormat } from './openai-chat';

export type AiConfidence = 'low' | 'medium' | 'high';
export type AiAnalysisType = 'analysis' | 'insufficient_data';

export type AiAnalysisNarrative = {
  type: AiAnalysisType;
  summary: string;
  primary_problem: string;
  why_it_matters: string;
  evidence: string[];
  business_impact: string;
  priority_action: string;
  conversion_insight: string;
  pricing_suggestions: string[];
  growth_opportunities: string[];
  confidence: AiConfidence;
  insufficient_evidence: string[];
};

export type AiChatMetric = {
  label: string;
  value: string;
};

export type AiChatSection = {
  title: string;
  type: 'finding' | 'evidence' | 'metrics' | 'actions';
  content: string;
  metrics: AiChatMetric[];
  priority: 'high' | 'medium' | 'low' | 'none';
};

export type AiChatResponse = {
  type: 'answer' | 'analysis' | 'recommendation' | 'insufficient_data';
  summary: string;
  sections: AiChatSection[];
  confidence: {
    level: AiConfidence;
    reason: string;
  };
};

const stringArray = { type: 'array', items: { type: 'string' } } as const;

export const AI_ANALYSIS_RESPONSE_FORMAT: OpenAIResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'isaudi_store_analysis',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        type: { type: 'string', enum: ['analysis', 'insufficient_data'] },
        summary: { type: 'string' },
        primary_problem: { type: 'string' },
        why_it_matters: { type: 'string' },
        evidence: stringArray,
        business_impact: { type: 'string' },
        priority_action: { type: 'string' },
        conversion_insight: { type: 'string' },
        pricing_suggestions: stringArray,
        growth_opportunities: stringArray,
        confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        insufficient_evidence: stringArray,
      },
      required: [
        'type',
        'summary',
        'primary_problem',
        'why_it_matters',
        'evidence',
        'business_impact',
        'priority_action',
        'conversion_insight',
        'pricing_suggestions',
        'growth_opportunities',
        'confidence',
        'insufficient_evidence',
      ],
    },
  },
};

export const AI_CHAT_RESPONSE_FORMAT: OpenAIResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'isaudi_chat_response',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['answer', 'analysis', 'recommendation', 'insufficient_data'],
        },
        summary: { type: 'string' },
        sections: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              title: { type: 'string' },
              type: {
                type: 'string',
                enum: ['finding', 'evidence', 'metrics', 'actions'],
              },
              content: { type: 'string' },
              metrics: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    label: { type: 'string' },
                    value: { type: 'string' },
                  },
                  required: ['label', 'value'],
                },
              },
              priority: {
                type: 'string',
                enum: ['high', 'medium', 'low', 'none'],
              },
            },
            required: ['title', 'type', 'content', 'metrics', 'priority'],
          },
        },
        confidence: {
          type: 'object',
          additionalProperties: false,
          properties: {
            level: { type: 'string', enum: ['low', 'medium', 'high'] },
            reason: { type: 'string' },
          },
          required: ['level', 'reason'],
        },
      },
      required: ['type', 'summary', 'sections', 'confidence'],
    },
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid AI field: ${key}`);
  }
  return value.trim();
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error('Invalid AI string list');
  return value.map((item) => {
    if (typeof item !== 'string' || !item.trim()) {
      throw new Error('Invalid AI string list item');
    }
    return item.trim();
  });
}

export function parseAiAnalysisNarrative(content: string): AiAnalysisNarrative {
  const value: unknown = JSON.parse(content);
  if (!isRecord(value)) throw new Error('Invalid analysis response');
  const type = requiredString(value, 'type');
  const confidence = requiredString(value, 'confidence');
  if (type !== 'analysis' && type !== 'insufficient_data') {
    throw new Error('Invalid analysis type');
  }
  if (!['low', 'medium', 'high'].includes(confidence)) {
    throw new Error('Invalid analysis confidence');
  }

  const result: AiAnalysisNarrative = {
    type,
    summary: requiredString(value, 'summary'),
    primary_problem: requiredString(value, 'primary_problem'),
    why_it_matters: requiredString(value, 'why_it_matters'),
    evidence: strings(value.evidence),
    business_impact: requiredString(value, 'business_impact'),
    priority_action: requiredString(value, 'priority_action'),
    conversion_insight: requiredString(value, 'conversion_insight'),
    pricing_suggestions: strings(value.pricing_suggestions),
    growth_opportunities: strings(value.growth_opportunities),
    confidence: confidence as AiConfidence,
    insufficient_evidence: strings(value.insufficient_evidence),
  };
  if (result.type === 'analysis' && result.evidence.length === 0) {
    throw new Error('Analysis response has no evidence');
  }
  if (
    result.type === 'analysis' &&
    (result.pricing_suggestions.length === 0 ||
      result.growth_opportunities.length === 0)
  ) {
    throw new Error('Analysis response has empty required recommendations');
  }
  if (
    result.type === 'insufficient_data' &&
    result.insufficient_evidence.length === 0
  ) {
    throw new Error('Insufficient-data response has no reason');
  }
  return result;
}

export function insufficientAnalysisNarrative(reason: string): AiAnalysisNarrative {
  return {
    type: 'insufficient_data',
    summary: 'الأدلة المتاحة لا تكفي لإصدار تحليل موثوق.',
    primary_problem: 'لا يمكن تحديد المشكلة الأساسية من البيانات الحالية.',
    why_it_matters: 'أي استنتاج إضافي سيكون تخميناً غير مدعوم.',
    evidence: [],
    business_impact: 'تعذر قياس الأثر التجاري بدقة.',
    priority_action: 'أضف فترة مقارنة أو بيانات مكتملة قبل اتخاذ قرار تجاري.',
    conversion_insight: 'بيانات الزيارات والتحويل غير متاحة.',
    pricing_suggestions: [],
    growth_opportunities: [],
    confidence: 'low',
    insufficient_evidence: [reason],
  };
}

export function parseAiChatResponse(content: string): AiChatResponse {
  const value: unknown = JSON.parse(content);
  if (!isRecord(value)) throw new Error('Invalid chat response');
  const type = requiredString(value, 'type');
  if (!['answer', 'analysis', 'recommendation', 'insufficient_data'].includes(type)) {
    throw new Error('Invalid chat response type');
  }
  if (!Array.isArray(value.sections) || !isRecord(value.confidence)) {
    throw new Error('Invalid chat response structure');
  }
  const level = requiredString(value.confidence, 'level');
  if (!['low', 'medium', 'high'].includes(level)) {
    throw new Error('Invalid chat confidence');
  }
  const sections = value.sections.map((section) => {
    if (!isRecord(section) || !Array.isArray(section.metrics)) {
      throw new Error('Invalid chat section');
    }
    const sectionType = requiredString(section, 'type');
    const priority = requiredString(section, 'priority');
    if (!['finding', 'evidence', 'metrics', 'actions'].includes(sectionType)) {
      throw new Error('Invalid chat section type');
    }
    if (!['high', 'medium', 'low', 'none'].includes(priority)) {
      throw new Error('Invalid chat section priority');
    }
    const metrics = section.metrics.map((metric) => {
      if (!isRecord(metric)) throw new Error('Invalid chat metric');
      return {
        label: requiredString(metric, 'label'),
        value: requiredString(metric, 'value'),
      };
    });
    return {
      title: requiredString(section, 'title'),
      type: sectionType as AiChatSection['type'],
      content: requiredString(section, 'content'),
      metrics,
      priority: priority as AiChatSection['priority'],
    };
  });
  if (type !== 'answer' && sections.length === 0) {
    throw new Error('Structured chat response has no sections');
  }

  return {
    type: type as AiChatResponse['type'],
    summary: requiredString(value, 'summary'),
    sections,
    confidence: {
      level: level as AiConfidence,
      reason: requiredString(value.confidence, 'reason'),
    },
  };
}
