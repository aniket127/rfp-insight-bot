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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Chat AI function called at', new Date().toISOString());
    
    if (!openAIApiKey) {
      console.error('❌ OpenAI API key not found');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ OpenAI API key found');

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('🔐 Auth header present:', !!authHeader);
    
    if (!authHeader) {
      throw new Error('Authentication required');
    }

    // Set the auth context for the request
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('❌ Auth error:', userError);
      throw new Error('Invalid authentication');
    }

    console.log('✅ User authenticated:', user?.email);

    // Create authenticated Supabase client for RLS
    const supabaseWithAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });

    const { message, conversationId } = await req.json();
    console.log('📨 Request data:', { message: message?.substring(0, 50), conversationId });

    if (!message) {
      console.error('❌ No message provided');
      throw new Error('Message is required');
    }

    console.log('✅ Processing message:', message.substring(0, 100), 'at', new Date().toISOString());

    // Step 1: Perform NLP analysis on user query
    console.log('🧠 Performing NLP analysis on user query...');
    let nlpAnalysis = null;
    
    try {
      const nlpResponse = await supabaseWithAuth.functions.invoke('nlp-processor', {
        body: { text: message },
        headers: {
          Authorization: authHeader
        }
      });
      
      if (!nlpResponse.error) {
        nlpAnalysis = nlpResponse.data;
        console.log('✅ NLP Analysis completed:', {
          intent: nlpAnalysis.intent,
          confidence: nlpAnalysis.confidence,
          keywords: nlpAnalysis.keywords.slice(0, 3),
          entities: nlpAnalysis.entities.slice(0, 3)
        });
      }
    } catch (nlpError) {
      console.log('⚠️ NLP analysis failed, continuing with basic search:', nlpError);
    }

    // Step 2: Generate embedding for semantic search
    console.log('🔍 Generating embedding for query with OpenAI...');
    
    // Enhance query with NLP insights for better embedding
    let enhancedQuery = message;
    if (nlpAnalysis && nlpAnalysis.keywords.length > 0) {
      enhancedQuery = message + ' ' + nlpAnalysis.keywords.slice(0, 5).join(' ');
      console.log('📈 Enhanced query with keywords for embedding');
    }
    
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: enhancedQuery,
      }),
    });

    console.log('📊 OpenAI embedding response status:', embeddingResponse.status, 'at', new Date().toISOString());

    let documents = [];
    let searchMethod = 'fallback';
    let confidence = 0.3; // Base confidence for general knowledge

    if (!embeddingResponse.ok) {
      const errorData = await embeddingResponse.text();
      console.error('❌ OpenAI embedding API error:', errorData);
      console.error('❌ Embedding failed - skipping vector search, proceeding to text search');
    }

    if (embeddingResponse.ok) {
      try {
        const embeddingData = await embeddingResponse.json();
        const queryEmbedding = embeddingData.data[0].embedding;
        console.log('🎯 Query embedding generated, dimensions:', queryEmbedding.length);

        // Use vector similarity search
        console.log('🔍 Starting vector similarity search...');
        const { data: vectorDocs, error: vectorError } = await supabaseWithAuth
          .rpc('search_documents_by_similarity', {
            query_embedding: queryEmbedding,
            match_threshold: 0.3,  // Lower threshold for better recall
            match_count: 8        // Get more documents for better context
          });

        console.log('📊 Vector search completed');
        console.log('📊 Vector error:', vectorError);
        console.log('📊 Vector results count:', vectorDocs?.length || 0);

        if (vectorError) {
          console.error('❌ Vector search error:', vectorError);
        } else {
          documents = vectorDocs || [];
          searchMethod = 'vector';
          console.log(`✅ Vector search found ${documents.length} relevant documents`);
          
          if (documents.length > 0) {
            console.log('📊 Document similarities:', documents.map(d => ({ title: d.title, similarity: d.similarity })));
          }
          
          // Calculate confidence based on vector search results
          if (documents.length > 0) {
            const avgSimilarity = documents.reduce((sum, doc) => sum + (doc.similarity || 0), 0) / documents.length;
            confidence = Math.min(0.95, 0.4 + (avgSimilarity * 0.6)); // Scale from 0.4 to 0.95
            console.log(`📊 Average similarity: ${avgSimilarity.toFixed(3)}, Confidence: ${confidence.toFixed(3)}`);
          }
        }
      } catch (error) {
        console.error('Error processing embeddings:', error);
      }
    }

    // Step 3: Enhanced text search with NLP filters
    console.log('🔍 Checking if enhanced text search needed...');
    if (documents.length === 0 && nlpAnalysis) {
      console.log('🔍 Starting NLP-enhanced text search...');
      
      // Build dynamic search query based on NLP analysis
      let query = supabaseWithAuth.from('documents')
        .select('id, title, type, client, industry, geography, year, summary, content, tags');
      
      // Apply NLP-based filters
      const searchTerms = [
        ...nlpAnalysis.keywords.slice(0, 3),
        ...nlpAnalysis.entities.slice(0, 2)
      ].filter(term => term.length > 2);
      
      if (searchTerms.length > 0) {
        const searchPattern = searchTerms.map(term => 
          `title.ilike.%${term}%,summary.ilike.%${term}%,content.ilike.%${term}%,tags.cs.{${term}}`
        ).join(',');
        query = query.or(searchPattern);
      }
      
      // Apply domain filters if available
      if (nlpAnalysis.searchFilters.industries && nlpAnalysis.searchFilters.industries.length > 0) {
        query = query.in('industry', nlpAnalysis.searchFilters.industries);
      }
      
      if (nlpAnalysis.searchFilters.documentTypes && nlpAnalysis.searchFilters.documentTypes.length > 0) {
        const docTypeMapping = {
          'rfp': 'RFP',
          'proposal': 'Proposal', 
          'case study': 'Case Study',
          'win loss': 'Win/Loss Analysis'
        };
        const mappedTypes = nlpAnalysis.searchFilters.documentTypes.map(type => 
          docTypeMapping[type.toLowerCase()] || type
        );
        query = query.in('type', mappedTypes);
      }
      
      const { data: enhancedTextDocs, error: enhancedSearchError } = await query.limit(8);

      console.log('📊 Enhanced text search completed');
      console.log('📊 Enhanced search error:', enhancedSearchError);
      console.log('📊 Enhanced search results count:', enhancedTextDocs?.length || 0);

      if (enhancedSearchError) {
        console.error('❌ Enhanced text search error:', enhancedSearchError);
      } else {
        documents = enhancedTextDocs || [];
        searchMethod = 'enhanced_text';
        console.log(`✅ Enhanced text search found ${documents.length} relevant documents`);
        
        // Higher confidence for NLP-enhanced search
        if (documents.length > 0) {
          confidence = 0.7 + (documents.length * 0.03) + (nlpAnalysis.confidence * 0.15);
          console.log(`📊 Enhanced search confidence: ${confidence.toFixed(3)}`);
        }
      }
    }
    
    // Step 4: Fallback to basic text search
    if (documents.length === 0) {
      console.log('🔍 Starting basic text search fallback...');
      const { data: textDocs, error: searchError } = await supabaseWithAuth
        .from('documents')
        .select('id, title, type, client, industry, geography, year, summary, content, tags')
        .or(`title.ilike.%${message}%,summary.ilike.%${message}%,content.ilike.%${message}%`)
        .limit(5);

      console.log('📊 Basic text search completed');
      console.log('📊 Basic text search error:', searchError);
      console.log('📊 Basic text search results count:', textDocs?.length || 0);

      if (searchError) {
        console.error('❌ Basic text search error:', searchError);
      } else {
        documents = textDocs || [];
        searchMethod = 'basic_text';
        console.log(`✅ Basic text search found ${documents.length} relevant documents`);
        
        // Lower confidence for basic text search
        if (documents.length > 0) {
          confidence = 0.5 + (documents.length * 0.05);
          console.log(`📊 Basic text search confidence: ${confidence.toFixed(3)}`);
        }
      }
    }

    console.log(`🎯 Final results: ${documents.length} documents, confidence: ${confidence.toFixed(3)}, method: ${searchMethod}`);

    // Build comprehensive system prompt with NLP insights
    let systemPrompt = `You are an expert knowledge assistant that analyzes and retrieves information from a repository of business documents including RFPs, case studies, proposals, and reports.

QUERY ANALYSIS:`;

    if (nlpAnalysis) {
      systemPrompt += `
- Intent: ${nlpAnalysis.intent} (confidence: ${(nlpAnalysis.confidence * 100).toFixed(0)}%)
- Key entities: ${nlpAnalysis.entities.slice(0, 5).join(', ')}
- Keywords: ${nlpAnalysis.keywords.slice(0, 5).join(', ')}
- Query type: ${nlpAnalysis.queryType}`;
      
      if (nlpAnalysis.searchFilters.industries) {
        systemPrompt += `\n- Target industries: ${nlpAnalysis.searchFilters.industries.join(', ')}`;
      }
      if (nlpAnalysis.searchFilters.technologies) {
        systemPrompt += `\n- Relevant technologies: ${nlpAnalysis.searchFilters.technologies.join(', ')}`;
      }
    }

    systemPrompt += `

INSTRUCTIONS:
1. Always prioritize information from the provided documents
2. Quote specific sections when referencing document content  
3. If documents contain relevant information, base your answer primarily on that content
4. Be specific and detailed when document content is available
5. Clearly indicate which documents you're referencing
6. Structure your response based on the identified intent and query type
7. If the intent is 'comparison', focus on comparing relevant aspects
8. If the intent is 'summarization', provide concise key points
9. If the intent is 'specific_search', highlight matching documents and their relevance

Search method: ${searchMethod} (${
      searchMethod === 'vector' ? 'semantic similarity search' :
      searchMethod === 'enhanced_text' ? 'NLP-enhanced keyword search' :
      'basic keyword search'
    })
Confidence level: ${confidence.toFixed(2)}
Documents retrieved: ${documents.length}

AVAILABLE DOCUMENTS WITH CONTENT:`;

    if (documents && documents.length > 0) {
      systemPrompt += documents.map((doc, index) => {
        const similarityInfo = doc.similarity ? ` (${Math.round(doc.similarity * 100)}% relevance)` : '';
        
        // Use the full content if available, with a reasonable limit for context window
        let fullContent = '';
        if (doc.content && doc.content.trim()) {
          // Use up to 15,000 characters per document to provide comprehensive context
          fullContent = doc.content.length > 15000 ? 
            doc.content.substring(0, 15000) + '\n[Content truncated for length...]' : 
            doc.content;
        } else if (doc.summary) {
          fullContent = doc.summary;
        } else {
          fullContent = 'No content available - document may need to be re-uploaded in text format.';
        }
        
        return `

DOCUMENT ${index + 1}: "${doc.title}"${similarityInfo}
Type: ${doc.type} | Client: ${doc.client} | Industry: ${doc.industry}
Geography: ${doc.geography} | Year: ${doc.year}

FULL DOCUMENT CONTENT:
${fullContent}

---`;
      }).join('');
    } else {
      systemPrompt += "\n\nNo relevant documents found. Provide general guidance and suggest the user be more specific about their query.";
    }

    // Step 5: Generate intelligent response using advanced model
    console.log('🤖 Generating intelligent response...');
    
    // Choose model based on query complexity and available context
    const useAdvancedModel = documents.length > 3 || (nlpAnalysis && nlpAnalysis.confidence > 0.8);
    const model = useAdvancedModel ? 'gpt-4o-mini' : 'gpt-4o-mini'; // Using consistent model
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 2000, // Increased for more comprehensive responses
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    // Store the conversation and messages in the database
    let currentConversationId = conversationId;
    
    if (!currentConversationId) {
      // Create new conversation
      const { data: newConversation, error: convError } = await supabaseWithAuth
        .from('conversations')
        .insert({
          title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
          user_id: user.id
        })
        .select()
        .single();

      if (convError) {
        console.error('Conversation creation error:', convError);
        throw convError;
      }
      
      currentConversationId = newConversation.id;
    }

    // Insert user message
    const { error: userMsgError } = await supabaseWithAuth
      .from('messages')
      .insert({
        conversation_id: currentConversationId,
        type: 'user',
        content: message,
        user_id: user.id
      });

    if (userMsgError) {
      console.error('User message insert error:', userMsgError);
    }

    // Insert bot response
    const sources = documents?.map(doc => doc.title) || [];
    const { error: botMsgError } = await supabaseWithAuth
      .from('messages')
      .insert({
        conversation_id: currentConversationId,
        type: 'bot',
        content: aiResponse,
        sources: sources,
        confidence: confidence,
        user_id: user.id
      });

    if (botMsgError) {
      console.error('Bot message insert error:', botMsgError);
    }

    return new Response(
      JSON.stringify({ 
        response: aiResponse, 
        sources: sources,
        conversationId: currentConversationId,
        confidence: confidence,
        nlpAnalysis: nlpAnalysis
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('💥 Error in chat-ai function:', error);
    console.error('💥 Error stack:', error.stack);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack?.split('\n')[0] || 'Unknown error'
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});