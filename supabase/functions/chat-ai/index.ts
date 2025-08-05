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
    console.log('🚀 Chat AI function called');
    
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

    console.log('✅ Processing message:', message.substring(0, 100));

    // Generate embedding for the user's query
    console.log('🔍 Generating embedding for query...');
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: message,
      }),
    });

    console.log('📊 Embedding response status:', embeddingResponse.status);

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
            match_threshold: 0.7,
            match_count: 5
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

    // Fallback to text search if vector search fails or finds no results
    console.log('🔍 Checking if text search fallback needed...');
    if (documents.length === 0) {
      console.log('🔍 Starting text search fallback...');
      const { data: textDocs, error: searchError } = await supabaseWithAuth
        .from('documents')
        .select('id, title, type, client, industry, geography, year, summary, content, tags')
        .or(`title.ilike.%${message}%,summary.ilike.%${message}%,content.ilike.%${message}%`)
        .limit(5);

      console.log('📊 Text search completed');
      console.log('📊 Text search error:', searchError);
      console.log('📊 Text search results count:', textDocs?.length || 0);

      if (searchError) {
        console.error('❌ Text search error:', searchError);
      } else {
        documents = textDocs || [];
        searchMethod = 'text';
        console.log(`✅ Text search found ${documents.length} relevant documents`);
        
        // Lower confidence for text-based search
        if (documents.length > 0) {
          confidence = 0.6 + (documents.length * 0.05); // 0.6 to 0.85 based on results count
          console.log(`📊 Text search confidence: ${confidence.toFixed(3)}`);
        }
      }
    }

    console.log(`🎯 Final results: ${documents.length} documents, confidence: ${confidence.toFixed(3)}, method: ${searchMethod}`);

    let systemPrompt = `You are a knowledgeable assistant that helps users find information from a repository of RFPs, case studies, and proposals. 

Based on the user's query, provide helpful and accurate information. If you find relevant documents in the knowledge base, reference them in your response.

Search method used: ${searchMethod} ${searchMethod === 'vector' ? '(semantic similarity)' : '(keyword matching)'}

Available documents in knowledge base:`;

    if (documents && documents.length > 0) {
      systemPrompt += documents.map(doc => {
        const similarityInfo = doc.similarity ? ` (similarity: ${Math.round(doc.similarity * 100)}%)` : '';
        return `\n- ${doc.title} (${doc.type}) - ${doc.client} - ${doc.industry}${similarityInfo} - ${doc.summary}`;
      }).join('');
    } else {
      systemPrompt += "\nNo directly relevant documents found in current search. Please provide general guidance or ask the user to be more specific.";
    }

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 1500,
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
        confidence: confidence
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