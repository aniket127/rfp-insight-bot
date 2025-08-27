import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

interface NLPAnalysis {
  intent: string;
  confidence: number;
  keywords: string[];
  entities: string[];
  queryType: 'information_retrieval' | 'comparison' | 'summarization' | 'specific_search' | 'general_question';
  searchFilters: {
    industries?: string[];
    clients?: string[];
    documentTypes?: string[];
    technologies?: string[];
    timeframe?: string;
  };
}

// Intent classification patterns
const intentPatterns = {
  information_retrieval: [
    'what is', 'tell me about', 'explain', 'describe', 'overview of', 'information about',
    'details on', 'help me understand', 'how does', 'what are the benefits'
  ],
  comparison: [
    'compare', 'versus', 'vs', 'difference between', 'better than', 'similar to',
    'alternatives to', 'choose between', 'which is'
  ],
  summarization: [
    'summary', 'summarize', 'key points', 'main points', 'brief overview',
    'highlights', 'in short', 'tldr'
  ],
  specific_search: [
    'find documents', 'search for', 'look for', 'show me documents',
    'examples of', 'case studies about', 'proposals for'
  ],
  general_question: [
    'how to', 'best practices', 'recommendations', 'advice', 'guidance',
    'should i', 'can you help'
  ]
};

// Industry and technology keywords
const domainKeywords = {
  industries: [
    'healthcare', 'finance', 'financial services', 'banking', 'insurance',
    'manufacturing', 'retail', 'telecommunications', 'telecom', 'education',
    'government', 'energy', 'utilities', 'automotive', 'aerospace', 'pharma',
    'pharmaceutical', 'technology', 'tech', 'media', 'entertainment'
  ],
  technologies: [
    'cloud', 'azure', 'aws', 'gcp', 'migration', 'digital transformation',
    'ai', 'artificial intelligence', 'machine learning', 'ml', 'iot',
    'blockchain', 'cybersecurity', 'security', 'data analytics', 'big data',
    'crm', 'erp', 'salesforce', 'microsoft', 'oracle', 'sap'
  ],
  documentTypes: [
    'rfp', 'proposal', 'case study', 'win loss', 'analysis', 'report',
    'presentation', 'white paper', 'implementation', 'strategy'
  ]
};

function extractKeywords(text: string): string[] {
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);
  
  // Remove common stop words
  const stopWords = new Set([
    'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
    'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may',
    'might', 'can', 'this', 'that', 'these', 'those', 'a', 'an', 'as'
  ]);
  
  return words.filter(word => !stopWords.has(word) && word.length > 2);
}

function extractEntities(text: string): string[] {
  const entities = new Set<string>();
  const lowerText = text.toLowerCase();
  
  // Extract domain-specific entities
  Object.entries(domainKeywords).forEach(([category, keywords]) => {
    keywords.forEach(keyword => {
      if (lowerText.includes(keyword.toLowerCase())) {
        entities.add(keyword);
      }
    });
  });
  
  // Extract potential company names (capitalized words)
  const capitalizedWords = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
  capitalizedWords.forEach(word => {
    if (word.length > 2 && !word.match(/^(The|And|Or|But|In|On|At|To|For|Of|With|By)$/)) {
      entities.add(word);
    }
  });
  
  return Array.from(entities);
}

function classifyIntent(text: string): { intent: string; confidence: number } {
  const lowerText = text.toLowerCase();
  let bestMatch = { intent: 'general_question', confidence: 0.3 };
  
  Object.entries(intentPatterns).forEach(([intent, patterns]) => {
    const matches = patterns.filter(pattern => lowerText.includes(pattern)).length;
    const confidence = matches / patterns.length;
    
    if (confidence > bestMatch.confidence) {
      bestMatch = { intent, confidence };
    }
  });
  
  return bestMatch;
}

