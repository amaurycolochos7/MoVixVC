-- Enable realtime for offers table
BEGIN;
  -- Check if table is already in publication, if not add it
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND tablename = 'offers'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE offers;
    END IF;
  END
  $$;
COMMIT;
