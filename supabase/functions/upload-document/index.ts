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
      console.error('Auth error:', userError);
      throw new Error('Invalid token');
    }

    // Create a new client with the user's session for RLS
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

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const type = formData.get('type') as string;
    const client = formData.get('client') as string;
    const industry = formData.get('industry') as string;

    if (!file) {
      throw new Error('No file provided');
    }

    if (!title || !type || !client || !industry) {
      throw new Error('Missing required fields: title, type, client, industry');
    }

    console.log(`Processing file upload: ${file.name}`);

    // Extract text content from file
    let textContent = '';
    const fileType = file.type.toLowerCase();
    
    if (fileType.includes('text') || fileType.includes('plain')) {
      textContent = await file.text();
    } else if (fileType.includes('pdf')) {
      // For PDF files, we'll store basic info and let user know to use text format
      textContent = `PDF file: ${file.name}. Please convert to text format for full content extraction.`;
    } else {
      textContent = `File: ${file.name} (${fileType}). Content extraction not supported for this file type.`;
    }

    // Upload file to storage
    const fileName = `${user.id}/${Date.now()}_${file.name}`;
    const { data: uploadData, error: uploadError } = await supabaseWithAuth.storage
      .from('documents')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('File upload error:', uploadError);
      throw uploadError;
    }

    console.log(`File uploaded to storage: ${fileName}`);

    // Get public URL for the file
    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(fileName);

    // Prepare content for embedding
    const contentForEmbedding = [
      title,
      textContent.substring(0, 8000), // Limit content size for embedding
      `Industry: ${industry}`,
      `Client: ${client}`,
      `Type: ${type}`
    ].filter(Boolean).join(' ');

    // Generate embedding for the document
    let embedding = null;
    try {
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: contentForEmbedding,
        }),
      });

      if (embeddingResponse.ok) {
        const embeddingData = await embeddingResponse.json();
        embedding = embeddingData.data[0].embedding;
        console.log('Generated embedding for uploaded document');
      } else {
        console.error('Failed to generate embedding, document will be searchable by text only');
      }
    } catch (error) {
      console.error('Error generating embedding:', error);
    }

    // Create document record in database
    const { data: documentData, error: dbError } = await supabaseWithAuth
      .from('documents')
      .insert({
        title: title,
        type: type,
        client: client,
        industry: industry,
        geography: 'Global', // Default value
        year: new Date().getFullYear().toString(),
        summary: textContent.substring(0, 500) + (textContent.length > 500 ? '...' : ''),
        content: textContent,
        file_url: publicUrl,
        user_id: user.id,
        embeddings: embedding,
        tags: [industry, type, client] // Basic tags from metadata
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      throw dbError;
    }

    console.log(`Document created in database: ${documentData.id}`);

    return new Response(
      JSON.stringify({ 
        message: 'File uploaded and processed successfully',
        document: {
          id: documentData.id,
          title: documentData.title,
          type: documentData.type,
          hasEmbedding: !!embedding,
          fileUrl: publicUrl
        }
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in upload-document function:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});