import { NextResponse } from 'next/server';

export async function POST(req) {
  const { questions, logicXML } = await req.json();
const prompt = `
You are a survey logic interpreter.

Given:
1. A list of survey questions in JSON format (with unique 'questionId' and 'label' properties).
2. Survey flow logic in XML format (includes rules, conditions, and goto actions).

Your Task:
- Analyze the XML rules and connect questions based on 'goto' logic.
- Return a valid JSON object with two arrays: 'nodes' and 'edges'.
- Each node should have 'id', 'data.label', and a dummy 'position' (x, y).
- Each edge should include 'id', 'source', 'target', and 'label'.

Output format example:
{
  "nodes": [
    { "id": "q1", "data": { "label": "Question 1" }, "position": { "x": 0, "y": 0 } }
  ],
  "edges": [
    { "id": "q1->q2", "source": "q1", "target": "q2", "label": "goto" }
  ]
}

Questions JSON:
${JSON.stringify(questions, null, 2)}

Logic XML:
${logicXML}
`;


  try {
const openaiRes = await fetch(`https://api.groq.com/openai/v1/chat/completions `, {
      method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.3
      })
    });

const result = await openaiRes.json();
console.log("Gemini API raw response:", JSON.stringify(result, null, 2));

// This is the line that might fail:
const rawContent = result.choices?.[0]?.message?.content;

if (!rawContent) {
  throw new Error('Gemini API did not return valid content.');
}

const parsed = JSON.parse(rawContent); // only happens if content exists

console.log(result);
    return NextResponse.json({ nodes: parsed.nodes || [], edges: parsed.edges || [] });
  } catch (error) {
    console.error('OpenAI API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch flow from AI' }, { status: 500 });
  }
}
