import { useState, useRef, useEffect } from "react";
import { Bot, Upload, Search, BookOpen, Plus, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { FilterPanel } from "./FilterPanel";
import { DocumentCard } from "./DocumentCard";
import { DocumentUpload } from "./DocumentUpload";
import { Auth } from "./Auth";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  id: string;
  type: "user" | "bot";
  content: string;
  timestamp: Date;
  sources?: string[];
  confidence?: number;
}

interface Document {
  id: string;
  title: string;
  type: "RFP" | "Case Study" | "Proposal" | "Win/Loss Analysis";
  client: string;
  industry: string;
  geography: string;
  year: string;
  summary: string;
  tags: string[];
  confidence?: number;
}

// Sample data for demonstration
const SAMPLE_DOCUMENTS: Document[] = [
  {
    id: "1",
    title: "Healthcare Cloud Migration RFP Response",
    type: "RFP",
    client: "MedCenter Corp",
    industry: "Healthcare",
    geography: "North America",
    year: "2024",
    summary: "Comprehensive cloud migration strategy for a healthcare organization with 15,000+ employees, focusing on HIPAA compliance and data security.",
    tags: ["Cloud Migration", "Azure", "HIPAA", "Security"],
    confidence: 0.95
  },
  {
    id: "2",
    title: "Financial Services Digital Transformation",
    type: "Case Study",
    client: "SecureBank Inc",
    industry: "Financial Services",
    geography: "Europe",
    year: "2023",
    summary: "Successful implementation of digital banking platform resulting in 40% increase in customer satisfaction and 25% reduction in operational costs.",
    tags: ["Digital Transformation", "Banking", "Customer Experience"],
    confidence: 0.88
  },
  {
    id: "3",
    title: "Manufacturing IoT Implementation",
    type: "Proposal",
    client: "TechManufacturing Ltd",
    industry: "Manufacturing",
    geography: "Asia Pacific",
    year: "2024",
    summary: "IoT-enabled smart factory solution with predictive maintenance capabilities and real-time production monitoring.",
    tags: ["IoT", "Smart Factory", "Predictive Maintenance"],
    confidence: 0.92
  }
];

