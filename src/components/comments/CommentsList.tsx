import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import CommentForm from "./CommentForm";
import CommentItem from "./CommentItem";
import { Button } from "@/components/ui/button";
import { MessageCircle, ChevronDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Comment {
  id: string;
  content: string;
  author_name: string;
  author_email?: string;
  likes_count: number;
  reply_count: number;
  created_at: string;
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

  const { data: comments, isLoading, refetch } = useQuery({
    queryKey: ["comments", seriesId, episodeId, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_comments_with_stats", {
        p_series_id: seriesId,
        p_episode_id: episodeId || null,
        p_limit: COMMENTS_PER_PAGE,
        p_offset: page * COMMENTS_PER_PAGE
      });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: totalCount } = useQuery({
    queryKey: ["comments-count", seriesId, episodeId],
    queryFn: async () => {
      let query = supabase
        .from("comments")
        .select("*", { count: "exact", head: true })
        .eq("series_id", seriesId)
        .is("parent_id", null);

      if (episodeId) {
        query = query.eq("episode_id", episodeId);
      } else {
        query = query.is("episode_id", null);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
  });

  // Real-time subscription for new comments
  useEffect(() => {
    const channel = supabase
      .channel("comments")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `series_id=eq.${seriesId}${episodeId ? ` and episode_id=eq.${episodeId}` : " and episode_id=is.null"}`
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

  // Update allComments when new data comes in
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
    setPage(0);
    refetch();
  };

  const loadMore = () => {
    setPage(prev => prev + 1);
  };

  const hasMore = totalCount ? allComments.length < totalCount : false;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5" />
        <h3 className="text-lg font-semibold">
          {title || "Comments"} {totalCount ? `(${totalCount})` : ""}
        </h3>
      </div>

      <CommentForm
        seriesId={seriesId}
        episodeId={episodeId}
        onCommentAdded={handleCommentAdded}
      />

      <div className="space-y-6">
        {isLoading && page === 0 ? (
          // Loading skeletons
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-16 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-12" />
                  <Skeleton className="h-6 w-12" />
                </div>
              </div>
            </div>
          ))
        ) : allComments.length > 0 ? (
          <>
            {allComments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                seriesId={seriesId}
                episodeId={episodeId}
                onCommentUpdate={refetch}
              />
            ))}
            
            {hasMore && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  {isLoading ? (
                    "Loading..."
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      Load more comments
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No comments yet. Be the first to comment!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommentsList;