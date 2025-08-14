import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Send } from "lucide-react";

interface CommentFormProps {
  seriesId: string;
  episodeId?: string;
  parentId?: string;
  onCommentAdded?: () => void;
  onCancel?: () => void;
  placeholder?: string;
  compact?: boolean;
}

const CommentForm = ({ 
  seriesId, 
  episodeId, 
  parentId, 
  onCommentAdded, 
  onCancel,
  placeholder = "Add a comment...",
  compact = false
}: CommentFormProps) => {
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(!compact);

  // Load saved user info from localStorage
  useEffect(() => {
    const savedName = localStorage.getItem("comment_author_name");
    const savedEmail = localStorage.getItem("comment_author_email");
    if (savedName) setAuthorName(savedName);
    if (savedEmail) setAuthorEmail(savedEmail);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) {
      toast({ title: "Comment required", description: "Please enter a comment", variant: "destructive" });
      return;
    }
    
    if (!authorName.trim()) {
      toast({ title: "Name required", description: "Please enter your name", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const { data, error } = await supabase.rpc("create_comment", {
        p_content: content.trim(),
        p_author_name: authorName.trim(),
        p_author_email: authorEmail.trim() || null,
        p_series_id: seriesId,
        p_episode_id: episodeId || null,
        p_parent_id: parentId || null,
      });

      if (error) throw error;

      // Save user info to localStorage for future comments
      localStorage.setItem("comment_author_name", authorName.trim());
      if (authorEmail.trim()) {
        localStorage.setItem("comment_author_email", authorEmail.trim());
      }

      toast({ 
        title: "Comment posted", 
        description: parentId ? "Reply added successfully" : "Comment added successfully" 
      });
      
      setContent("");
      if (compact) {
        setShowForm(false);
      }
      onCommentAdded?.();
    } catch (error: any) {
      toast({ 
        title: "Failed to post comment", 
        description: error.message || "Please try again", 
        variant: "destructive" 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setContent("");
    if (compact) {
      setShowForm(false);
    }
    onCancel?.();
  };

  if (compact && !showForm) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowForm(true)}
        className="h-8 px-2 text-muted-foreground hover:text-foreground"
      >
        <MessageCircle className="mr-1 h-3 w-3" />
        {parentId ? "Reply" : "Comment"}
      </Button>
    );
  }

  return (
    <Card className={compact ? "border-0 shadow-none" : ""}>
      {!compact && (
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="h-5 w-5" />
            {parentId ? "Reply to comment" : "Add a comment"}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className={compact ? "p-0" : ""}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="author-name" className="text-sm">Name *</Label>
                <Input
                  id="author-name"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="Your name"
                  required
                  maxLength={100}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="author-email" className="text-sm">Email (optional)</Label>
                <Input
                  id="author-email"
                  type="email"
                  value={authorEmail}
                  onChange={(e) => setAuthorEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="h-9"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="comment-content" className="text-sm">Comment *</Label>
              <Textarea
                id="comment-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={placeholder}
                required
                maxLength={2000}
                rows={compact ? 3 : 4}
                className="resize-none"
              />
              <div className="text-xs text-muted-foreground text-right">
                {content.length}/2000
              </div>
            </div>
          </div>
          
          <div className="flex gap-2 justify-end">
            {(compact || onCancel) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !content.trim() || !authorName.trim()}
            >
              {isSubmitting ? (
                "Posting..."
              ) : (
                <>
                  <Send className="mr-1 h-3 w-3" />
                  {parentId ? "Reply" : "Comment"}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default CommentForm;