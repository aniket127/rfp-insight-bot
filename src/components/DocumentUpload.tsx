import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, FileText, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface DocumentUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

export const DocumentUpload = ({ isOpen, onClose, onUploadSuccess }: DocumentUploadProps) => {
  const [formData, setFormData] = useState({
    title: "",
    type: "",
    client: "",
    industry: "",
    summary: ""
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('🔍 File selection triggered');
    const file = e.target.files?.[0];
    if (file) {
      console.log('📁 File selected:', file.name, 'Size:', file.size);
      setSelectedFile(file);
      
      // Auto-fill title from filename if empty
      if (!formData.title) {
        setFormData(prev => ({
          ...prev,
          title: file.name.replace(/\.[^/.]+$/, "") // Remove extension
        }));
      }
      
      // Show confirmation that file is selected, NOT uploaded
      toast({
        title: "✅ File Ready",
        description: `${file.name} selected. Fill in details below to upload.`,
      });
      
      console.log('✅ File selection complete - NO upload triggered');
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleUpload = async () => {
    console.log('🚀 ACTUAL UPLOAD STARTED - Button clicked');
    
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a file to upload.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.title || !formData.type || !formData.client || !formData.industry) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Prepare form data for upload
      const uploadFormData = new FormData();
      uploadFormData.append('file', selectedFile);
      uploadFormData.append('title', formData.title);
      uploadFormData.append('type', formData.type);
      uploadFormData.append('client', formData.client);
      uploadFormData.append('industry', formData.industry);

      const { data, error } = await supabase.functions.invoke('upload-document', {
        body: uploadFormData,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      toast({
        title: "Upload successful",
        description: `${formData.title} has been uploaded and ${data.document.hasEmbedding ? 'vectorized for RAG search' : 'added to text search'}.`,
      });

      // Reset form
      setFormData({
        title: "",
        type: "",
        client: "",
        industry: "",
        summary: ""
      });
      setSelectedFile(null);
      
      onUploadSuccess();
      onClose();

    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Document
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Select File</CardTitle>
              <CardDescription>
                Supported formats: PDF, TXT, DOC, DOCX. For best results, use text files.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedFile ? (
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <div className="text-sm text-muted-foreground">
                      Click to select a file or drag and drop
                    </div>
                    <Input
                      type="file"
                      onChange={handleFileSelect}
                      accept=".pdf,.txt,.doc,.docx,.md"
                      className="hidden"
                      id="file-upload"
                      ref={(input) => {
                        if (input) {
                          (window as any).fileInputRef = input;
                        }
                      }}
                    />
                    <Button 
                      variant="outline" 
                      type="button"
                      onClick={() => {
                        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
                        if (fileInput) {
                          fileInput.click();
                        }
                      }}
                    >
                      Choose File
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <FileText className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-green-800">
                          📁 {selectedFile.name}
                        </div>
                        <div className="text-sm text-green-600">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Selected (Not uploaded yet)
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={removeFile} className="text-green-600 hover:text-green-800">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="text-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-medium text-blue-800">
                      📝 Step 2: Fill in document details below
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Upload will happen only when you click "Upload & Process"
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Document Information */}
          <Card className={selectedFile ? "ring-2 ring-primary/20" : ""}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                Document Information
                {selectedFile && <span className="text-sm text-primary">• Required</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Enter document title"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="type">Type *</Label>
                  <Select value={formData.type} onValueChange={(value) => handleInputChange('type', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select document type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RFP">RFP</SelectItem>
                      <SelectItem value="Case Study">Case Study</SelectItem>
                      <SelectItem value="Proposal">Proposal</SelectItem>
                      <SelectItem value="Win/Loss Analysis">Win/Loss Analysis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="industry">Industry *</Label>
                  <Input
                    id="industry"
                    value={formData.industry}
                    onChange={(e) => handleInputChange('industry', e.target.value)}
                    placeholder="e.g., Healthcare, Finance"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="client">Client *</Label>
                <Input
                  id="client"
                  value={formData.client}
                  onChange={(e) => handleInputChange('client', e.target.value)}
                  placeholder="Enter client name"
                  required
                />
              </div>

              <div>
                <Label htmlFor="summary">Summary (Optional)</Label>
                <Textarea
                  id="summary"
                  value={formData.summary}
                  onChange={(e) => handleInputChange('summary', e.target.value)}
                  placeholder="Brief description of the document contents..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={isUploading}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpload} 
              disabled={isUploading || !selectedFile || !formData.title || !formData.type || !formData.client || !formData.industry}
              className="min-w-[160px] bg-blue-600 hover:bg-blue-700"
              size="lg"
            >
              {isUploading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Uploading to Backend...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  🚀 Upload & Process Document
                </div>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};