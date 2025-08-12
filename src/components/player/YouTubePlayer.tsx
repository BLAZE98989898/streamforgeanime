import { AspectRatio } from "@/components/ui/aspect-ratio";
import { cn } from "@/lib/utils";

interface YouTubePlayerProps {
  videoId?: string;
  playlistId?: string;
  title?: string;
  className?: string;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
}

const YouTubePlayer = ({ videoId, playlistId, title = "YouTube Player", className, onPlay, onPause, onEnded }: YouTubePlayerProps) => {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://www.youtube.com') return;
      
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        
        if (data.event === 'video-progress') {
          switch (data.info?.playerState) {
            case 1: // Playing
              onPlay?.();
              break;
            case 2: // Paused
              onPause?.();
              break;
            case 0: // Ended
              onEnded?.();
              break;
          }
        }
      } catch (error) {
        // Ignore parsing errors
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onPlay, onPause, onEnded]);

  const normalizeVideoId = (input?: string) => {
    if (!input) return undefined;
    const url = new URL(input, window.location.origin);
    if (url.hostname.includes("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v) return v;
      const embed = url.pathname.match(/\/embed\/([A-Za-z0-9_-]{6,})/i);
      if (embed) return embed[1];
    }
    if (url.hostname.includes("youtu.be")) {
      const short = url.pathname.replace(/^\//, "");
      if (short) return short;
    }
    return input;
  };

  const normalizePlaylistId = (input?: string) => {
    if (!input) return undefined;
    try {
      const url = new URL(input, window.location.origin);
      if (url.hostname.includes("youtube.com")) {
        const list = url.searchParams.get("list");
        if (list) return list;
      }
    } catch {}
    return input;
  };

  const effectiveVideoId = normalizeVideoId(videoId);
  const effectivePlaylistId = normalizePlaylistId(playlistId);
  const src = effectivePlaylistId
    ? `https://www.youtube.com/embed/videoseries?list=${effectivePlaylistId}&enablejsapi=1&origin=${window.location.origin}`
    : `https://www.youtube.com/embed/${effectiveVideoId}?enablejsapi=1&origin=${window.location.origin}`;

  return (
    <div className={cn("mx-auto w-full max-w-[420px] sm:max-w-[520px] md:max-w-[720px] lg:max-w-[960px]", className)}>
      <AspectRatio ratio={16 / 9}>
        <iframe
          ref={iframeRef}
          loading="lazy"
          src={src}
          title={title}
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          sandbox="allow-same-origin allow-scripts allow-popups allow-presentation"
          className="h-full w-full rounded-lg border"
        />
      </AspectRatio>
    </div>
  );
};

export default YouTubePlayer;
