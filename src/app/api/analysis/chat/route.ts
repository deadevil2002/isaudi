import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db/service';
import { getCurrentUser } from '@/lib/auth/utils';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { message } = await req.json();

    if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 });

    // Check limits
    if (user.plan === 'free' && (user.freeReportsUsed || 0) >= 2) {
      return NextResponse.json({ error: 'Free limit reached. Upgrade to continue.' }, { status: 403 });
    }

    // Get Report Context
    const latestReport = await dbService.getLatestReport(user.id);
    if (!latestReport) {
      return NextResponse.json({ error: 'No report found. Please generate an analysis first.' }, { status: 404 });
    }

    const context = JSON.parse(latestReport.reportJson);

    // Prepare System Prompt with Context
    const systemPrompt = `
      You are a helpful Saudi ecommerce assistant.
      You have access to the following analysis report of the user's store:
      ${JSON.stringify(context)}
      
      Answer the user's questions based on this report.
      Speak in professional but friendly Arabic.
      Keep answers concise and actionable.
    `;

    if (process.env.OPENAI_API_KEY) {
       try {
         const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
              model: 'gpt-4-turbo-preview',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message }
              ],
              temperature: 0.7,
              max_tokens: 500
            })
         });
         
         if (!response.ok) {
           throw new Error('OpenAI API Failed');
         }

         const data = await response.json();
         const reply = data.choices[0].message.content;
         
         return NextResponse.json({ reply });
       } catch (error) {
         console.error('Chat API Error:', error);
         // Fallback
         return NextResponse.json({ reply: "عذراً، أواجه مشكلة في الاتصال بالخدمة الذكية حالياً. يرجى المحاولة لاحقاً." });
       }
    } else {
       // Mock response for dev
       const topNames = (context.top_products || []).map((p: any) => typeof p === 'string' ? p : (p.name || p.sku || 'منتج')).join(', ');
       return NextResponse.json({ 
         reply: `[رد تجريبي] بناءً على التقرير، أرى أن أفضل منتجاتك هي: ${topNames}. هل تود معرفة كيفية زيادة مبيعاتها؟` 
       });
    }

  } catch (error) {
    console.error('Chat Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
