import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Target, Key, Building } from "lucide-react";

interface NLPAnalysis {
  intent: string;
  confidence: number;
  keywords: string[];
  entities: string[];
  queryType: string;
  searchFilters: {
    industries?: string[];
    clients?: string[];
    documentTypes?: string[];
    technologies?: string[];
    timeframe?: string;
  };
}

interface NLPInsightsProps {
  analysis: NLPAnalysis | null;
  isVisible: boolean;
}

export const NLPInsights: React.FC<NLPInsightsProps> = ({ analysis, isVisible }) => {
  if (!analysis || !isVisible) return null;

  const getIntentColor = (intent: string) => {
    switch (intent) {
      case 'information_retrieval': return 'bg-blue-500/20 text-blue-700 border-blue-300';
      case 'comparison': return 'bg-purple-500/20 text-purple-700 border-purple-300';
      case 'summarization': return 'bg-green-500/20 text-green-700 border-green-300';
      case 'specific_search': return 'bg-orange-500/20 text-orange-700 border-orange-300';
      default: return 'bg-gray-500/20 text-gray-700 border-gray-300';
    }
  };

  const formatIntent = (intent: string) => {
    return intent.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <Card className="mb-4 bg-card/50 backdrop-blur-sm border-glass-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          Query Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Intent & Confidence */}
        <div className="flex items-center gap-3">
          <Target className="h-4 w-4 text-muted-foreground" />
          <Badge className={getIntentColor(analysis.intent)}>
            {formatIntent(analysis.intent)}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {Math.round(analysis.confidence * 100)}% confidence
          </span>
        </div>

        {/* Keywords */}
        {analysis.keywords.length > 0 && (
          <div className="flex items-start gap-3">
            <Key className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="flex flex-wrap gap-1">
              {analysis.keywords.slice(0, 5).map((keyword, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {keyword}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Entities */}
        {analysis.entities.length > 0 && (
          <div className="flex items-start gap-3">
            <Building className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="flex flex-wrap gap-1">
              {analysis.entities.slice(0, 4).map((entity, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {entity}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Search Filters */}
        {Object.keys(analysis.searchFilters).length > 0 && (
          <div className="pt-2 border-t border-glass-border">
            <div className="text-xs text-muted-foreground mb-2">Applied Filters:</div>
            <div className="space-y-1">
              {analysis.searchFilters.industries && (
                <div className="text-xs">
                  <span className="font-medium">Industries:</span> {analysis.searchFilters.industries.join(', ')}
                </div>
              )}
              {analysis.searchFilters.technologies && (
                <div className="text-xs">
                  <span className="font-medium">Technologies:</span> {analysis.searchFilters.technologies.join(', ')}
                </div>
              )}
              {analysis.searchFilters.documentTypes && (
                <div className="text-xs">
                  <span className="font-medium">Document Types:</span> {analysis.searchFilters.documentTypes.join(', ')}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};