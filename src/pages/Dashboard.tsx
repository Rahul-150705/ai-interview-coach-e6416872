import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  TrendingUp, 
  Clock, 
  Target, 
  LogOut, 
  Sparkles,
  ChevronRight,
  BarChart3,
  Calendar
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface Interview {
  id: string;
  job_role: string;
  difficulty: string;
  interview_type: string;
  status: string;
  overall_score: number | null;
  created_at: string;
  completed_at: string | null;
}

interface Stats {
  totalInterviews: number;
  completedInterviews: number;
  averageScore: number;
  lastWeekInterviews: number;
}

const Dashboard: React.FC = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [stats, setStats] = useState<Stats>({ totalInterviews: 0, completedInterviews: 0, averageScore: 0, lastWeekInterviews: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchInterviews();
    }
  }, [user]);

  const fetchInterviews = async () => {
    try {
      const { data, error } = await supabase
        .from('interviews')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const typedData = (data || []) as Interview[];
      setInterviews(typedData);

      const completed = typedData.filter(i => i.status === 'completed');
      const avgScore = completed.length > 0 
        ? completed.reduce((sum, i) => sum + (i.overall_score || 0), 0) / completed.length 
        : 0;

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const recentInterviews = typedData.filter(i => new Date(i.created_at) >= weekAgo);

      setStats({
        totalInterviews: typedData.length,
        completedInterviews: completed.length,
        averageScore: Math.round(avgScore * 10) / 10,
        lastWeekInterviews: recentInterviews.length,
      });
    } catch (error) {
      console.error('Error fetching interviews:', error);
      toast({
        title: 'Error',
        description: 'Failed to load interviews',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getChartData = () => {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayInterviews = interviews.filter(
        i => i.created_at.split('T')[0] === dateStr && i.status === 'completed'
      );
      const avgScore = dayInterviews.length > 0
        ? dayInterviews.reduce((sum, i) => sum + (i.overall_score || 0), 0) / dayInterviews.length
        : null;
      
      last7Days.push({
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        score: avgScore,
        count: dayInterviews.length,
      });
    }
    return last7Days;
  };

  if (authLoading || loading) {
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
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg text-foreground">InterviewAI</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {user?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Welcome & CTA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-1">Dashboard</h1>
            <p className="text-muted-foreground">Track your progress and start new interviews</p>
          </div>
          <Button variant="hero" size="lg" onClick={() => navigate('/setup')}>
            <Plus className="w-5 h-5" />
            New Interview
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="glass-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-primary" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.totalInterviews}</p>
            <p className="text-sm text-muted-foreground">Total Interviews</p>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-success" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.averageScore || '—'}</p>
            <p className="text-sm text-muted-foreground">Average Score</p>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-blue-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.completedInterviews}</p>
            <p className="text-sm text-muted-foreground">Completed</p>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-purple-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.lastWeekInterviews}</p>
            <p className="text-sm text-muted-foreground">This Week</p>
          </div>
        </div>

        {/* Chart & Recent */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Progress Chart */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Weekly Progress</h3>
            {stats.completedInterviews > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={getChartData()}>
                    <defs>
                      <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(33, 100%, 50%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(33, 100%, 50%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="day" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 12 }} 
                    />
                    <YAxis 
                      domain={[0, 10]} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 12 }} 
                    />
                    <Tooltip 
                      contentStyle={{ 
                        background: 'hsl(222, 47%, 8%)', 
                        border: '1px solid hsl(222, 30%, 18%)',
                        borderRadius: '8px',
                        color: 'hsl(210, 40%, 98%)'
                      }} 
                    />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="hsl(33, 100%, 50%)"
                      strokeWidth={2}
                      fill="url(#scoreGradient)"
                      connectNulls
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <p className="text-muted-foreground text-center">
                  Complete interviews to see your progress
                </p>
              </div>
            )}
          </div>

          {/* Recent Interviews */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Recent Interviews</h3>
            {interviews.length > 0 ? (
              <div className="space-y-3">
                {interviews.slice(0, 5).map((interview) => (
                  <button
                    key={interview.id}
                    onClick={() => {
                      if (interview.status === 'completed') {
                        navigate(`/results/${interview.id}`);
                      } else {
                        navigate(`/interview/${interview.id}`);
                      }
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors text-left group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{interview.job_role}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {interview.interview_type.replace('_', ' ')} • {interview.difficulty}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {interview.status === 'completed' && interview.overall_score && (
                        <span className={`text-sm font-semibold ${
                          interview.overall_score >= 7 ? 'text-success' :
                          interview.overall_score >= 5 ? 'text-primary' : 'text-destructive'
                        }`}>
                          {interview.overall_score}/10
                        </span>
                      )}
                      {interview.status === 'in_progress' && (
                        <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                          In Progress
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center gap-4">
                <Clock className="w-12 h-12 text-muted-foreground/50" />
                <p className="text-muted-foreground text-center">No interviews yet</p>
                <Button variant="outline" onClick={() => navigate('/setup')}>
                  Start Your First Interview
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