export const KnowledgebaseChatbot = () => {
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      type: "bot",
      content: "Welcome to the RFP & Case Study Knowledge Assistant! I can help you search through our repository of proposals, case studies, and RFP responses. Try asking me about specific industries, technologies, or client challenges.",
      timestamp: new Date(),
      confidence: 1.0
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([]);
  const [isGeneratingEmbeddings, setIsGeneratingEmbeddings] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setIsAuthLoading(false);
      
      // Load documents when user signs in
      if (session?.user && !documents.length) {
        setTimeout(() => {
          loadDocuments();
        }, 0);
      }
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsAuthLoading(false);
      if (session?.user) {
        loadDocuments();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform the data to match our interface
      const transformedDocs = data.map(doc => ({
        id: doc.id,
        title: doc.title,
        type: doc.type as "RFP" | "Case Study" | "Proposal" | "Win/Loss Analysis",
        client: doc.client,
        industry: doc.industry,
        geography: doc.geography || "Global",
        year: new Date(doc.created_at).getFullYear().toString(),
        summary: doc.summary,
        tags: doc.tags || [],
        confidence: 0.85
      }));

      setDocuments(transformedDocs);
      setFilteredDocuments(transformedDocs);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast({
        title: "Error loading documents",
        description: "Failed to load documents from the database.",
        variant: "destructive",
      });
    }
  };

  const handleSendMessage = async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('chat-ai', {
        body: { 
          message: content,
          conversationId: currentConversationId 
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "bot",
        content: data.response,
        timestamp: new Date(),
        sources: data.sources || [],
        confidence: data.confidence || 0.85
      };

      setMessages(prev => [...prev, botMessage]);
      
      // Store conversation ID for future messages
      if (data.conversationId) {
        setCurrentConversationId(data.conversationId);
      }
      
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send message. Please try again.",
        variant: "destructive",
      });
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "bot",
        content: "I'm sorry, I encountered an error processing your request. Please try again.",
        timestamp: new Date(),
        confidence: 0.0
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };


  const handleFiltersChange = (filters: any) => {
    let filtered = [...documents];
    
    // Apply filters
    if (filters.industry.length > 0) {
      filtered = filtered.filter(doc => filters.industry.includes(doc.industry));
    }
    if (filters.geography.length > 0) {
      filtered = filtered.filter(doc => filters.geography.includes(doc.geography));
    }
    if (filters.year.length > 0) {
      filtered = filtered.filter(doc => filters.year.includes(doc.year));
    }
    if (filters.documentType.length > 0) {
      filtered = filtered.filter(doc => filters.documentType.includes(doc.type));
    }

    setFilteredDocuments(filtered);
  };

  const handleRateMessage = (rating: "up" | "down") => {
    toast({
      title: "Feedback received",
      description: `Thank you for rating this response as ${rating === "up" ? "helpful" : "not helpful"}.`,
    });
  };

  const handleRetryMessage = () => {
    toast({
      title: "Regenerating response",
      description: "Please wait while I generate a new response...",
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setMessages([{
      id: "welcome",
      type: "bot",
      content: "Welcome to the RFP & Case Study Knowledge Assistant! I can help you search through our repository of proposals, case studies, and RFP responses. Try asking me about specific industries, technologies, or client challenges.",
      timestamp: new Date(),
      confidence: 1.0
    }]);
    setCurrentConversationId(null);
  };

  const handleGenerateEmbeddings = async () => {
    setIsGeneratingEmbeddings(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('generate-embeddings', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      toast({
        title: "Embeddings Generated",
        description: `Processed ${data.processed} documents. ${data.errors > 0 ? `${data.errors} errors occurred.` : 'RAG is now ready!'}`,
      });

      // Reload documents to get updated embeddings status
      loadDocuments();
      
    } catch (error: any) {
      console.error('Error generating embeddings:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate embeddings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingEmbeddings(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-primary rounded-lg shadow-glass animate-pulse">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <span className="text-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b border-glass-border bg-card/80 backdrop-blur-sm px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-primary rounded-lg shadow-glass">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Knowledge Assistant</h1>
              <p className="text-sm text-muted-foreground">RFP & Case Study Expert</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsUploadDialogOpen(true)}
            >
              <Upload className="h-4 w-4 mr-1" />
              Upload Docs
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Sidebar */}
        <div className="w-80 border-r border-glass-border bg-card/50 backdrop-blur-sm p-4 space-y-4">
          <FilterPanel onFiltersChange={handleFiltersChange} />
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">Recent Documents</h3>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <ScrollArea className="h-96">
              <div className="space-y-3">
                {filteredDocuments.slice(0, 5).map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    {...doc}
                    className="scale-90 origin-top-left"
                    onView={() => toast({ title: "Opening document", description: doc.title })}
                    onDownload={() => toast({ title: "Downloading", description: doc.title })}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2 mx-6 mt-4">
              <TabsTrigger value="chat" className="flex items-center gap-2">
                <Bot className="h-4 w-4" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="search" className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Browse
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="flex-1 flex flex-col mt-4">
              <ScrollArea className="flex-1 px-6">
                <div className="space-y-4 pb-4">
                  {messages.map((message) => (
                    <ChatMessage
                      key={message.id}
                      {...message}
                      onRate={handleRateMessage}
                      onRetry={handleRetryMessage}
                    />
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-chat-bot border border-glass-border rounded-2xl px-4 py-3 max-w-[80%]">
                        <div className="flex items-center gap-2">
                          <div className="flex space-x-1">
                            <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce"></div>
                          </div>
                          <span className="text-sm text-muted-foreground">Thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              <div className="p-6 border-t border-glass-border bg-card/50 backdrop-blur-sm">
                <ChatInput
                  onSendMessage={handleSendMessage}
                  disabled={isLoading}
                />
              </div>
            </TabsContent>

            <TabsContent value="search" className="flex-1 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDocuments.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    {...doc}
                    onView={() => toast({ title: "Opening document", description: doc.title })}
                    onDownload={() => toast({ title: "Downloading", description: doc.title })}
                  />
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Upload Dialog */}
      <DocumentUpload
        isOpen={isUploadDialogOpen}
        onClose={() => setIsUploadDialogOpen(false)}
        onUploadSuccess={() => {
          loadDocuments(); // Refresh document list
          toast({
            title: "Document added",
            description: "Your document has been added to the knowledge base.",
          });
        }}
      />
    </div>
  );
};