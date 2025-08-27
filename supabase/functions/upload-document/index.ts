import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

// Function to extract text from PDF using PDF-lib
async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Simple PDF text extraction - looks for text objects in PDF
    const pdfText = new TextDecoder().decode(uint8Array);
    
    // Extract text content using regex patterns for PDF text objects
    const textMatches = pdfText.match(/\(([^)]+)\)/g) || [];
    const streamMatches = pdfText.match(/BT\s+.*?ET/gs) || [];
    
    let extractedText = '';
    
    // Process parentheses-enclosed text (simple text objects)
    textMatches.forEach(match => {
      const text = match.slice(1, -1); // Remove parentheses
      if (text.length > 2 && !text.includes('\\') && /[a-zA-Z]/.test(text)) {
        extractedText += text + ' ';
      }
    });
    
    // Process text streams
    streamMatches.forEach(stream => {
      const lines = stream.split('\n');
      lines.forEach(line => {
        // Look for Tj commands (show text)
        const tjMatch = line.match(/\(([^)]*)\)\s*Tj/);
        if (tjMatch) {
          extractedText += tjMatch[1] + ' ';
        }
        
        // Look for TJ commands (show text with spacing)
        const tjArrayMatch = line.match(/\[([^\]]*)\]\s*TJ/);
        if (tjArrayMatch) {
          const textArray = tjArrayMatch[1];
          const textParts = textArray.match(/\(([^)]*)\)/g) || [];
          textParts.forEach(part => {
            extractedText += part.slice(1, -1) + ' ';
          });
        }
      });
    });
    
    // Clean up extracted text
    extractedText = extractedText
      .replace(/\s+/g, ' ')
      .replace(/[^\x20-\x7E\n]/g, '') // Remove non-printable characters
      .trim();
    
    // If we couldn't extract much text, try a different approach
    if (extractedText.length < 100) {
      // Look for readable text patterns in the entire PDF
      const readableText = pdfText
        .replace(/[^\x20-\x7E\n]/g, ' ')
        .replace(/\s+/g, ' ')
        .split(' ')
        .filter(word => word.length > 2 && /^[a-zA-Z]/.test(word))
        .join(' ');
      
      if (readableText.length > extractedText.length) {
        extractedText = readableText;
      }
    }
    
    return extractedText.length > 50 ? extractedText : '';
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    return '';
  }
}

// Function to extract text from Word documents
async function extractTextFromWord(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const docText = new TextDecoder().decode(uint8Array);
    
    // Simple text extraction for Word documents
    // Look for readable text patterns
    const extractedText = docText
      .replace(/[^\x20-\x7E\n]/g, ' ')
      .replace(/\s+/g, ' ')
      .split(' ')
      .filter(word => word.length > 2 && /^[a-zA-Z]/.test(word))
      .join(' ');
    
    return extractedText.length > 50 ? extractedText : '';
  } catch (error) {
    console.error('Error extracting text from Word document:', error);
    return '';
  }
}

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

    // Extract and preprocess text content from file
    let textContent = '';
    const fileType = file.type.toLowerCase();
    
    console.log(`Extracting content from file type: ${fileType}`);
    
    if (fileType.includes('text') || fileType.includes('plain')) {
      textContent = await file.text();
      console.log(`Extracted ${textContent.length} characters from text file`);
    } else if (fileType.includes('json')) {
      const jsonContent = await file.text();
      try {
        const parsed = JSON.parse(jsonContent);
        textContent = JSON.stringify(parsed, null, 2);
      } catch {
        textContent = jsonContent;
      }
      console.log(`Extracted ${textContent.length} characters from JSON file`);
    } else if (fileType.includes('pdf')) {
      console.log('Attempting to extract text from PDF...');
      const extractedText = await extractTextFromPDF(file);
      if (extractedText && extractedText.length > 50) {
        textContent = extractedText;
        console.log(`Successfully extracted ${textContent.length} characters from PDF`);
      } else {
        textContent = `PDF Document: ${title}. Industry: ${industry}. Client: ${client}. This is a ${type} document. Note: Could not extract text content from PDF. Please upload as text file for full content search.`;
        console.log('Could not extract sufficient text from PDF, using metadata only');
      }
    } else if (fileType.includes('word') || fileType.includes('doc')) {
      console.log('Attempting to extract text from Word document...');
      const extractedText = await extractTextFromWord(file);
      if (extractedText && extractedText.length > 50) {
        textContent = extractedText;
        console.log(`Successfully extracted ${textContent.length} characters from Word document`);
      } else {
        textContent = `Word Document: ${title}. Industry: ${industry}. Client: ${client}. This is a ${type} document. Note: Could not extract text content from Word document. Please upload as text file for full content search.`;
        console.log('Could not extract sufficient text from Word document, using metadata only');
      }
    } else {
      textContent = `Document: ${title}. Industry: ${industry}. Client: ${client}. Type: ${type}. File format: ${fileType}. Please upload in text format for full content search.`;
      console.log(`Unsupported file type ${fileType}, using metadata only`);
    }

    // Clean and normalize text content
    textContent = textContent
      .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
      .replace(/\n\s*\n/g, '\n')  // Remove empty lines
      .trim();

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

    // Prepare optimized content for embedding with structured format
    const metadataContent = `Document Title: ${title}\nDocument Type: ${type}\nClient: ${client}\nIndustry: ${industry}\n\n`;
    const mainContent = textContent.substring(0, 7000); // Leave space for metadata
    const contentForEmbedding = metadataContent + mainContent;

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
          dimensions: 1536
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
        tags: [industry.toLowerCase(), type.toLowerCase(), client.toLowerCase()].filter(Boolean)
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