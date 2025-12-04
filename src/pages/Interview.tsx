import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Send, 
  Loader2, 
  MessageSquare,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface InterviewData {
  id: string;
  job_role: string;
  difficulty: string;
  interview_type: string;
  total_questions: number;
  status: string;
}

interface QA {
  question: string;
  questionId: string;
  answer: string;
  answerId?: string;
  feedback?: string;
  score?: number;
}

const Interview: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [interview, setInterview] = useState<InterviewData | null>(null);
  const [qaHistory, setQaHistory] = useState<QA[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [currentQuestionId, setCurrentQuestionId] = useState<string>('');
  const [userAnswer, setUserAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [questionNumber, setQuestionNumber] = useState(1);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }
    if (user && id) {
      fetchInterview();
    }
  }, [user, authLoading, id, navigate]);

  const fetchInterview = async () => {
    try {
      const { data: interviewData, error: interviewError } = await supabase
        .from('interviews')
        .select('*')
        .eq('id', id)
        .single();

      if (interviewError) throw interviewError;
      
      if (interviewData.status === 'completed') {
        navigate(`/results/${id}`);
        return;
      }

      setInterview(interviewData);

      // Fetch existing questions and answers
      const { data: questionsData } = await supabase
        .from('questions')
        .select('*, answers(*)')
        .eq('interview_id', id)
        .order('question_order', { ascending: true });

      if (questionsData && questionsData.length > 0) {
        const existingQA: QA[] = questionsData.map(q => ({
          question: q.question_text,
          questionId: q.id,
          answer: q.answers?.[0]?.answer_text || '',
          answerId: q.answers?.[0]?.id,
          feedback: q.answers?.[0]?.ai_feedback || undefined,
          score: q.answers?.[0]?.score || undefined,
        }));
        setQaHistory(existingQA);
        setQuestionNumber(questionsData.length + 1);

        // If the last question wasn't answered, continue from there
        const lastQuestion = questionsData[questionsData.length - 1];
        if (!lastQuestion.answers || lastQuestion.answers.length === 0) {
          setCurrentQuestion(lastQuestion.question_text);
          setCurrentQuestionId(lastQuestion.id);
          setQaHistory(existingQA.slice(0, -1));
          setQuestionNumber(questionsData.length);
        } else if (questionsData.length < interviewData.total_questions) {
          generateNextQuestion(interviewData, existingQA);
        } else {
          // All questions answered, generate final feedback
          generateFinalFeedback(interviewData, existingQA);
        }
      } else {
        generateNextQuestion(interviewData, []);
      }
    } catch (error) {
      console.error('Error fetching interview:', error);
      toast({
        title: 'Error',
        description: 'Failed to load interview',
        variant: 'destructive',
      });
      navigate('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const generateNextQuestion = async (interviewData: InterviewData, history: QA[]) => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('interview-ai', {
        body: {
          type: 'generate_question',
          jobRole: interviewData.job_role,
          difficulty: interviewData.difficulty,
          interviewType: interviewData.interview_type,
          questionNumber: history.length + 1,
          totalQuestions: interviewData.total_questions,
          previousQuestions: history.map(qa => qa.question),
        },
      });

      if (error) throw error;

      const questionText = data.result.trim();

      // Save question to database
      const { data: savedQuestion, error: saveError } = await supabase
        .from('questions')
        .insert({
          interview_id: interviewData.id,
          question_text: questionText,
          question_order: history.length + 1,
        })
        .select()
        .single();

      if (saveError) throw saveError;

      setCurrentQuestion(questionText);
      setCurrentQuestionId(savedQuestion.id);
      setQuestionNumber(history.length + 1);
    } catch (error) {
      console.error('Error generating question:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate question. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!userAnswer.trim() || !interview) return;

    setIsSubmitting(true);

    try {
      // Get AI feedback
      const { data: feedbackData, error: feedbackError } = await supabase.functions.invoke('interview-ai', {
        body: {
          type: 'evaluate_answer',
          jobRole: interview.job_role,
          difficulty: interview.difficulty,
          interviewType: interview.interview_type,
          currentQuestion: currentQuestion,
          userAnswer: userAnswer,
        },
      });

      if (feedbackError) throw feedbackError;

      let feedback = '';
      let score = 5;

      try {
        const parsed = JSON.parse(feedbackData.result);
        feedback = parsed.feedback || feedbackData.result;
        score = parsed.score || 5;
      } catch {
        feedback = feedbackData.result;
      }

      // Save answer to database
      const { data: savedAnswer, error: saveError } = await supabase
        .from('answers')
        .insert({
          question_id: currentQuestionId,
          answer_text: userAnswer,
          ai_feedback: feedback,
          score: score,
        })
        .select()
        .single();

      if (saveError) throw saveError;

      const newQA: QA = {
        question: currentQuestion,
        questionId: currentQuestionId,
        answer: userAnswer,
        answerId: savedAnswer.id,
        feedback: feedback,
        score: score,
      };

      const updatedHistory = [...qaHistory, newQA];
      setQaHistory(updatedHistory);
      setUserAnswer('');
      setCurrentQuestion('');

      // Check if interview is complete
      if (updatedHistory.length >= interview.total_questions) {
        generateFinalFeedback(interview, updatedHistory);
      } else {
        generateNextQuestion(interview, updatedHistory);
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit answer. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateFinalFeedback = async (interviewData: InterviewData, history: QA[]) => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('interview-ai', {
        body: {
          type: 'generate_feedback',
          jobRole: interviewData.job_role,
          difficulty: interviewData.difficulty,
          interviewType: interviewData.interview_type,
          allQA: history.map(qa => ({
            question: qa.question,
            answer: qa.answer,
            score: qa.score || 5,
          })),
        },
      });

      if (error) throw error;

      let overallScore = 5;
      let strengths: string[] = [];
      let improvements: string[] = [];

      try {
        const parsed = JSON.parse(data.result);
        overallScore = parsed.overallScore || 5;
        strengths = parsed.strengths || [];
        improvements = parsed.improvements || [];
      } catch {
        const avgScore = history.reduce((sum, qa) => sum + (qa.score || 5), 0) / history.length;
        overallScore = Math.round(avgScore * 10) / 10;
      }

      // Update interview as completed
      const { error: updateError } = await supabase
        .from('interviews')
        .update({
          status: 'completed',
          overall_score: overallScore,
          strengths: strengths,
          improvements: improvements,
          completed_at: new Date().toISOString(),
        })
        .eq('id', interviewData.id);

      if (updateError) throw updateError;

      navigate(`/results/${interviewData.id}`);
    } catch (error) {
      console.error('Error generating final feedback:', error);
      toast({
        title: 'Error',
        description: 'Failed to complete interview. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading interview...</p>
        </div>
      </div>
    );
  }

  if (!interview) return null;

  const progress = (qaHistory.length / interview.total_questions) * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Exit
          </Button>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{interview.job_role}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {interview.interview_type.replace('_', ' ')} • {interview.difficulty}
            </p>
          </div>
          <div className="text-sm font-medium text-foreground">
            {qaHistory.length}/{interview.total_questions}
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-secondary">
          <div 
            className="h-full bg-gradient-to-r from-primary to-orange-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 container mx-auto px-4 py-6 max-w-3xl overflow-y-auto">
        <div className="space-y-6">
          {/* Previous Q&A */}
          {qaHistory.map((qa, index) => (
            <div key={qa.questionId} className="space-y-4 animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
              {/* Question */}
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 glass-card p-4">
                  <p className="text-sm text-muted-foreground mb-1">Question {index + 1}</p>
                  <p className="text-foreground">{qa.question}</p>
                </div>
              </div>

              {/* Answer */}
              <div className="flex gap-3 justify-end">
                <div className="flex-1 max-w-[80%] bg-primary/10 rounded-2xl p-4">
                  <p className="text-foreground">{qa.answer}</p>
                </div>
              </div>

              {/* Feedback */}
              {qa.feedback && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  </div>
                  <div className="flex-1 bg-success/5 border border-success/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold text-success">Score: {qa.score}/10</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{qa.feedback}</p>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Current Question */}
          {currentQuestion && (
            <div className="flex gap-3 animate-fade-in">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 glass-card p-4">
                <p className="text-sm text-muted-foreground mb-1">Question {questionNumber}</p>
                <p className="text-foreground">{currentQuestion}</p>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isGenerating && (
            <div className="flex gap-3 animate-fade-in">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
              </div>
              <div className="flex-1 glass-card p-4">
                <p className="text-muted-foreground">
                  {qaHistory.length >= interview.total_questions 
                    ? 'Generating your feedback...' 
                    : 'Preparing next question...'}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Input Area */}
      {currentQuestion && !isGenerating && (
        <div className="border-t border-border/50 bg-card/50 backdrop-blur-xl p-4">
          <div className="container mx-auto max-w-3xl">
            <div className="flex gap-3">
              <Textarea
                placeholder="Type your answer..."
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                className="flex-1 min-h-[80px] max-h-[200px] resize-none bg-secondary/50"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitAnswer();
                  }
                }}
              />
              <Button 
                variant="hero" 
                size="icon" 
                className="h-auto aspect-square"
                onClick={handleSubmitAnswer}
                disabled={!userAnswer.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Press Enter to submit or Shift+Enter for a new line
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Interview;
