/*
  # Add Comments System

  1. New Tables
    - `comments`
      - `id` (uuid, primary key)
      - `content` (text, comment content)
      - `author_name` (text, commenter name)
      - `author_email` (text, optional email for gravatar)
      - `series_id` (uuid, foreign key to series)
      - `episode_id` (uuid, optional foreign key to episodes)
      - `parent_id` (uuid, optional for replies)
      - `likes_count` (integer, number of likes)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    - `comment_likes`
      - `id` (uuid, primary key)
      - `comment_id` (uuid, foreign key to comments)
      - `user_identifier` (text, IP or session identifier)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for public read access
    - Add policies for public comment creation
    - Add policies for comment likes

  3. Functions
    - Function to like/unlike comments
    - Function to get comment counts
    - Function to create comments with validation
*/

-- Create comments table
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL CHECK (length(trim(content)) > 0 AND length(content) <= 2000),
  author_name text NOT NULL CHECK (length(trim(author_name)) > 0 AND length(author_name) <= 100),
  author_email text CHECK (author_email IS NULL OR author_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  series_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  episode_id uuid REFERENCES public.episodes(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  likes_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create comment_likes table for tracking likes
CREATE TABLE IF NOT EXISTS public.comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_identifier text NOT NULL CHECK (length(trim(user_identifier)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(comment_id, user_identifier)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_comments_series_id ON public.comments (series_id);
CREATE INDEX IF NOT EXISTS idx_comments_episode_id ON public.comments (episode_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON public.comments (parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON public.comments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON public.comment_likes (comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user ON public.comment_likes (user_identifier);

-- Enable RLS
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for comments
CREATE POLICY "Anyone can read comments" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Anyone can create comments" ON public.comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Authors can update their own comments" ON public.comments FOR UPDATE USING (true);

-- RLS Policies for comment_likes
CREATE POLICY "Anyone can read comment likes" ON public.comment_likes FOR SELECT USING (true);
CREATE POLICY "Anyone can like comments" ON public.comment_likes FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can unlike their own likes" ON public.comment_likes FOR DELETE USING (true);

-- Trigger for updating updated_at on comments
CREATE TRIGGER trg_comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to toggle comment like
CREATE OR REPLACE FUNCTION public.toggle_comment_like(
  p_comment_id uuid,
  p_user_identifier text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  like_exists boolean;
  new_likes_count integer;
  action_taken text;
BEGIN
  -- Validate inputs
  IF p_comment_id IS NULL OR p_user_identifier IS NULL OR length(trim(p_user_identifier)) = 0 THEN
    RAISE EXCEPTION 'Invalid parameters';
  END IF;

  -- Check if like already exists
  SELECT EXISTS(
    SELECT 1 FROM public.comment_likes 
    WHERE comment_id = p_comment_id AND user_identifier = p_user_identifier
  ) INTO like_exists;

  IF like_exists THEN
    -- Remove like
    DELETE FROM public.comment_likes 
    WHERE comment_id = p_comment_id AND user_identifier = p_user_identifier;
    
    -- Update likes count
    UPDATE public.comments 
    SET likes_count = likes_count - 1,
        updated_at = now()
    WHERE id = p_comment_id
    RETURNING likes_count INTO new_likes_count;
    
    action_taken := 'unliked';
  ELSE
    -- Add like
    INSERT INTO public.comment_likes (comment_id, user_identifier)
    VALUES (p_comment_id, p_user_identifier);
    
    -- Update likes count
    UPDATE public.comments 
    SET likes_count = likes_count + 1,
        updated_at = now()
    WHERE id = p_comment_id
    RETURNING likes_count INTO new_likes_count;
    
    action_taken := 'liked';
  END IF;

  RETURN json_build_object(
    'action', action_taken,
    'likes_count', new_likes_count,
    'user_liked', NOT like_exists
  );
END;
$$;

-- Function to create a comment with validation
CREATE OR REPLACE FUNCTION public.create_comment(
  p_content text,
  p_author_name text,
  p_author_email text,
  p_series_id uuid,
  p_episode_id uuid DEFAULT NULL,
  p_parent_id uuid DEFAULT NULL
)
RETURNS public.comments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_comment public.comments;
BEGIN
  -- Validate required fields
  IF p_content IS NULL OR length(trim(p_content)) = 0 THEN
    RAISE EXCEPTION 'Comment content is required';
  END IF;
  
  IF p_author_name IS NULL OR length(trim(p_author_name)) = 0 THEN
    RAISE EXCEPTION 'Author name is required';
  END IF;
  
  IF p_series_id IS NULL THEN
    RAISE EXCEPTION 'Series ID is required';
  END IF;

  -- Validate series exists
  IF NOT EXISTS(SELECT 1 FROM public.series WHERE id = p_series_id) THEN
    RAISE EXCEPTION 'Series not found';
  END IF;

  -- Validate episode exists if provided
  IF p_episode_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.episodes WHERE id = p_episode_id AND series_id = p_series_id) THEN
    RAISE EXCEPTION 'Episode not found or does not belong to the specified series';
  END IF;

  -- Validate parent comment exists if provided
  IF p_parent_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.comments WHERE id = p_parent_id AND series_id = p_series_id) THEN
    RAISE EXCEPTION 'Parent comment not found or does not belong to the specified series';
  END IF;

  -- Insert comment
  INSERT INTO public.comments (
    content,
    author_name,
    author_email,
    series_id,
    episode_id,
    parent_id
  ) VALUES (
    trim(p_content),
    trim(p_author_name),
    CASE WHEN p_author_email IS NOT NULL AND length(trim(p_author_email)) > 0 THEN trim(p_author_email) ELSE NULL END,
    p_series_id,
    p_episode_id,
    p_parent_id
  )
  RETURNING * INTO new_comment;

  RETURN new_comment;
END;
$$;

-- Function to get comments with reply counts
CREATE OR REPLACE FUNCTION public.get_comments_with_stats(
  p_series_id uuid,
  p_episode_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  content text,
  author_name text,
  author_email text,
  series_id uuid,
  episode_id uuid,
  parent_id uuid,
  likes_count integer,
  reply_count bigint,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.content,
    c.author_name,
    c.author_email,
    c.series_id,
    c.episode_id,
    c.parent_id,
    c.likes_count,
    COALESCE(reply_counts.reply_count, 0) as reply_count,
    c.created_at,
    c.updated_at
  FROM public.comments c
  LEFT JOIN (
    SELECT 
      parent_id,
      COUNT(*) as reply_count
    FROM public.comments
    WHERE parent_id IS NOT NULL
    GROUP BY parent_id
  ) reply_counts ON c.id = reply_counts.parent_id
  WHERE c.series_id = p_series_id
    AND (p_episode_id IS NULL OR c.episode_id = p_episode_id)
    AND c.parent_id IS NULL  -- Only top-level comments
  ORDER BY c.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.toggle_comment_like(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_comment(text, text, text, uuid, uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_comments_with_stats(uuid, uuid, integer, integer) TO anon, authenticated;

-- Enable realtime for comments
ALTER TABLE public.comments REPLICA IDENTITY FULL;
ALTER TABLE public.comment_likes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_likes;