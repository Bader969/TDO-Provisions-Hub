
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'member');
CREATE TYPE public.provider_type AS ENUM ('Strom','VF','1u1','O2','Ayyildiz','Check','Yourfone','DAK','BKK','UNKNOWN');
CREATE TYPE public.record_status AS ENUM ('open','booked','cancelled','review');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- USER ROLES (separate table to prevent privilege escalation)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RAW MESSAGES (incoming WhatsApp/Twilio)
CREATE TABLE public.raw_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  twilio_sid TEXT UNIQUE,
  from_number TEXT,
  from_name TEXT,
  body TEXT,
  media_url TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed BOOLEAN NOT NULL DEFAULT false,
  parse_error TEXT,
  ai_response JSONB
);
ALTER TABLE public.raw_messages ENABLE ROW LEVEL SECURITY;

-- RECORDS
CREATE TABLE public.records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider provider_type NOT NULL,
  status record_status NOT NULL DEFAULT 'open',
  record_date DATE,
  customer_name TEXT,
  tariff TEXT,
  tippgeber TEXT,
  provision NUMERIC(10,2),
  notes TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_message_id UUID REFERENCES public.raw_messages(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_records_provider ON public.records(provider);
CREATE INDEX idx_records_date ON public.records(record_date DESC);
CREATE INDEX idx_records_created_at ON public.records(created_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_records_updated BEFORE UPDATE ON public.records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup; first user becomes admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count <= 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies
-- profiles
CREATE POLICY "Authenticated can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- user_roles
CREATE POLICY "Authenticated can view roles" ON public.user_roles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- records
CREATE POLICY "Authenticated can view records" ON public.records
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert records" ON public.records
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update records" ON public.records
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete records" ON public.records
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- raw_messages: only admins
CREATE POLICY "Admins can view raw messages" ON public.raw_messages
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update raw messages" ON public.raw_messages
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.raw_messages;
ALTER TABLE public.records REPLICA IDENTITY FULL;
ALTER TABLE public.raw_messages REPLICA IDENTITY FULL;
