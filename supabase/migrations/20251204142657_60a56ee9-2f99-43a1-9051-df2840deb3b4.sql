-- Create enum for interview types and difficulty
CREATE TYPE public.interview_type AS ENUM ('technical', 'behavioral', 'case_study');
CREATE TYPE public.difficulty_level AS ENUM ('junior', 'mid', 'senior');
CREATE TYPE public.interview_status AS ENUM ('in_progress', 'completed', 'cancelled');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create interviews table
CREATE TABLE public.interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  job_role TEXT NOT NULL,
  difficulty difficulty_level NOT NULL DEFAULT 'mid',
  interview_type interview_type NOT NULL DEFAULT 'behavioral',
  total_questions INTEGER NOT NULL DEFAULT 5,
  status interview_status NOT NULL DEFAULT 'in_progress',
  overall_score DECIMAL(3,1),
  strengths TEXT[],
  improvements TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create questions table
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID REFERENCES public.interviews(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  question_order INTEGER NOT NULL,
  asked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create answers table
CREATE TABLE public.answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  answer_text TEXT NOT NULL,
  ai_feedback TEXT,
  score DECIMAL(3,1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Interviews policies
CREATE POLICY "Users can view own interviews" ON public.interviews
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own interviews" ON public.interviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own interviews" ON public.interviews
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own interviews" ON public.interviews
  FOR DELETE USING (auth.uid() = user_id);

-- Questions policies (through interview ownership)
CREATE POLICY "Users can view questions from own interviews" ON public.questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.interviews 
      WHERE interviews.id = questions.interview_id 
      AND interviews.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert questions to own interviews" ON public.questions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.interviews 
      WHERE interviews.id = questions.interview_id 
      AND interviews.user_id = auth.uid()
    )
  );

-- Answers policies (through interview ownership)
CREATE POLICY "Users can view answers from own interviews" ON public.answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.questions q
      JOIN public.interviews i ON i.id = q.interview_id
      WHERE q.id = answers.question_id 
      AND i.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert answers to own interviews" ON public.answers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.questions q
      JOIN public.interviews i ON i.id = q.interview_id
      WHERE q.id = answers.question_id 
      AND i.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update answers in own interviews" ON public.answers
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.questions q
      JOIN public.interviews i ON i.id = q.interview_id
      WHERE q.id = answers.question_id 
      AND i.user_id = auth.uid()
    )
  );

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$;

-- Trigger to create profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();