CREATE TABLE IF NOT EXISTS school_destinations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  demo_zone TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO school_destinations(name,demo_zone) VALUES
('Lycée d''État','Akanda'),
('Lycée Léon Mba','Akanda'),
('Quaben','Akanda'),
('Sainte-Marie','Akanda'),
('Immaculée','Akanda'),
('Bessieux','Akanda'),
('Lycée Technique National Omar Bongo','Owendo'),
('Lycée Public d''Owendo','Owendo'),
('CES d''Alénakiri','Owendo'),
('Lycée Privé Catholique Don Bosco','Owendo')
ON CONFLICT(name) DO NOTHING;