import { useState } from "react";
import { Filter, X, Calendar, Building, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface FilterState {
  industry: string[];
  geography: string[];
  clientSize: string[];
  year: string[];
  documentType: string[];
}

interface FilterPanelProps {
  onFiltersChange: (filters: FilterState) => void;
  className?: string;
}

const INDUSTRIES = [
  "Healthcare", "Financial Services", "Technology", "Manufacturing", 
  "Retail", "Government", "Education", "Energy", "Telecommunications"
];

const GEOGRAPHIES = [
  "North America", "Europe", "Asia Pacific", "Latin America", 
  "Middle East", "Africa", "Global"
];

const CLIENT_SIZES = [
  "Enterprise (1000+)", "Mid-Market (100-999)", "Small Business (<100)"
];

const YEARS = ["2024", "2023", "2022", "2021", "2020"];

const DOCUMENT_TYPES = ["RFP", "Case Study", "Proposal", "Win/Loss Analysis"];

export const FilterPanel = ({ onFiltersChange, className }: FilterPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    industry: [],
    geography: [],
    clientSize: [],
    year: [],
    documentType: []
  });

  const updateFilter = (category: keyof FilterState, value: string) => {
    const newFilters = { ...filters };
    const currentValues = newFilters[category];
    
    if (currentValues.includes(value)) {
      newFilters[category] = currentValues.filter(v => v !== value);
    } else {
      newFilters[category] = [...currentValues, value];
    }
    
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const removeFilter = (category: keyof FilterState, value: string) => {
    const newFilters = { ...filters };
    newFilters[category] = newFilters[category].filter(v => v !== value);
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearAllFilters = () => {
    const emptyFilters = {
      industry: [],
      geography: [],
      clientSize: [],
      year: [],
      documentType: []
    };
    setFilters(emptyFilters);
    onFiltersChange(emptyFilters);
  };

  const activeFilterCount = Object.values(filters).flat().length;

  const FilterSection = ({ 
    title, 
    icon: Icon, 
    category, 
    options 
  }: { 
    title: string; 
    icon: any; 
    category: keyof FilterState; 
    options: string[] 
  }) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <div className="space-y-1">
        {options.map(option => (
          <Button
            key={option}
            variant={filters[category].includes(option) ? "default" : "ghost"}
            size="sm"
            onClick={() => updateFilter(category, option)}
            className="w-full justify-start h-8 text-xs"
          >
            {option}
          </Button>
        ))}
      </div>
    </div>
  );

  return (
    <div className={cn("bg-card rounded-xl border border-glass-border shadow-card-custom p-4", className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-0 h-auto">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span className="font-medium">Filters</span>
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeFilterCount}
                </Badge>
              )}
            </div>
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-4 mt-4">
          <FilterSection 
            title="Industry" 
            icon={Building} 
            category="industry" 
            options={INDUSTRIES} 
          />
          <FilterSection 
            title="Geography" 
            icon={MapPin} 
            category="geography" 
            options={GEOGRAPHIES} 
          />
          <FilterSection 
            title="Client Size" 
            icon={Users} 
            category="clientSize" 
            options={CLIENT_SIZES} 
          />
          <FilterSection 
            title="Year" 
            icon={Calendar} 
            category="year" 
            options={YEARS} 
          />
          <FilterSection 
            title="Document Type" 
            icon={Filter} 
            category="documentType" 
            options={DOCUMENT_TYPES} 
          />

          {activeFilterCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllFilters}
              className="w-full"
            >
              Clear All Filters
            </Button>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Active Filters:</div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(filters).map(([category, values]) =>
              values.map(value => (
                <Badge key={`${category}-${value}`} variant="secondary" className="text-xs">
                  {value}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFilter(category as keyof FilterState, value)}
                    className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};