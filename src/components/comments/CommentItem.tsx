import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Heart, MessageCircle, MoreVertical } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import CommentForm from "./CommentForm";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Comment {
  id: string;
  content: string;
  author_name: string;
  author_email?: string;
  series_id: string;
  episode_id?: string;
  parent_id?: string;
  likes_count: number;
  reply_count?: number;
  created_at: string;
  updated_at: string;
}

interface CommentItemProps {
  comment: Comment;
  onCommentUpdate?: () => void;
  showReplies?: boolean;
  isReply?: boolean;
}

const CommentItem = ({ comment, onCommentUpdate, showReplies = true, isReply = false }: CommentItemProps) => {
  const { toast } = useToast();
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(comment.likes_count);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showReplies, setShowRepliesState] = useState(false);
  const [replies, setReplies] = useState<Comment[]>([]);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);
  const [userIdentifier, setUserIdentifier] = useState<string>("");

  // Generate or retrieve user identifier for likes
  useEffect(() => {
    let identifier = localStorage.getItem("user_identifier");
    if (!identifier) {
      identifier = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("user_identifier", identifier);
    }
    setUserIdentifier(identifier);

    // Check if user has liked this comment
    const likedComments = JSON.parse(localStorage.getItem("liked_comments") || "[]");
    setIsLiked(likedComments.includes(comment.id));
  }, [comment.id]);

  const handleLike = async () => {
    if (!userIdentifier) return;

    try {
      const { data, error } = await supabase.rpc("toggle_comment_like", {
        p_comment_id: comment.id,
        p_user_identifier: userIdentifier,
      });

      if (error) throw error;

      setIsLiked(data.user_liked);
      setLikesCount(data.likes_count);

      // Update local storage
      const likedComments = JSON.parse(localStorage.getItem("liked_comments") || "[]");
      if (data.user_liked) {
        likedComments.push(comment.id);
      } else {
        const index = likedComments.indexOf(comment.id);
        if (index > -1) likedComments.splice(index, 1);
      }
      localStorage.setItem("liked_comments", JSON.stringify(likedComments));

      toast({
        title: data.action === "liked" ? "Comment liked" : "Like removed",
        description: `${data.likes_count} ${data.likes_count === 1 ? "like" : "likes"}`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to update like",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    }
  };

  const loadReplies = async () => {
    if (isReply || !comment.reply_count || comment.reply_count === 0) return;

    setIsLoadingReplies(true);
    try {
      const { data, error } = await supabase
        .from("comments")
        .select("*")
        .eq("parent_id", comment.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setReplies(data || []);
    } catch (error: any) {
      toast({
        title: "Failed to load replies",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoadingReplies(false);
    }
  };

  const handleShowReplies = () => {
    if (!showReplies) {
      loadReplies();
    }
    setShowRepliesState(!showReplies);
  };

  const handleReplyAdded = () => {
    setShowReplyForm(false);
    loadReplies();
    onCommentUpdate?.();
  };

  const getGravatarUrl = (email?: string) => {
    if (!email) return null;
    const hash = btoa(email.toLowerCase().trim()).replace(/[^a-zA-Z0-9]/g, '');
    return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=32`;
  };

  const timeAgo = formatDistanceToNow(new Date(comment.created_at), { addSuffix: true });

  return (
    <Card className={`${isReply ? "ml-8 border-l-2 border-l-muted" : ""}`}>
      <CardContent className="p-4">
        <div className="flex gap-3">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {comment.author_email ? (
              <img
                src={getGravatarUrl(comment.author_email) || "/placeholder.svg"}
                alt={`${comment.author_name}'s avatar`}
                className="h-8 w-8 rounded-full bg-muted"
                onError={(e) => {
                  e.currentTarget.src = "/placeholder.svg";
                }}
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                {comment.author_name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{comment.author_name}</span>
                <span className="text-xs text-muted-foreground">{timeAgo}</span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigator.clipboard.writeText(comment.content)}>
                    Copy comment
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    const url = `${window.location.origin}${window.location.pathname}#comment-${comment.id}`;
                    navigator.clipboard.writeText(url);
                    toast({ title: "Link copied", description: "Comment link copied to clipboard" });
                  }}>
                    Copy link
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Content */}
            <div className="mb-3">
              <p className="text-sm whitespace-pre-wrap break-words" id={`comment-${comment.id}`}>
                {comment.content}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLike}
                className={`h-7 px-2 ${isLiked ? "text-red-500" : "text-muted-foreground"}`}
              >
                <Heart className={`mr-1 h-3 w-3 ${isLiked ? "fill-current" : ""}`} />
                {likesCount > 0 && <span className="text-xs">{likesCount}</span>}
              </Button>

              {!isReply && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowReplyForm(!showReplyForm)}
                  className="h-7 px-2 text-muted-foreground"
                >
                  <MessageCircle className="mr-1 h-3 w-3" />
                  Reply
                </Button>
              )}

              {!isReply && comment.reply_count && comment.reply_count > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleShowReplies}
                  className="h-7 px-2 text-muted-foreground"
                  disabled={isLoadingReplies}
                >
                  {isLoadingReplies ? "Loading..." : showReplies ? "Hide replies" : `Show ${comment.reply_count} ${comment.reply_count === 1 ? "reply" : "replies"}`}
                </Button>
              )}
            </div>

            {/* Reply Form */}
            {showReplyForm && (
              <div className="mt-4">
                <CommentForm
                  seriesId={comment.series_id}
                  episodeId={comment.episode_id}
                  parentId={comment.id}
                  onCommentAdded={handleReplyAdded}
                  onCancel={() => setShowReplyForm(false)}
                  placeholder={`Reply to ${comment.author_name}...`}
                  compact
                />
              </div>
            )}

            {/* Replies */}
            {showReplies && replies.length > 0 && (
              <div className="mt-4 space-y-3">
                {replies.map((reply) => (
                  <CommentItem
                    key={reply.id}
                    comment={reply}
                    onCommentUpdate={onCommentUpdate}
                    showReplies={false}
                    isReply
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CommentItem;