import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  type: 'generate_question' | 'evaluate_answer' | 'generate_feedback';
  jobRole: string;
  difficulty: string;
  interviewType: string;
  questionNumber?: number;
  totalQuestions?: number;
  previousQuestions?: string[];
  currentQuestion?: string;
  userAnswer?: string;
  allQA?: Array<{ question: string; answer: string; score: number }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const body: RequestBody = await req.json();
    const { type, jobRole, difficulty, interviewType, questionNumber, totalQuestions, previousQuestions, currentQuestion, userAnswer, allQA } = body;

    let systemPrompt = '';
    let userPrompt = '';

    if (type === 'generate_question') {
      systemPrompt = `You are an expert interviewer conducting a ${difficulty}-level ${interviewType} interview for a ${jobRole} position. 
      
Your role is to ask thoughtful, relevant interview questions that assess the candidate's skills and experience.

Guidelines:
- For technical interviews: Focus on problem-solving, coding concepts, system design, and technical knowledge relevant to the role
- For behavioral interviews: Use STAR method questions about past experiences, teamwork, leadership, and conflict resolution
- For case study interviews: Present business scenarios that require analytical thinking and structured problem-solving

Keep questions clear, focused, and appropriate for the ${difficulty} level.`;

      const prevQuestionsText = previousQuestions && previousQuestions.length > 0 
        ? `\n\nPrevious questions asked:\n${previousQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nAsk a different question that hasn't been covered yet.`
        : '';

      userPrompt = `Generate question ${questionNumber} of ${totalQuestions} for this ${interviewType} interview.${prevQuestionsText}

Provide ONLY the interview question, nothing else. No preamble, no explanation, just the question itself.`;

    } else if (type === 'evaluate_answer') {
      systemPrompt = `You are an expert interviewer evaluating answers for a ${difficulty}-level ${interviewType} interview for a ${jobRole} position.

Evaluate the candidate's answer based on:
- Relevance and completeness
- Technical accuracy (for technical questions)
- Communication clarity
- Use of specific examples (for behavioral questions)
- Problem-solving approach (for case studies)

Be constructive and specific in your feedback.`;

      userPrompt = `Question: ${currentQuestion}

Candidate's Answer: ${userAnswer}

Provide your evaluation in the following JSON format ONLY (no other text):
{
  "score": <number from 1-10>,
  "feedback": "<specific, constructive feedback in 2-3 sentences>"
}`;

    } else if (type === 'generate_feedback') {
      systemPrompt = `You are an expert career coach providing comprehensive interview feedback for a ${difficulty}-level ${interviewType} interview for a ${jobRole} position.

Provide actionable, encouraging feedback that helps the candidate improve.`;

      const qaText = allQA?.map((qa, i) => `
Q${i + 1}: ${qa.question}
A${i + 1}: ${qa.answer}
Score: ${qa.score}/10`).join('\n') || '';

      userPrompt = `Here is the complete interview:
${qaText}

Provide a comprehensive evaluation in the following JSON format ONLY (no other text):
{
  "overallScore": <number from 1-10, calculated as weighted average>,
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "improvements": ["<area 1>", "<area 2>", "<area 3>"],
  "summary": "<2-3 sentence overall assessment>"
}`;
    }

    console.log(`Processing ${type} request for ${jobRole} ${interviewType} interview`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add more credits.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    console.log(`Successfully processed ${type} request`);

    return new Response(JSON.stringify({ result: content }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in interview-ai function:', error);
    return new Response(JSON.stringify({ error: error.message || 'Unknown error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
