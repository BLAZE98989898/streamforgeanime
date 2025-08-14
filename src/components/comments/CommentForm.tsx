import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Send } from "lucide-react";

interface CommentFormProps {
  seriesId: string;
  episodeId?: string;
  parentId?: string;
  onCommentAdded?: () => void;
  placeholder?: string;
  buttonText?: string;
  compact?: boolean;
}

const CommentForm = ({
  seriesId,
  episodeId,
  parentId,
  onCommentAdded,
  placeholder = "Add a comment...",
  buttonText = "Comment",
  compact = false
}: CommentFormProps) => {
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [authorName, setAuthorName] = useState(() => 
    localStorage.getItem("comment_author_name") || ""
  );
  const [authorEmail, setAuthorEmail] = useState(() => 
    localStorage.getItem("comment_author_email") || ""
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(!compact);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) {
      toast({
        title: "Comment required",
        description: "Please enter a comment",
        variant: "destructive"
      });
      return;
    }

    if (!authorName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your name",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Save user info to localStorage
      localStorage.setItem("comment_author_name", authorName.trim());
      if (authorEmail.trim()) {
        localStorage.setItem("comment_author_email", authorEmail.trim());
      }

      const { error } = await supabase.rpc("create_comment", {
        p_content: content.trim(),
        p_author_name: authorName.trim(),
        p_author_email: authorEmail.trim() || null,
        p_series_id: seriesId,
        p_episode_id: episodeId || null,
        p_parent_id: parentId || null
      });

      if (error) throw error;

      setContent("");
      if (compact) {
        setShowForm(false);
      }
      onCommentAdded?.();
      
      toast({
        title: "Comment posted!",
        description: "Your comment has been added successfully"
      });
    } catch (error: any) {
      console.error("Error posting comment:", error);
      toast({
        title: "Failed to post comment",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (compact && !showForm) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowForm(true)}
        className="text-muted-foreground hover:text-foreground"
      >
        Reply
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-3">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholder}
          className="min-h-[80px] resize-none"
          maxLength={2000}
          required
        />
        
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="author-name" className="sr-only">Name</Label>
            <Input
              id="author-name"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Your name"
              maxLength={100}
              required
            />
          </div>
          <div>
            <Label htmlFor="author-email" className="sr-only">Email (optional)</Label>
            <Input
              id="author-email"
              type="email"
              value={authorEmail}
              onChange={(e) => setAuthorEmail(e.target.value)}
              placeholder="Email (optional, for avatar)"
              maxLength={255}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {content.length}/2000 characters
        </div>
        <div className="flex gap-2">
          {compact && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowForm(false);
                setContent("");
              }}
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
                <Send className="mr-2 h-4 w-4" />
                {buttonText}
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
};

export default CommentForm;