-- Create clients table for client account system
-- This allows clients to have their own accounts with restricted dashboard access

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL, -- bcrypt hashed
  company_name TEXT,
  contact_person TEXT,
  phone TEXT,
  
  -- Dashboard access permissions (JSON array of allowed dashboards)
  allowed_dashboards JSONB DEFAULT '[]'::jsonb,
  
  -- Additional permissions
  can_view_all_events BOOLEAN DEFAULT FALSE,
  allowed_event_ids JSONB DEFAULT '[]'::jsonb, -- Specific events they can access
  
  -- Account status
  is_active BOOLEAN DEFAULT TRUE,
  is_approved BOOLEAN DEFAULT FALSE,
  
  -- Audit fields
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT, -- Admin who created the account
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT,
  last_login_at TEXT,
  
  -- Notes for admin reference
  notes TEXT
);

-- Create index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_active ON clients(is_active, is_approved);

-- Insert a sample client account for testing
-- Password: 'client123' (hashed with bcrypt)
INSERT INTO clients (
  id, 
  name, 
  email, 
  password, 
  company_name,
  contact_person,
  allowed_dashboards,
  can_view_all_events,
  is_active,
  is_approved,
  created_by
) VALUES (
  'client-' || extract(epoch from now()) || '-sample',
  'Sample Client',
  'client@example.com',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- bcrypt hash of 'client123'
  'Sample Company Ltd',
  'John Doe',
  '["announcer-dashboard", "media-dashboard", "registration-dashboard"]'::jsonb,
  false,
  true,
  true,
  'system'
) ON CONFLICT (email) DO NOTHING;

-- Add client session tracking table
CREATE TABLE IF NOT EXISTS client_sessions (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_client_sessions_token ON client_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_client_sessions_client ON client_sessions(client_id);
