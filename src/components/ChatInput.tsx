import { useState } from "react";
import { Send, Paperclip, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onFileUpload?: (files: FileList) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInput = ({ 
  onSendMessage, 
  onFileUpload, 
  disabled = false,
  placeholder = "Ask about RFPs, case studies, or search our knowledge base..."
}: ChatInputProps) => {
  const [message, setMessage] = useState("");
  const [isListening, setIsListening] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && onFileUpload) {
      onFileUpload(e.target.files);
    }
  };

  const toggleVoiceInput = () => {
    setIsListening(!isListening);
    // Voice input implementation would go here
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative bg-card rounded-2xl border border-glass-border shadow-glass backdrop-blur-sm">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="min-h-[60px] max-h-32 border-0 resize-none bg-transparent pr-24 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground"
        />
        
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          <input
            type="file"
            id="file-upload"
            multiple
            accept=".pdf,.docx,.xlsx,.html,.txt"
            onChange={handleFileChange}
            className="hidden"
          />
          
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => document.getElementById("file-upload")?.click()}
            className="h-8 w-8 p-0 hover:bg-accent"
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleVoiceInput}
            className={cn(
              "h-8 w-8 p-0 hover:bg-accent",
              isListening && "bg-accent text-primary"
            )}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>

          <Button
            type="submit"
            disabled={!message.trim() || disabled}
            size="sm"
            className="h-8 w-8 p-0 bg-gradient-primary hover:shadow-float transition-all duration-200"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </form>
  );
};