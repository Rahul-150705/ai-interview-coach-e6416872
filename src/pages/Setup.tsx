import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  ArrowRight, 
  Code, 
  Users, 
  Briefcase,
  Sparkles,
  Loader2
} from 'lucide-react';

const jobRoles = [
  'Software Engineer',
  'Product Manager',
  'Data Scientist',
  'UX Designer',
  'DevOps Engineer',
  'Marketing Manager',
  'Sales Representative',
  'Business Analyst',
];

const interviewTypes = [
  { id: 'technical', label: 'Technical', icon: Code, description: 'Coding, system design, technical knowledge' },
  { id: 'behavioral', label: 'Behavioral', icon: Users, description: 'Past experiences, teamwork, leadership' },
  { id: 'case_study', label: 'Case Study', icon: Briefcase, description: 'Business scenarios, analytical thinking' },
];

const difficultyLevels = [
  { id: 'junior', label: 'Junior', description: '0-2 years experience' },
  { id: 'mid', label: 'Mid-Level', description: '3-5 years experience' },
  { id: 'senior', label: 'Senior', description: '6+ years experience' },
];

const questionCounts = [5, 10, 15];

const Setup: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [jobRole, setJobRole] = useState('');
  const [customRole, setCustomRole] = useState('');
  const [interviewType, setInterviewType] = useState('behavioral');
  const [difficulty, setDifficulty] = useState('mid');
  const [questionCount, setQuestionCount] = useState(5);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const handleStartInterview = async () => {
    const finalRole = jobRole === 'custom' ? customRole : jobRole;
    
    if (!finalRole.trim()) {
      toast({
        title: 'Please select a role',
        description: 'Choose a job role or enter a custom one.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);

    try {
      const { data, error } = await supabase
        .from('interviews')
        .insert({
          user_id: user!.id,
          job_role: finalRole,
          difficulty: difficulty as 'junior' | 'mid' | 'senior',
          interview_type: interviewType as 'technical' | 'behavioral' | 'case_study',
          total_questions: questionCount,
          status: 'in_progress',
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Interview created!',
        description: 'Get ready for your mock interview.',
      });

      navigate(`/interview/${data.id}`);
    } catch (error) {
      console.error('Error creating interview:', error);
      toast({
        title: 'Error',
        description: 'Failed to create interview. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-orange-500 mb-4 glow-effect">
            <Sparkles className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Set Up Your Interview</h1>
          <p className="text-muted-foreground">Customize your mock interview experience</p>
        </div>

        <div className="space-y-8">
          {/* Job Role */}
          <div className="glass-card p-6">
            <Label className="text-lg font-semibold text-foreground mb-4 block">Job Role</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {jobRoles.map((role) => (
                <button
                  key={role}
                  onClick={() => setJobRole(role)}
                  className={`p-3 rounded-xl text-sm font-medium transition-all ${
                    jobRole === role
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                      : 'bg-secondary/50 text-foreground hover:bg-secondary'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setJobRole('custom')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  jobRole === 'custom'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary/50 text-foreground hover:bg-secondary'
                }`}
              >
                Custom
              </button>
              {jobRole === 'custom' && (
                <Input
                  placeholder="Enter job role..."
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  className="flex-1"
                />
              )}
            </div>
          </div>

          {/* Interview Type */}
          <div className="glass-card p-6">
            <Label className="text-lg font-semibold text-foreground mb-4 block">Interview Type</Label>
            <div className="grid sm:grid-cols-3 gap-4">
              {interviewTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() => setInterviewType(type.id)}
                    className={`p-4 rounded-xl text-left transition-all ${
                      interviewType === type.id
                        ? 'bg-primary/10 border-2 border-primary'
                        : 'bg-secondary/50 border-2 border-transparent hover:bg-secondary'
                    }`}
                  >
                    <Icon className={`w-6 h-6 mb-2 ${interviewType === type.id ? 'text-primary' : 'text-muted-foreground'}`} />
                    <p className="font-semibold text-foreground">{type.label}</p>
                    <p className="text-sm text-muted-foreground">{type.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Difficulty */}
          <div className="glass-card p-6">
            <Label className="text-lg font-semibold text-foreground mb-4 block">Difficulty Level</Label>
            <div className="grid sm:grid-cols-3 gap-4">
              {difficultyLevels.map((level) => (
                <button
                  key={level.id}
                  onClick={() => setDifficulty(level.id)}
                  className={`p-4 rounded-xl text-left transition-all ${
                    difficulty === level.id
                      ? 'bg-primary/10 border-2 border-primary'
                      : 'bg-secondary/50 border-2 border-transparent hover:bg-secondary'
                  }`}
                >
                  <p className="font-semibold text-foreground">{level.label}</p>
                  <p className="text-sm text-muted-foreground">{level.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Question Count */}
          <div className="glass-card p-6">
            <Label className="text-lg font-semibold text-foreground mb-4 block">Number of Questions</Label>
            <div className="flex gap-4">
              {questionCounts.map((count) => (
                <button
                  key={count}
                  onClick={() => setQuestionCount(count)}
                  className={`w-20 h-20 rounded-xl text-xl font-bold transition-all ${
                    questionCount === count
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                      : 'bg-secondary/50 text-foreground hover:bg-secondary'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          {/* Start Button */}
          <Button 
            variant="hero" 
            size="xl" 
            className="w-full" 
            onClick={handleStartInterview}
            disabled={isCreating}
          >
            {isCreating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Start Interview
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Setup;
