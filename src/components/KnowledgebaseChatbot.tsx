import { useState, useRef, useEffect } from "react";
import { Bot, Upload, Search, BookOpen, Settings, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { FilterPanel } from "./FilterPanel";
import { DocumentCard } from "./DocumentCard";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

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
  const [documents, setDocuments] = useState<Document[]>(SAMPLE_DOCUMENTS);
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>(SAMPLE_DOCUMENTS);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Simulate AI response
    setTimeout(() => {
      let botResponse = "";
      let sources: string[] = [];
      let confidence = 0.85;

      if (content.toLowerCase().includes("healthcare")) {
        botResponse = "I found several healthcare-related documents in our knowledge base. Our most recent healthcare project involved a cloud migration for MedCenter Corp, which required strict HIPAA compliance and advanced security measures. We successfully migrated their patient data systems to Azure with zero downtime and achieved 99.9% uptime SLA.\n\nKey highlights:\n• HIPAA-compliant cloud architecture\n• End-to-end encryption\n• Disaster recovery implementation\n• Staff training and change management\n\nWould you like me to provide more details about any specific aspect?";
        sources = ["Healthcare Cloud Migration RFP Response", "HIPAA Compliance Guidelines"];
        confidence = 0.95;
      } else if (content.toLowerCase().includes("financial") || content.toLowerCase().includes("banking")) {
        botResponse = "Our financial services portfolio includes successful digital transformation projects. Notable case study: SecureBank Inc's digital banking platform implementation resulted in:\n\n• 40% increase in customer satisfaction\n• 25% reduction in operational costs\n• Enhanced mobile banking experience\n• Improved fraud detection systems\n\nThe project utilized advanced APIs, microservices architecture, and AI-powered analytics. Would you like specific technical details or metrics?";
        sources = ["Financial Services Digital Transformation", "SecureBank Case Study"];
        confidence = 0.88;
      } else if (content.toLowerCase().includes("iot") || content.toLowerCase().includes("manufacturing")) {
        botResponse = "Our manufacturing expertise includes IoT-enabled smart factory solutions. The TechManufacturing Ltd project demonstrates our capabilities in:\n\n• Predictive maintenance systems\n• Real-time production monitoring\n• Industrial IoT sensor networks\n• Edge computing implementation\n\nThis solution reduced equipment downtime by 30% and improved overall equipment effectiveness (OEE) by 15%.";
        sources = ["Manufacturing IoT Implementation", "Smart Factory Architecture"];
        confidence = 0.92;
      } else {
        botResponse = `I understand you're asking about "${content}". Let me search our knowledge base for relevant information. Our repository contains over 500 RFPs, case studies, and proposals covering various industries including healthcare, financial services, manufacturing, technology, and government sectors.\n\nTo provide more specific insights, could you tell me:\n• Which industry are you interested in?\n• Are you looking for technical solutions or business outcomes?\n• Any specific time frame or geography?`;
        sources = ["Knowledge Base Overview"];
        confidence = 0.75;
      }

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "bot",
        content: botResponse,
        timestamp: new Date(),
        sources,
        confidence
      };

      setMessages(prev => [...prev, botMessage]);
      setIsLoading(false);
    }, 1500);
  };

  const handleFileUpload = (files: FileList) => {
    const fileNames = Array.from(files).map(file => file.name);
    toast({
      title: "Files uploaded",
      description: `Uploaded ${files.length} file(s): ${fileNames.join(", ")}`,
    });
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
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-1" />
              Upload Docs
            </Button>
            <Button variant="ghost" size="sm">
              <Settings className="h-4 w-4" />
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
                  onFileUpload={handleFileUpload}
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
    </div>
  );
};