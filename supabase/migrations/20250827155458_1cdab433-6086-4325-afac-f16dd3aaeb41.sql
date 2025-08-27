-- Fix critical security vulnerability: Restrict document SELECT access to owners only
-- Currently all authenticated users can view ALL documents, which exposes confidential data

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Users can view all documents" ON public.documents;

-- Create new secure policy that only allows users to view their own documents
CREATE POLICY "Users can view their own documents" 
ON public.documents 
FOR SELECT 
USING (auth.uid() = user_id);