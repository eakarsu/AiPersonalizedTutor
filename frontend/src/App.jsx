import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  BookOpen, GraduationCap, Brain, MessageCircle, Target, BarChart3,
  FileText, Video, Calculator, PenTool, Lightbulb, Award, Clock,
  User, LogOut, Menu, X, ChevronRight, Plus, Send, Check, ArrowLeft,
  Play, Pause, RotateCcw, Eye, EyeOff, Sparkles, Zap, TrendingUp,
  BookMarked, Layers, Home, Settings, Bot
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';

// API Base URL
const API_URL = '/api';

// Auth Context
const AuthContext = createContext(null);

const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      const userData = localStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    }
    setLoading(false);
  }, [token]);

  const login = async (email, password) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) {
      setUser(data.user);
      setToken(data.token);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      return { success: true };
    }
    return { success: false, error: data.error };
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// API Helper
const apiFetch = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers
  };
  try {
    const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
      return null;
    }
    if (!res.ok) {
      console.error(`API error ${res.status} on ${endpoint}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('Fetch error:', endpoint, err);
    return null;
  }
};

// Components
const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

const Card = ({ children, className = '', onClick, hover = true }) => (
  <div
    onClick={onClick}
    className={`bg-white rounded-xl shadow-sm border border-gray-100 ${hover ? 'card-hover cursor-pointer' : ''} ${className}`}
  >
    {children}
  </div>
);

const Button = ({ children, variant = 'primary', size = 'md', className = '', ...props }) => {
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    success: 'bg-green-600 text-white hover:bg-green-700',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-100'
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg'
  };
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors ${variants[variant]} ${sizes[size]} ${props.disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

const Input = ({ label, ...props }) => (
  <div className="mb-4">
    {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
    <input
      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
      {...props}
    />
  </div>
);

const TextArea = ({ label, ...props }) => (
  <div className="mb-4">
    {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
    <textarea
      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow resize-none"
      {...props}
    />
  </div>
);

const Badge = ({ children, color = 'blue' }) => {
  const colors = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    red: 'bg-red-100 text-red-700',
    purple: 'bg-purple-100 text-purple-700',
    gray: 'bg-gray-100 text-gray-700'
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  );
};

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};

// Sidebar Component
const Sidebar = ({ isOpen, setIsOpen }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { icon: Home, label: 'Dashboard', path: '/dashboard' },
    { icon: BookOpen, label: 'Learning Paths', path: '/learning-paths' },
    { icon: FileText, label: 'Study Materials', path: '/study-materials' },
    { icon: Brain, label: 'Quizzes', path: '/quizzes' },
    { icon: Lightbulb, label: 'Practice Problems', path: '/practice-problems' },
    { icon: Layers, label: 'Flashcards', path: '/flashcards' },
    { icon: Video, label: 'Video Lessons', path: '/video-lessons' },
    { icon: MessageCircle, label: 'AI Tutor Chat', path: '/ai-chat' },
    { icon: Target, label: 'Goals', path: '/goals' },
    { icon: BookMarked, label: 'Vocabulary', path: '/vocabulary' },
    { icon: PenTool, label: 'Essay Grading', path: '/essays' },
    { icon: Calculator, label: 'Math Solver', path: '/math-solver' },
    { icon: Sparkles, label: 'Writing Assistant', path: '/writing-assistant' },
    { icon: BarChart3, label: 'Analytics', path: '/analytics' },
    { icon: Award, label: 'Achievements', path: '/achievements' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-50 transform transition-transform lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <GraduationCap className="text-blue-600" size={28} />
            <span className="font-bold text-lg">AI Tutor</span>
          </div>
          <button onClick={() => setIsOpen(false)} className="lg:hidden p-1 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>

        <nav className="p-2 overflow-y-auto h-[calc(100vh-140px)]">
          {menuItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setIsOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                location.pathname.startsWith(item.path)
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <item.icon size={20} />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <User size={20} className="text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{user?.fullName}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-center" onClick={handleLogout}>
            <LogOut size={18} className="mr-2" />
            Logout
          </Button>
        </div>
      </aside>
    </>
  );
};

// Ask AI Widget
const AskAIWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const messagesEndRef = React.useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setLoading(true);

    const result = await apiFetch('/ai/ask', {
      method: 'POST',
      body: JSON.stringify({ question, context: location.pathname.replace('/', '').replace(/-/g, ' ') })
    });

    if (result && result.answer) {
      setMessages(prev => [...prev, { role: 'assistant', content: result.answer }]);
    } else {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I couldn\'t get a response. Please try again.' }]);
    }
    setLoading(false);
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <>
      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 w-[350px] h-[400px] bg-white rounded-xl shadow-2xl border border-gray-200 z-40 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white">
            <div className="flex items-center gap-2">
              <Bot size={18} />
              <span className="font-semibold text-sm">Ask AI</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={clearChat} className="p-1 hover:bg-white/20 rounded" title="Clear chat">
                <RotateCcw size={14} />
              </button>
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/20 rounded" title="Close">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 text-sm mt-8">
                <Sparkles size={24} className="mx-auto mb-2 text-green-400" />
                <p>Ask me anything!</p>
                <p className="text-xs mt-1">I'm here to help with your studies.</p>
              </div>
            )}
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${msg.role === 'user' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-800'}`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-xl px-3 py-2">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && sendMessage()}
                placeholder="Type your question..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-full shadow-lg hover:shadow-xl flex items-center justify-center z-40 transition-all hover:scale-105"
        title="Ask AI"
      >
        {isOpen ? <X size={20} /> : <Sparkles size={20} />}
      </button>
    </>
  );
};

// Layout Component
const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      {/* Top bar for mobile */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b z-30 flex items-center px-4">
        <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-gray-100 rounded-lg">
          <Menu size={24} />
        </button>
        <div className="flex items-center gap-2 ml-3">
          <GraduationCap className="text-blue-600" size={24} />
          <span className="font-bold">AI Tutor</span>
        </div>
      </header>

      {/* Main content */}
      <main className="lg:ml-64 pt-14 lg:pt-0 min-h-screen">
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>

      {/* Floating Ask AI Widget */}
      <AskAIWidget />
    </div>
  );
};

// Login Page
const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await login(email, password);
    setLoading(false);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error || 'Login failed');
    }
  };

  const populateDemo = () => {
    setEmail('student@demo.com');
    setPassword('password123');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <GraduationCap size={32} className="text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">AI Personalized Tutor</h1>
          <p className="text-gray-500 mt-2">Sign in to continue your learning journey</p>
        </div>

        <form onSubmit={handleSubmit}>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full mb-4" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>

          <Button type="button" variant="secondary" className="w-full" onClick={populateDemo}>
            <Zap size={18} className="mr-2" />
            Use Demo Account
          </Button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Demo: student@demo.com / password123
        </p>
      </div>
    </div>
  );
};