function extractSearchFilters(text: string, entities: string[]): NLPAnalysis['searchFilters'] {
  const filters: NLPAnalysis['searchFilters'] = {};
  
  // Extract industries
  const industries = entities.filter(entity => 
    domainKeywords.industries.some(industry => 
      industry.toLowerCase() === entity.toLowerCase()
    )
  );
  if (industries.length > 0) filters.industries = industries;
  
  // Extract technologies
  const technologies = entities.filter(entity => 
    domainKeywords.technologies.some(tech => 
      tech.toLowerCase() === entity.toLowerCase()
    )
  );
  if (technologies.length > 0) filters.technologies = technologies;
  
  // Extract document types
  const documentTypes = entities.filter(entity => 
    domainKeywords.documentTypes.some(type => 
      type.toLowerCase() === entity.toLowerCase()
    )
  );
  if (documentTypes.length > 0) filters.documentTypes = documentTypes;
  
  // Extract timeframe
  const timeMatches = text.match(/\b(202[0-9]|201[0-9]|last\s+year|recent|latest)\b/gi);
  if (timeMatches) {
    filters.timeframe = timeMatches[0];
  }
  
  return filters;
}

async function performAdvancedNLP(text: string): Promise<NLPAnalysis> {
  try {
    // Use OpenAI for more advanced NLP analysis
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert NLP analyst. Analyze the user query and extract:
1. Intent (information_retrieval, comparison, summarization, specific_search, general_question)
2. Key entities (companies, technologies, industries)
3. Search intent keywords
4. Query classification confidence (0-1)

Respond with ONLY a JSON object in this format:
{
  "intent": "intent_type",
  "confidence": 0.85,
  "entities": ["entity1", "entity2"],
  "keywords": ["keyword1", "keyword2"],
  "industries": ["industry1"],
  "technologies": ["tech1"],
  "documentTypes": ["type1"]
}`
          },
          { role: 'user', content: text }
        ],
        temperature: 0.1,
        max_tokens: 500
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const aiAnalysis = JSON.parse(data.choices[0].message.content);
      
      return {
        intent: aiAnalysis.intent || 'general_question',
        confidence: aiAnalysis.confidence || 0.7,
        keywords: aiAnalysis.keywords || [],
        entities: aiAnalysis.entities || [],
        queryType: aiAnalysis.intent || 'general_question',
        searchFilters: {
          industries: aiAnalysis.industries,
          technologies: aiAnalysis.technologies,
          documentTypes: aiAnalysis.documentTypes
        }
      };
    }
  } catch (error) {
    console.log('OpenAI NLP analysis failed, using fallback:', error);
  }
  
  // Fallback to rule-based analysis
  const keywords = extractKeywords(text);
  const entities = extractEntities(text);
  const { intent, confidence } = classifyIntent(text);
  const searchFilters = extractSearchFilters(text, entities);
  
  return {
    intent,
    confidence,
    keywords,
    entities,
    queryType: intent as NLPAnalysis['queryType'],
    searchFilters
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🧠 NLP Processor function called at', new Date().toISOString());
    
    if (!openAIApiKey) {
      console.log('⚠️ OpenAI API key not found, using basic NLP');
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authentication required');
    }

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid authentication');
    }

    const { text } = await req.json();
    
    if (!text || typeof text !== 'string') {
      throw new Error('Text input is required');
    }

    console.log('📝 Analyzing text:', text.substring(0, 100) + '...');

    // Perform NLP analysis
    const analysis = await performAdvancedNLP(text);
    
    console.log('🎯 NLP Analysis completed:', {
      intent: analysis.intent,
      confidence: analysis.confidence,
      keywordCount: analysis.keywords.length,
      entityCount: analysis.entities.length
    });

    return new Response(
      JSON.stringify(analysis), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Error in NLP processor:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        fallback: {
          intent: 'general_question',
          confidence: 0.3,
          keywords: [],
          entities: [],
          queryType: 'general_question',
          searchFilters: {}
        }
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});