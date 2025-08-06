import { FileText, Calendar, Building, MapPin, ExternalLink, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DocumentCardProps {
  title: string;
  type: "RFP" | "Case Study" | "Proposal" | "Win/Loss Analysis";
  client: string;
  industry: string;
  geography: string;
  year: string;
  summary: string;
  tags: string[];
  confidence?: number;
  onView?: () => void;
  onDownload?: () => void;
  onDelete?: () => void;
  className?: string;
}

const TYPE_COLORS = {
  "RFP": "bg-blue-100 text-blue-800 border-blue-200",
  "Case Study": "bg-green-100 text-green-800 border-green-200",
  "Proposal": "bg-purple-100 text-purple-800 border-purple-200",
  "Win/Loss Analysis": "bg-orange-100 text-orange-800 border-orange-200"
};

export const DocumentCard = ({
  title,
  type,
  client,
  industry,
  geography,
  year,
  summary,
  tags,
  confidence,
  onView,
  onDownload,
  onDelete,
  className
}: DocumentCardProps) => {
  return (
    <Card className={cn(
      "group hover:shadow-float transition-all duration-200 border-glass-border bg-card/80 backdrop-blur-sm",
      className
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Badge 
                variant="outline" 
                className={cn("text-xs border", TYPE_COLORS[type])}
              >
                {type}
              </Badge>
              {confidence && (
                <Badge variant="secondary" className="text-xs">
                  {Math.round(confidence * 100)}% match
                </Badge>
              )}
            </div>
            <h3 className="font-medium text-sm leading-tight text-foreground group-hover:text-primary transition-colors">
              {title}
            </h3>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Building className="h-3 w-3" />
              <span className="truncate">{client}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{year}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-primary">●</span>
              <span className="truncate">{industry}</span>
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{geography}</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
            {summary}
          </p>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, 3).map((tag, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{tags.length - 3}
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-3">
        <div className="flex items-center gap-2 w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={onView}
            className="flex-1 h-8 text-xs"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            View
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDownload}
            className="h-8 w-8 p-0"
          >
            <Download className="h-3 w-3" />
          </Button>
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
};