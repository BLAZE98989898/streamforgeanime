import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, RefreshCw } from "lucide-react";
import CommentItem from "./CommentItem";
import CommentForm from "./CommentForm";
import { Skeleton } from "@/components/ui/skeleton";

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

interface CommentsListProps {
  seriesId: string;
  episodeId?: string;
  title?: string;
}

const CommentsList = ({ seriesId, episodeId, title }: CommentsListProps) => {
  const [page, setPage] = useState(0);
  const [allComments, setAllComments] = useState<Comment[]>([]);
  const COMMENTS_PER_PAGE = 10;

  const { data: comments, isLoading, error, refetch } = useQuery({
    queryKey: ["comments", seriesId, episodeId, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_comments_with_stats", {
        p_series_id: seriesId,
        p_episode_id: episodeId || null,
        p_limit: COMMENTS_PER_PAGE,
        p_offset: page * COMMENTS_PER_PAGE,
      });

      if (error) throw error;
      return data as Comment[];
    },
  });

  // Real-time subscription for new comments
  useEffect(() => {
    const channel = supabase
      .channel("comments-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `series_id=eq.${seriesId}${episodeId ? ` AND episode_id=eq.${episodeId}` : ""}`,
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [seriesId, episodeId, refetch]);

  // Update all comments when new data comes in
  useEffect(() => {
    if (comments) {
      if (page === 0) {
        setAllComments(comments);
      } else {
        setAllComments(prev => [...prev, ...comments]);
      }
    }
  }, [comments, page]);

  const handleCommentAdded = () => {
    // Reset to first page and refetch
    setPage(0);
    setAllComments([]);
    refetch();
  };

  const handleLoadMore = () => {
    setPage(prev => prev + 1);
  };

  const totalComments = allComments.length;
  const hasMoreComments = comments && comments.length === COMMENTS_PER_PAGE;

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <p>Failed to load comments</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
              <RefreshCw className="mr-1 h-3 w-3" />
              Try again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            {title || "Comments"}
            {totalComments > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({totalComments} {totalComments === 1 ? "comment" : "comments"})
              </span>
            )}
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Comment Form */}
      <CommentForm
        seriesId={seriesId}
        episodeId={episodeId}
        onCommentAdded={handleCommentAdded}
      />

      {/* Comments List */}
      <div className="space-y-4">
        {isLoading && page === 0 ? (
          // Loading skeletons
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <div className="flex gap-2">
                        <Skeleton className="h-6 w-12" />
                        <Skeleton className="h-6 w-12" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : allComments.length === 0 ? (
          // Empty state
          <Card>
            <CardContent className="p-8">
              <div className="text-center text-muted-foreground">
                <MessageCircle className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No comments yet</p>
                <p className="text-sm">Be the first to share your thoughts!</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          // Comments
          <>
            {allComments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                onCommentUpdate={refetch}
              />
            ))}

            {/* Load More Button */}
            {hasMoreComments && (
              <div className="text-center">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Load more comments"
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CommentsList;