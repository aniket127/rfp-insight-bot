import { ThumbsUp, ThumbsDown, Copy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface ChatMessageProps {
  type: "user" | "bot";
  content: string;
  timestamp?: Date;
  sources?: string[];
  confidence?: number;
  onRate?: (rating: "up" | "down") => void;
  onRetry?: () => void;
}

export const ChatMessage = ({ 
  type, 
  content, 
  timestamp, 
  sources, 
  confidence,
  onRate,
  onRetry
}: ChatMessageProps) => {
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRate = (newRating: "up" | "down") => {
    setRating(newRating);
    onRate?.(newRating);
  };

  return (
    <div className={cn(
      "flex w-full mb-6 animate-slide-up",
      type === "user" ? "justify-end" : "justify-start"
    )}>
      <div className={cn(
        "max-w-[80%] rounded-2xl px-4 py-3 shadow-card-custom",
        type === "user" 
          ? "bg-chat-user text-white ml-12" 
          : "bg-chat-bot border border-glass-border mr-12"
      )}>
        <div className="text-sm leading-relaxed whitespace-pre-wrap">
          {content}
        </div>
        
        {timestamp && (
          <div className={cn(
            "text-xs mt-2 opacity-70",
            type === "user" ? "text-blue-100" : "text-muted-foreground"
          )}>
            {timestamp.toLocaleTimeString()}
          </div>
        )}

        {type === "bot" && (
          <div className="mt-3 space-y-3">
            {sources && sources.length > 0 && (
              <div className="border-t border-glass-border pt-3">
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  📚 Sources ({sources.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {sources.map((source, index) => (
                    <Badge 
                      key={index} 
                      variant="outline" 
                      className="text-xs bg-accent/50 border-accent hover:bg-accent/70 transition-colors"
                    >
                      📄 {source}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {confidence && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <span className="text-green-500">✓</span>
                Confidence: {Math.round(confidence * 100)}%
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRate("up")}
                className={cn(
                  "h-8 w-8 p-0 hover:bg-accent",
                  rating === "up" && "bg-accent text-success"
                )}
              >
                <ThumbsUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRate("down")}
                className={cn(
                  "h-8 w-8 p-0 hover:bg-accent",
                  rating === "down" && "bg-accent text-destructive"
                )}
              >
                <ThumbsDown className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-8 w-8 p-0 hover:bg-accent"
              >
                <Copy className={cn("h-3 w-3", copied && "text-success")} />
              </Button>
              {onRetry && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRetry}
                  className="h-8 w-8 p-0 hover:bg-accent"
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};