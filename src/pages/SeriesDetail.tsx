import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import DailymotionPlayer from "@/components/player/DailymotionPlayer";
import YouTubePlayer from "@/components/player/YouTubePlayer";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SeriesDetail = () => {
  const { id } = useParams();
  const { toast } = useToast();

  const { data: series, refetch } = useQuery({
    queryKey: ["series", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("series")
        .select("id,title,description,dailymotion_playlist_id,youtube_playlist_id,cover_image_url,views_count,rating_sum,rating_count")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: episodes } = useQuery({
    queryKey: ["episodes", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("episodes")
        .select("id,title,dailymotion_video_id,youtube_video_id,season_number,episode_number")
        .eq("series_id", id)
        .order("season_number", { ascending: true, nullsFirst: true })
        .order("episode_number", { ascending: true, nullsFirst: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const [provider, setProvider] = useState<"dailymotion" | "youtube">("dailymotion");
  const [currentId, setCurrentId] = useState<string | undefined>(undefined);
  const [isWatching, setIsWatching] = useState(false);
  const [watchStartTime, setWatchStartTime] = useState<number | null>(null);
  const [totalViewsAdded, setTotalViewsAdded] = useState(0);

  useEffect(() => {
    if (!id) return;
    // Initial view count increment when page loads
    supabase.rpc("increment_series_view", { p_series_id: id }).then(() => {
      refetch();
      setTotalViewsAdded(1);
    });
  }, [id, refetch]);

  // Time-based view counting system
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isWatching && id) {
      interval = setInterval(async () => {
        try {
          await supabase.rpc("increment_series_view", { p_series_id: id });
          setTotalViewsAdded(prev => prev + 1);
          refetch();
        } catch (error) {
          console.error("Failed to increment view:", error);
        }
      }, 5000); // Increment every 5 seconds
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isWatching, id, refetch]);

  // Handle player events to track watching state
  const handlePlayerStart = () => {
    setIsWatching(true);
    setWatchStartTime(Date.now());
  };

  const handlePlayerPause = () => {
    setIsWatching(false);
  };

  const handlePlayerEnd = () => {
    setIsWatching(false);
    if (watchStartTime) {
      const watchDuration = Math.floor((Date.now() - watchStartTime) / 1000);
      toast({
        title: "Thanks for watching!",
        description: `You watched for ${Math.floor(watchDuration / 60)}m ${watchDuration % 60}s and contributed ${totalViewsAdded} views`,
      });
    }
  };

  // Reset watching state when changing videos
  useEffect(() => {
    setIsWatching(false);
    setWatchStartTime(null);
    setTotalViewsAdded(1); // Reset to initial view
  }, [currentId, provider]);
  
  useEffect(() => {
    if (series?.dailymotion_playlist_id) {
      setProvider("dailymotion");
      setCurrentId(undefined);
      return;
    }
    if (series?.youtube_playlist_id) {
      setProvider("youtube");
      setCurrentId(undefined);
      return;
    }
    // No playlist: pick first episode
    const first = episodes?.[0];
    if (first?.dailymotion_video_id) {
      setProvider("dailymotion");
      setCurrentId(first.dailymotion_video_id);
    } else if (first?.youtube_video_id) {
      setProvider("youtube");
      setCurrentId(first.youtube_video_id);
    }
  }, [series?.dailymotion_playlist_id, series?.youtube_playlist_id, episodes]);

  const ratingAvg = series && series.rating_count > 0 ? (series.rating_sum / series.rating_count).toFixed(1) : "0.0";

  return (
    <main className="container mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="mb-2 text-3xl font-bold">{series?.title || "Series"}</h1>
        <div className="text-sm text-muted-foreground">
          <span>{series?.views_count ?? 0} views</span>
          <span className="mx-2">•</span>
          <span>{ratingAvg} ★</span>
          {isWatching && (
            <>
              <span className="mx-2">•</span>
              <span className="text-green-600">● Watching (+{totalViewsAdded} views)</span>
            </>
          )}
        </div>
        {series?.description && (
          <p className="mt-2 text-muted-foreground">{series.description}</p>
        )}
      </header>

      <div className="mb-4 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
        <p>📊 <strong>View System:</strong> Views increment every 5 seconds while watching. A 30-minute watch session = ~360 views!</p>
      </div>

      {provider === "dailymotion" ? (
        <DailymotionPlayer
          title={series?.title || "Series Player"}
          playlistId={series?.dailymotion_playlist_id || undefined}
          videoId={series?.dailymotion_playlist_id ? undefined : currentId}
          onPlay={handlePlayerStart}
          onPause={handlePlayerPause}
          onEnded={handlePlayerEnd}
        />
      ) : (
        <YouTubePlayer
          title={series?.title || "Series Player"}
          playlistId={series?.youtube_playlist_id || undefined}
          videoId={series?.youtube_playlist_id ? undefined : currentId}
          onPlay={handlePlayerStart}
          onPause={handlePlayerPause}
          onEnded={handlePlayerEnd}
        />
      )}

      <div className="mt-8">
        {episodes && episodes.length > 0 ? (
          <section>
            <h2 className="mb-3 text-xl font-semibold">Episodes</h2>
            <ul className="grid gap-2">
              {episodes.map((ep) => (
                <li
                  key={ep.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (ep.dailymotion_video_id) {
                      setProvider("dailymotion");
                      setCurrentId(ep.dailymotion_video_id);
                    } else if (ep.youtube_video_id) {
                      setProvider("youtube");
                      setCurrentId(ep.youtube_video_id);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (ep.dailymotion_video_id) {
                        setProvider("dailymotion");
                        setCurrentId(ep.dailymotion_video_id);
                      } else if (ep.youtube_video_id) {
                        setProvider("youtube");
                        setCurrentId(ep.youtube_video_id);
                      }
                    }
                  }}
                  className={`rounded-md border p-3 transition-colors hover:bg-accent ${currentId && ((provider === 'dailymotion' && currentId === ep.dailymotion_video_id) || (provider === 'youtube' && currentId === ep.youtube_video_id)) ? "border-primary" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{ep.title}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            <p>No episodes available</p>
          </div>
        )}
      </div>
    </main>
  );
};

export default SeriesDetail;