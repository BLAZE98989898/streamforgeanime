import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, Copy, MoreHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import CommentForm from "./CommentForm";
import { formatDistanceToNow } from "date-fns";
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
  likes_count: number;
  created_at: string;
  reply_count?: number;
}

interface CommentItemProps {
  comment: Comment;
  seriesId: string;
  episodeId?: string;
  onCommentUpdate?: () => void;
  showReplies?: boolean;
  isReply?: boolean;
}

const CommentItem = ({ 
  comment, 
  seriesId, 
  episodeId, 
  onCommentUpdate, 
  showReplies = true,
  isReply = false 
}: CommentItemProps) => {
  const { toast } = useToast();
  const [repliesVisible, setRepliesVisible] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replies, setReplies] = useState<Comment[]>([]);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);
  const [userLiked, setUserLiked] = useState(() => {
    const likedComments = JSON.parse(localStorage.getItem("liked_comments") || "[]");
    return likedComments.includes(comment.id);
  });
  const [likesCount, setLikesCount] = useState(comment.likes_count);

  const getGravatarUrl = (email?: string) => {
    if (!email) return "";
    const hash = btoa(email.toLowerCase().trim()).replace(/[^a-zA-Z0-9]/g, "");
    return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=40`;
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(word => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLike = async () => {
    try {
      const userIdentifier = `user_${Date.now()}_${Math.random()}`;
      
      const { data, error } = await supabase.rpc("toggle_comment_like", {
        p_comment_id: comment.id,
        p_user_identifier: userIdentifier
      });

      if (error) throw error;

      const newLikedState = data.action === "liked";
      setUserLiked(newLikedState);
      setLikesCount(data.likes_count);

      // Update localStorage
      const likedComments = JSON.parse(localStorage.getItem("liked_comments") || "[]");
      if (newLikedState) {
        likedComments.push(comment.id);
      } else {
        const index = likedComments.indexOf(comment.id);
        if (index > -1) likedComments.splice(index, 1);
      }
      localStorage.setItem("liked_comments", JSON.stringify(likedComments));

      onCommentUpdate?.();
    } catch (error: any) {
      console.error("Error toggling like:", error);
      toast({
        title: "Failed to update like",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    }
  };

  const loadReplies = async () => {
    if (isLoadingReplies || isReply) return;
    
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
      console.error("Error loading replies:", error);
      toast({
        title: "Failed to load replies",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    } finally {
      setIsLoadingReplies(false);
    }
  };

  const toggleReplies = () => {
    if (!repliesVisible && replies.length === 0) {
      loadReplies();
    }
    setRepliesVisible(!repliesVisible);
  };

  const handleReplyAdded = () => {
    setShowReplyForm(false);
    loadReplies();
    onCommentUpdate?.();
  };

  const copyCommentLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#comment-${comment.id}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copied!",
      description: "Comment link copied to clipboard"
    });
  };

  return (
    <div id={`comment-${comment.id}`} className={`space-y-3 ${isReply ? "ml-8" : ""}`}>
      <div className="flex gap-3">
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage 
            src={getGravatarUrl(comment.author_email)} 
            alt={comment.author_name}
          />
          <AvatarFallback className="text-xs">
            {getInitials(comment.author_name)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{comment.author_name}</span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </span>
          </div>

          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {comment.content}
          </p>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLike}
              className={`h-8 px-2 ${userLiked ? "text-red-500" : "text-muted-foreground"}`}
            >
              <Heart className={`mr-1 h-4 w-4 ${userLiked ? "fill-current" : ""}`} />
              {likesCount > 0 && <span className="text-xs">{likesCount}</span>}
            </Button>

            {showReplies && !isReply && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowReplyForm(!showReplyForm)}
                className="h-8 px-2 text-muted-foreground"
              >
                <MessageCircle className="mr-1 h-4 w-4" />
                Reply
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={copyCommentLink}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy link
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {showReplyForm && !isReply && (
        <div className="ml-11">
          <CommentForm
            seriesId={seriesId}
            episodeId={episodeId}
            parentId={comment.id}
            onCommentAdded={handleReplyAdded}
            placeholder="Write a reply..."
            buttonText="Reply"
            compact
          />
        </div>
      )}

      {showReplies && !isReply && comment.reply_count && comment.reply_count > 0 && (
        <div className="ml-11">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleReplies}
            className="text-blue-600 hover:text-blue-700 p-0 h-auto font-medium"
            disabled={isLoadingReplies}
          >
            {isLoadingReplies ? (
              "Loading replies..."
            ) : repliesVisible ? (
              `Hide ${comment.reply_count} ${comment.reply_count === 1 ? "reply" : "replies"}`
            ) : (
              `Show ${comment.reply_count} ${comment.reply_count === 1 ? "reply" : "replies"}`
            )}
          </Button>
        </div>
      )}

      {repliesVisible && replies.length > 0 && (
        <div className="space-y-4">
          {replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              seriesId={seriesId}
              episodeId={episodeId}
              onCommentUpdate={onCommentUpdate}
              showReplies={false}
              isReply
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CommentItem;