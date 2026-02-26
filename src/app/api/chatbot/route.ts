// src/app/api/chatbot/route.ts - FIXED: MULTIPLE FREE AI MODELS WITH FALLBACK SYSTEM
import { NextRequest, NextResponse } from 'next/server';
import { auth, authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

// FIXED: Proper TypeScript interfaces instead of any
interface ChatbotRequest {
  message: string;
  clientId: string;
  clientName: string;
  projectContext: ProjectContextData[];
}

interface ProjectContextData {
  title: string;
  status: string;
  progress: number;
  manager: string;
  timeline: string;
}

interface AIResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface ChatbotApiResponse {
  success: boolean;
  response?: string;
  error?: string;
}

// FIXED: Multiple free AI models for fallback system
const FREE_AI_MODELS = [
  {
    name: 'deepseek/deepseek-chat-v3-0324:free',
    description: 'DeepSeek Chat - Great for general conversation'
  },
  {
    name: 'meta-llama/llama-3.3-70b-instruct:free',
    description: 'Meta Llama 3.3 - Excellent instruction following'
  },
  {
    name: 'google/gemini-2.0-flash-exp:free',
    description: 'Google Gemini Flash - Fast and efficient'
  },
  {
    name: 'deepseek/deepseek-r1-distill-qwen-32b:free',
    description: 'DeepSeek R1 Distilled - Reasoning focused'
  },
  {
    name: 'nvidia/llama-3.1-nemotron-ultra-253b-v1:free',
    description: 'NVIDIA Nemotron - High quality responses'
  }
];

// FIXED: Proper project document interface
interface ProjectDocument {
  _id: ObjectId;
  title: string;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  progress: number;
  startDate?: Date;
  endDate?: Date;
  manager: {
    _id: ObjectId;
    name: string;
    email: string;
  };
  client: ObjectId;
}

// GET method for health check
export async function GET(): Promise<NextResponse<{ message: string; availableModels: typeof FREE_AI_MODELS }>> {
  return NextResponse.json({
    message: 'AI Chatbot API is running with fallback system.',
    availableModels: FREE_AI_MODELS
  });
}

// Main POST handler for chatbot requests
export async function POST(request: NextRequest): Promise<NextResponse<ChatbotApiResponse>> {
  try {
    const session = await auth();
    
    // Authentication check
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    // Role authorization - only clients can use AI chatbot
    if (session.user.role !== 'client') {
      return NextResponse.json({
        success: false,
        error: 'AI chatbot is only available for clients'
      }, { status: 403 });
    }

    // Parse and validate request body
    let body: ChatbotRequest;
    try {
      body = await request.json() as ChatbotRequest;
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return NextResponse.json({
        success: false,
        error: 'Invalid request format'
      }, { status: 400 });
    }

    const { message, clientId, clientName } = body;

    // Validate required fields
    if (!message?.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Message is required'
      }, { status: 400 });
    }

    if (clientId !== session.user.id) {
      return NextResponse.json({
        success: false,
        error: 'Client ID mismatch'
      }, { status: 403 });
    }

    // Get fresh project context from database for accuracy
    const freshProjectContext = await getFreshProjectContext(clientId);

    // Create system prompt with project context
    const systemPrompt = createSystemPrompt(clientName || session.user.name || 'Client', freshProjectContext);

    // Call AI API with fallback system
    const aiResponse = await callAIWithFallback(systemPrompt, message);

    // Log successful interaction (without sensitive data)
    console.log(`AI Chatbot: Successfully processed message for client ${clientId} using model: ${aiResponse.modelUsed}`);

    return NextResponse.json({
      success: true,
      response: aiResponse.response
    });

  } catch (error) {
    console.error('AI Chatbot Error:', error);
    
    // FIXED: Proper error handling without any type
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'An unexpected error occurred';

    return NextResponse.json({
      success: false,
      error: 'Sorry, I encountered an error processing your request. Please try again or contact your project manager for assistance.'
    }, { status: 500 });
  }
}

// FIXED: Proper async function typing
async function getFreshProjectContext(clientId: string): Promise<ProjectContextData[]> {
  try {
    const { db } = await connectToDatabase();
    
    // Get client's active projects with populated manager data
    const projects = await db.collection('projects').aggregate<ProjectDocument>([
      {
        $match: {
          client: new ObjectId(clientId),
          status: { $in: ['planning', 'in_progress', 'on_hold'] }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'manager',
          foreignField: '_id',
          as: 'managerData'
        }
      },
      {
        $addFields: {
          manager: { $arrayElemAt: ['$managerData', 0] }
        }
      },
      {
        $project: {
          title: 1,
          status: 1,
          progress: 1,
          startDate: 1,
          endDate: 1,
          'manager.name': 1,
          'manager.email': 1
        }
      },
      { $limit: 5 } // Limit to 5 most recent projects
    ]).toArray();

    return projects.map(project => ({
      title: project.title,
      status: project.status,
      progress: project.progress,
      manager: project.manager?.name || 'Not assigned',
      timeline: project.startDate && project.endDate 
        ? `${project.startDate.toDateString()} to ${project.endDate.toDateString()}`
        : 'Timeline not specified'
    }));
    
  } catch (error) {
    console.error('Error fetching fresh project context:', error);
    return [];
  }
}

