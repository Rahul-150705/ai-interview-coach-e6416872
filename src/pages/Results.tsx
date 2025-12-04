import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Trophy, 
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Plus
} from 'lucide-react';

interface InterviewResult {
  id: string;
  job_role: string;
  difficulty: string;
  interview_type: string;
  total_questions: number;
  overall_score: number;
  strengths: string[];
  improvements: string[];
  completed_at: string;
}

interface QA {
  question: string;
  answer: string;
  feedback: string;
  score: number;
}

const Results: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [interview, setInterview] = useState<InterviewResult | null>(null);
  const [qaList, setQaList] = useState<QA[]>([]);
  const [expandedQA, setExpandedQA] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }
    if (user && id) {
      fetchResults();
    }
  }, [user, authLoading, id, navigate]);

  const fetchResults = async () => {
    try {
      const { data: interviewData, error: interviewError } = await supabase
        .from('interviews')
        .select('*')
        .eq('id', id)
        .single();

      if (interviewError) throw interviewError;

      if (interviewData.status !== 'completed') {
        navigate(`/interview/${id}`);
        return;
      }

      setInterview(interviewData as InterviewResult);

      // Fetch questions and answers
      const { data: questionsData } = await supabase
        .from('questions')
        .select('*, answers(*)')
        .eq('interview_id', id)
        .order('question_order', { ascending: true });

      if (questionsData) {
        const qaData: QA[] = questionsData.map(q => ({
          question: q.question_text,
          answer: q.answers?.[0]?.answer_text || '',
          feedback: q.answers?.[0]?.ai_feedback || '',
          score: q.answers?.[0]?.score || 0,
        }));
        setQaList(qaData);
      }
    } catch (error) {
      console.error('Error fetching results:', error);
      toast({
        title: 'Error',
        description: 'Failed to load results',
        variant: 'destructive',
      });
      navigate('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-success';
    if (score >= 6) return 'text-primary';
    if (score >= 4) return 'text-yellow-500';
    return 'text-destructive';
  };

  const getScoreBg = (score: number) => {
    if (score >= 8) return 'bg-success/10 border-success/30';
    if (score >= 6) return 'bg-primary/10 border-primary/30';
    if (score >= 4) return 'bg-yellow-500/10 border-yellow-500/30';
    return 'bg-destructive/10 border-destructive/30';
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!interview) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Score Card */}
        <div className="glass-card p-8 mb-8 text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-primary to-orange-500 mb-4 glow-effect">
            <Trophy className="w-12 h-12 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Interview Complete!</h1>
          <p className="text-muted-foreground mb-6">
            {interview.job_role} • {interview.interview_type.replace('_', ' ')} • {interview.difficulty}
          </p>
          
          <div className={`inline-flex items-center justify-center w-32 h-32 rounded-full border-4 mb-4 ${getScoreBg(interview.overall_score)}`}>
            <span className={`text-5xl font-bold ${getScoreColor(interview.overall_score)}`}>
              {interview.overall_score}
            </span>
            <span className="text-xl text-muted-foreground">/10</span>
          </div>

          <p className="text-lg text-foreground font-medium">
            {interview.overall_score >= 8 ? 'Excellent Performance!' :
             interview.overall_score >= 6 ? 'Good Job!' :
             interview.overall_score >= 4 ? 'Room for Improvement' :
             'Keep Practicing!'}
          </p>
        </div>

        {/* Strengths & Improvements */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Strengths */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-success" />
              <h3 className="text-lg font-semibold text-foreground">Strengths</h3>
            </div>
            {interview.strengths && interview.strengths.length > 0 ? (
              <ul className="space-y-3">
                {interview.strengths.map((strength, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="w-6 h-6 rounded-full bg-success/10 text-success text-sm font-medium flex items-center justify-center flex-shrink-0">
                      {index + 1}
                    </span>
                    <span className="text-muted-foreground">{strength}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">Analysis in progress...</p>
            )}
          </div>

          {/* Improvements */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Areas to Improve</h3>
            </div>
            {interview.improvements && interview.improvements.length > 0 ? (
              <ul className="space-y-3">
                {interview.improvements.map((improvement, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium flex items-center justify-center flex-shrink-0">
                      {index + 1}
                    </span>
                    <span className="text-muted-foreground">{improvement}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">Analysis in progress...</p>
            )}
          </div>
        </div>

        {/* Q&A Breakdown */}
        <div className="glass-card p-6 mb-8">
          <h3 className="text-lg font-semibold text-foreground mb-4">Question Breakdown</h3>
          <div className="space-y-4">
            {qaList.map((qa, index) => (
              <div 
                key={index} 
                className="border border-border/50 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setExpandedQA(expandedQA === index ? null : index)}
                  className="w-full p-4 flex items-center justify-between bg-secondary/30 hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${getScoreBg(qa.score)} ${getScoreColor(qa.score)}`}>
                      {qa.score}
                    </span>
                    <span className="text-foreground font-medium text-left">Question {index + 1}</span>
                  </div>
                  {expandedQA === index ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </button>
                
                {expandedQA === index && (
                  <div className="p-4 space-y-4 animate-fade-in">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Question</p>
                      <p className="text-foreground">{qa.question}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Your Answer</p>
                      <p className="text-foreground bg-secondary/30 rounded-lg p-3">{qa.answer}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Feedback</p>
                      <p className="text-foreground bg-primary/5 border border-primary/20 rounded-lg p-3">{qa.feedback}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button variant="outline" size="lg" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
          <Button variant="hero" size="lg" onClick={() => navigate('/setup')}>
            <Plus className="w-5 h-5" />
            New Interview
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Results;