// Dashboard Page
const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentPaths, setRecentPaths] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch('/dashboard/stats').then(data => setStats(data || {}));
    apiFetch('/learning-paths?limit=4').then(data => setRecentPaths(Array.isArray(data) ? data.slice(0, 4) : []));
  }, []);

  const features = [
    { icon: BookOpen, label: 'Learning Paths', path: '/learning-paths', color: 'gradient-blue', desc: 'Structured courses' },
    { icon: Brain, label: 'Quizzes', path: '/quizzes', color: 'gradient-purple', desc: 'Test your knowledge' },
    { icon: MessageCircle, label: 'AI Tutor', path: '/ai-chat', color: 'gradient-green', desc: 'Get instant help' },
    { icon: Calculator, label: 'Math Solver', path: '/math-solver', color: 'gradient-orange', desc: 'Step-by-step solutions' },
    { icon: PenTool, label: 'Essay Grading', path: '/essays', color: 'gradient-pink', desc: 'AI feedback' },
    { icon: Layers, label: 'Flashcards', path: '/flashcards', color: 'gradient-cyan', desc: 'Memorize faster' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user?.fullName?.split(' ')[0]}!</h1>
        <p className="text-gray-500 mt-1">Ready to continue your learning journey?</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="p-4" hover={false}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BookOpen size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.enrolledPaths || 0}</p>
              <p className="text-sm text-gray-500">Enrolled Paths</p>
            </div>
          </div>
        </Card>
        <Card className="p-4" hover={false}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Check size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.completedQuizzes || 0}</p>
              <p className="text-sm text-gray-500">Quizzes Done</p>
            </div>
          </div>
        </Card>
        <Card className="p-4" hover={false}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Target size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.achievedGoals || 0}</p>
              <p className="text-sm text-gray-500">Goals Achieved</p>
            </div>
          </div>
        </Card>
        <Card className="p-4" hover={false}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Clock size={20} className="text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.studyHours || 0}h</p>
              <p className="text-sm text-gray-500">Study Time</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {features.map(f => (
          <Card key={f.path} className="p-4" onClick={() => navigate(f.path)}>
            <div className={`w-12 h-12 ${f.color} rounded-xl flex items-center justify-center mb-3`}>
              <f.icon size={24} className="text-white" />
            </div>
            <h3 className="font-semibold">{f.label}</h3>
            <p className="text-sm text-gray-500">{f.desc}</p>
          </Card>
        ))}
      </div>

      {/* Recent Learning Paths */}
      <h2 className="text-lg font-semibold mb-4">Continue Learning</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {recentPaths.map(path => (
          <Card key={path.id} className="p-4" onClick={() => navigate(`/learning-paths/${path.id}`)}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <BookOpen size={24} className="text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{path.title}</h3>
                <p className="text-sm text-gray-500 mb-2">{path.subject}</p>
                <div className="flex items-center gap-2">
                  <Badge color={path.difficulty_level === 'Beginner' ? 'green' : path.difficulty_level === 'Advanced' ? 'red' : 'yellow'}>
                    {path.difficulty_level}
                  </Badge>
                  <span className="text-xs text-gray-400">{path.estimated_hours}h</span>
                </div>
              </div>
              <ChevronRight size={20} className="text-gray-400 flex-shrink-0" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

// Learning Paths Page
const LearningPaths = () => {
  const [paths, setPaths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newPath, setNewPath] = useState({ title: '', description: '', subject: '', difficultyLevel: 'Beginner', estimatedHours: 10 });
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch('/learning-paths').then(data => {
      setPaths(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    const result = await apiFetch('/learning-paths', {
      method: 'POST',
      body: JSON.stringify(newPath)
    });
    if (result && result.id) {
      setPaths([result, ...paths]);
      setShowModal(false);
      setNewPath({ title: '', description: '', subject: '', difficultyLevel: 'Beginner', estimatedHours: 10 });
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Learning Paths</h1>
          <p className="text-gray-500">Structured courses to master new skills</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={18} className="mr-2" />
          New Path
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {paths.map(path => (
          <Card key={path.id} className="p-4" onClick={() => navigate(`/learning-paths/${path.id}`)}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <BookOpen size={20} className="text-blue-600" />
              </div>
              <Badge>{path.subject}</Badge>
            </div>
            <h3 className="font-semibold mb-1">{path.title}</h3>
            <p className="text-sm text-gray-500 line-clamp-2 mb-3">{path.description}</p>
            <div className="flex items-center justify-between text-sm">
              <Badge color={path.difficulty_level === 'Beginner' ? 'green' : path.difficulty_level === 'Advanced' ? 'red' : 'yellow'}>
                {path.difficulty_level}
              </Badge>
              <span className="text-gray-400">{path.estimated_hours}h estimated</span>
            </div>
          </Card>
        ))}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Learning Path">
        <Input label="Title" value={newPath.title} onChange={e => setNewPath({...newPath, title: e.target.value})} />
        <TextArea label="Description" rows={3} value={newPath.description} onChange={e => setNewPath({...newPath, description: e.target.value})} />
        <Input label="Subject" value={newPath.subject} onChange={e => setNewPath({...newPath, subject: e.target.value})} />
        <div className="grid grid-cols-2 gap-4">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
            <select
              className="w-full px-4 py-2 border rounded-lg"
              value={newPath.difficultyLevel}
              onChange={e => setNewPath({...newPath, difficultyLevel: e.target.value})}
            >
              <option>Beginner</option>
              <option>Intermediate</option>
              <option>Advanced</option>
            </select>
          </div>
          <Input
            label="Hours"
            type="number"
            value={newPath.estimatedHours}
            onChange={e => setNewPath({...newPath, estimatedHours: parseInt(e.target.value)})}
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={handleCreate}>Create</Button>
        </div>
      </Modal>
    </div>
  );
};

// Learning Path Detail
const LearningPathDetail = () => {
  const { id } = useParams();
  const [path, setPath] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch(`/learning-paths/${id}`).then(data => {
      setPath(data);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <LoadingSpinner />;
  if (!path) return <div className="text-center py-8">Learning path not found</div>;

  return (
    <div>
      <button onClick={() => navigate('/learning-paths')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={20} />
        Back to Learning Paths
      </button>

      <div className="bg-white rounded-xl border p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center">
            <BookOpen size={32} className="text-blue-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold mb-2">{path.title}</h1>
            <p className="text-gray-500 mb-4">{path.description}</p>
            <div className="flex items-center gap-4">
              <Badge>{path.subject}</Badge>
              <Badge color={path.difficulty_level === 'Beginner' ? 'green' : path.difficulty_level === 'Advanced' ? 'red' : 'yellow'}>
                {path.difficulty_level}
              </Badge>
              <span className="text-sm text-gray-500">{path.estimated_hours} hours</span>
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-4">Study Materials ({path.materials?.length || 0})</h2>
      <div className="space-y-3">
        {path.materials?.map((material, idx) => (
          <Card key={material.id} className="p-4" onClick={() => navigate(`/study-materials/${material.id}`)}>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center font-semibold text-gray-600">
                {idx + 1}
              </div>
              <div className="flex-1">
                <h3 className="font-medium">{material.title}</h3>
                <p className="text-sm text-gray-500">{material.topic} - {material.material_type}</p>
              </div>
              <ChevronRight size={20} className="text-gray-400" />
            </div>
          </Card>
        ))}
        {(!path.materials || path.materials.length === 0) && (
          <p className="text-center text-gray-500 py-8">No materials added yet</p>
        )}
      </div>
    </div>
  );
};

// Study Materials Page
const StudyMaterials = () => {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newMaterial, setNewMaterial] = useState({ title: '', content: '', subject: '', topic: '', materialType: 'lesson', difficultyLevel: 'Beginner' });
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch('/study-materials').then(data => {
      setMaterials(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    const result = await apiFetch('/study-materials', {
      method: 'POST',
      body: JSON.stringify(newMaterial)
    });
    if (result && result.id) {
      setMaterials([result, ...materials]);
      setShowModal(false);
      setNewMaterial({ title: '', content: '', subject: '', topic: '', materialType: 'lesson', difficultyLevel: 'Beginner' });
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Study Materials</h1>
          <p className="text-gray-500">Browse lessons, articles, and resources</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={18} className="mr-2" />
          New Material
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {materials.map(material => (
          <Card key={material.id} className="p-4" onClick={() => navigate(`/study-materials/${material.id}`)}>
            <div className="flex items-center gap-2 mb-2">
              <Badge>{material.subject}</Badge>
              <Badge color="gray">{material.material_type}</Badge>
            </div>
            <h3 className="font-semibold mb-1">{material.title}</h3>
            <p className="text-sm text-gray-500 line-clamp-2">{material.content?.substring(0, 150)}...</p>
          </Card>
        ))}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Study Material">
        <Input label="Title" value={newMaterial.title} onChange={e => setNewMaterial({...newMaterial, title: e.target.value})} />
        <TextArea label="Content" rows={6} value={newMaterial.content} onChange={e => setNewMaterial({...newMaterial, content: e.target.value})} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Subject" value={newMaterial.subject} onChange={e => setNewMaterial({...newMaterial, subject: e.target.value})} />
          <Input label="Topic" value={newMaterial.topic} onChange={e => setNewMaterial({...newMaterial, topic: e.target.value})} />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={handleCreate}>Create</Button>
        </div>
      </Modal>
    </div>
  );
};

// Study Material Detail
const StudyMaterialDetail = () => {
  const { id } = useParams();
  const [material, setMaterial] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch(`/study-materials/${id}`).then(data => {
      setMaterial(data);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <LoadingSpinner />;
  if (!material) return <div className="text-center py-8">Material not found</div>;

  return (
    <div>
      <button onClick={() => navigate('/study-materials')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={20} />
        Back to Study Materials
      </button>

      <Card className="p-6" hover={false}>
        <div className="flex items-center gap-2 mb-4">
          <Badge>{material.subject}</Badge>
          <Badge color="gray">{material.topic}</Badge>
          <Badge color={material.difficulty_level === 'Beginner' ? 'green' : material.difficulty_level === 'Advanced' ? 'red' : 'yellow'}>
            {material.difficulty_level}
          </Badge>
        </div>
        <h1 className="text-2xl font-bold mb-4">{material.title}</h1>
        <div className="prose max-w-none">
          <p className="text-gray-700 whitespace-pre-wrap">{material.content}</p>
        </div>
      </Card>
    </div>
  );
};

// Quizzes Page
const Quizzes = () => {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newQuiz, setNewQuiz] = useState({ title: '', description: '', subject: '', topic: '', difficultyLevel: 'Beginner', timeLimitMinutes: 15 });
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch('/quizzes').then(data => {
      setQuizzes(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    const result = await apiFetch('/quizzes', {
      method: 'POST',
      body: JSON.stringify(newQuiz)
    });
    if (result && result.id) {
      setQuizzes([result, ...quizzes]);
      setShowModal(false);
      setNewQuiz({ title: '', description: '', subject: '', topic: '', difficultyLevel: 'Beginner', timeLimitMinutes: 15 });
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Quizzes</h1>
          <p className="text-gray-500">Test your knowledge with adaptive quizzes</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={18} className="mr-2" />
          New Quiz
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {quizzes.map(quiz => (
          <Card key={quiz.id} className="p-4" onClick={() => navigate(`/quizzes/${quiz.id}`)}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Brain size={20} className="text-purple-600" />
              </div>
              <Badge>{quiz.subject}</Badge>
              {quiz.is_adaptive && <Badge color="purple">Adaptive</Badge>}
            </div>
            <h3 className="font-semibold mb-1">{quiz.title}</h3>
            <p className="text-sm text-gray-500 mb-3">{quiz.description}</p>
            <div className="flex items-center justify-between text-sm">
              <Badge color={quiz.difficulty_level === 'Beginner' ? 'green' : quiz.difficulty_level === 'Advanced' ? 'red' : 'yellow'}>
                {quiz.difficulty_level}
              </Badge>
              <span className="text-gray-400">{quiz.time_limit_minutes} min</span>
            </div>
          </Card>
        ))}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Quiz">
        <Input label="Title" value={newQuiz.title} onChange={e => setNewQuiz({...newQuiz, title: e.target.value})} />
        <TextArea label="Description" rows={2} value={newQuiz.description} onChange={e => setNewQuiz({...newQuiz, description: e.target.value})} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Subject" value={newQuiz.subject} onChange={e => setNewQuiz({...newQuiz, subject: e.target.value})} />
          <Input label="Topic" value={newQuiz.topic} onChange={e => setNewQuiz({...newQuiz, topic: e.target.value})} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
            <select className="w-full px-4 py-2 border rounded-lg" value={newQuiz.difficultyLevel} onChange={e => setNewQuiz({...newQuiz, difficultyLevel: e.target.value})}>
              <option>Beginner</option>
              <option>Intermediate</option>
              <option>Advanced</option>
            </select>
          </div>
          <Input label="Time Limit (min)" type="number" value={newQuiz.timeLimitMinutes} onChange={e => setNewQuiz({...newQuiz, timeLimitMinutes: parseInt(e.target.value)})} />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={handleCreate}>Create</Button>
        </div>
      </Modal>
    </div>
  );
};

// Quiz Detail/Taking Page
const QuizDetail = () => {
  const { id } = useParams();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch(`/quizzes/${id}`).then(data => {
      setQuiz(data);
      setTimeLeft(data.time_limit_minutes * 60);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (started && timeLeft > 0 && !result) {
      const timer = setTimeout(() => setTimeLeft(t => t - 1), 1000);
      return () => clearTimeout(timer);
    }
    if (timeLeft === 0 && started && !result) {
      handleSubmit();
    }
  }, [started, timeLeft, result]);

  const handleSubmit = async () => {
    const res = await apiFetch(`/quizzes/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers, timeTaken: (quiz.time_limit_minutes * 60) - timeLeft })
    });
    setResult(res);
  };

  if (loading) return <LoadingSpinner />;
  if (!quiz) return <div className="text-center py-8">Quiz not found</div>;

  if (result) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="p-8 text-center" hover={false}>
          <div className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${result.percentage >= 70 ? 'bg-green-100' : 'bg-red-100'}`}>
            {result.percentage >= 70 ? <Check size={40} className="text-green-600" /> : <X size={40} className="text-red-600" />}
          </div>
          <h2 className="text-2xl font-bold mb-2">Quiz Complete!</h2>
          <p className="text-4xl font-bold text-blue-600 mb-2">{result.percentage}%</p>
          <p className="text-gray-500 mb-6">{result.score} / {result.totalPoints} points</p>
          <div className="flex gap-3 justify-center">
            <Button variant="secondary" onClick={() => navigate('/quizzes')}>Back to Quizzes</Button>
            <Button onClick={() => { setResult(null); setStarted(false); setAnswers({}); setCurrentQ(0); setTimeLeft(quiz.time_limit_minutes * 60); }}>Retry</Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="max-w-2xl mx-auto">
        <button onClick={() => navigate('/quizzes')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={20} />
          Back to Quizzes
        </button>
        <Card className="p-8 text-center" hover={false}>
          <div className="w-16 h-16 mx-auto mb-4 bg-purple-100 rounded-full flex items-center justify-center">
            <Brain size={32} className="text-purple-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">{quiz.title}</h1>
          <p className="text-gray-500 mb-6">{quiz.description}</p>
          <div className="flex justify-center gap-6 mb-6 text-sm">
            <div><span className="font-semibold">{quiz.questions?.length || 0}</span> questions</div>
            <div><span className="font-semibold">{quiz.time_limit_minutes}</span> minutes</div>
            <div><span className="font-semibold">{quiz.passing_score}%</span> to pass</div>
          </div>
          {quiz.questions?.length > 0 ? (
            <Button onClick={() => setStarted(true)} size="lg">Start Quiz</Button>
          ) : (
            <div className="text-gray-500 bg-gray-50 rounded-lg p-4">
              <p className="font-medium text-gray-700 mb-1">No questions available</p>
              <p className="text-sm">This quiz does not have any questions yet.</p>
            </div>
          )}
        </Card>
      </div>
    );
  }

  const question = quiz.questions?.[currentQ];
  if (!question) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <p className="text-gray-500">No questions available for this quiz.</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/quizzes')}>Back to Quizzes</Button>
      </div>
    );
  }
  const options = Array.isArray(question.options) ? question.options : [];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-500">Question {currentQ + 1} of {quiz.questions?.length}</span>
        <span className={`font-mono font-semibold ${timeLeft < 60 ? 'text-red-600' : ''}`}>
          {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
        <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${((currentQ + 1) / quiz.questions?.length) * 100}%` }} />
      </div>

      <Card className="p-6" hover={false}>
        <h2 className="text-lg font-semibold mb-6">{question?.question_text}</h2>
        <div className="space-y-3">
          {options.map((opt, idx) => (
            <button
              key={idx}
              onClick={() => setAnswers({ ...answers, [question.id]: opt })}
              className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${answers[question.id] === opt ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
            >
              {opt}
            </button>
          ))}
        </div>
      </Card>

      <div className="flex justify-between mt-6">
        <Button variant="secondary" onClick={() => setCurrentQ(c => c - 1)} disabled={currentQ === 0}>Previous</Button>
        {currentQ < quiz.questions?.length - 1 ? (
          <Button onClick={() => setCurrentQ(c => c + 1)}>Next</Button>
        ) : (
          <Button variant="success" onClick={handleSubmit}>Submit Quiz</Button>
        )}
      </div>
    </div>
  );
};

// Practice Problems Page
const PracticeProblems = () => {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newProblem, setNewProblem] = useState({ title: '', problemText: '', subject: '', topic: '', difficultyLevel: 'Beginner', solution: '', hints: [] });
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch('/practice-problems').then(data => {
      setProblems(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    const result = await apiFetch('/practice-problems', {
      method: 'POST',
      body: JSON.stringify(newProblem)
    });
    if (result && result.id) {
      setProblems([result, ...problems]);
      setShowModal(false);
      setNewProblem({ title: '', problemText: '', subject: '', topic: '', difficultyLevel: 'Beginner', solution: '', hints: [] });
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Practice Problems</h1>
          <p className="text-gray-500">Challenge yourself with practice exercises</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={18} className="mr-2" />
          New Problem
        </Button>
      </div>

      <div className="space-y-3">
        {problems.map(problem => (
          <Card key={problem.id} className="p-4" onClick={() => navigate(`/practice-problems/${problem.id}`)}>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Lightbulb size={20} className="text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{problem.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge>{problem.subject}</Badge>
                  <Badge color="gray">{problem.topic}</Badge>
                  <Badge color={problem.difficulty_level === 'Beginner' ? 'green' : problem.difficulty_level === 'Advanced' ? 'red' : 'yellow'}>
                    {problem.difficulty_level}
                  </Badge>
                </div>
              </div>
              <ChevronRight size={20} className="text-gray-400" />
            </div>
          </Card>
        ))}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Practice Problem">
        <Input label="Title" value={newProblem.title} onChange={e => setNewProblem({...newProblem, title: e.target.value})} />
        <TextArea label="Problem Text" rows={4} value={newProblem.problemText} onChange={e => setNewProblem({...newProblem, problemText: e.target.value})} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Subject" value={newProblem.subject} onChange={e => setNewProblem({...newProblem, subject: e.target.value})} />
          <Input label="Topic" value={newProblem.topic} onChange={e => setNewProblem({...newProblem, topic: e.target.value})} />
        </div>
        <TextArea label="Solution" rows={3} value={newProblem.solution} onChange={e => setNewProblem({...newProblem, solution: e.target.value})} />
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={handleCreate}>Create</Button>
        </div>
      </Modal>
    </div>
  );
};

// Practice Problem Detail
const PracticeProblemDetail = () => {
  const { id } = useParams();
  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSolution, setShowSolution] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch(`/practice-problems/${id}`).then(data => {
      setProblem(data);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <LoadingSpinner />;
  if (!problem) return <div className="text-center py-8">Problem not found</div>;

  const hints = Array.isArray(problem.hints) ? problem.hints : [];

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate('/practice-problems')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={20} />
        Back to Problems
      </button>

      <Card className="p-6 mb-4" hover={false}>
        <div className="flex items-center gap-2 mb-4">
          <Badge>{problem.subject}</Badge>
          <Badge color="gray">{problem.topic}</Badge>
          <Badge color={problem.difficulty_level === 'Beginner' ? 'green' : problem.difficulty_level === 'Advanced' ? 'red' : 'yellow'}>
            {problem.difficulty_level}
          </Badge>
        </div>
        <h1 className="text-xl font-bold mb-4">{problem.title}</h1>
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <p className="text-gray-700">{problem.problem_text}</p>
        </div>

        {hints.length > 0 && (
          <div className="mb-4">
            <Button variant="secondary" onClick={() => setShowHints(!showHints)} className="mb-2">
              <Lightbulb size={18} className="mr-2" />
              {showHints ? 'Hide Hints' : 'Show Hints'}
            </Button>
            {showHints && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <ul className="space-y-2">
                  {hints.map((hint, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-yellow-800">
                      <span className="font-semibold">{idx + 1}.</span>
                      <span>{hint}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <Button variant={showSolution ? 'secondary' : 'primary'} onClick={() => setShowSolution(!showSolution)}>
          {showSolution ? <EyeOff size={18} className="mr-2" /> : <Eye size={18} className="mr-2" />}
          {showSolution ? 'Hide Solution' : 'Show Solution'}
        </Button>

        {showSolution && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-800 mb-2">Solution:</h3>
            <p className="text-green-700">{problem.solution}</p>
          </div>
        )}
      </Card>
    </div>
  );
};

// Flashcards Page
const Flashcards = () => {
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newDeck, setNewDeck] = useState({ title: '', description: '', subject: '', topic: '' });
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch('/flashcard-decks').then(data => {
      setDecks(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    const result = await apiFetch('/flashcard-decks', {
      method: 'POST',
      body: JSON.stringify(newDeck)
    });
    if (result && result.id) {
      setDecks([result, ...decks]);
      setShowModal(false);
      setNewDeck({ title: '', description: '', subject: '', topic: '' });
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Flashcards</h1>
          <p className="text-gray-500">Memorize key concepts with spaced repetition</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={18} className="mr-2" />
          New Deck
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {decks.map(deck => (
          <Card key={deck.id} className="p-4" onClick={() => navigate(`/flashcards/${deck.id}`)}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
                <Layers size={20} className="text-cyan-600" />
              </div>
              <Badge>{deck.subject}</Badge>
            </div>
            <h3 className="font-semibold mb-1">{deck.title}</h3>
            <p className="text-sm text-gray-500 mb-3">{deck.description}</p>
            <p className="text-sm text-gray-400">{deck.card_count} cards</p>
          </Card>
        ))}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Flashcard Deck">
        <Input label="Title" value={newDeck.title} onChange={e => setNewDeck({...newDeck, title: e.target.value})} />
        <TextArea label="Description" rows={2} value={newDeck.description} onChange={e => setNewDeck({...newDeck, description: e.target.value})} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Subject" value={newDeck.subject} onChange={e => setNewDeck({...newDeck, subject: e.target.value})} />
          <Input label="Topic" value={newDeck.topic} onChange={e => setNewDeck({...newDeck, topic: e.target.value})} />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={handleCreate}>Create</Button>
        </div>
      </Modal>
    </div>
  );
};

// Flashcard Deck Detail/Study
const FlashcardDeckDetail = () => {
  const { id } = useParams();
  const [deck, setDeck] = useState(null);
  const [loading, setLoading] = useState(true);
  const [studying, setStudying] = useState(false);
  const [currentCard, setCurrentCard] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCard, setNewCard] = useState({ frontText: '', backText: '' });
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch(`/flashcard-decks/${id}`).then(data => {
      setDeck(data);
      setLoading(false);
    });
  }, [id]);

  const handleAddCard = async () => {
    const result = await apiFetch(`/flashcard-decks/${id}/cards`, {
      method: 'POST',
      body: JSON.stringify(newCard)
    });
    if (result && result.id) {
      setDeck({ ...deck, cards: [...(deck.cards || []), result], card_count: (deck.card_count || 0) + 1 });
      setShowAddCard(false);
      setNewCard({ frontText: '', backText: '' });
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!deck) return <div className="text-center py-8">Deck not found</div>;

  if (studying && deck.cards?.length > 0) {
    const card = deck.cards[currentCard];
    return (
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setStudying(false)} className="flex items-center gap-2 text-gray-500 hover:text-gray-700">
            <ArrowLeft size={20} />
            Exit Study
          </button>
          <span className="text-sm text-gray-500">{currentCard + 1} / {deck.cards.length}</span>
        </div>

        <div
          onClick={() => setFlipped(!flipped)}
          className="bg-white rounded-xl shadow-lg border-2 border-gray-100 h-64 flex items-center justify-center cursor-pointer hover:shadow-xl transition-shadow"
        >
          <div className="text-center p-8">
            <p className="text-xs text-gray-400 mb-2">{flipped ? 'Answer' : 'Question'}</p>
            <p className="text-xl font-medium">{flipped ? card.back_text : card.front_text}</p>
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">Click card to flip</p>

        <div className="flex justify-between mt-6">
          <Button variant="secondary" onClick={() => { setCurrentCard(c => c - 1); setFlipped(false); }} disabled={currentCard === 0}>Previous</Button>
          <Button onClick={() => { setFlipped(false); }} variant="ghost"><RotateCcw size={18} /></Button>
          <Button onClick={() => { setCurrentCard(c => c + 1); setFlipped(false); }} disabled={currentCard >= deck.cards.length - 1}>Next</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => navigate('/flashcards')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={20} />
        Back to Flashcards
      </button>

      <Card className="p-6 mb-6" hover={false}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge>{deck.subject}</Badge>
              <Badge color="gray">{deck.topic}</Badge>
            </div>
            <h1 className="text-2xl font-bold mb-2">{deck.title}</h1>
            <p className="text-gray-500 mb-4">{deck.description}</p>
            <p className="text-sm text-gray-400">{deck.card_count || 0} cards</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowAddCard(true)}>
              <Plus size={18} className="mr-2" />
              Add Card
            </Button>
            {deck.cards?.length > 0 && (
              <Button onClick={() => setStudying(true)}>
                <Play size={18} className="mr-2" />
                Study
              </Button>
            )}
          </div>
        </div>
      </Card>

      <h2 className="text-lg font-semibold mb-4">Cards</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {deck.cards?.map((card, idx) => (
          <Card key={card.id} className="p-4" hover={false}>
            <div className="text-xs text-gray-400 mb-1">Card {idx + 1}</div>
            <p className="font-medium mb-2">{card.front_text}</p>
            <p className="text-sm text-gray-500">{card.back_text}</p>
          </Card>
        ))}
      </div>

      <Modal isOpen={showAddCard} onClose={() => setShowAddCard(false)} title="Add Flashcard">
        <Input label="Front (Question)" value={newCard.frontText} onChange={e => setNewCard({...newCard, frontText: e.target.value})} />
        <TextArea label="Back (Answer)" rows={3} value={newCard.backText} onChange={e => setNewCard({...newCard, backText: e.target.value})} />
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setShowAddCard(false)}>Cancel</Button>
          <Button onClick={handleAddCard}>Add Card</Button>
        </div>
      </Modal>
    </div>
  );
};

// Video Lessons Page
const VideoLessons = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newVideo, setNewVideo] = useState({ title: '', description: '', subject: '', topic: '', videoUrl: '', durationMinutes: 15, instructor: '' });
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch('/video-lessons').then(data => {
      setVideos(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    const result = await apiFetch('/video-lessons', {
      method: 'POST',
      body: JSON.stringify(newVideo)
    });
    if (result && result.id) {
      setVideos([result, ...videos]);
      setShowModal(false);
      setNewVideo({ title: '', description: '', subject: '', topic: '', videoUrl: '', durationMinutes: 15, instructor: '' });
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Video Lessons</h1>
          <p className="text-gray-500">Watch expert-led video tutorials</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={18} className="mr-2" />
          New Video
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {videos.map(video => (
          <Card key={video.id} className="overflow-hidden" onClick={() => navigate(`/video-lessons/${video.id}`)}>
            <div className="h-40 bg-gray-900 relative">
              {video.thumbnail_url ? (
                <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
              ) : null}
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 hover:bg-opacity-30 transition-colors">
                <div className="w-12 h-12 bg-white bg-opacity-90 rounded-full flex items-center justify-center shadow-lg">
                  <Play size={24} className="text-red-600 ml-1" />
                </div>
              </div>
              <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                {video.duration_minutes} min
              </div>
            </div>
            <div className="p-4">
              <Badge className="mb-2">{video.subject}</Badge>
              <h3 className="font-semibold mb-1">{video.title}</h3>
              <p className="text-sm text-gray-500">{video.instructor}</p>
            </div>
          </Card>
        ))}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Video Lesson">
        <Input label="Title" value={newVideo.title} onChange={e => setNewVideo({...newVideo, title: e.target.value})} />
        <TextArea label="Description" rows={2} value={newVideo.description} onChange={e => setNewVideo({...newVideo, description: e.target.value})} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Subject" value={newVideo.subject} onChange={e => setNewVideo({...newVideo, subject: e.target.value})} />
          <Input label="Topic" value={newVideo.topic} onChange={e => setNewVideo({...newVideo, topic: e.target.value})} />
        </div>
        <Input label="Video URL" value={newVideo.videoUrl} onChange={e => setNewVideo({...newVideo, videoUrl: e.target.value})} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Instructor" value={newVideo.instructor} onChange={e => setNewVideo({...newVideo, instructor: e.target.value})} />
          <Input label="Duration (min)" type="number" value={newVideo.durationMinutes} onChange={e => setNewVideo({...newVideo, durationMinutes: parseInt(e.target.value)})} />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={handleCreate}>Add Video</Button>
        </div>
      </Modal>
    </div>
  );
};

// Video Lesson Detail
const VideoLessonDetail = () => {
  const { id } = useParams();
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch(`/video-lessons/${id}`).then(data => {
      setVideo(data);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <LoadingSpinner />;
  if (!video) return <div className="text-center py-8">Video not found</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => navigate('/video-lessons')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={20} />
        Back to Videos
      </button>

      <div className="rounded-xl overflow-hidden aspect-video mb-6 bg-black">
        {video.video_url && video.video_url.includes('youtube.com') ? (
          <iframe
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${video.video_url.split('v=')[1]?.split('&')[0]}`}
            title={video.title}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white">
            <div className="text-center">
              <Play size={64} className="mx-auto mb-4 opacity-50" />
              <p className="text-sm opacity-75">Video not available</p>
            </div>
          </div>
        )}
      </div>

      <Card className="p-6" hover={false}>
        <div className="flex items-center gap-2 mb-2">
          <Badge>{video.subject}</Badge>
          <Badge color="gray">{video.topic}</Badge>
        </div>
        <h1 className="text-2xl font-bold mb-2">{video.title}</h1>
        <p className="text-gray-500 mb-4">{video.description}</p>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>By {video.instructor}</span>
          <span>{video.duration_minutes} minutes</span>
        </div>
      </Card>
    </div>
  );
};

// AI Chat Page
const AIChat = () => {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    apiFetch('/chat/sessions').then(data => {
      setSessions(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const loadSession = async (session) => {
    setActiveSession(session);
    const msgs = await apiFetch(`/chat/sessions/${session.id}/messages`);
    setMessages(msgs);
  };

  const createSession = async () => {
    setCreating(true);
    const result = await apiFetch('/chat/sessions', {
      method: 'POST',
      body: JSON.stringify({ title: 'New Chat', subject: 'General' })
    });
    setCreating(false);
    if (result && result.id) {
      setSessions([result, ...sessions]);
      setActiveSession(result);
      setMessages([]);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeSession) return;
    setSending(true);
    const userMsg = { role: 'user', content: input };
    setMessages([...messages, userMsg]);
    setInput('');

    const result = await apiFetch(`/chat/sessions/${activeSession.id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content: input })
    });

    if (result.assistantMessage) {
      setMessages([...messages, userMsg, result.assistantMessage]);
    }
    setSending(false);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 7rem)' }}>
      {/* Mobile header with New Chat button */}
      <div className="lg:hidden flex items-center gap-2 mb-3">
        <Button onClick={createSession} disabled={creating} className="flex-1 flex items-center justify-center">
          <Plus size={18} className="mr-2" />
          {creating ? 'Creating...' : 'New Chat'}
        </Button>
        {sessions.length > 0 && (
          <select
            className="border rounded-lg px-3 py-2 text-sm"
            value={activeSession?.id || ''}
            onChange={e => {
              const s = sessions.find(s => s.id === e.target.value);
              if (s) loadSession(s);
            }}
          >
            <option value="">Select chat...</option>
            {sessions.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        )}
      </div>
      <div className="flex gap-4 flex-1 min-h-0">
      {/* Sessions sidebar */}
      <div className="w-64 flex-shrink-0 hidden lg:block">
        <Card className="h-full flex flex-col" hover={false}>
          <div className="p-4 border-b">
            <Button onClick={createSession} disabled={creating} className="w-full flex items-center justify-center">
              <Plus size={18} className="mr-2" />
              {creating ? 'Creating...' : 'New Chat'}
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {sessions.map(session => (
              <button
                key={session.id}
                onClick={() => loadSession(session)}
                className={`w-full text-left p-3 rounded-lg mb-1 transition-colors ${activeSession?.id === session.id ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'}`}
              >
                <p className="font-medium text-sm truncate">{session.title}</p>
                <p className="text-xs text-gray-500">{session.subject}</p>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Chat area */}
      <Card className="flex-1 flex flex-col" hover={false}>
        {activeSession ? (
          <>
            <div className="p-4 border-b">
              <h2 className="font-semibold">{activeSession.title}</h2>
              <p className="text-sm text-gray-500">{activeSession.subject}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${msg.role === 'user' ? 'chat-bubble-user text-white' : 'chat-bubble-assistant'}`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-2xl px-4 py-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && sendMessage()}
                  placeholder="Ask your question..."
                  className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <Button onClick={sendMessage} disabled={sending}>
                  <Send size={18} />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <MessageCircle size={32} className="text-green-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">AI Tutor Chat</h2>
            <p className="text-gray-500 mb-4">Get instant help with your studies</p>
            <Button onClick={createSession} disabled={creating}>{creating ? 'Creating...' : 'Start New Chat'}</Button>
          </div>
        )}
      </Card>
      </div>
    </div>
  );
};

// Goals Page
const Goals = () => {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [newGoal, setNewGoal] = useState({ title: '', description: '', targetDate: '', category: 'Learning' });

  useEffect(() => {
    apiFetch('/goals').then(data => {
      setGoals(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    const result = await apiFetch('/goals', {
      method: 'POST',
      body: JSON.stringify(newGoal)
    });
    if (result && result.id) {
      setGoals([result, ...goals]);
      setShowModal(false);
      setNewGoal({ title: '', description: '', targetDate: '', category: 'Learning' });
    }
  };

  const handleUpdate = async (goalId, updates) => {
    const result = await apiFetch(`/goals/${goalId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    if (result && result.id) {
      setGoals(goals.map(g => g.id === goalId ? result : g));
      setSelectedGoal(result);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Goals</h1>
          <p className="text-gray-500">Track your learning objectives</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={18} className="mr-2" />
          New Goal
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {goals.map(goal => (
          <Card key={goal.id} className="p-4" onClick={() => setSelectedGoal(goal)}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${goal.status === 'completed' ? 'bg-green-100' : 'bg-purple-100'}`}>
                  <Target size={20} className={goal.status === 'completed' ? 'text-green-600' : 'text-purple-600'} />
                </div>
                <Badge color={goal.status === 'completed' ? 'green' : 'blue'}>{goal.category}</Badge>
              </div>
              {goal.status === 'completed' && <Check size={20} className="text-green-600" />}
            </div>
            <h3 className="font-semibold mb-1">{goal.title}</h3>
            <p className="text-sm text-gray-500 mb-3">{goal.description}</p>
            <div className="mb-2">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">Progress</span>
                <span className="font-medium">{goal.progress_percentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${goal.progress_percentage}%` }} />
              </div>
            </div>
            {goal.target_date && (
              <p className="text-xs text-gray-400">Target: {new Date(goal.target_date).toLocaleDateString()}</p>
            )}
          </Card>
        ))}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Goal">
        <Input label="Title" value={newGoal.title} onChange={e => setNewGoal({...newGoal, title: e.target.value})} />
        <TextArea label="Description" rows={2} value={newGoal.description} onChange={e => setNewGoal({...newGoal, description: e.target.value})} />
        <div className="grid grid-cols-2 gap-4">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select className="w-full px-4 py-2 border rounded-lg" value={newGoal.category} onChange={e => setNewGoal({...newGoal, category: e.target.value})}>
              <option>Learning</option>
              <option>Reading</option>
              <option>Writing</option>
              <option>Languages</option>
              <option>Other</option>
            </select>
          </div>
          <Input label="Target Date" type="date" value={newGoal.targetDate} onChange={e => setNewGoal({...newGoal, targetDate: e.target.value})} />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={handleCreate}>Create</Button>
        </div>
      </Modal>

      <Modal isOpen={!!selectedGoal} onClose={() => setSelectedGoal(null)} title="Goal Details">
        {selectedGoal && (
          <>
            <h3 className="text-lg font-semibold mb-2">{selectedGoal.title}</h3>
            <p className="text-gray-500 mb-4">{selectedGoal.description}</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Progress: {selectedGoal.progress_percentage}%</label>
              <input
                type="range"
                min="0"
                max="100"
                value={selectedGoal.progress_percentage}
                onChange={e => handleUpdate(selectedGoal.id, { progressPercentage: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={selectedGoal.status === 'completed' ? 'secondary' : 'success'}
                onClick={() => handleUpdate(selectedGoal.id, { status: selectedGoal.status === 'completed' ? 'in_progress' : 'completed', progressPercentage: selectedGoal.status === 'completed' ? selectedGoal.progress_percentage : 100 })}
                className="flex-1"
              >
                {selectedGoal.status === 'completed' ? 'Mark Incomplete' : 'Mark Complete'}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

// Vocabulary Page
const Vocabulary = () => {
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWord, setSelectedWord] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [newWord, setNewWord] = useState({ word: '', definition: '', partOfSpeech: 'noun', exampleSentence: '', difficultyLevel: 'Beginner' });

  useEffect(() => {
    apiFetch('/vocabulary').then(data => {
      setWords(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    const result = await apiFetch('/vocabulary', {
      method: 'POST',
      body: JSON.stringify(newWord)
    });
    if (result && result.id) {
      setWords([result, ...words]);
      setShowModal(false);
      setNewWord({ word: '', definition: '', partOfSpeech: 'noun', exampleSentence: '', difficultyLevel: 'Beginner' });
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Vocabulary Builder</h1>
          <p className="text-gray-500">Expand your word knowledge</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={18} className="mr-2" />
          New Word
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {words.map(word => (
          <Card key={word.id} className="p-4" onClick={() => setSelectedWord(word)}>
            <div className="flex items-center justify-between mb-2">
              <Badge color={word.difficulty_level === 'Beginner' ? 'green' : word.difficulty_level === 'Advanced' ? 'red' : 'yellow'}>
                {word.difficulty_level}
              </Badge>
              <span className="text-xs text-gray-400">{word.part_of_speech}</span>
            </div>
            <h3 className="text-lg font-semibold mb-1">{word.word}</h3>
            <p className="text-sm text-gray-500 line-clamp-2">{word.definition}</p>
          </Card>
        ))}
      </div>

      <Modal isOpen={!!selectedWord} onClose={() => setSelectedWord(null)} title="Word Details">
        {selectedWord && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <Badge color={selectedWord.difficulty_level === 'Beginner' ? 'green' : selectedWord.difficulty_level === 'Advanced' ? 'red' : 'yellow'}>
                {selectedWord.difficulty_level}
              </Badge>
              <Badge color="gray">{selectedWord.part_of_speech}</Badge>
            </div>
            <h2 className="text-2xl font-bold mb-1">{selectedWord.word}</h2>
            {selectedWord.pronunciation && <p className="text-gray-400 mb-4">{selectedWord.pronunciation}</p>}
            <div className="mb-4">
              <h4 className="font-semibold text-sm text-gray-700 mb-1">Definition</h4>
              <p className="text-gray-600">{selectedWord.definition}</p>
            </div>
            {selectedWord.example_sentence && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-sm text-gray-700 mb-1">Example</h4>
                <p className="text-gray-600 italic">"{selectedWord.example_sentence}"</p>
              </div>
            )}
          </>
        )}
      </Modal>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Vocabulary Word">
        <Input label="Word" value={newWord.word} onChange={e => setNewWord({...newWord, word: e.target.value})} />
        <TextArea label="Definition" rows={2} value={newWord.definition} onChange={e => setNewWord({...newWord, definition: e.target.value})} />
        <div className="grid grid-cols-2 gap-4">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Part of Speech</label>
            <select className="w-full px-4 py-2 border rounded-lg" value={newWord.partOfSpeech} onChange={e => setNewWord({...newWord, partOfSpeech: e.target.value})}>
              <option value="noun">Noun</option>
              <option value="verb">Verb</option>
              <option value="adjective">Adjective</option>
              <option value="adverb">Adverb</option>
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
            <select className="w-full px-4 py-2 border rounded-lg" value={newWord.difficultyLevel} onChange={e => setNewWord({...newWord, difficultyLevel: e.target.value})}>
              <option>Beginner</option>
              <option>Intermediate</option>
              <option>Advanced</option>
            </select>
          </div>
        </div>
        <TextArea label="Example Sentence" rows={2} value={newWord.exampleSentence} onChange={e => setNewWord({...newWord, exampleSentence: e.target.value})} />
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={handleCreate}>Add Word</Button>
        </div>
      </Modal>
    </div>
  );
};

// Essays Page
const Essays = () => {
  const [essays, setEssays] = useState([]);
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newEssay, setNewEssay] = useState({ title: '', content: '', prompt: '', subject: 'English' });
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      apiFetch('/essays'),
      apiFetch('/writing-prompts')
    ]).then(([essaysData, promptsData]) => {
      setEssays(Array.isArray(essaysData) ? essaysData : []);
      setPrompts(Array.isArray(promptsData) ? promptsData : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    const result = await apiFetch('/essays', {
      method: 'POST',
      body: JSON.stringify(newEssay)
    });
    if (result && result.id) {
      setEssays([result, ...essays]);
      setShowModal(false);
      setNewEssay({ title: '', content: '', prompt: '', subject: 'English' });
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Essay Grading</h1>
          <p className="text-gray-500">Write and get AI feedback on your essays</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={18} className="mr-2" />
          New Essay
        </Button>
      </div>

      <h2 className="text-lg font-semibold mb-4">Your Essays</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {essays.map(essay => (
          <Card key={essay.id} className="p-4" onClick={() => navigate(`/essays/${essay.id}`)}>
            <div className="flex items-center justify-between mb-2">
              <Badge color={essay.status === 'graded' ? 'green' : essay.status === 'submitted' ? 'blue' : 'gray'}>
                {essay.status}
              </Badge>
              {essay.ai_score && <span className="font-bold text-blue-600">{essay.ai_score}%</span>}
            </div>
            <h3 className="font-semibold mb-1">{essay.title}</h3>
            <p className="text-sm text-gray-500 mb-2">{essay.word_count} words</p>
            <p className="text-xs text-gray-400">Last updated: {new Date(essay.updated_at).toLocaleDateString()}</p>
          </Card>
        ))}
        {essays.length === 0 && (
          <div className="col-span-2 text-center py-8 text-gray-500">
            No essays yet. Start writing!
          </div>
        )}
      </div>

      <h2 className="text-lg font-semibold mb-4">Writing Prompts</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {prompts.slice(0, 6).map(prompt => (
          <Card key={prompt.id} className="p-4" onClick={() => { setNewEssay({ ...newEssay, prompt: prompt.prompt_text, title: prompt.title }); setShowModal(true); }}>
            <Badge className="mb-2">{prompt.genre}</Badge>
            <h3 className="font-semibold mb-1">{prompt.title}</h3>
            <p className="text-sm text-gray-500 line-clamp-2">{prompt.prompt_text}</p>
            <p className="text-xs text-gray-400 mt-2">Target: {prompt.word_count_target} words</p>
          </Card>
        ))}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Write Essay">
        <Input label="Title" value={newEssay.title} onChange={e => setNewEssay({...newEssay, title: e.target.value})} />
        {newEssay.prompt && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-700 mb-1">Prompt:</h4>
            <p className="text-sm text-blue-600">{newEssay.prompt}</p>
          </div>
        )}
        <TextArea label="Essay Content" rows={10} value={newEssay.content} onChange={e => setNewEssay({...newEssay, content: e.target.value})} placeholder="Start writing your essay here..." />
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={handleCreate}>Save Draft</Button>
        </div>
      </Modal>
    </div>
  );
};

// Essay Detail
const EssayDetail = () => {
  const { id } = useParams();
  const [essay, setEssay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState('');
  const [grading, setGrading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch(`/essays/${id}`).then(data => {
      setEssay(data);
      setContent(data.content || '');
      setLoading(false);
    });
  }, [id]);

  const handleSave = async () => {
    const result = await apiFetch(`/essays/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ content })
    });
    setEssay(result);
    setEditing(false);
  };

  const handleGrade = async () => {
    setGrading(true);
    const result = await apiFetch(`/essays/${id}/grade`, { method: 'POST' });
    setEssay(result);
    setGrading(false);
  };

  if (loading) return <LoadingSpinner />;
  if (!essay) return <div className="text-center py-8">Essay not found</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => navigate('/essays')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={20} />
        Back to Essays
      </button>

      <Card className="p-6 mb-6" hover={false}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge color={essay.status === 'graded' ? 'green' : essay.status === 'submitted' ? 'blue' : 'gray'}>
                {essay.status}
              </Badge>
              {essay.ai_score && <span className="font-bold text-blue-600 text-xl">{essay.ai_score}%</span>}
            </div>
            <h1 className="text-2xl font-bold">{essay.title}</h1>
            <p className="text-gray-500">{essay.word_count} words</p>
          </div>
          <div className="flex gap-2">
            {!editing && <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>}
            {!essay.ai_feedback && (
              <Button onClick={handleGrade} disabled={grading}>
                <Sparkles size={18} className="mr-2" />
                {grading ? 'Grading...' : 'Get AI Feedback'}
              </Button>
            )}
          </div>
        </div>

        {essay.prompt && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h4 className="text-sm font-semibold text-blue-700 mb-1">Prompt:</h4>
            <p className="text-sm text-blue-600">{essay.prompt}</p>
          </div>
        )}

        {editing ? (
          <>
            <TextArea rows={15} value={content} onChange={e => setContent(e.target.value)} />
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="secondary" onClick={() => { setEditing(false); setContent(essay.content); }}>Cancel</Button>
              <Button onClick={handleSave}>Save</Button>
            </div>
          </>
        ) : (
          <div className="prose max-w-none">
            <p className="whitespace-pre-wrap text-gray-700">{essay.content}</p>
          </div>
        )}
      </Card>

      {essay.ai_feedback && (
        <Card className="p-6" hover={false}>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="text-purple-600" size={24} />
            <h2 className="text-lg font-semibold">AI Feedback</h2>
          </div>
          <div className="prose max-w-none">
            <p className="whitespace-pre-wrap text-gray-700">{essay.ai_feedback}</p>
          </div>
        </Card>
      )}
    </div>
  );
};

// Math Solver Page
const MathSolver = () => {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState('');
  const [solution, setSolution] = useState(null);
  const [solving, setSolving] = useState(false);
  const [selectedProblem, setSelectedProblem] = useState(null);

  useEffect(() => {
    apiFetch('/math-problems').then(data => {
      setProblems(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSolve = async () => {
    if (!problem.trim()) return;
    setSolving(true);
    setSolution(null);
    const result = await apiFetch('/math-problems/solve', {
      method: 'POST',
      body: JSON.stringify({ problem })
    });
    setSolution(result);
    setSolving(false);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Math Problem Solver</h1>
        <p className="text-gray-500">Get step-by-step solutions with AI</p>
      </div>

      <Card className="p-6 mb-6" hover={false}>
        <TextArea
          label="Enter your math problem"
          rows={3}
          value={problem}
          onChange={e => setProblem(e.target.value)}
          placeholder="e.g., Solve for x: 2x + 5 = 13"
        />
        <Button onClick={handleSolve} disabled={solving || !problem.trim()}>
          <Calculator size={18} className="mr-2" />
          {solving ? 'Solving...' : 'Solve Problem'}
        </Button>

        {solution && (
          <div className="mt-6">
            <h3 className="font-semibold mb-2">Solution:</h3>
            <div className={`p-4 rounded-lg ${solution.error ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
              <p className="whitespace-pre-wrap">{solution.solution}</p>
            </div>
          </div>
        )}
      </Card>

      <h2 className="text-lg font-semibold mb-4">Practice Problems</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {problems.slice(0, 8).map(p => (
          <Card key={p.id} className="p-4" onClick={() => setSelectedProblem(p)}>
            <div className="flex items-center gap-2 mb-2">
              <Badge>{p.topic}</Badge>
              <Badge color={p.difficulty_level === 'Beginner' ? 'green' : p.difficulty_level === 'Advanced' ? 'red' : 'yellow'}>
                {p.difficulty_level}
              </Badge>
            </div>
            <p className="font-medium">{p.problem_text}</p>
          </Card>
        ))}
      </div>

      <Modal isOpen={!!selectedProblem} onClose={() => setSelectedProblem(null)} title="Math Problem">
        {selectedProblem && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <Badge>{selectedProblem.topic}</Badge>
              <Badge color={selectedProblem.difficulty_level === 'Beginner' ? 'green' : selectedProblem.difficulty_level === 'Advanced' ? 'red' : 'yellow'}>
                {selectedProblem.difficulty_level}
              </Badge>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="font-medium text-lg">{selectedProblem.problem_text}</p>
            </div>
            <h4 className="font-semibold mb-2">Solution Steps:</h4>
            <div className="space-y-2 mb-4">
              {(Array.isArray(selectedProblem.solution_steps) ? selectedProblem.solution_steps : []).map((step, idx) => (
                <div key={idx} className="flex gap-2 text-sm">
                  <span className="font-semibold text-blue-600">{idx + 1}.</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="font-semibold text-green-700">Answer: {selectedProblem.final_answer}</p>
            </div>
            <div className="mt-4">
              <Button onClick={() => { setProblem(selectedProblem.problem_text); setSelectedProblem(null); }}>
                Try with AI Solver
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

// Writing Assistant Page
const WritingAssistant = () => {
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState('grammar');

  const handleImprove = async () => {
    if (!text.trim()) return;
    setLoading(true);
    const res = await apiFetch('/writing-assistant/improve', {
      method: 'POST',
      body: JSON.stringify({ text, type })
    });
    setResult(res);
    setLoading(false);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Writing Assistant</h1>
        <p className="text-gray-500">Improve your writing with AI suggestions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6" hover={false}>
          <h3 className="font-semibold mb-4">Your Text</h3>
          <TextArea
            rows={12}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Paste or type your text here..."
          />
          <div className="flex items-center gap-4 mt-4">
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="px-4 py-2 border rounded-lg"
            >
              <option value="grammar">Fix Grammar</option>
              <option value="style">Improve Style</option>
              <option value="clarity">Enhance Clarity</option>
              <option value="expand">Expand Text</option>
            </select>
            <Button onClick={handleImprove} disabled={loading || !text.trim()}>
              <Sparkles size={18} className="mr-2" />
              {loading ? 'Processing...' : 'Improve'}
            </Button>
          </div>
        </Card>

        <Card className="p-6" hover={false}>
          <h3 className="font-semibold mb-4">Improved Text</h3>
          {result ? (
            <div className="bg-gray-50 rounded-lg p-4 min-h-[300px]">
              <p className="whitespace-pre-wrap">{result.improved}</p>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-4 min-h-[300px] flex items-center justify-center text-gray-400">
              Your improved text will appear here
            </div>
          )}
          {result && !result.error && (
            <Button variant="secondary" className="mt-4" onClick={() => { setText(result.improved); setResult(null); }}>
              Use This Text
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
};

// Analytics Page
const CHART_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

const Analytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [quizHistory, setQuizHistory] = useState([]);
  const [studyHistory, setStudyHistory] = useState([]);
  const [subjectScores, setSubjectScores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch('/analytics'),
      apiFetch('/analytics/quiz-history'),
      apiFetch('/analytics/study-history'),
      apiFetch('/analytics/subject-scores')
    ]).then(([analyticsData, quizData, studyData, subjectData]) => {
      setAnalytics(analyticsData || {});
      setQuizHistory(Array.isArray(quizData) ? quizData.map(d => ({ ...d, date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) })) : []);
      setStudyHistory(Array.isArray(studyData) ? studyData.map(d => ({ ...d, date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) })) : []);
      setSubjectScores(Array.isArray(subjectData) ? subjectData : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  // Build goals pie chart data
  const goalsData = [
    { name: 'Completed', value: parseInt(analytics?.goalStats?.completed_goals) || 0 },
    { name: 'In Progress', value: Math.max(0, (parseInt(analytics?.goalStats?.total_goals) || 0) - (parseInt(analytics?.goalStats?.completed_goals) || 0)) }
  ].filter(d => d.value > 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Performance Analytics</h1>
        <p className="text-gray-500">Track your learning progress with detailed charts</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="p-6" hover={false}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Brain size={24} className="text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Quiz Average</p>
              <p className="text-2xl font-bold">{Math.round(analytics?.quizStats?.avg_score || 0)}%</p>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {analytics?.quizStats?.total_quizzes || 0} quizzes completed
          </div>
        </Card>

        <Card className="p-6" hover={false}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Clock size={24} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Study Time</p>
              <p className="text-2xl font-bold">{Math.round((analytics?.studyStats?.total_minutes || 0) / 60)}h</p>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {analytics?.studyStats?.total_sessions || 0} sessions
          </div>
        </Card>

        <Card className="p-6" hover={false}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Target size={24} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Goals Progress</p>
              <p className="text-2xl font-bold">{Math.round(analytics?.goalStats?.avg_progress || 0)}%</p>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {analytics?.goalStats?.completed_goals || 0} / {analytics?.goalStats?.total_goals || 0} completed
          </div>
        </Card>
      </div>

      {/* Charts Row 1: Quiz Scores & Study Time */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Quiz Score Trend */}
        <Card className="p-6" hover={false}>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-purple-600" />
            Quiz Score Trend
          </h3>
          {quizHistory.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={quizHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  formatter={(value) => [`${value}%`, 'Score']}
                />
                <Line type="monotone" dataKey="avg_score" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Brain size={32} className="mx-auto mb-2" />
                <p>Complete quizzes to see your score trend</p>
              </div>
            </div>
          )}
        </Card>

        {/* Study Time Chart */}
        <Card className="p-6" hover={false}>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock size={20} className="text-blue-600" />
            Daily Study Time (minutes)
          </h3>
          {studyHistory.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={studyHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  formatter={(value) => [`${value} min`, 'Study Time']}
                />
                <Bar dataKey="total_minutes" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Clock size={32} className="mx-auto mb-2" />
                <p>Start studying to track your time</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Charts Row 2: Subject Performance & Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Subject Performance */}
        <Card className="p-6" hover={false}>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 size={20} className="text-green-600" />
            Performance by Subject
          </h3>
          {subjectScores.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={subjectScores} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                <YAxis dataKey="subject" type="category" tick={{ fontSize: 12 }} width={100} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  formatter={(value) => [`${value}%`, 'Avg Score']}
                />
                <Bar dataKey="avg_score" radius={[0, 4, 4, 0]}>
                  {subjectScores.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <BarChart3 size={32} className="mx-auto mb-2" />
                <p>Complete quizzes in different subjects</p>
              </div>
            </div>
          )}
        </Card>

        {/* Goals Completion */}
        <Card className="p-6" hover={false}>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Target size={20} className="text-emerald-600" />
            Goals Completion
          </h3>
          {goalsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={goalsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  <Cell fill="#10b981" />
                  <Cell fill="#e5e7eb" />
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Target size={32} className="mx-auto mb-2" />
                <p>Set goals to track your progress</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Achievements */}
      <h2 className="text-lg font-semibold mb-4">Recent Achievements</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {analytics?.achievements?.slice(0, 4).map(achievement => (
          <Card key={achievement.id} className="p-4" hover={false}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <Award size={24} className="text-yellow-600" />
              </div>
              <div>
                <p className="font-semibold">{achievement.title}</p>
                <p className="text-xs text-gray-500">{achievement.points} points</p>
              </div>
            </div>
          </Card>
        ))}
        {(!analytics?.achievements || analytics.achievements.length === 0) && (
          <div className="col-span-4 text-center py-8 text-gray-500">
            Complete activities to earn achievements!
          </div>
        )}
      </div>
    </div>
  );
};

// Achievements Page
const Achievements = () => {
  const [achievements, setAchievements] = useState([]);
  const [userAchievements, setUserAchievements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch('/achievements'),
      apiFetch('/achievements/user')
    ]).then(([all, user]) => {
      setAchievements(Array.isArray(all) ? all : []);
      setUserAchievements(Array.isArray(user) ? user : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const earnedIds = userAchievements.map(a => a.id);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Achievements</h1>
        <p className="text-gray-500">Collect badges and track your accomplishments</p>
      </div>

      <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl p-6 text-white mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
            <Award size={32} />
          </div>
          <div>
            <p className="text-3xl font-bold">{userAchievements.length} / {achievements.length}</p>
            <p className="opacity-90">Achievements Unlocked</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {achievements.map(achievement => {
          const earned = earnedIds.includes(achievement.id);
          return (
            <Card key={achievement.id} className={`p-4 ${!earned ? 'opacity-50' : ''}`} hover={false}>
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center ${earned ? 'bg-yellow-100' : 'bg-gray-100'}`}>
                  <Award size={28} className={earned ? 'text-yellow-600' : 'text-gray-400'} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{achievement.title}</h3>
                    {earned && <Check size={16} className="text-green-600" />}
                  </div>
                  <p className="text-sm text-gray-500">{achievement.description}</p>
                  <p className="text-xs text-gray-400 mt-1">{achievement.points} points</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

// Protected Route
const ProtectedRoute = ({ children }) => {
  const { token, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!token) return <Navigate to="/login" />;

  return <Layout>{children}</Layout>;
};

// App Component
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/learning-paths" element={<ProtectedRoute><LearningPaths /></ProtectedRoute>} />
          <Route path="/learning-paths/:id" element={<ProtectedRoute><LearningPathDetail /></ProtectedRoute>} />
          <Route path="/study-materials" element={<ProtectedRoute><StudyMaterials /></ProtectedRoute>} />
          <Route path="/study-materials/:id" element={<ProtectedRoute><StudyMaterialDetail /></ProtectedRoute>} />
          <Route path="/quizzes" element={<ProtectedRoute><Quizzes /></ProtectedRoute>} />
          <Route path="/quizzes/:id" element={<ProtectedRoute><QuizDetail /></ProtectedRoute>} />
          <Route path="/practice-problems" element={<ProtectedRoute><PracticeProblems /></ProtectedRoute>} />
          <Route path="/practice-problems/:id" element={<ProtectedRoute><PracticeProblemDetail /></ProtectedRoute>} />
          <Route path="/flashcards" element={<ProtectedRoute><Flashcards /></ProtectedRoute>} />
          <Route path="/flashcards/:id" element={<ProtectedRoute><FlashcardDeckDetail /></ProtectedRoute>} />
          <Route path="/video-lessons" element={<ProtectedRoute><VideoLessons /></ProtectedRoute>} />
          <Route path="/video-lessons/:id" element={<ProtectedRoute><VideoLessonDetail /></ProtectedRoute>} />
          <Route path="/ai-chat" element={<ProtectedRoute><AIChat /></ProtectedRoute>} />
          <Route path="/goals" element={<ProtectedRoute><Goals /></ProtectedRoute>} />
          <Route path="/vocabulary" element={<ProtectedRoute><Vocabulary /></ProtectedRoute>} />
          <Route path="/essays" element={<ProtectedRoute><Essays /></ProtectedRoute>} />
          <Route path="/essays/:id" element={<ProtectedRoute><EssayDetail /></ProtectedRoute>} />
          <Route path="/math-solver" element={<ProtectedRoute><MathSolver /></ProtectedRoute>} />
          <Route path="/writing-assistant" element={<ProtectedRoute><WritingAssistant /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
          <Route path="/achievements" element={<ProtectedRoute><Achievements /></ProtectedRoute>} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