// FIXED: Proper system prompt generation with type safety
function createSystemPrompt(clientName: string, projectContext: ProjectContextData[]): string {
  const currentDate = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return `You are an AI assistant for OliveHaus Interior Design Company, helping client ${clientName}.

COMPANY INFORMATION:
- OliveHaus Interior Design specializes in residential and commercial interior design
- Based in Nigeria, serving clients with modern, functional, and aesthetic design solutions
- Services include complete interior design, space planning, furniture selection, and project management
- Focus on creating beautiful, livable spaces that reflect client personality and lifestyle

TODAY'S DATE: ${currentDate}

CLIENT'S CURRENT PROJECTS:
${projectContext.length > 0 ? 
  projectContext.map(project => `
- Project: "${project.title}"
- Status: ${project.status.replace('_', ' ').toUpperCase()}
- Progress: ${project.progress}%
- Project Manager: ${project.manager}
- Timeline: ${project.timeline}`).join('\n') 
: 'No active projects found.'}

INSTRUCTIONS FOR RESPONSES:
1. Be helpful, professional, and friendly
2. Use the client's name (${clientName}) naturally in conversation
3. For project-specific questions, reference the current project data above
4. For general design questions, provide helpful interior design advice
5. If asked about project details not in the data, direct them to contact their project manager
6. For complex issues or requests for changes, suggest contacting their project manager via the platform's messaging system
7. Keep responses concise but informative (2-3 paragraphs maximum)
8. Always end with an offer to help further

COMMON QUESTIONS TO HANDLE:
- Project status and progress updates
- Timeline and delivery dates
- Design process questions
- General interior design advice
- How to request changes or modifications
- Contact information for project team

If you don't have specific information about something, be honest and guide them to the right resource rather than making assumptions.`;
}

// FIXED: AI API call with fallback system
async function callAIWithFallback(systemPrompt: string, userMessage: string): Promise<{ response: string; modelUsed: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error('OpenRouter API key not configured');
  }

  let lastError: Error | null = null;

  // Try each model in order until one works
  for (const model of FREE_AI_MODELS) {
    try {
      console.log(`Trying AI model: ${model.name}`);
      
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXTAUTH_URL || 'https://localhost:3000',
          'X-Title': 'OliveHaus Interior Design PPMA'
        },
        body: JSON.stringify({
          model: model.name,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          max_tokens: 500, // Reasonable limit for chat responses
          temperature: 0.7, // Balanced creativity and consistency
          top_p: 0.9,
          frequency_penalty: 0.0,
          presence_penalty: 0.0
        })
      });

      if (response.ok) {
        const data: AIResponse = await response.json() as AIResponse;

        if (data.choices && data.choices.length > 0) {
          const aiResponse = data.choices[0].message.content;
          
          if (aiResponse && aiResponse.trim()) {
            // Log successful model usage
            console.log(`✅ Successfully used model: ${model.name}`);
            if (data.usage) {
              console.log('Token Usage:', {
                model: model.name,
                prompt_tokens: data.usage.prompt_tokens,
                completion_tokens: data.usage.completion_tokens,
                total_tokens: data.usage.total_tokens
              });
            }

            return {
              response: aiResponse.trim(),
              modelUsed: model.name
            };
          }
        }
        
        throw new Error(`Empty response from ${model.name}`);
      } else {
        const errorText = await response.text();
        console.warn(`❌ Model ${model.name} failed: ${response.status} - ${errorText}`);
        lastError = new Error(`${model.name} failed: ${response.status}`);
        continue; // Try next model
      }

    } catch (error) {
      console.warn(`❌ Error with model ${model.name}:`, error);
      lastError = error instanceof Error ? error : new Error(`Unknown error with ${model.name}`);
      continue; // Try next model
    }
  }

  // If all models failed, throw the last error
  console.error('❌ All AI models failed');
  
  if (lastError) {
    if (lastError.message.includes('429')) {
      throw new Error('AI services are currently busy. Please try again in a moment.');
    } else if (lastError.message.includes('401')) {
      throw new Error('AI service authentication error. Please check your API configuration.');
    }
  }
  
  throw new Error('All AI services are temporarily unavailable. Please try again later or contact your project manager.');
}