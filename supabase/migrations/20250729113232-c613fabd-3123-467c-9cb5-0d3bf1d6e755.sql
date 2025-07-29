-- Create enum types
CREATE TYPE document_type AS ENUM ('RFP', 'Case Study', 'Proposal', 'Win/Loss Analysis');
CREATE TYPE message_type AS ENUM ('user', 'bot');

-- Create documents table (without vector embeddings for now)
CREATE TABLE public.documents (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    type document_type NOT NULL,
    client TEXT NOT NULL,
    industry TEXT NOT NULL,
    geography TEXT NOT NULL,
    year TEXT NOT NULL,
    summary TEXT,
    content TEXT,
    tags TEXT[],
    file_url TEXT,
    confidence DECIMAL(3,2),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create conversations table
CREATE TABLE public.conversations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create messages table
CREATE TABLE public.messages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
    type message_type NOT NULL,
    content TEXT NOT NULL,
    sources TEXT[],
    confidence DECIMAL(3,2),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for documents
CREATE POLICY "Users can view all documents" 
ON public.documents 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create their own documents" 
ON public.documents 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents" 
ON public.documents 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents" 
ON public.documents 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for conversations
CREATE POLICY "Users can view their own conversations" 
ON public.conversations 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversations" 
ON public.conversations 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations" 
ON public.conversations 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations" 
ON public.conversations 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for messages
CREATE POLICY "Users can view messages from their conversations" 
ON public.messages 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.conversations 
        WHERE id = conversation_id AND user_id = auth.uid()
    )
);

CREATE POLICY "Users can create messages in their conversations" 
ON public.messages 
FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.conversations 
        WHERE id = conversation_id AND user_id = auth.uid()
    )
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON public.documents
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON public.conversations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_documents_user_id ON public.documents(user_id);
CREATE INDEX idx_documents_type ON public.documents(type);
CREATE INDEX idx_documents_industry ON public.documents(industry);
CREATE INDEX idx_documents_geography ON public.documents(geography);
CREATE INDEX idx_documents_year ON public.documents(year);
CREATE INDEX idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);

-- Insert sample documents
INSERT INTO public.documents (title, type, client, industry, geography, year, summary, tags, confidence) VALUES
('Healthcare Cloud Migration RFP Response', 'RFP', 'MedCenter Corp', 'Healthcare', 'North America', '2024', 'Comprehensive cloud migration strategy for a healthcare organization with 15,000+ employees, focusing on HIPAA compliance and data security.', ARRAY['Cloud Migration', 'Azure', 'HIPAA', 'Security'], 0.95),
('Financial Services Digital Transformation', 'Case Study', 'SecureBank Inc', 'Financial Services', 'Europe', '2023', 'Successful implementation of digital banking platform resulting in 40% increase in customer satisfaction and 25% reduction in operational costs.', ARRAY['Digital Transformation', 'Banking', 'Customer Experience'], 0.88),
('Manufacturing IoT Implementation', 'Proposal', 'TechManufacturing Ltd', 'Manufacturing', 'Asia Pacific', '2024', 'IoT-enabled smart factory solution with predictive maintenance capabilities and real-time production monitoring.', ARRAY['IoT', 'Smart Factory', 'Predictive Maintenance'], 0.92);