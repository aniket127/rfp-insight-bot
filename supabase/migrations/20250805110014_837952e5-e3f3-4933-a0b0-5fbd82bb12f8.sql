-- Fix RLS policy for conversations table to allow the edge function to create conversations for users
-- First, let's check the current policy and fix it

-- Drop and recreate the INSERT policy for conversations to ensure it works properly
DROP POLICY IF EXISTS "Users can create their own conversations" ON public.conversations;

CREATE POLICY "Users can create their own conversations" 
ON public.conversations 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Also ensure the messages RLS policy works correctly with edge functions
-- Drop and recreate the INSERT policy for messages  
DROP POLICY IF EXISTS "Users can create messages in their conversations" ON public.messages;

CREATE POLICY "Users can create messages in their conversations" 
ON public.messages 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.conversations 
    WHERE conversations.id = messages.conversation_id 
    AND conversations.user_id = auth.uid()
  )
);