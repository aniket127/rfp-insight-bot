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
    if (!openAIApiKey) {
      console.error('OpenAI API key not found');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
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
      throw new Error('No authorization header');
    }

    // Set the auth context for the request
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid token');
    }

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

    // Get all documents that don't have embeddings yet
    const { data: documents, error: fetchError } = await supabaseWithAuth
      .from('documents')
      .select('id, title, summary, content')
      .is('embeddings', null);

    if (fetchError) {
      console.error('Error fetching documents:', fetchError);
      throw fetchError;
    }

    if (!documents || documents.length === 0) {
      return new Response(
        JSON.stringify({ message: 'All documents already have embeddings', processed: 0 }), 
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Processing ${documents.length} documents for embeddings`);

    let processed = 0;
    let errors = 0;

    // Process documents in batches to avoid rate limits
    for (const doc of documents) {
      try {
        console.log(`Processing document ${doc.id}: ${doc.title}`);
        
        // Combine title, summary, and content for embedding
        const textToEmbed = [
          doc.title,
          doc.summary || '',
          doc.content || ''
        ].filter(Boolean).join(' ');

        console.log(`Text to embed length: ${textToEmbed.length} characters`);

        if (!textToEmbed.trim()) {
          console.log(`Skipping document ${doc.id} - no content to embed`);
          continue;
        }

        // Generate embedding using OpenAI
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: textToEmbed,
          }),
        });

        if (!embeddingResponse.ok) {
          const errorData = await embeddingResponse.text();
          console.error(`OpenAI API error for document ${doc.id}:`, errorData);
          errors++;
          continue;
        }

        const embeddingData = await embeddingResponse.json();
        const embedding = embeddingData.data[0].embedding;

        // Update document with embedding
        const { error: updateError } = await supabaseWithAuth
          .from('documents')
          .update({ embeddings: embedding })
          .eq('id', doc.id);

        if (updateError) {
          console.error(`Error updating document ${doc.id}:`, updateError);
          errors++;
          continue;
        }

        processed++;
        console.log(`Generated embedding for document: ${doc.title}`);

        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Error processing document ${doc.id}:`, error);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `Embedding generation complete`,
        processed: processed,
        errors: errors,
        total: documents.length
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in generate-embeddings function:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});