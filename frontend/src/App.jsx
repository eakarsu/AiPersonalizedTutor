import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import SpacedRepetition from './pages/SpacedRepetition.jsx';
import AdaptiveQuiz from './pages/AdaptiveQuiz.jsx';
import ParentDashboard from './pages/ParentDashboard.jsx';
import LearningStyleContentRecommend from './pages/LearningStyleContentRecommend.jsx';
import IntegrationsAndParent from './pages/IntegrationsAndParent.jsx';
// // === Batch 06 Gaps & Frontend Mounts ===
import CFAdaptiveQuizEnginePage from './pages/CFAdaptiveQuizEnginePage';
import CFParentInsightsPage from './pages/CFParentInsightsPage';
import CFContentRecommendationPage from './pages/CFContentRecommendationPage';
import CFAutomatedTutoringPage from './pages/CFAutomatedTutoringPage';
import CFProgressPredictionPage from './pages/CFProgressPredictionPage';
import GapNoTeacherPage from './pages/GapNoTeacherPage';
import GapNoCurriculumPage from './pages/GapNoCurriculumPage';
import GapNoPeerPage from './pages/GapNoPeerPage';
import GapNoDedicatedRoutesDirectoryAllRoutesInlinePage from './pages/GapNoDedicatedRoutesDirectoryAllRoutesInlinePage';
import GapLimitedFrontendOnly3PagesDespiteRichBackendPage from './pages/GapLimitedFrontendOnly3PagesDespiteRichBackendPage';
import GapNoRealLmsIntegrationCanvasBlackboardAdapterPage from './pages/GapNoRealLmsIntegrationCanvasBlackboardAdapterPage';
import GapNoPaymentBillingForParentSubscriptionsPage from './pages/GapNoPaymentBillingForParentSubscriptionsPage';
import GapNoWebhooksPage from './pages/GapNoWebhooksPage';
import GapNoAuditLoggingVisiblePage from './pages/GapNoAuditLoggingVisiblePage';
import GapLimitedRbacStudentParentTeacherSeparationUncPage from './pages/GapLimitedRbacStudentParentTeacherSeparationUncPage';
import CustomViewsPage from './pages/CustomViewsPage.jsx';
import CodexCustomVizFeature from './pages/CodexCustomVizFeature';
import CodexOperationsFeature from './pages/CodexOperationsFeature';

import {
  BookOpen, GraduationCap, Brain, MessageCircle, Target, BarChart3,
  FileText, Video, Calculator, PenTool, Lightbulb, Award, Clock,
  User, LogOut, Menu, X, ChevronRight, ChevronLeft, Plus, Send, Check, ArrowLeft,
  Play, Pause, RotateCcw, Eye, EyeOff, Sparkles, Zap, TrendingUp,
  BookMarked, Layers, Home, Settings, Bot, Trash2, Download, Search,
  Filter, AlertTriangle, CheckSquare, Square
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

  const logout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      });
    } catch (e) {}
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

// ==================== TOAST NOTIFICATIONS ====================
const ToastContext = createContext(null);
const useToast = () => useContext(ToastContext);

const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((message, type = 'success', duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);
  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error'),
    info: (msg) => addToast(msg, 'info'),
    warning: (msg) => addToast(msg, 'warning'),
  };
  const colors = { success: 'bg-green-500', error: 'bg-red-500', info: 'bg-blue-500', warning: 'bg-yellow-500' };
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed top-4 right-4 z-[60] space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`${colors[t.type]} text-white px-4 py-3 rounded-lg shadow-lg animate-slide-in flex items-center gap-2 min-w-[250px]`}>
            {t.type === 'success' && <Check size={16} />}
            {t.type === 'error' && <X size={16} />}
            {t.type === 'warning' && <AlertTriangle size={16} />}
            {t.type === 'info' && <Lightbulb size={16} />}
            <span className="text-sm">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// ==================== CONFIRM DIALOG ====================
const ConfirmDialog = ({ isOpen, onClose, onConfirm, title = 'Confirm', message = 'Are you sure?' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[55] p-4">
      <div className="bg-white rounded-xl max-w-sm w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={() => { onConfirm(); onClose(); }}>Delete</Button>
        </div>
      </div>
    </div>
  );
};

// ==================== SKELETON LOADING ====================
const Skeleton = ({ className = '' }) => (
  <div className={`skeleton rounded ${className}`} />
);

const CardSkeleton = () => (
  <div className="bg-white rounded-xl border border-gray-100 p-4">
    <div className="flex items-center gap-3 mb-3">
      <Skeleton className="w-10 h-10 rounded-lg" />
      <Skeleton className="w-20 h-5" />
    </div>
    <Skeleton className="w-3/4 h-5 mb-2" />
    <Skeleton className="w-full h-4 mb-1" />
    <Skeleton className="w-2/3 h-4" />
  </div>
);

const ListSkeleton = ({ count = 6, grid = true }) => (
  <div className={grid ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}>
    {Array.from({ length: count }).map((_, i) => <CardSkeleton key={i} />)}
  </div>
);

// ==================== ERROR BOUNDARY ====================
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center py-12">
          <AlertTriangle size={48} className="mx-auto text-red-400 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <Button onClick={() => this.setState({ hasError: false })}>Try Again</Button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ==================== PAGINATION CONTROLS ====================
const PaginationControls = ({ pagination, onPageChange }) => {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, totalPages, total } = pagination;
  return (
    <div className="flex items-center justify-between mt-6 flex-wrap gap-2">
      <p className="text-sm text-gray-500">{total} items total</p>
      <div className="flex items-center gap-1">
        <Button variant="secondary" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          <ChevronLeft size={16} />
        </Button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let p;
          if (totalPages <= 5) p = i + 1;
          else if (page <= 3) p = i + 1;
          else if (page >= totalPages - 2) p = totalPages - 4 + i;
          else p = page - 2 + i;
          return (
            <Button key={p} variant={p === page ? 'primary' : 'secondary'} size="sm" onClick={() => onPageChange(p)} className="min-w-[36px]">
              {p}
            </Button>
          );
        })}
        <Button variant="secondary" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
};

// ==================== SEARCH & FILTER CONTROLS ====================
const SearchInput = ({ value, onChange, placeholder = 'Search...' }) => {
  const [local, setLocal] = useState(value || '');
  const timerRef = useRef(null);
  useEffect(() => { setLocal(value || ''); }, [value]);
  const handleChange = (v) => {
    setLocal(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(v), 300);
  };
  return (
    <div className="relative">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        value={local}
        onChange={e => handleChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
      />
      {local && (
        <button onClick={() => handleChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          <X size={14} />
        </button>
      )}
    </div>
  );
};

const FilterSelect = ({ label, value, onChange, options }) => (
  <select
    value={value || ''}
    onChange={e => onChange(e.target.value || null)}
    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
  >
    <option value="">{label}</option>
    {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
  </select>
);

const ListToolbar = ({ search, onSearchChange, filters = [], children }) => (
  <div className="flex flex-wrap items-center gap-3 mb-4">
    <div className="w-64">
      <SearchInput value={search} onChange={onSearchChange} />
    </div>
    {filters.map(f => (
      <FilterSelect key={f.key} label={f.label} value={f.value} onChange={f.onChange} options={f.options} />
    ))}
    {children}
  </div>
);

// ==================== PAGINATED DATA HOOK ====================
const usePaginatedData = (endpoint, options = {}) => {
  const { searchColumns, filterConfigs = [] } = options;
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', page);
    params.set('limit', '20');
    if (search) params.set('search', search);
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });

    const result = await apiFetch(`${endpoint}?${params.toString()}`);
    if (result && result.data) {
      setData(result.data);
      setPagination(result.pagination);
    } else if (Array.isArray(result)) {
      setData(result);
      setPagination(null);
    } else {
      setData([]);
    }
    setLoading(false);
  }, [endpoint, page, search, filters, refreshKey]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [search, filters]);

  const refresh = () => setRefreshKey(k => k + 1);
  const setFilter = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));

  return { data, setData, pagination, loading, search, setSearch, filters, setFilter, page, setPage, refresh };
};

// ==================== BULK SELECT HOOK ====================
const useBulkSelect = (items) => {
  const [selected, setSelected] = useState(new Set());
  const toggleItem = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map(i => i.id)));
  };
  const clearSelection = () => setSelected(new Set());
  return { selected, toggleItem, toggleAll, clearSelection, hasSelection: selected.size > 0, allSelected: items.length > 0 && selected.size === items.length };
};

// ==================== BULK ACTION BAR ====================
const BulkActionBar = ({ selected, onDelete, onExportCsv, onExportPdf, onClear }) => {
  if (selected.size === 0) return null;
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 flex items-center justify-between flex-wrap gap-2">
      <span className="text-sm font-medium text-blue-700">{selected.size} item{selected.size > 1 ? 's' : ''} selected</span>
      <div className="flex items-center gap-2">
        {onExportCsv && <Button variant="secondary" size="sm" onClick={onExportCsv}><Download size={14} className="mr-1" />CSV</Button>}
        {onExportPdf && <Button variant="secondary" size="sm" onClick={onExportPdf}><Download size={14} className="mr-1" />PDF</Button>}
        {onDelete && <Button variant="danger" size="sm" onClick={onDelete}><Trash2 size={14} className="mr-1" />Delete</Button>}
        <Button variant="ghost" size="sm" onClick={onClear}><X size={14} /></Button>
      </div>
    </div>
  );
};

const SelectCheckbox = ({ checked, onChange }) => (
  <button onClick={e => { e.stopPropagation(); onChange(); }} className="p-1 hover:bg-gray-100 rounded">
    {checked ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} className="text-gray-400" />}
  </button>
);

// ==================== FORM VALIDATION HOOK ====================
const useFormValidation = (rules) => {
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const validate = (field, value) => {
    const fieldRules = rules[field];
    if (!fieldRules) return null;
    for (const rule of fieldRules) {
      if (rule.required && (!value || !value.toString().trim())) return rule.message || `${field} is required`;
      if (rule.minLength && value && value.length < rule.minLength) return rule.message || `Minimum ${rule.minLength} characters`;
      if (rule.maxLength && value && value.length > rule.maxLength) return rule.message || `Maximum ${rule.maxLength} characters`;
      if (rule.pattern && value && !rule.pattern.test(value)) return rule.message || 'Invalid format';
      if (rule.custom && value) { const err = rule.custom(value); if (err) return err; }
    }
    return null;
  };

  const validateField = (field, value) => {
    const error = validate(field, value);
    setErrors(prev => ({ ...prev, [field]: error }));
    setTouched(prev => ({ ...prev, [field]: true }));
    return !error;
  };

  const validateAll = (values) => {
    const newErrors = {};
    let valid = true;
    const newTouched = {};
    for (const field of Object.keys(rules)) {
      const error = validate(field, values[field]);
      newErrors[field] = error;
      newTouched[field] = true;
      if (error) valid = false;
    }
    setErrors(newErrors);
    setTouched(newTouched);
    return valid;
  };

  const clearErrors = () => { setErrors({}); setTouched({}); };

  return { errors, touched, validateField, validateAll, clearErrors };
};

const FormError = ({ error, touched }) => {
  if (!error || !touched) return null;
  return <p className="text-red-500 text-xs mt-1">{error}</p>;
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
    { icon: User, label: 'Learning Style', path: '/learning-style' },
    { icon: Sparkles, label: 'Style-Tailored Content', path: '/learning-style-recommendations' },
    { icon: Zap, label: 'Quiz Generator', path: '/quiz-generator' },
    { icon: TrendingUp, label: 'Progress Predictor', path: '/progress-predictor' },
    { icon: Lightbulb, label: 'Concept Explainer', path: '/concept-explainer' },
    { icon: Clock, label: 'Study Scheduler', path: '/study-scheduler' },
    { icon: FileText, label: 'Homework Helper', path: '/homework-helper' },
    { icon: Calculator, label: 'Math Tutor', path: '/math-tutor' },
    { icon: BookOpen, label: 'History Explorer', path: '/history-explorer' },
    { icon: Lightbulb, label: 'Science Lab', path: '/science-lab' },
    { icon: Layers, label: 'Flashcard Generator', path: '/flashcard-generator' },
    { icon: Layers, label: 'Spaced Repetition', path: '/spaced-repetition' },
    { icon: Brain, label: 'Adaptive Quiz', path: '/adaptive-quiz' },
    { icon: User, label: 'Parent Dashboard', path: '/parent-dashboard' },
    { icon: BarChart3, label: 'Tutor Views', path: '/custom-views' },
    { icon: BarChart3, label: 'Analytics', path: '/analytics' },
    { icon: Award, label: 'Achievements', path: '/achievements' },
    { icon: Settings, label: 'Settings', path: '/settings' },
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
    setEmail(import.meta.env.VITE_DEMO_EMAIL || '');
    setPassword(import.meta.env.VITE_DEMO_PASSWORD || '');
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

  const aiFeatures = [
    { icon: User, label: 'Learning Style', path: '/learning-style', color: 'bg-gradient-to-r from-violet-500 to-purple-500', desc: 'Discover how you learn best' },
    { icon: Zap, label: 'Quiz Generator', path: '/quiz-generator', color: 'bg-gradient-to-r from-yellow-500 to-orange-500', desc: 'Create custom AI quizzes' },
    { icon: TrendingUp, label: 'Progress Predictor', path: '/progress-predictor', color: 'bg-gradient-to-r from-green-500 to-emerald-500', desc: 'Predict your future scores' },
    { icon: Lightbulb, label: 'Concept Explainer', path: '/concept-explainer', color: 'bg-gradient-to-r from-blue-500 to-cyan-500', desc: 'Understand any concept' },
    { icon: Clock, label: 'Study Scheduler', path: '/study-scheduler', color: 'bg-gradient-to-r from-pink-500 to-rose-500', desc: 'AI-optimized schedule' },
    { icon: FileText, label: 'Homework Helper', path: '/homework-helper', color: 'bg-gradient-to-r from-indigo-500 to-violet-500', desc: 'Get assignment guidance' },
    { icon: Calculator, label: 'Math Tutor', path: '/math-tutor', color: 'bg-gradient-to-r from-red-500 to-orange-500', desc: 'Personal math help' },
    { icon: BookOpen, label: 'History Explorer', path: '/history-explorer', color: 'bg-gradient-to-r from-amber-500 to-yellow-500', desc: 'Explore historical events' },
    { icon: Lightbulb, label: 'Science Lab', path: '/science-lab', color: 'bg-gradient-to-r from-teal-500 to-green-500', desc: 'Virtual experiments' },
    { icon: Layers, label: 'Flashcard Generator', path: '/flashcard-generator', color: 'bg-gradient-to-r from-fuchsia-500 to-pink-500', desc: 'AI-generated cards' },
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

      {/* AI-Powered Features */}
      <h2 className="text-lg font-semibold mb-4">AI-Powered Features</h2>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {aiFeatures.map(f => (
          <Card key={f.path} className="p-4" onClick={() => navigate(f.path)}>
            <div className={`w-10 h-10 ${f.color} rounded-lg flex items-center justify-center mb-2`}>
              <f.icon size={20} className="text-white" />
            </div>
            <h3 className="font-semibold text-sm">{f.label}</h3>
            <p className="text-xs text-gray-500">{f.desc}</p>
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
  const { data: paths, setData: setPaths, pagination, loading, search, setSearch, setFilter, filters, page, setPage, refresh } = usePaginatedData('/learning-paths');
  const { selected, toggleItem, toggleAll, clearSelection, hasSelection, allSelected } = useBulkSelect(paths);
  const [showModal, setShowModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [newPath, setNewPath] = useState({ title: '', description: '', subject: '', difficultyLevel: 'Beginner', estimatedHours: 10 });
  const navigate = useNavigate();
  const toast = useToast();

  const handleCreate = async () => {
    const result = await apiFetch('/learning-paths', { method: 'POST', body: JSON.stringify(newPath) });
    if (result && result.id) {
      setShowModal(false);
      setNewPath({ title: '', description: '', subject: '', difficultyLevel: 'Beginner', estimatedHours: 10 });
      refresh();
      toast.success('Learning path created');
    } else { toast.error('Failed to create learning path'); }
  };

  const handleDelete = async (pathId) => {
    await apiFetch(`/learning-paths/${pathId}`, { method: 'DELETE' });
    refresh();
    toast.success('Learning path deleted');
  };

  const handleBulkDelete = async () => {
    await apiFetch('/learning-paths/bulk-delete', { method: 'POST', body: JSON.stringify({ ids: [...selected] }) });
    clearSelection();
    refresh();
    toast.success(`${selected.size} items deleted`);
  };

  const handleExportCsv = () => { window.open(`${API_URL}/learning-paths/export/csv`, '_blank'); };

  if (loading && !paths.length) return <ListSkeleton />;

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

      <ListToolbar search={search} onSearchChange={setSearch} filters={[
        { key: 'subject', label: 'All Subjects', value: filters.subject, onChange: v => setFilter('subject', v), options: ['Mathematics', 'Science', 'English', 'History', 'Technology', 'Languages', 'Arts'] },
        { key: 'difficulty_level', label: 'All Levels', value: filters.difficulty_level, onChange: v => setFilter('difficulty_level', v), options: ['Beginner', 'Intermediate', 'Advanced'] },
      ]}>
        <Button variant="ghost" size="sm" onClick={toggleAll}>
          {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
        </Button>
        {hasSelection && <Button variant="secondary" size="sm" onClick={handleExportCsv}><Download size={14} className="mr-1" />CSV</Button>}
      </ListToolbar>

      <BulkActionBar selected={selected} onDelete={() => setConfirmDelete('bulk')} onExportCsv={handleExportCsv} onClear={clearSelection} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {paths.map(path => (
          <Card key={path.id} className="p-4" onClick={() => navigate(`/learning-paths/${path.id}`)}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <SelectCheckbox checked={selected.has(path.id)} onChange={() => toggleItem(path.id)} />
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <BookOpen size={20} className="text-blue-600" />
                </div>
                <Badge>{path.subject}</Badge>
              </div>
              <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(path.id); }} className="p-1 text-red-500 hover:bg-red-50 rounded">
                <Trash2 size={16} />
              </button>
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

      <PaginationControls pagination={pagination} onPageChange={setPage} />

      <ConfirmDialog isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Learning Path" message={confirmDelete === 'bulk' ? `Delete ${selected.size} selected items?` : 'Delete this learning path?'} onConfirm={() => confirmDelete === 'bulk' ? handleBulkDelete() : handleDelete(confirmDelete)} />

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Learning Path">
        <Input label="Title" value={newPath.title} onChange={e => setNewPath({...newPath, title: e.target.value})} />
        <TextArea label="Description" rows={3} value={newPath.description} onChange={e => setNewPath({...newPath, description: e.target.value})} />
        <Input label="Subject" value={newPath.subject} onChange={e => setNewPath({...newPath, subject: e.target.value})} />
        <div className="grid grid-cols-2 gap-4">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
            <select className="w-full px-4 py-2 border rounded-lg" value={newPath.difficultyLevel} onChange={e => setNewPath({...newPath, difficultyLevel: e.target.value})}>
              <option>Beginner</option>
              <option>Intermediate</option>
              <option>Advanced</option>
            </select>
          </div>
          <Input label="Hours" type="number" value={newPath.estimatedHours} onChange={e => setNewPath({...newPath, estimatedHours: parseInt(e.target.value)})} />
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
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    apiFetch(`/learning-paths/${id}`).then(data => {
      setPath(data);
      setEditForm({ title: data.title, description: data.description, subject: data.subject, difficultyLevel: data.difficulty_level, estimatedHours: data.estimated_hours });
      setLoading(false);
    });
  }, [id]);

  const handleSave = async () => {
    const result = await apiFetch(`/learning-paths/${id}`, { method: 'PUT', body: JSON.stringify(editForm) });
    if (result) { setPath({ ...path, ...result }); setEditing(false); toast.success('Learning path updated'); }
  };

  const handleDelete = async () => {
    await apiFetch(`/learning-paths/${id}`, { method: 'DELETE' });
    toast.success('Learning path deleted');
    navigate('/learning-paths');
  };

  if (loading) return <LoadingSpinner />;
  if (!path) return <div className="text-center py-8">Learning path not found</div>;

  return (
    <div>
      <button onClick={() => navigate('/learning-paths')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={20} />
        Back to Learning Paths
      </button>

      <div className="bg-white rounded-xl border p-6 mb-6">
        {editing ? (
          <div className="space-y-4">
            <Input label="Title" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} />
            <TextArea label="Description" rows={3} value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} />
            <div className="grid grid-cols-3 gap-4">
              <Input label="Subject" value={editForm.subject} onChange={e => setEditForm({...editForm, subject: e.target.value})} />
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                <select className="w-full px-4 py-2 border rounded-lg" value={editForm.difficultyLevel} onChange={e => setEditForm({...editForm, difficultyLevel: e.target.value})}>
                  <option>Beginner</option><option>Intermediate</option><option>Advanced</option>
                </select>
              </div>
              <Input label="Hours" type="number" value={editForm.estimatedHours} onChange={e => setEditForm({...editForm, estimatedHours: parseInt(e.target.value)})} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save</Button>
            </div>
          </div>
        ) : (
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
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
            <Button variant="danger" onClick={() => setConfirmDelete(true)}><Trash2 size={16} /></Button>
          </div>
        </div>
        )}
      </div>
      <ConfirmDialog isOpen={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete Learning Path" message="Are you sure you want to delete this learning path?" onConfirm={handleDelete} />

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
  const { data: materials, pagination, loading, search, setSearch, setFilter, filters, page, setPage, refresh } = usePaginatedData('/study-materials');
  const { selected, toggleItem, clearSelection } = useBulkSelect(materials);
  const [showModal, setShowModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [newMaterial, setNewMaterial] = useState({ title: '', content: '', subject: '', topic: '', materialType: 'lesson', difficultyLevel: 'Beginner' });
  const navigate = useNavigate();
  const toast = useToast();

  const handleCreate = async () => {
    const result = await apiFetch('/study-materials', { method: 'POST', body: JSON.stringify(newMaterial) });
    if (result && result.id) {
      setShowModal(false);
      setNewMaterial({ title: '', content: '', subject: '', topic: '', materialType: 'lesson', difficultyLevel: 'Beginner' });
      refresh();
      toast.success('Study material created');
    }
  };

  const handleBulkDelete = async () => {
    await apiFetch('/study-materials/bulk-delete', { method: 'POST', body: JSON.stringify({ ids: [...selected] }) });
    clearSelection();
    refresh();
    toast.success(`${selected.size} items deleted`);
  };

  if (loading && !materials.length) return <ListSkeleton count={4} />;

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

      <ListToolbar search={search} onSearchChange={setSearch} filters={[
        { key: 'subject', label: 'All Subjects', value: filters.subject, onChange: v => setFilter('subject', v), options: ['Mathematics', 'Science', 'English', 'History', 'Technology', 'Languages'] },
        { key: 'difficulty_level', label: 'All Levels', value: filters.difficulty_level, onChange: v => setFilter('difficulty_level', v), options: ['Beginner', 'Intermediate', 'Advanced'] },
      ]} />

      <BulkActionBar selected={selected} onDelete={() => setConfirmDelete('bulk')} onExportCsv={() => window.open(`${API_URL}/study-materials/export/csv`, '_blank')} onClear={clearSelection} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {materials.map(material => (
          <Card key={material.id} className="p-4" onClick={() => navigate(`/study-materials/${material.id}`)}>
            <div className="flex items-center gap-2 mb-2">
              <SelectCheckbox checked={selected.has(material.id)} onChange={() => toggleItem(material.id)} />
              <Badge>{material.subject}</Badge>
              <Badge color="gray">{material.material_type}</Badge>
            </div>
            <h3 className="font-semibold mb-1">{material.title}</h3>
            <p className="text-sm text-gray-500 line-clamp-2">{material.content?.substring(0, 150)}...</p>
          </Card>
        ))}
      </div>

      <PaginationControls pagination={pagination} onPageChange={setPage} />
      <ConfirmDialog isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete" message={`Delete ${selected.size} selected items?`} onConfirm={handleBulkDelete} />

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
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    apiFetch(`/study-materials/${id}`).then(data => {
      setMaterial(data);
      setEditForm({ title: data.title, content: data.content, subject: data.subject, topic: data.topic, materialType: data.material_type, difficultyLevel: data.difficulty_level });
      setLoading(false);
    });
  }, [id]);

  const handleSave = async () => {
    const result = await apiFetch(`/study-materials/${id}`, { method: 'PUT', body: JSON.stringify(editForm) });
    if (result) { setMaterial({ ...material, ...result }); setEditing(false); toast.success('Material updated'); }
  };

  const handleDelete = async () => {
    await apiFetch(`/study-materials/${id}`, { method: 'DELETE' });
    toast.success('Material deleted');
    navigate('/study-materials');
  };

  if (loading) return <LoadingSpinner />;
  if (!material) return <div className="text-center py-8">Material not found</div>;

  return (
    <div>
      <button onClick={() => navigate('/study-materials')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={20} />
        Back to Study Materials
      </button>

      <Card className="p-6" hover={false}>
        {editing ? (
          <div className="space-y-4">
            <Input label="Title" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} />
            <div className="grid grid-cols-3 gap-4">
              <Input label="Subject" value={editForm.subject} onChange={e => setEditForm({...editForm, subject: e.target.value})} />
              <Input label="Topic" value={editForm.topic} onChange={e => setEditForm({...editForm, topic: e.target.value})} />
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                <select className="w-full px-4 py-2 border rounded-lg" value={editForm.difficultyLevel} onChange={e => setEditForm({...editForm, difficultyLevel: e.target.value})}>
                  <option>Beginner</option><option>Intermediate</option><option>Advanced</option>
                </select>
              </div>
            </div>
            <TextArea label="Content" rows={10} value={editForm.content} onChange={e => setEditForm({...editForm, content: e.target.value})} />
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Badge>{material.subject}</Badge>
                <Badge color="gray">{material.topic}</Badge>
                <Badge color={material.difficulty_level === 'Beginner' ? 'green' : material.difficulty_level === 'Advanced' ? 'red' : 'yellow'}>
                  {material.difficulty_level}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
                <Button variant="danger" onClick={() => setConfirmDelete(true)}><Trash2 size={16} /></Button>
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-4">{material.title}</h1>
            <div className="prose max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap">{material.content}</p>
            </div>
          </>
        )}
      </Card>
      <ConfirmDialog isOpen={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete Material" message="Are you sure you want to delete this study material?" onConfirm={handleDelete} />
    </div>
  );
};

// Quizzes Page
const Quizzes = () => {
  const { data: quizzes, pagination, loading, search, setSearch, setFilter, filters, page, setPage, refresh } = usePaginatedData('/quizzes');
  const { selected, toggleItem, clearSelection } = useBulkSelect(quizzes);
  const [showModal, setShowModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [newQuiz, setNewQuiz] = useState({ title: '', description: '', subject: '', topic: '', difficultyLevel: 'Beginner', timeLimitMinutes: 15 });
  const navigate = useNavigate();
  const toast = useToast();

  const handleCreate = async () => {
    const result = await apiFetch('/quizzes', { method: 'POST', body: JSON.stringify(newQuiz) });
    if (result && result.id) {
      setShowModal(false);
      setNewQuiz({ title: '', description: '', subject: '', topic: '', difficultyLevel: 'Beginner', timeLimitMinutes: 15 });
      refresh();
      toast.success('Quiz created');
    }
  };

  const handleBulkDelete = async () => {
    await apiFetch('/quizzes/bulk-delete', { method: 'POST', body: JSON.stringify({ ids: [...selected] }) });
    clearSelection(); refresh(); toast.success(`${selected.size} quizzes deleted`);
  };

  if (loading && !quizzes.length) return <ListSkeleton />;

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

      <ListToolbar search={search} onSearchChange={setSearch} filters={[
        { key: 'subject', label: 'All Subjects', value: filters.subject, onChange: v => setFilter('subject', v), options: ['Mathematics', 'Science', 'English', 'History', 'Technology', 'Languages', 'Arts'] },
        { key: 'difficulty_level', label: 'All Levels', value: filters.difficulty_level, onChange: v => setFilter('difficulty_level', v), options: ['Beginner', 'Intermediate', 'Advanced'] },
      ]} />

      <BulkActionBar selected={selected} onDelete={() => setConfirmDelete('bulk')} onExportCsv={() => window.open(`${API_URL}/quizzes/export/csv`, '_blank')} onClear={clearSelection} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {quizzes.map(quiz => (
          <Card key={quiz.id} className="p-4" onClick={() => navigate(`/quizzes/${quiz.id}`)}>
            <div className="flex items-center gap-2 mb-3">
              <SelectCheckbox checked={selected.has(quiz.id)} onChange={() => toggleItem(quiz.id)} />
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

      <PaginationControls pagination={pagination} onPageChange={setPage} />
      <ConfirmDialog isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Quizzes" message={`Delete ${selected.size} selected quizzes?`} onConfirm={handleBulkDelete} />

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
  const { data: problems, pagination, loading, search, setSearch, setFilter, filters, page, setPage, refresh } = usePaginatedData('/practice-problems');
  const [showModal, setShowModal] = useState(false);
  const [newProblem, setNewProblem] = useState({ title: '', problemText: '', subject: '', topic: '', difficultyLevel: 'Beginner', solution: '', hints: [] });
  const navigate = useNavigate();
  const toast = useToast();

  const handleCreate = async () => {
    const result = await apiFetch('/practice-problems', { method: 'POST', body: JSON.stringify(newProblem) });
    if (result && result.id) {
      setShowModal(false);
      setNewProblem({ title: '', problemText: '', subject: '', topic: '', difficultyLevel: 'Beginner', solution: '', hints: [] });
      refresh();
      toast.success('Problem created');
    }
  };

  if (loading && !problems.length) return <ListSkeleton count={6} grid={false} />;

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

      <ListToolbar search={search} onSearchChange={setSearch} filters={[
        { key: 'subject', label: 'All Subjects', value: filters.subject, onChange: v => setFilter('subject', v), options: ['Mathematics', 'Science', 'English', 'History', 'Technology', 'Languages', 'Arts'] },
        { key: 'difficulty_level', label: 'All Levels', value: filters.difficulty_level, onChange: v => setFilter('difficulty_level', v), options: ['Beginner', 'Intermediate', 'Advanced'] },
      ]} />

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

      <PaginationControls pagination={pagination} onPageChange={setPage} />

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
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    apiFetch(`/practice-problems/${id}`).then(data => {
      setProblem(data);
      setEditForm({ title: data.title, problemText: data.problem_text, subject: data.subject, topic: data.topic, difficultyLevel: data.difficulty_level, solution: data.solution });
      setLoading(false);
    });
  }, [id]);

  const handleSave = async () => {
    const result = await apiFetch(`/practice-problems/${id}`, { method: 'PUT', body: JSON.stringify(editForm) });
    if (result) { setProblem({ ...problem, ...result }); setEditing(false); toast.success('Problem updated'); }
  };

  const handleDelete = async () => {
    await apiFetch(`/practice-problems/${id}`, { method: 'DELETE' });
    toast.success('Problem deleted');
    navigate('/practice-problems');
  };

  if (loading) return <LoadingSpinner />;
  if (!problem) return <div className="text-center py-8">Problem not found</div>;

  const hints = Array.isArray(problem.hints) ? problem.hints : [];

  if (editing) {
    return (
      <div className="max-w-3xl mx-auto">
        <button onClick={() => setEditing(false)} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={20} /> Cancel Edit
        </button>
        <Card className="p-6" hover={false}>
          <h2 className="text-lg font-semibold mb-4">Edit Problem</h2>
          <Input label="Title" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} />
          <TextArea label="Problem Text" rows={4} value={editForm.problemText} onChange={e => setEditForm({...editForm, problemText: e.target.value})} />
          <div className="grid grid-cols-3 gap-4">
            <Input label="Subject" value={editForm.subject} onChange={e => setEditForm({...editForm, subject: e.target.value})} />
            <Input label="Topic" value={editForm.topic} onChange={e => setEditForm({...editForm, topic: e.target.value})} />
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
              <select className="w-full px-4 py-2 border rounded-lg" value={editForm.difficultyLevel} onChange={e => setEditForm({...editForm, difficultyLevel: e.target.value})}>
                <option>Beginner</option><option>Intermediate</option><option>Advanced</option>
              </select>
            </div>
          </div>
          <TextArea label="Solution" rows={3} value={editForm.solution} onChange={e => setEditForm({...editForm, solution: e.target.value})} />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate('/practice-problems')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={20} />
        Back to Problems
      </button>

      <Card className="p-6 mb-4" hover={false}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Badge>{problem.subject}</Badge>
            <Badge color="gray">{problem.topic}</Badge>
            <Badge color={problem.difficulty_level === 'Beginner' ? 'green' : problem.difficulty_level === 'Advanced' ? 'red' : 'yellow'}>
              {problem.difficulty_level}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
            <Button variant="danger" onClick={() => setConfirmDelete(true)}><Trash2 size={16} /></Button>
          </div>
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
      <ConfirmDialog isOpen={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete Problem" message="Are you sure you want to delete this problem?" onConfirm={handleDelete} />
    </div>
  );
};

// Flashcards Page
const Flashcards = () => {
  const { data: decks, pagination, loading, search, setSearch, setFilter, filters, page, setPage, refresh } = usePaginatedData('/flashcard-decks');
  const [showModal, setShowModal] = useState(false);
  const [newDeck, setNewDeck] = useState({ title: '', description: '', subject: '', topic: '' });
  const navigate = useNavigate();
  const toast = useToast();

  const handleCreate = async () => {
    const result = await apiFetch('/flashcard-decks', { method: 'POST', body: JSON.stringify(newDeck) });
    if (result && result.id) {
      setShowModal(false);
      setNewDeck({ title: '', description: '', subject: '', topic: '' });
      refresh();
      toast.success('Flashcard deck created');
    }
  };

  if (loading && !decks.length) return <ListSkeleton />;

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

      <ListToolbar search={search} onSearchChange={setSearch} filters={[
        { key: 'subject', label: 'All Subjects', value: filters.subject, onChange: v => setFilter('subject', v), options: ['Mathematics', 'Science', 'English', 'History', 'Technology', 'Languages', 'Arts', 'Geography'] },
      ]} />

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

      <PaginationControls pagination={pagination} onPageChange={setPage} />

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
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    apiFetch(`/flashcard-decks/${id}`).then(data => {
      setDeck(data);
      setEditForm({ title: data.title, description: data.description, subject: data.subject, topic: data.topic });
      setLoading(false);
    });
  }, [id]);

  const handleSaveDeck = async () => {
    const result = await apiFetch(`/flashcard-decks/${id}`, { method: 'PUT', body: JSON.stringify(editForm) });
    if (result) { setDeck({ ...deck, ...result }); setEditing(false); toast.success('Deck updated'); }
  };

  const handleDeleteDeck = async () => {
    await apiFetch(`/flashcard-decks/${id}`, { method: 'DELETE' });
    toast.success('Deck deleted');
    navigate('/flashcards');
  };

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
        {editing ? (
          <div className="space-y-4">
            <Input label="Title" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} />
            <TextArea label="Description" rows={2} value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Subject" value={editForm.subject} onChange={e => setEditForm({...editForm, subject: e.target.value})} />
              <Input label="Topic" value={editForm.topic} onChange={e => setEditForm({...editForm, topic: e.target.value})} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
              <Button onClick={handleSaveDeck}>Save</Button>
            </div>
          </div>
        ) : (
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
            <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
            <Button variant="danger" onClick={() => setConfirmDelete(true)}><Trash2 size={16} /></Button>
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
        )}
      </Card>
      <ConfirmDialog isOpen={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete Deck" message="Are you sure you want to delete this flashcard deck?" onConfirm={handleDeleteDeck} />

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
  const { data: videos, pagination, loading, search, setSearch, setFilter, filters, page, setPage, refresh } = usePaginatedData('/video-lessons');
  const [showModal, setShowModal] = useState(false);
  const [newVideo, setNewVideo] = useState({ title: '', description: '', subject: '', topic: '', videoUrl: '', durationMinutes: 15, instructor: '' });
  const navigate = useNavigate();
  const toast = useToast();

  const handleCreate = async () => {
    const result = await apiFetch('/video-lessons', { method: 'POST', body: JSON.stringify(newVideo) });
    if (result && result.id) {
      setShowModal(false);
      setNewVideo({ title: '', description: '', subject: '', topic: '', videoUrl: '', durationMinutes: 15, instructor: '' });
      refresh();
      toast.success('Video lesson added');
    }
  };

  if (loading && !videos.length) return <ListSkeleton />;

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
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    apiFetch(`/video-lessons/${id}`).then(data => {
      setVideo(data);
      setEditForm({ title: data.title, description: data.description, subject: data.subject, topic: data.topic, videoUrl: data.video_url, durationMinutes: data.duration_minutes, instructor: data.instructor });
      setLoading(false);
    });
  }, [id]);

  const handleSave = async () => {
    const result = await apiFetch(`/video-lessons/${id}`, { method: 'PUT', body: JSON.stringify(editForm) });
    if (result) { setVideo({ ...video, ...result }); setEditing(false); toast.success('Video lesson updated'); }
  };

  const handleDelete = async () => {
    await apiFetch(`/video-lessons/${id}`, { method: 'DELETE' });
    toast.success('Video lesson deleted');
    navigate('/video-lessons');
  };

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
        {editing ? (
          <div className="space-y-4">
            <Input label="Title" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} />
            <TextArea label="Description" rows={3} value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Subject" value={editForm.subject} onChange={e => setEditForm({...editForm, subject: e.target.value})} />
              <Input label="Topic" value={editForm.topic} onChange={e => setEditForm({...editForm, topic: e.target.value})} />
            </div>
            <Input label="Video URL" value={editForm.videoUrl} onChange={e => setEditForm({...editForm, videoUrl: e.target.value})} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Instructor" value={editForm.instructor} onChange={e => setEditForm({...editForm, instructor: e.target.value})} />
              <Input label="Duration (min)" type="number" value={editForm.durationMinutes} onChange={e => setEditForm({...editForm, durationMinutes: parseInt(e.target.value)})} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge>{video.subject}</Badge>
                <Badge color="gray">{video.topic}</Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
                <Button variant="danger" onClick={() => setConfirmDelete(true)}><Trash2 size={16} /></Button>
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2">{video.title}</h1>
            <p className="text-gray-500 mb-4">{video.description}</p>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>By {video.instructor}</span>
              <span>{video.duration_minutes} minutes</span>
            </div>
          </>
        )}
      </Card>
      <ConfirmDialog isOpen={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete Video" message="Are you sure you want to delete this video lesson?" onConfirm={handleDelete} />
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
              {messages.length === 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="text-sm text-gray-500 self-center">Try:</span>
                  <button onClick={() => setInput('Can you explain the concept of photosynthesis in simple terms?')} className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100">Explain concept</button>
                  <button onClick={() => setInput('I need help understanding how to solve quadratic equations for my homework.')} className="px-3 py-1 text-xs bg-purple-50 text-purple-600 rounded-full hover:bg-purple-100">Help with HW</button>
                  <button onClick={() => setInput('What are some effective study techniques for preparing for a final exam?')} className="px-3 py-1 text-xs bg-green-50 text-green-600 rounded-full hover:bg-green-100">Study tips</button>
                </div>
              )}
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

  const handleDelete = async (goalId) => {
    await apiFetch(`/goals/${goalId}`, { method: 'DELETE' });
    setGoals(goals.filter(g => g.id !== goalId));
    setSelectedGoal(null);
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
              <div className="flex items-center gap-2">
                {goal.status === 'completed' && <Check size={20} className="text-green-600" />}
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(goal.id); }}
                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                >
                  <X size={16} />
                </button>
              </div>
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
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input className="w-full px-3 py-2 border rounded-lg text-sm" value={selectedGoal.title}
                  onChange={e => { const updated = {...selectedGoal, title: e.target.value}; setSelectedGoal(updated); handleUpdate(selectedGoal.id, { title: e.target.value }); }} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select className="w-full px-3 py-2 border rounded-lg text-sm" value={selectedGoal.category}
                  onChange={e => { const updated = {...selectedGoal, category: e.target.value}; setSelectedGoal(updated); handleUpdate(selectedGoal.id, { category: e.target.value }); }}>
                  <option>Learning</option><option>Reading</option><option>Writing</option><option>Languages</option><option>Dedication</option><option>Goals</option><option>Testing</option><option>Other</option>
                </select>
              </div>
            </div>
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
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge color={selectedWord.difficulty_level === 'Beginner' ? 'green' : selectedWord.difficulty_level === 'Advanced' ? 'red' : 'yellow'}>
                  {selectedWord.difficulty_level}
                </Badge>
                <Badge color="gray">{selectedWord.part_of_speech}</Badge>
              </div>
              <button onClick={async () => {
                await apiFetch(`/vocabulary/${selectedWord.id}`, { method: 'DELETE' });
                setWords(words.filter(w => w.id !== selectedWord.id));
                setSelectedWord(null);
              }} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
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
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-sm text-gray-500 self-center">Try sample:</span>
          <button onClick={() => setNewEssay({ title: 'The Impact of Technology on Education', content: 'Technology has fundamentally transformed the landscape of modern education, creating both unprecedented opportunities and significant challenges. In the past two decades, the integration of digital tools into classrooms has shifted from a novelty to a necessity, reshaping how students learn, how teachers instruct, and how educational institutions operate.\n\nOne of the most significant impacts of technology on education is the democratization of access to information. The internet has made vast libraries of knowledge available to anyone with a connection, breaking down geographical and socioeconomic barriers that once limited educational opportunities. Students in rural areas can now access the same resources as those in major cities, and online courses from prestigious universities are available to learners worldwide.\n\nHowever, this technological revolution is not without its drawbacks. The digital divide remains a persistent issue, with many students lacking access to reliable internet or modern devices. Furthermore, the constant presence of technology can be a source of distraction, potentially undermining the deep focus required for meaningful learning. Studies have shown that excessive screen time can affect attention spans and cognitive development, particularly in younger students.\n\nDespite these challenges, the potential of technology to enhance education is immense. Adaptive learning platforms can personalize instruction to meet individual student needs, artificial intelligence can provide immediate feedback on assignments, and virtual reality can create immersive learning experiences that were previously impossible. The key lies in thoughtful implementation that leverages these tools while mitigating their risks.', prompt: 'Discuss the impact of technology on modern education', subject: 'English' })} className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100">Sample Essay</button>
        </div>
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
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-sm text-gray-500 self-center">Try sample:</span>
          <button onClick={() => setProblem('Solve for x: 3x² - 12x + 9 = 0')} className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100">Algebra</button>
          <button onClick={() => setProblem('Find the derivative of f(x) = x³ + 3x² - 5x + 2 and determine the critical points')} className="px-3 py-1 text-xs bg-purple-50 text-purple-600 rounded-full hover:bg-purple-100">Calculus</button>
          <button onClick={() => setProblem('A triangle has sides of length 5, 12, and 13. Find the area and determine if it is a right triangle.')} className="px-3 py-1 text-xs bg-green-50 text-green-600 rounded-full hover:bg-green-100">Geometry</button>
        </div>
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
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-sm text-gray-500 self-center">Try sample:</span>
            <button onClick={() => setText('The impact of social media on modern society has been profound and far-reaching. It has changed how we communicate, how we get our news, and even how we think about ourselves. While social media has brung many benefits, such as connecting people across the globe and giving voice to marginalized communities, it also has significant drawbacks. Many studies has shown that excessive social media use can lead to increased anxiety, depression, and feelings of loneliness. Furthermore, the spread of misinformation on these platforms poses a serious threat to democratic institutions.')} className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100">Essay Intro</button>
            <button onClick={() => setText('This paper examines the relationship between sleep patterns and academic performance among college students. Previous research have demonstrated that inadequate sleep negatively affects cognitive function, however the specific mechanisms through which sleep deprivation impacts learning outcomes remains poorly understood. Our methodology involved surverying 500 undergraduate students across three universities, collecting data on there sleep habits, GPA, and self-reported cognitive functioning over a period of one academic semester.')} className="px-3 py-1 text-xs bg-purple-50 text-purple-600 rounded-full hover:bg-purple-100">Research Paper</button>
            <button onClick={() => setText('The old lighthouse stood at the edge of the cliff, its paint peeling like sunburnt skin. Every evening, the keeper would climb the spiral staircase, his bones creaking in harmony with the ancient steps. He had tended the light for forty years, watching ships pass like ghosts through the fog. Tonight was different though. The sea was angry, waves crashing against the rocks with a furosity he hadnt seen in decades. And somewhere out there, beyond the curtain of rain, a ship was calling for help.')} className="px-3 py-1 text-xs bg-green-50 text-green-600 rounded-full hover:bg-green-100">Creative Writing</button>
          </div>
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

// AI Response Display Component
const AIResponseDisplay = ({ content, title }) => {
  if (!content) return null;

  // Parse sections from AI response
  const sections = content.split(/\n\n+/).filter(s => s.trim());

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 overflow-hidden">
      {title && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 flex items-center gap-2">
          <Sparkles className="text-white" size={18} />
          <h3 className="font-semibold text-white">{title}</h3>
        </div>
      )}
      <div className="p-4 space-y-4">
        {sections.map((section, idx) => {
          const isHeader = section.match(/^#+\s/) || section.match(/^\d+\.\s/) || section.match(/^[A-Z][A-Za-z\s]+:$/);
          const isList = section.includes('\n-') || section.includes('\n•');

          if (isList) {
            const lines = section.split('\n');
            return (
              <div key={idx}>
                {lines[0] && !lines[0].startsWith('-') && !lines[0].startsWith('•') && (
                  <p className="font-medium text-gray-800 mb-2">{lines[0]}</p>
                )}
                <ul className="space-y-1">
                  {lines.filter(l => l.startsWith('-') || l.startsWith('•')).map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-gray-700">
                      <span className="text-blue-500 mt-1">•</span>
                      <span>{item.replace(/^[-•]\s*/, '')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          }

          return (
            <p key={idx} className={`text-gray-700 ${isHeader ? 'font-semibold text-gray-800' : ''}`}>
              {section.replace(/^#+\s*/, '')}
            </p>
          );
        })}
      </div>
    </div>
  );
};

// Editable Row Component
const EditableRow = ({ item, fields, onEdit, onDelete, onClick }) => {
  const [showActions, setShowActions] = useState(false);

  return (
    <Card
      className="p-4 relative"
      onClick={() => onClick && onClick(item)}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          {fields.map((field, idx) => (
            <div key={field.key} className={idx === 0 ? 'font-semibold' : 'text-sm text-gray-500'}>
              {item[field.key]}
            </div>
          ))}
        </div>
        {showActions && (
          <div className="flex items-center gap-2 ml-4" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => onEdit(item)}
              className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
            >
              <PenTool size={16} />
            </button>
            <button
              onClick={() => onDelete(item)}
              className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <ChevronRight size={20} className="text-gray-400 ml-2" />
      </div>
    </Card>
  );
};

// ==================== AI LEARNING STYLE DETECTOR ====================
const LearningStyleDetector = () => {
  const [tab, setTab] = useState('ai'); // 'ai' | 'quiz' | 'history'
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [quizStarted, setQuizStarted] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState(null);
  const [aiDescription, setAiDescription] = useState('');

  const styleColors = {
    visual: 'from-purple-500 to-pink-500',
    auditory: 'from-blue-500 to-cyan-500',
    reading_writing: 'from-green-500 to-emerald-500',
    kinesthetic: 'from-orange-500 to-red-500'
  };

  const styleLabels = {
    visual: 'Visual Learner',
    auditory: 'Auditory Learner',
    reading_writing: 'Reading/Writing Learner',
    kinesthetic: 'Kinesthetic Learner'
  };

  const styleIcons = {
    visual: Eye,
    auditory: MessageCircle,
    reading_writing: BookOpen,
    kinesthetic: Zap
  };

  const styleDescriptions = {
    visual: 'You learn best through images, diagrams, charts, and spatial understanding.',
    auditory: 'You learn best through listening, discussions, and verbal explanations.',
    reading_writing: 'You learn best through reading, writing notes, and text-based materials.',
    kinesthetic: 'You learn best through hands-on experience, practice, and physical activity.'
  };

  useEffect(() => {
    apiFetch('/learning-style/questions').then(data => {
      setQuestions(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch(() => {
      setError('Failed to load questions');
      setLoading(false);
    });
  }, []);

  const loadHistory = async () => {
    setHistoryLoading(true);
    const data = await apiFetch('/learning-style/history');
    setHistory(Array.isArray(data) ? data : []);
    setHistoryLoading(false);
  };

  const handleTabChange = (newTab) => {
    setTab(newTab);
    if (newTab === 'history') loadHistory();
  };

  const handleAiAssess = async () => {
    if (!aiDescription.trim()) return;
    setAnalyzing(true);
    setError(null);
    const response = await apiFetch('/learning-style/ai-assess', {
      method: 'POST',
      body: JSON.stringify({ description: aiDescription })
    });
    if (response && response.scores) {
      setResult(response);
    } else {
      setError(response?.error || 'AI assessment failed. Please try again with more detail.');
    }
    setAnalyzing(false);
  };

  const handleAnswer = async (optionIndex) => {
    const newAnswers = [...answers, { questionId: questions[currentQuestion].id, selectedOption: optionIndex }];
    setAnswers(newAnswers);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      setAnalyzing(true);
      setError(null);
      const response = await apiFetch('/learning-style/analyze', {
        method: 'POST',
        body: JSON.stringify({ answers: newAnswers })
      });
      if (response) {
        setResult(response);
      } else {
        setError('Failed to analyze your responses. Please try again.');
      }
      setAnalyzing(false);
    }
  };

  const restartQuiz = () => {
    setCurrentQuestion(0);
    setAnswers([]);
    setResult(null);
    setQuizStarted(false);
    setError(null);
  };

  if (loading) return <LoadingSpinner />;

  // Tab navigation
  const TabBar = () => (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
      {[
        { key: 'ai', label: 'AI Assessment', icon: Zap },
        { key: 'quiz', label: 'Quiz', icon: Brain },
        { key: 'history', label: 'History', icon: Clock }
      ].map(t => (
        <button
          key={t.key}
          onClick={() => handleTabChange(t.key)}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium flex-1 justify-center transition-colors ${
            tab === t.key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <t.icon size={16} />
          {t.label}
        </button>
      ))}
    </div>
  );

  // === RESULTS VIEW ===
  if (result) {
    const maxScore = Math.max(result.scores.visual, result.scores.auditory, result.scores.reading_writing, result.scores.kinesthetic);

    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Your Learning Style Results</h1>
          <p className="text-gray-500">Based on your responses, here's your learning profile</p>
        </div>

        <div className={`bg-gradient-to-r ${styleColors[result.dominantStyle] || 'from-blue-500 to-indigo-500'} rounded-xl p-6 text-white mb-8`}>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <Brain size={32} />
            </div>
            <div>
              <p className="text-3xl font-bold">{styleLabels[result.dominantStyle] || 'Your Style'}</p>
              <p className="opacity-90">{styleDescriptions[result.dominantStyle] || 'Your dominant learning style'}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {Object.entries(result.scores).map(([style, score]) => {
            const Icon = styleIcons[style] || Brain;
            const isMax = score === maxScore;
            return (
              <Card key={style} className={`p-4 text-center ${isMax ? 'ring-2 ring-blue-500' : ''}`} hover={false}>
                <Icon size={24} className={`mx-auto mb-2 ${isMax ? 'text-blue-600' : 'text-gray-400'}`} />
                <p className={`text-2xl font-bold ${isMax ? 'text-blue-600' : 'text-gray-700'}`}>{score}</p>
                <p className="text-sm text-gray-500 capitalize">{style.replace('_', ' ')}</p>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                  <div
                    className={`h-1.5 rounded-full ${isMax ? 'bg-blue-600' : 'bg-gray-400'}`}
                    style={{ width: `${maxScore > 0 ? (score / maxScore) * 100 : 0}%` }}
                  />
                </div>
              </Card>
            );
          })}
        </div>

        <AIResponseDisplay content={result.analysis} title="Personalized Analysis" />

        {result.recommendations?.length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold mb-3">Study Recommendations</h3>
            <div className="space-y-2">
              {result.recommendations.map((rec, idx) => (
                <div key={idx} className="flex items-start gap-2 p-3 bg-green-50 rounded-lg">
                  <Check size={18} className="text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">{rec}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <Button onClick={restartQuiz}>
            <RotateCcw size={18} className="mr-2" />
            Retake Assessment
          </Button>
          <Button variant="secondary" onClick={() => handleTabChange('history')}>
            <Clock size={18} className="mr-2" />
            View History
          </Button>
        </div>
      </div>
    );
  }

  // === ANALYZING VIEW ===
  if (analyzing) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-lg font-medium">Analyzing your learning style...</p>
        <p className="text-gray-500">Our AI is creating your personalized profile</p>
      </div>
    );
  }

  // === HISTORY TAB ===
  if (tab === 'history') {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Learning Style Assessment</h1>
          <p className="text-gray-500">Discover how you learn best with the VARK framework</p>
        </div>
        <TabBar />
        {historyLoading ? <LoadingSpinner /> : history.length === 0 ? (
          <Card className="p-8 text-center" hover={false}>
            <Clock size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">No assessments yet</h3>
            <p className="text-gray-400 mb-4">Take your first learning style assessment to see results here.</p>
            <Button onClick={() => setTab('quiz')}>
              <Brain size={18} className="mr-2" />
              Take Assessment
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {history.map((item, idx) => {
              const Icon = styleIcons[item.dominant_style] || Brain;
              return (
                <Card key={item.id || idx} className="p-5" hover={false}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${styleColors[item.dominant_style] || 'from-gray-400 to-gray-500'} flex items-center justify-center`}>
                        <Icon size={20} className="text-white" />
                      </div>
                      <div>
                        <p className="font-semibold">{styleLabels[item.dominant_style] || item.dominant_style}</p>
                        <p className="text-sm text-gray-400">{new Date(item.assessed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'Visual', score: item.visual_score },
                      { label: 'Auditory', score: item.auditory_score },
                      { label: 'Read/Write', score: item.reading_writing_score },
                      { label: 'Kinesthetic', score: item.kinesthetic_score }
                    ].map(s => (
                      <div key={s.label} className="text-center p-2 bg-gray-50 rounded-lg">
                        <p className="text-lg font-bold text-gray-700">{s.score}</p>
                        <p className="text-xs text-gray-400">{s.label}</p>
                      </div>
                    ))}
                  </div>
                  {item.ai_analysis && (
                    <div className="mt-3">
                      <AIResponseDisplay content={item.ai_analysis} title="AI Analysis" />
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // === AI ASSESSMENT TAB ===
  if (tab === 'ai' && !result && !analyzing) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Learning Style Assessment</h1>
          <p className="text-gray-500">Let AI analyze your learning style instantly</p>
        </div>
        <TabBar />

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
        )}

        <Card className="p-6" hover={false}>
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Zap size={20} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg">AI-Powered Learning Style Analysis</h2>
              <p className="text-gray-500 text-sm">Describe how you study and learn, and our AI will determine your VARK learning style profile with personalized recommendations.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-sm text-gray-500 self-center">Try sample:</span>
            <button onClick={() => setAiDescription('I learn best when I can watch videos and see diagrams. I like color-coding my notes and creating mind maps. When studying, I prefer visual aids like charts and infographics over reading long text.')} className="px-3 py-1 text-xs bg-purple-50 text-purple-600 rounded-full hover:bg-purple-100">Visual Learner</button>
            <button onClick={() => setAiDescription('I prefer listening to lectures and podcasts when studying. I often read my notes out loud and enjoy group discussions. I find it easier to remember things when someone explains them verbally.')} className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100">Auditory Learner</button>
            <button onClick={() => setAiDescription('I love hands-on experiments and building things. I struggle to sit still for long lectures. I learn best by doing practice problems and physical activities. I like to take breaks and move around while studying.')} className="px-3 py-1 text-xs bg-orange-50 text-orange-600 rounded-full hover:bg-orange-100">Kinesthetic Learner</button>
          </div>

          <textarea
            className="w-full p-4 border rounded-lg mb-4 min-h-[150px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Describe how you prefer to study and learn. For example: How do you take notes? Do you prefer reading, watching, listening, or doing? What study methods work best for you? How do you prepare for exams?"
            value={aiDescription}
            onChange={e => setAiDescription(e.target.value)}
          />

          <Button onClick={handleAiAssess} disabled={!aiDescription.trim() || analyzing}>
            <Zap size={18} className="mr-2" />
            Analyze My Learning Style
          </Button>
        </Card>
      </div>
    );
  }

  // === INTRO SCREEN (before quiz starts) ===
  if (tab === 'quiz' && !quizStarted) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Learning Style Assessment</h1>
          <p className="text-gray-500">Discover how you learn best with the VARK framework</p>
        </div>
        <TabBar />

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
        )}

        {questions.length === 0 ? (
          <Card className="p-8 text-center" hover={false}>
            <Brain size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">No questions available</h3>
            <p className="text-gray-400">Learning style questions haven't been loaded yet. Please make sure the database is seeded.</p>
          </Card>
        ) : (
          <>
            <Card className="p-6 mb-6" hover={false}>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Brain size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold mb-2">What is the VARK Framework?</h2>
                  <p className="text-gray-600 mb-3">
                    The VARK model identifies four primary learning styles: <strong>Visual</strong>, <strong>Auditory</strong>, <strong>Reading/Writing</strong>, and <strong>Kinesthetic</strong>. Understanding your dominant style helps you study more effectively.
                  </p>
                  <p className="text-gray-500 text-sm">
                    You'll answer {questions.length} questions about your learning preferences. Our AI will then analyze your responses and provide personalized study strategies.
                  </p>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {Object.entries(styleLabels).map(([key, label]) => {
                const Icon = styleIcons[key];
                return (
                  <Card key={key} className="p-4 text-center" hover={false}>
                    <div className={`w-10 h-10 mx-auto mb-2 rounded-full bg-gradient-to-r ${styleColors[key]} flex items-center justify-center`}>
                      <Icon size={20} className="text-white" />
                    </div>
                    <p className="font-medium text-sm">{label.replace(' Learner', '')}</p>
                    <p className="text-xs text-gray-400 mt-1">{styleDescriptions[key].split('.')[0]}</p>
                  </Card>
                );
              })}
            </div>

            <Button onClick={() => setQuizStarted(true)} className="w-full">
              <Play size={18} className="mr-2" />
              Start Assessment ({questions.length} questions)
            </Button>
          </>
        )}
      </div>
    );
  }

  // === QUIZ VIEW ===
  const question = questions[currentQuestion];
  if (!question) {
    return (
      <Card className="p-8 text-center" hover={false}>
        <Brain size={48} className="mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-semibold text-gray-600 mb-2">Something went wrong</h3>
        <p className="text-gray-400 mb-4">Could not load the current question.</p>
        <Button onClick={restartQuiz}>
          <RotateCcw size={18} className="mr-2" />
          Start Over
        </Button>
      </Card>
    );
  }

  // options comes from JSONB column - already parsed by pg driver
  const options = Array.isArray(question.options) ? question.options : (typeof question.options === 'string' ? JSON.parse(question.options) : []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Learning Style Assessment</h1>
        <p className="text-gray-500">Discover how you learn best</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
      )}

      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-500 mb-2">
          <span>Question {currentQuestion + 1} of {questions.length}</span>
          <span>{Math.round(((currentQuestion + 1) / questions.length) * 100)}% complete</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <Card className="p-6" hover={false}>
        <h2 className="text-xl font-semibold mb-6">{question.question_text}</h2>
        <div className="space-y-3">
          {options.map((option, idx) => (
            <button
              key={idx}
              onClick={() => handleAnswer(idx)}
              className="w-full p-4 text-left border border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors flex items-center gap-3"
            >
              <span className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 font-semibold flex items-center justify-center flex-shrink-0">
                {String.fromCharCode(65 + idx)}
              </span>
              <span>{option}</span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
};

// ==================== AI QUIZ GENERATOR ====================
const QuizGenerator = () => {
  const [form, setForm] = useState({ subject: '', topic: '', difficulty: 'Intermediate', questionCount: 5 });
  const [generating, setGenerating] = useState(false);
  const [generatedQuiz, setGeneratedQuiz] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('generate');
  const navigate = useNavigate();

  const loadHistory = () => {
    apiFetch('/quiz-generator/history').then(data => {
      setHistory(Array.isArray(data) ? data : []);
    });
  };

  useEffect(() => { loadHistory(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    const result = await apiFetch('/quiz-generator/generate', {
      method: 'POST',
      body: JSON.stringify(form)
    });
    setGeneratedQuiz(result);
    setGenerating(false);
    loadHistory();
  };

  if (generatedQuiz) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Quiz Generated!</h1>
          <p className="text-gray-500">Your AI-generated quiz is ready</p>
        </div>

        <Card className="p-6 mb-6" hover={false}>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Check size={24} className="text-green-600" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">{generatedQuiz.quiz?.title}</h2>
              <p className="text-gray-500">{generatedQuiz.questions?.length || 0} questions generated</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={() => navigate(`/quizzes/${generatedQuiz.quiz?.id}`)}>
              Take Quiz Now
            </Button>
            <Button variant="secondary" onClick={() => setGeneratedQuiz(null)}>
              Generate Another
            </Button>
          </div>
        </Card>

        <h3 className="font-semibold mb-4">Preview Questions</h3>
        <div className="space-y-4">
          {generatedQuiz.questions?.map((q, idx) => (
            <Card key={idx} className="p-4" hover={false}>
              <p className="font-medium mb-2">{idx + 1}. {q.question_text}</p>
              <div className="grid grid-cols-2 gap-2">
                {q.options?.map((opt, i) => (
                  <div key={i} className={`p-2 rounded text-sm ${opt === q.correct_answer ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>
                    {opt}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">AI Quiz Generator</h1>
        <p className="text-gray-500">Create custom quizzes on any topic</p>
      </div>

      <div className="flex gap-2 mb-6">
        {[{ key: 'generate', label: 'Generate Quiz', icon: Zap }, { key: 'history', label: 'History', icon: Clock }].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'generate' ? (
        <Card className="p-6" hover={false}>
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-sm text-gray-500 self-center">Try sample:</span>
            <button onClick={() => setForm({ subject: 'Biology', topic: 'Cell Division and Mitosis', difficulty: 'Intermediate', questionCount: 5 })} className="px-3 py-1 text-xs bg-green-50 text-green-600 rounded-full hover:bg-green-100">Biology Quiz</button>
            <button onClick={() => setForm({ subject: 'History', topic: 'World War II - Major Battles', difficulty: 'Intermediate', questionCount: 5 })} className="px-3 py-1 text-xs bg-yellow-50 text-yellow-600 rounded-full hover:bg-yellow-100">History Quiz</button>
            <button onClick={() => setForm({ subject: 'Mathematics', topic: 'Fractions and Decimals', difficulty: 'Beginner', questionCount: 5 })} className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100">Math Quiz</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Subject"
              placeholder="e.g., Mathematics, Science, History"
              value={form.subject}
              onChange={e => setForm({ ...form, subject: e.target.value })}
            />
            <Input
              label="Topic"
              placeholder="e.g., Quadratic Equations, Cell Biology"
              value={form.topic}
              onChange={e => setForm({ ...form, topic: e.target.value })}
            />
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
              <select
                className="w-full px-4 py-2 border rounded-lg"
                value={form.difficulty}
                onChange={e => setForm({ ...form, difficulty: e.target.value })}
              >
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>
            </div>
            <Input
              label="Number of Questions"
              type="number"
              min="3"
              max="20"
              value={form.questionCount}
              onChange={e => setForm({ ...form, questionCount: parseInt(e.target.value) })}
            />
          </div>

          <Button
            className="mt-4"
            onClick={handleGenerate}
            disabled={generating || !form.subject || !form.topic}
          >
            {generating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Generating...
              </>
            ) : (
              <>
                <Zap size={18} className="mr-2" />
                Generate Quiz
              </>
            )}
          </Button>
        </Card>
      ) : (
        <div>
          <h3 className="font-semibold mb-4">Generated Quiz History</h3>
          {history.length === 0 ? (
            <Card className="p-6 text-center text-gray-500" hover={false}>
              No quizzes generated yet. Create your first quiz!
            </Card>
          ) : (
            <div className="space-y-4">
              {history.map(quiz => (
                <Card key={quiz.id} className="p-4" hover={false}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold">{quiz.title}</h4>
                      <p className="text-sm text-gray-500">{quiz.subject} - {quiz.topic} | {quiz.difficulty_level} | {new Date(quiz.created_at).toLocaleDateString()}</p>
                    </div>
                    <Button size="sm" onClick={() => navigate(`/quizzes/${quiz.id}`)}>Take Quiz</Button>
                  </div>
                  {quiz.questions && quiz.questions.length > 0 && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-700">View {quiz.questions.length} questions</summary>
                      <div className="mt-2 space-y-3">
                        {quiz.questions.map((q, idx) => (
                          <div key={idx} className="bg-gray-50 rounded-lg p-3">
                            <p className="font-medium text-sm mb-2">{idx + 1}. {q.question_text}</p>
                            <div className="grid grid-cols-2 gap-1">
                              {(Array.isArray(q.options) ? q.options : []).map((opt, i) => (
                                <div key={i} className={`p-1.5 rounded text-xs ${opt === q.correct_answer ? 'bg-green-100 text-green-700 font-medium' : 'bg-white text-gray-600'}`}>
                                  {opt}
                                </div>
                              ))}
                            </div>
                            {q.explanation && <p className="text-xs text-gray-500 mt-1">{q.explanation}</p>}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ==================== AI PROGRESS PREDICTOR ====================
const ProgressPredictor = () => {
  const [form, setForm] = useState({ subject: '', targetDate: '' });
  const [predicting, setPredicting] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('predict');

  const loadHistory = () => {
    apiFetch('/progress-predictor/history').then(data => {
      setHistory(Array.isArray(data) ? data : []);
    });
  };

  useEffect(() => { loadHistory(); }, []);

  const handlePredict = async () => {
    setPredicting(true);
    const result = await apiFetch('/progress-predictor/predict', {
      method: 'POST',
      body: JSON.stringify(form)
    });
    setPrediction(result);
    setPredicting(false);
    loadHistory();
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">AI Progress Predictor</h1>
        <p className="text-gray-500">See where your studies are heading</p>
      </div>

      <div className="flex gap-2 mb-6">
        {[{ key: 'predict', label: 'Predict', icon: TrendingUp }, { key: 'history', label: 'History', icon: Clock }].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'predict' ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6" hover={false}>
              <h3 className="font-semibold mb-4">Make a Prediction</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="text-sm text-gray-500 self-center">Try sample:</span>
                <button onClick={() => setForm({ subject: 'Mathematics', targetDate: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0] })} className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100">Math Progress</button>
                <button onClick={() => setForm({ subject: 'Biology', targetDate: new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0] })} className="px-3 py-1 text-xs bg-green-50 text-green-600 rounded-full hover:bg-green-100">Science Progress</button>
                <button onClick={() => setForm({ subject: 'English Literature', targetDate: new Date(Date.now() + 45 * 86400000).toISOString().split('T')[0] })} className="px-3 py-1 text-xs bg-purple-50 text-purple-600 rounded-full hover:bg-purple-100">English Progress</button>
              </div>
              <Input
                label="Subject"
                placeholder="e.g., Mathematics"
                value={form.subject}
                onChange={e => setForm({ ...form, subject: e.target.value })}
              />
              <Input
                label="Target Date"
                type="date"
                value={form.targetDate}
                onChange={e => setForm({ ...form, targetDate: e.target.value })}
              />
              <Button
                onClick={handlePredict}
                disabled={predicting || !form.subject || !form.targetDate}
              >
                {predicting ? 'Analyzing...' : 'Predict Progress'}
              </Button>
            </Card>

            {prediction && (
              <Card className="p-6" hover={false}>
                <h3 className="font-semibold mb-4">Prediction Results</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-3xl font-bold text-gray-600">{Math.round(prediction.currentScore)}%</p>
                    <p className="text-sm text-gray-500">Current Score</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-3xl font-bold text-green-600">{Math.round(prediction.predictedScore)}%</p>
                    <p className="text-sm text-gray-500">Predicted Score</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm text-gray-500">Confidence:</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${prediction.confidence}%` }} />
                  </div>
                  <span className="text-sm font-medium">{Math.round(prediction.confidence)}%</span>
                </div>
              </Card>
            )}
          </div>

          {prediction && (
            <div className="mt-6">
              <AIResponseDisplay content={prediction.insights} title="AI Insights & Recommendations" />
            </div>
          )}
        </>
      ) : (
        <div>
          <h3 className="font-semibold mb-4">Prediction History</h3>
          {history.length === 0 ? (
            <Card className="p-6 text-center text-gray-500" hover={false}>
              No predictions yet. Make your first prediction to see results here!
            </Card>
          ) : (
            <div className="space-y-3">
              {history.map((h, idx) => (
                <Card key={h.id || idx} className="p-4" hover={false}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium">{h.subject}</p>
                      <p className="text-sm text-gray-500">
                        Target: {h.target_date ? new Date(h.target_date).toLocaleDateString() : 'N/A'}
                        {h.created_at && ` | Created: ${new Date(h.created_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">{h.predicted_score != null ? Math.round(h.predicted_score) : 0}%</p>
                      <p className="text-xs text-gray-400">predicted</p>
                    </div>
                  </div>
                  {h.ai_insights && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-700">View AI Insights</summary>
                      <div className="mt-2">
                        <AIResponseDisplay content={h.ai_insights} title="AI Insights" />
                      </div>
                    </details>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ==================== AI CONCEPT EXPLAINER ====================
const ConceptExplainer = () => {
  const [form, setForm] = useState({ concept: '', subject: '', difficulty: 'intermediate' });
  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('explain');

  const loadHistory = () => {
    apiFetch('/concept-explainer/history').then(data => {
      setHistory(Array.isArray(data) ? data : []);
    });
  };

  useEffect(() => { loadHistory(); }, []);

  const handleExplain = async () => {
    setExplaining(true);
    const result = await apiFetch('/concept-explainer/explain', {
      method: 'POST',
      body: JSON.stringify(form)
    });
    setExplanation(result);
    setExplaining(false);
    loadHistory();
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">AI Concept Explainer</h1>
        <p className="text-gray-500">Get clear explanations of any concept</p>
      </div>

      <div className="flex gap-2 mb-6">
        {[{ key: 'explain', label: 'Explain', icon: Lightbulb }, { key: 'history', label: 'History', icon: Clock }].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'explain' ? (
        <>
          <Card className="p-6 mb-6" hover={false}>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-sm text-gray-500 self-center">Try sample:</span>
              <button onClick={() => setForm({ concept: 'Photosynthesis', subject: 'Biology', difficulty: 'intermediate' })} className="px-3 py-1 text-xs bg-green-50 text-green-600 rounded-full hover:bg-green-100">Photosynthesis</button>
              <button onClick={() => setForm({ concept: 'Gravity and Gravitational Force', subject: 'Physics', difficulty: 'intermediate' })} className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100">Gravity</button>
              <button onClick={() => setForm({ concept: 'Democracy and its Forms', subject: 'Political Science', difficulty: 'beginner' })} className="px-3 py-1 text-xs bg-purple-50 text-purple-600 rounded-full hover:bg-purple-100">Democracy</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Concept"
                placeholder="e.g., Photosynthesis, Quadratic Formula"
                value={form.concept}
                onChange={e => setForm({ ...form, concept: e.target.value })}
              />
              <Input
                label="Subject"
                placeholder="e.g., Biology, Math"
                value={form.subject}
                onChange={e => setForm({ ...form, subject: e.target.value })}
              />
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Explanation Level</label>
                <select
                  className="w-full px-4 py-2 border rounded-lg"
                  value={form.difficulty}
                  onChange={e => setForm({ ...form, difficulty: e.target.value })}
                >
                  <option value="beginner">Beginner (Simple)</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced (Detailed)</option>
                </select>
              </div>
            </div>
            <Button onClick={handleExplain} disabled={explaining || !form.concept || !form.subject}>
              {explaining ? 'Explaining...' : 'Explain Concept'}
            </Button>
          </Card>

          {explanation && (
            <AIResponseDisplay content={explanation.content} title={`Understanding: ${form.concept}`} />
          )}
        </>
      ) : (
        <div>
          <h3 className="font-semibold mb-4">Explanation History</h3>
          {history.length === 0 ? (
            <Card className="p-6 text-center text-gray-500" hover={false}>
              No explanations yet. Ask about a concept to see results here!
            </Card>
          ) : (
            <div className="space-y-4">
              {history.map((h, idx) => (
                <Card key={h.id || idx} className="p-4" hover={false}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Lightbulb size={20} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">{h.concept_name}</p>
                      <p className="text-sm text-gray-500">{h.subject} {h.difficulty_level && `| ${h.difficulty_level}`} {h.created_at && `| ${new Date(h.created_at).toLocaleDateString()}`}</p>
                    </div>
                  </div>
                  {h.explanation && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-700">View AI Explanation</summary>
                      <div className="mt-2">
                        <AIResponseDisplay content={h.explanation} title={h.concept_name} />
                      </div>
                    </details>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ==================== AI STUDY SCHEDULE OPTIMIZER ====================
const StudyScheduler = () => {
  const [form, setForm] = useState({
    subjects: [],
    availableHours: 3,
    goals: '',
    startDate: '',
    endDate: ''
  });
  const [subjectInput, setSubjectInput] = useState('');
  const [optimizing, setOptimizing] = useState(false);
  const [schedule, setSchedule] = useState(null);
  const [schedules, setSchedules] = useState([]);

  useEffect(() => {
    apiFetch('/study-schedule').then(data => {
      setSchedules(Array.isArray(data) ? data : []);
    });
  }, []);

  const addSubject = () => {
    if (subjectInput && !form.subjects.includes(subjectInput)) {
      setForm({ ...form, subjects: [...form.subjects, subjectInput] });
      setSubjectInput('');
    }
  };

  const removeSubject = (subject) => {
    setForm({ ...form, subjects: form.subjects.filter(s => s !== subject) });
  };

  const handleOptimize = async () => {
    setOptimizing(true);
    const result = await apiFetch('/study-schedule/optimize', {
      method: 'POST',
      body: JSON.stringify(form)
    });
    setSchedule(result);
    setOptimizing(false);
  };

  const deleteSchedule = async (id) => {
    await apiFetch(`/study-schedule/${id}`, { method: 'DELETE' });
    setSchedules(schedules.filter(s => s.id !== id));
  };

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">AI Study Schedule Optimizer</h1>
        <p className="text-gray-500">Get a personalized study plan</p>
      </div>

      <Card className="p-6 mb-6" hover={false}>
        <h3 className="font-semibold mb-4">Create Optimized Schedule</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-sm text-gray-500 self-center">Try sample:</span>
          <button onClick={() => { const d = new Date(); setForm({ subjects: ['Mathematics', 'Physics', 'Chemistry'], availableHours: 4, goals: 'Prepare for final exams in all three subjects', startDate: d.toISOString().split('T')[0], endDate: new Date(d.getTime() + 14 * 86400000).toISOString().split('T')[0] }); }} className="px-3 py-1 text-xs bg-red-50 text-red-600 rounded-full hover:bg-red-100">Exam Prep</button>
          <button onClick={() => { const d = new Date(); setForm({ subjects: ['Math', 'English', 'Science', 'History'], availableHours: 3, goals: 'Maintain consistent progress across all subjects', startDate: d.toISOString().split('T')[0], endDate: new Date(d.getTime() + 7 * 86400000).toISOString().split('T')[0] }); }} className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100">Balanced Week</button>
          <button onClick={() => { const d = new Date(); const sat = new Date(d.getTime() + ((6 - d.getDay()) % 7) * 86400000); setForm({ subjects: ['Biology', 'Chemistry'], availableHours: 6, goals: 'Deep dive weekend study session for science subjects', startDate: sat.toISOString().split('T')[0], endDate: new Date(sat.getTime() + 1 * 86400000).toISOString().split('T')[0] }); }} className="px-3 py-1 text-xs bg-green-50 text-green-600 rounded-full hover:bg-green-100">Weekend Focus</button>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Subjects</label>
          <div className="flex gap-2 mb-2">
            <input
              className="flex-1 px-4 py-2 border rounded-lg"
              placeholder="Add a subject"
              value={subjectInput}
              onChange={e => setSubjectInput(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && addSubject()}
            />
            <Button onClick={addSubject}>Add</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {form.subjects.map(subject => (
              <span key={subject} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-1">
                {subject}
                <button onClick={() => removeSubject(subject)}><X size={14} /></button>
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Available Hours/Day"
            type="number"
            min="1"
            max="8"
            value={form.availableHours}
            onChange={e => setForm({ ...form, availableHours: parseInt(e.target.value) })}
          />
          <Input
            label="Start Date"
            type="date"
            value={form.startDate}
            onChange={e => setForm({ ...form, startDate: e.target.value })}
          />
          <Input
            label="End Date"
            type="date"
            value={form.endDate}
            onChange={e => setForm({ ...form, endDate: e.target.value })}
          />
        </div>

        <TextArea
          label="Study Goals (Optional)"
          placeholder="e.g., Prepare for final exams, improve math grades"
          value={form.goals}
          onChange={e => setForm({ ...form, goals: e.target.value })}
          rows={2}
        />

        <Button onClick={handleOptimize} disabled={optimizing || form.subjects.length === 0}>
          {optimizing ? 'Optimizing...' : 'Generate Schedule'}
        </Button>
      </Card>

      {schedule && (
        <div className="mb-8">
          <h3 className="font-semibold mb-4">Your Optimized Schedule</h3>
          <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
            {days.map(day => (
              <Card key={day} className="p-3" hover={false}>
                <p className="font-medium capitalize text-sm mb-2">{day}</p>
                <div className="space-y-1">
                  {schedule.scheduleData?.[day]?.map((slot, idx) => (
                    <div key={idx} className="p-2 bg-blue-50 rounded text-xs">
                      <p className="font-medium">{slot.subject}</p>
                      <p className="text-gray-500">{slot.time}</p>
                    </div>
                  )) || <p className="text-xs text-gray-400">Rest day</p>}
                </div>
              </Card>
            ))}
          </div>

          {schedule.recommendations && (
            <div className="mt-4">
              <AIResponseDisplay content={schedule.recommendations} title="Scheduling Tips" />
            </div>
          )}
        </div>
      )}

      {schedules.length > 0 && (
        <div>
          <h3 className="font-semibold mb-4">Saved Schedules</h3>
          <div className="space-y-3">
            {schedules.map(s => (
              <Card key={s.id} className="p-4" hover={false}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{s.title}</p>
                    <p className="text-sm text-gray-500">{s.start_date} to {s.end_date}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.ai_optimized && <Badge color="green">AI Optimized</Badge>}
                    <button onClick={() => deleteSchedule(s.id)} className="p-2 text-red-500 hover:bg-red-50 rounded">
                      <X size={18} />
                    </button>
                  </div>
                </div>
                {s.optimization_notes && (
                  <details className="mt-3">
                    <summary className="text-blue-600 cursor-pointer text-sm font-medium">View AI Recommendations</summary>
                    <div className="mt-2">
                      <AIResponseDisplay content={s.optimization_notes} title="AI Schedule Tips" />
                    </div>
                  </details>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== AI HOMEWORK HELPER ====================
const HomeworkHelper = () => {
  const [tab, setTab] = useState('ask'); // 'ask' | 'assignments' | 'history'
  const [homework, setHomework] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [selectedHomework, setSelectedHomework] = useState(null);
  const [helpQuestion, setHelpQuestion] = useState('');
  const [helpResponse, setHelpResponse] = useState(null);
  const [helping, setHelping] = useState(false);
  const [newHomework, setNewHomework] = useState({ title: '', subject: '', description: '', dueDate: '' });
  const navigate = useNavigate();
  // Quick help state
  const [quickSubject, setQuickSubject] = useState('');
  const [quickQuestion, setQuickQuestion] = useState('');
  const [quickResponse, setQuickResponse] = useState(null);
  const [quickHelping, setQuickHelping] = useState(false);
  const [helpHistory, setHelpHistory] = useState([]);

  useEffect(() => {
    loadHomework();
  }, []);

  const loadHomework = () => {
    apiFetch('/homework').then(data => {
      setHomework(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  };

  const loadHistory = () => {
    apiFetch('/homework/help-history').then(data => {
      setHelpHistory(Array.isArray(data) ? data : []);
    });
  };

  const handleQuickHelp = async () => {
    setQuickHelping(true);
    setQuickResponse(null);
    const result = await apiFetch('/homework/quick-help', {
      method: 'POST',
      body: JSON.stringify({ subject: quickSubject, question: quickQuestion })
    });
    setQuickResponse(result);
    setQuickHelping(false);
  };

  const handleCreate = async () => {
    const result = await apiFetch('/homework', {
      method: 'POST',
      body: JSON.stringify(newHomework)
    });
    if (result) {
      setHomework([result, ...homework]);
      setShowModal(false);
      setNewHomework({ title: '', subject: '', description: '', dueDate: '' });
    }
  };

  const handleDelete = async (item) => {
    await apiFetch(`/homework/${item.id}`, { method: 'DELETE' });
    setHomework(homework.filter(h => h.id !== item.id));
  };

  const handleGetHelp = async () => {
    setHelping(true);
    const result = await apiFetch(`/homework/${selectedHomework.id}/help`, {
      method: 'POST',
      body: JSON.stringify({ question: helpQuestion })
    });
    setHelpResponse(result);
    setHelping(false);
  };

  const openHelpModal = (hw) => {
    setSelectedHomework(hw);
    setHelpQuestion('');
    setHelpResponse(null);
    setShowHelpModal(true);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">AI Homework Helper</h1>
        <p className="text-gray-500">Get AI-powered guidance on any homework question</p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
        {[
          { key: 'ask', label: 'Ask AI', icon: Sparkles },
          { key: 'assignments', label: 'My Assignments', icon: FileText },
          { key: 'history', label: 'History', icon: Clock }
        ].map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); if (t.key === 'history') loadHistory(); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium flex-1 justify-center transition-colors ${
              tab === t.key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ask' && (
        <div>
          <Card className="p-6 mb-6" hover={false}>
            <h3 className="font-semibold mb-4">Ask Any Homework Question</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-sm text-gray-500 self-center">Try sample:</span>
              <button onClick={() => { setQuickSubject('Mathematics'); setQuickQuestion('How do I solve the quadratic equation 2x² + 5x - 3 = 0? I know the quadratic formula but I keep getting the wrong answer.'); }} className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100">Math Help</button>
              <button onClick={() => { setQuickSubject('Biology'); setQuickQuestion('Can you explain the difference between mitosis and meiosis? I need to understand when each type of cell division occurs.'); }} className="px-3 py-1 text-xs bg-green-50 text-green-600 rounded-full hover:bg-green-100">Biology Help</button>
              <button onClick={() => { setQuickSubject('English'); setQuickQuestion('I need to write a thesis statement for an essay about symbolism in The Great Gatsby. How should I approach this?'); }} className="px-3 py-1 text-xs bg-purple-50 text-purple-600 rounded-full hover:bg-purple-100">English Help</button>
            </div>
            <Input
              label="Subject"
              placeholder="e.g., Mathematics, Biology, English"
              value={quickSubject}
              onChange={e => setQuickSubject(e.target.value)}
            />
            <TextArea
              label="Your Question"
              placeholder="Type your homework question here... Be specific about what you're stuck on."
              value={quickQuestion}
              onChange={e => setQuickQuestion(e.target.value)}
              rows={4}
            />
            <Button onClick={handleQuickHelp} disabled={quickHelping || !quickQuestion}>
              {quickHelping ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Getting AI Help...
                </>
              ) : (
                <>
                  <Sparkles size={18} className="mr-2" />
                  Get AI Help
                </>
              )}
            </Button>
          </Card>

          {quickResponse && (
            <div className="space-y-4">
              <AIResponseDisplay content={quickResponse.help} title="AI Tutor Response" />
              {quickResponse.hints?.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Hints to Guide You</h4>
                  <div className="space-y-2">
                    {quickResponse.hints.map((hint, idx) => (
                      <div key={idx} className="p-3 bg-yellow-50 rounded-lg text-sm flex items-start gap-2">
                        <Lightbulb size={16} className="text-yellow-600 mt-0.5 flex-shrink-0" />
                        <span>{hint}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'assignments' && (
        <div>
          <div className="flex justify-end mb-4">
            <Button onClick={() => setShowModal(true)}>
              <Plus size={18} className="mr-2" />
              Add Assignment
            </Button>
          </div>

      <div className="space-y-3">
        {homework.map(hw => (
          <Card key={hw.id} className="p-4" hover={false}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold cursor-pointer hover:text-blue-600" onClick={() => navigate(`/homework/${hw.id}`)}>{hw.title}</h3>
                  <Badge>{hw.subject}</Badge>
                  <Badge color={hw.status === 'completed' ? 'green' : hw.status === 'in_progress' ? 'yellow' : 'gray'}>
                    {hw.status}
                  </Badge>
                </div>
                <p className="text-sm text-gray-500">{hw.description}</p>
                <p className="text-xs text-gray-400 mt-1">Due: {hw.due_date}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => openHelpModal(hw)}>
                  <Sparkles size={16} className="mr-1" />
                  Get Help
                </Button>
                <button onClick={() => handleDelete(hw)} className="p-2 text-red-500 hover:bg-red-50 rounded">
                  <X size={18} />
                </button>
              </div>
            </div>
            {hw.ai_help_content && (
              <details className="mt-3">
                <summary className="text-blue-600 cursor-pointer text-sm font-medium">View Previous AI Help</summary>
                <div className="mt-2">
                  <AIResponseDisplay content={hw.ai_help_content} title="AI Help" />
                  {hw.ai_hints && (() => {
                    let hints = [];
                    try { hints = typeof hw.ai_hints === 'string' ? JSON.parse(hw.ai_hints) : (Array.isArray(hw.ai_hints) ? hw.ai_hints : []); } catch(e) {}
                    return hints.length > 0 ? (
                      <div className="mt-2 space-y-1">
                        {hints.map((hint, i) => (
                          <div key={i} className="p-2 bg-yellow-50 rounded-lg text-sm">
                            <Lightbulb size={14} className="inline mr-1 text-yellow-600" />{hint}
                          </div>
                        ))}
                      </div>
                    ) : null;
                  })()}
                </div>
              </details>
            )}
          </Card>
        ))}
        {homework.length === 0 && (
          <p className="text-center text-gray-500 py-8">No homework assignments yet</p>
        )}
      </div>

      </div>
      )}

      {tab === 'history' && (
        <div>
          <h3 className="font-semibold mb-4">AI Help History</h3>
          {helpHistory.length === 0 ? (
            <Card className="p-6 text-center text-gray-500" hover={false}>
              No AI help history yet. Ask a homework question to see results here!
            </Card>
          ) : (
            <div className="space-y-4">
              {helpHistory.map((h, idx) => (
                <Card key={h.id || idx} className="p-4" hover={false}>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge>{h.subject || 'General'}</Badge>
                    <span className="text-sm text-gray-400">{h.created_at && new Date(h.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="font-medium text-sm mb-2">{h.description || h.title}</p>
                  {h.ai_help_content && (
                    <details>
                      <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-700">View AI Response</summary>
                      <div className="mt-2">
                        <AIResponseDisplay content={h.ai_help_content} title="AI Help" />
                      </div>
                    </details>
                  )}
                  {h.ai_hints && (() => {
                    let hints = [];
                    try { hints = typeof h.ai_hints === 'string' ? JSON.parse(h.ai_hints) : (Array.isArray(h.ai_hints) ? h.ai_hints : []); } catch(e) {}
                    return hints.length > 0 ? (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm text-yellow-600 hover:text-yellow-700">View Hints ({hints.length})</summary>
                        <div className="mt-2 space-y-1">
                          {hints.map((hint, i) => (
                            <div key={i} className="p-2 bg-yellow-50 rounded-lg text-sm">
                              <Lightbulb size={14} className="inline mr-1 text-yellow-600" />{hint}
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null;
                  })()}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Homework Assignment">
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-sm text-gray-500 self-center">Try sample:</span>
          <button onClick={() => setNewHomework({ title: 'Algebra Problem Set #5', subject: 'Mathematics', description: 'Solve problems 1-20 on pages 142-145. Topics: quadratic equations, factoring, and completing the square.', dueDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0] })} className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100">Math HW</button>
          <button onClick={() => setNewHomework({ title: 'Chemistry Lab Report: Titration', subject: 'Chemistry', description: 'Write a formal lab report for the acid-base titration experiment. Include hypothesis, procedure, data tables, calculations, and conclusion.', dueDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0] })} className="px-3 py-1 text-xs bg-green-50 text-green-600 rounded-full hover:bg-green-100">Lab Report</button>
          <button onClick={() => setNewHomework({ title: 'English Essay: Theme Analysis', subject: 'English', description: 'Write a 5-paragraph essay analyzing the theme of isolation in "The Great Gatsby". Use at least 3 quotes from the text as evidence.', dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0] })} className="px-3 py-1 text-xs bg-purple-50 text-purple-600 rounded-full hover:bg-purple-100">Essay Draft</button>
        </div>
        <Input label="Title" value={newHomework.title} onChange={e => setNewHomework({ ...newHomework, title: e.target.value })} />
        <Input label="Subject" value={newHomework.subject} onChange={e => setNewHomework({ ...newHomework, subject: e.target.value })} />
        <TextArea label="Description" rows={3} value={newHomework.description} onChange={e => setNewHomework({ ...newHomework, description: e.target.value })} />
        <Input label="Due Date" type="date" value={newHomework.dueDate} onChange={e => setNewHomework({ ...newHomework, dueDate: e.target.value })} />
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={handleCreate}>Add</Button>
        </div>
      </Modal>

      <Modal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} title="AI Homework Help">
        {selectedHomework && (
          <div>
            <div className="bg-gray-50 p-3 rounded-lg mb-4">
              <p className="font-medium">{selectedHomework.title}</p>
              <p className="text-sm text-gray-500">{selectedHomework.description}</p>
            </div>

            <TextArea
              label="What do you need help with?"
              placeholder="Ask a specific question about this assignment..."
              value={helpQuestion}
              onChange={e => setHelpQuestion(e.target.value)}
              rows={3}
            />

            <Button onClick={handleGetHelp} disabled={helping || !helpQuestion} className="mb-4">
              {helping ? 'Getting help...' : 'Get AI Help'}
            </Button>

            {helpResponse && (
              <AIResponseDisplay content={helpResponse.help} title="AI Tutor Response" />
            )}

            {helpResponse?.hints?.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Hints</h4>
                <div className="space-y-2">
                  {helpResponse.hints.map((hint, idx) => (
                    <div key={idx} className="p-3 bg-yellow-50 rounded-lg text-sm">
                      <Lightbulb size={16} className="inline mr-2 text-yellow-600" />
                      {hint}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

// ==================== AI MATH TUTOR ====================
const MathTutor = () => {
  const [problem, setProblem] = useState('');
  const [topic, setTopic] = useState('');
  const [solving, setSolving] = useState(false);
  const [solution, setSolution] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [practiceMode, setPracticeMode] = useState(false);
  const [practiceProblems, setPracticeProblems] = useState([]);
  const [generatingPractice, setGeneratingPractice] = useState(false);
  const [activeTab, setActiveTab] = useState('solve');

  const loadSessions = () => {
    apiFetch('/math-tutor/sessions').then(data => {
      setSessions(Array.isArray(data) ? data : []);
    });
  };

  useEffect(() => { loadSessions(); }, []);

  const handleSolve = async () => {
    setSolving(true);
    const result = await apiFetch('/math-tutor/solve', {
      method: 'POST',
      body: JSON.stringify({ problem, topic })
    });
    setSolution(result);
    setSolving(false);
    loadSessions();
  };

  const generatePractice = async () => {
    setGeneratingPractice(true);
    const result = await apiFetch('/math-tutor/practice', {
      method: 'POST',
      body: JSON.stringify({ topic: topic || 'Algebra', difficulty: 'Intermediate', count: 5 })
    });
    setPracticeProblems(result?.problems || []);
    setGeneratingPractice(false);
    setPracticeMode(true);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">AI Math Tutor</h1>
        <p className="text-gray-500">Step-by-step help with any math problem</p>
      </div>

      <div className="flex gap-2 mb-6">
        {[{ key: 'solve', label: 'Solve', icon: Calculator }, { key: 'history', label: 'History', icon: Clock }].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'solve' ? (
        <>
          <Card className="p-6" hover={false}>
            <h3 className="font-semibold mb-4">Enter Your Problem</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-sm text-gray-500 self-center">Try sample:</span>
              <button onClick={() => { setTopic('Algebra'); setProblem('Solve the quadratic equation: 2x² + 5x - 3 = 0. Show all steps using the quadratic formula and verify by factoring.'); }} className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100">Quadratic Eq.</button>
              <button onClick={() => { setTopic('Calculus'); setProblem('Find the integral of (3x² + 2x)·sin(x) dx using integration by parts.'); }} className="px-3 py-1 text-xs bg-purple-50 text-purple-600 rounded-full hover:bg-purple-100">Integration</button>
              <button onClick={() => { setTopic('Trigonometry'); setProblem('Prove that sin²(θ) + cos²(θ) = 1 using the unit circle, and then use this identity to simplify: (1 - sin²(θ))/(1 + cos(θ))'); }} className="px-3 py-1 text-xs bg-green-50 text-green-600 rounded-full hover:bg-green-100">Trigonometry</button>
            </div>
            <Input
              label="Topic (Optional)"
              placeholder="e.g., Algebra, Calculus, Geometry"
              value={topic}
              onChange={e => setTopic(e.target.value)}
            />
            <TextArea
              label="Math Problem"
              placeholder="Type or paste your math problem here..."
              value={problem}
              onChange={e => setProblem(e.target.value)}
              rows={4}
            />
            <div className="flex gap-3">
              <Button onClick={handleSolve} disabled={solving || !problem}>
                {solving ? 'Solving...' : 'Solve Step by Step'}
              </Button>
              <Button variant="secondary" onClick={generatePractice} disabled={generatingPractice}>
                {generatingPractice ? 'Generating...' : 'Practice Problems'}
              </Button>
            </div>
          </Card>

          {solution && (
            <div className="mt-6">
              <AIResponseDisplay content={solution.solution} title="Step-by-Step Solution" />
            </div>
          )}

          {practiceMode && practiceProblems.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Practice Problems</h3>
                <Button variant="ghost" onClick={() => setPracticeMode(false)}>Close</Button>
              </div>
              <div className="space-y-4">
                {practiceProblems.map((p, idx) => (
                  <Card key={idx} className="p-4" hover={false}>
                    <p className="font-medium mb-2">{idx + 1}. {p.problem}</p>
                    <details className="text-sm">
                      <summary className="text-blue-600 cursor-pointer">Show Hint</summary>
                      <p className="mt-2 text-gray-600">{p.hint}</p>
                    </details>
                    <details className="text-sm mt-2">
                      <summary className="text-green-600 cursor-pointer">Show Answer</summary>
                      <p className="mt-2 text-gray-800 font-medium">{p.answer}</p>
                    </details>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div>
          <h3 className="font-semibold mb-4">Tutoring Session History</h3>
          {sessions.length === 0 ? (
            <Card className="p-6 text-center text-gray-500" hover={false}>
              No tutoring sessions yet. Solve a math problem to see results here!
            </Card>
          ) : (
            <div className="space-y-4">
              {sessions.map((s, idx) => (
                <Card key={s.id || idx} className="p-4" hover={false}>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge>{s.topic || 'General'}</Badge>
                    <span className="text-sm text-gray-400">{s.created_at && new Date(s.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="font-medium text-sm mb-2">{s.problem}</p>
                  {s.step_by_step_solution && (
                    <details>
                      <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-700">View AI Solution</summary>
                      <div className="mt-2">
                        <AIResponseDisplay content={s.step_by_step_solution} title="Solution" />
                      </div>
                    </details>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ==================== AI HISTORY EXPLORER ====================
const HistoryExplorer = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [query, setQuery] = useState('');
  const [exploring, setExploring] = useState(false);
  const [exploration, setExploration] = useState(null);
  const [pastExplorations, setPastExplorations] = useState([]);

  useEffect(() => {
    apiFetch('/history-explorer/events').then(data => {
      setEvents(Array.isArray(data) ? data : []);
      setLoading(false);
    });
    apiFetch('/history-explorer/history').then(data => {
      setPastExplorations(Array.isArray(data) ? data : []);
    });
  }, []);

  const handleExplore = async () => {
    setExploring(true);
    const result = await apiFetch('/history-explorer/explore', {
      method: 'POST',
      body: JSON.stringify({ eventId: selectedEvent?.id, query })
    });
    setExploration(result);
    setExploring(false);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">AI History Explorer</h1>
        <p className="text-gray-500">Discover and explore historical events</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card className="p-4" hover={false}>
            <h3 className="font-semibold mb-4">Historical Events</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {events.map(event => (
                <button
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  className={`w-full p-3 text-left rounded-lg transition-colors ${
                    selectedEvent?.id === event.id ? 'bg-blue-100 border-blue-500' : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <p className="font-medium text-sm">{event.title}</p>
                  <p className="text-xs text-gray-500">{event.era} - {event.region}</p>
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {selectedEvent && (
            <Card className="p-6 mb-4" hover={false}>
              <h2 className="text-xl font-bold mb-2">{selectedEvent.title}</h2>
              <div className="flex gap-2 mb-3">
                <Badge>{selectedEvent.era}</Badge>
                <Badge color="green">{selectedEvent.region}</Badge>
                <Badge color="gray">{selectedEvent.event_date}</Badge>
              </div>
              <p className="text-gray-700 mb-4">{selectedEvent.description}</p>

              {selectedEvent.key_figures && (
                <div className="mb-3">
                  <p className="text-sm font-medium text-gray-600">Key Figures:</p>
                  <p className="text-sm">{(Array.isArray(selectedEvent.key_figures) ? selectedEvent.key_figures : []).join(', ')}</p>
                </div>
              )}
            </Card>
          )}

          <Card className="p-6" hover={false}>
            <h3 className="font-semibold mb-4">Ask About History</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-sm text-gray-500 self-center">Try sample:</span>
              <button onClick={() => setQuery('What were the main causes and contributing factors that led to this event?')} className="px-3 py-1 text-xs bg-yellow-50 text-yellow-600 rounded-full hover:bg-yellow-100">Causes</button>
              <button onClick={() => setQuery('What was the long-term impact and lasting legacy of this event on society and culture?')} className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100">Impact</button>
              <button onClick={() => setQuery('How does this event connect to other major historical events of the same era?')} className="px-3 py-1 text-xs bg-green-50 text-green-600 rounded-full hover:bg-green-100">Connections</button>
            </div>
            <TextArea
              placeholder={selectedEvent
                ? `Ask about ${selectedEvent.title}...`
                : "Ask any history question..."}
              value={query}
              onChange={e => setQuery(e.target.value)}
              rows={3}
            />
            <Button onClick={handleExplore} disabled={exploring || !query}>
              {exploring ? 'Exploring...' : 'Explore'}
            </Button>
          </Card>

          {exploration && (
            <div className="mt-4">
              <AIResponseDisplay content={exploration.response} title="Historical Insights" />

              {exploration.followUpQuestions?.length > 0 && (
                <div className="mt-4">
                  <p className="font-medium mb-2">Continue Exploring:</p>
                  <div className="flex flex-wrap gap-2">
                    {exploration.followUpQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => setQuery(q)}
                        className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm hover:bg-blue-100"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {pastExplorations.length > 0 && (
        <div className="mt-8">
          <h3 className="font-semibold mb-4">Your Exploration History</h3>
          <div className="space-y-4">
            {pastExplorations.slice(0, 10).map((pe, idx) => (
              <Card key={pe.id || idx} className="p-4" hover={false}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                    <BookOpen size={16} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{pe.event_title || 'General History'}</p>
                    <p className="text-xs text-gray-400">{pe.query} {pe.created_at && `| ${new Date(pe.created_at).toLocaleDateString()}`}</p>
                  </div>
                </div>
                {pe.ai_response && (
                  <details>
                    <summary className="text-blue-600 cursor-pointer text-sm font-medium">View AI Response</summary>
                    <div className="mt-2">
                      <AIResponseDisplay content={pe.ai_response} title="Historical Insights" />
                    </div>
                  </details>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== AI SCIENCE LAB SIMULATOR ====================
const ScienceLab = () => {
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedExperiment, setSelectedExperiment] = useState(null);
  const [userInputs, setUserInputs] = useState({});
  const [simulating, setSimulating] = useState(false);
  const [simulation, setSimulation] = useState(null);
  const [pastSimulations, setPastSimulations] = useState([]);

  useEffect(() => {
    apiFetch('/science-lab/experiments').then(data => {
      setExperiments(Array.isArray(data) ? data : []);
      setLoading(false);
    });
    apiFetch('/science-lab/simulations').then(data => {
      setPastSimulations(Array.isArray(data) ? data : []);
    });
  }, []);

  const handleSimulate = async () => {
    setSimulating(true);
    const result = await apiFetch('/science-lab/simulate', {
      method: 'POST',
      body: JSON.stringify({ experimentId: selectedExperiment.id, userInputs })
    });
    setSimulation(result);
    setSimulating(false);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">AI Science Lab Simulator</h1>
        <p className="text-gray-500">Virtual experiments with AI-powered results</p>
      </div>

      {!selectedExperiment ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {experiments.map(exp => (
              <Card key={exp.id} className="p-4" onClick={() => setSelectedExperiment(exp)}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Lightbulb size={20} className="text-green-600" />
                  </div>
                  <Badge>{exp.subject}</Badge>
                </div>
                <h3 className="font-semibold mb-1">{exp.title}</h3>
                <p className="text-sm text-gray-500 line-clamp-2">{exp.description}</p>
                <div className="flex items-center gap-2 mt-3">
                  <Badge color={exp.difficulty_level === 'Beginner' ? 'green' : exp.difficulty_level === 'Advanced' ? 'red' : 'yellow'}>
                    {exp.difficulty_level}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
          {pastSimulations.length > 0 && (
            <div className="mt-8">
              <h3 className="font-semibold mb-4">Your Past Simulations</h3>
              <div className="space-y-4">
                {pastSimulations.slice(0, 10).map((sim, idx) => (
                  <Card key={sim.id || idx} className="p-4" hover={false}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
                        <Lightbulb size={16} className="text-teal-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{sim.experiment_title || 'Experiment'}</p>
                        <p className="text-xs text-gray-400">{sim.subject} {sim.created_at && `| ${new Date(sim.created_at).toLocaleDateString()}`}</p>
                      </div>
                    </div>
                    {sim.ai_results && (
                      <details>
                        <summary className="text-blue-600 cursor-pointer text-sm font-medium">View AI Results</summary>
                        <div className="mt-2">
                          <AIResponseDisplay content={sim.ai_results} title="Simulation Results" />
                        </div>
                      </details>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div>
          <button
            onClick={() => { setSelectedExperiment(null); setSimulation(null); }}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft size={20} />
            Back to Experiments
          </button>

          <Card className="p-6 mb-6" hover={false}>
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center">
                <Lightbulb size={28} className="text-green-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold mb-2">{selectedExperiment.title}</h2>
                <p className="text-gray-600 mb-4">{selectedExperiment.description}</p>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Materials:</p>
                    <ul className="text-sm list-disc list-inside">
                      {(Array.isArray(selectedExperiment.materials) ? selectedExperiment.materials : []).map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Procedure:</p>
                    <ol className="text-sm list-decimal list-inside">
                      {(Array.isArray(selectedExperiment.procedure) ? selectedExperiment.procedure : []).slice(0, 4).map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ol>
                  </div>
                </div>

                {selectedExperiment.safety_notes && (
                  <div className="p-3 bg-yellow-50 rounded-lg text-sm">
                    <p className="font-medium text-yellow-800">Safety Note:</p>
                    <p className="text-yellow-700">{selectedExperiment.safety_notes}</p>
                  </div>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-6 mb-6" hover={false}>
            <h3 className="font-semibold mb-4">Run Virtual Simulation</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-sm text-gray-500 self-center">Try sample:</span>
              <button onClick={() => setUserInputs({ notes: 'Run the experiment with standard conditions as described in the procedure. Record all observations carefully.' })} className="px-3 py-1 text-xs bg-green-50 text-green-600 rounded-full hover:bg-green-100">Standard Test</button>
              <button onClick={() => setUserInputs({ notes: 'What happens if we double the concentration of the primary variable while keeping everything else constant?' })} className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100">Double Variable</button>
              <button onClick={() => setUserInputs({ notes: 'Repeat the experiment at three different temperatures: 10°C, 25°C, and 40°C. Compare results across conditions.' })} className="px-3 py-1 text-xs bg-orange-50 text-orange-600 rounded-full hover:bg-orange-100">Temperature</button>
            </div>
            <TextArea
              label="Your Observations/Variables (Optional)"
              placeholder="Describe any changes you'd like to make to the experiment..."
              value={userInputs.notes || ''}
              onChange={e => setUserInputs({ ...userInputs, notes: e.target.value })}
              rows={3}
            />
            <Button onClick={handleSimulate} disabled={simulating}>
              {simulating ? 'Simulating...' : 'Run Experiment'}
            </Button>
          </Card>

          {simulation && (
            <AIResponseDisplay content={simulation.results} title="Simulation Results" />
          )}
        </div>
      )}
    </div>
  );
};

// ==================== AI FLASHCARD GENERATOR ====================
const FlashcardGenerator = () => {
  const [form, setForm] = useState({ topic: '', subject: '', cardCount: 10, difficulty: 'Intermediate' });
  const [generating, setGenerating] = useState(false);
  const [generatedDeck, setGeneratedDeck] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('generate');
  const navigate = useNavigate();

  const loadHistory = () => {
    apiFetch('/flashcard-generator/history').then(data => {
      setHistory(Array.isArray(data) ? data : []);
    });
  };

  useEffect(() => { loadHistory(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    const result = await apiFetch('/flashcard-generator/generate', {
      method: 'POST',
      body: JSON.stringify(form)
    });
    setGeneratedDeck(result);
    setGenerating(false);
    loadHistory();
  };

  if (generatedDeck) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Flashcards Generated!</h1>
          <p className="text-gray-500">Your new deck is ready to study</p>
        </div>

        <Card className="p-6 mb-6" hover={false}>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Check size={24} className="text-green-600" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">{generatedDeck.deck?.title}</h2>
              <p className="text-gray-500">{generatedDeck.cards?.length || 0} cards created</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={() => navigate(`/flashcards/${generatedDeck.deck?.id}`)}>
              Study Now
            </Button>
            <Button variant="secondary" onClick={() => setGeneratedDeck(null)}>
              Generate More
            </Button>
          </div>
        </Card>

        <h3 className="font-semibold mb-4">Preview Cards</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {generatedDeck.cards?.slice(0, 6).map((card, idx) => (
            <Card key={idx} className="p-4" hover={false}>
              <p className="font-medium text-blue-600 mb-2">Q: {card.front_text}</p>
              <p className="text-gray-700">A: {card.back_text}</p>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">AI Flashcard Generator</h1>
        <p className="text-gray-500">Create study flashcards on any topic</p>
      </div>

      <div className="flex gap-2 mb-6">
        {[{ key: 'generate', label: 'Generate Cards', icon: Layers }, { key: 'history', label: 'History', icon: Clock }].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'generate' ? (
        <Card className="p-6" hover={false}>
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-sm text-gray-500 self-center">Try sample:</span>
            <button onClick={() => setForm({ topic: 'Cell Structure and Organelles', subject: 'Biology', cardCount: 10, difficulty: 'Intermediate' })} className="px-3 py-1 text-xs bg-green-50 text-green-600 rounded-full hover:bg-green-100">Biology Cards</button>
            <button onClick={() => setForm({ topic: 'Ancient Rome - Key Events and Figures', subject: 'History', cardCount: 10, difficulty: 'Intermediate' })} className="px-3 py-1 text-xs bg-yellow-50 text-yellow-600 rounded-full hover:bg-yellow-100">History Cards</button>
            <button onClick={() => setForm({ topic: 'Periodic Table - First 20 Elements', subject: 'Chemistry', cardCount: 10, difficulty: 'Beginner' })} className="px-3 py-1 text-xs bg-purple-50 text-purple-600 rounded-full hover:bg-purple-100">Chemistry Cards</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Topic"
              placeholder="e.g., Photosynthesis, World War II, Spanish Verbs"
              value={form.topic}
              onChange={e => setForm({ ...form, topic: e.target.value })}
            />
            <Input
              label="Subject"
              placeholder="e.g., Biology, History, Languages"
              value={form.subject}
              onChange={e => setForm({ ...form, subject: e.target.value })}
            />
            <Input
              label="Number of Cards"
              type="number"
              min="5"
              max="30"
              value={form.cardCount}
              onChange={e => setForm({ ...form, cardCount: parseInt(e.target.value) })}
            />
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
              <select
                className="w-full px-4 py-2 border rounded-lg"
                value={form.difficulty}
                onChange={e => setForm({ ...form, difficulty: e.target.value })}
              >
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>
            </div>
          </div>

          <Button onClick={handleGenerate} disabled={generating || !form.topic || !form.subject}>
            {generating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Generating...
              </>
            ) : (
              <>
                <Layers size={18} className="mr-2" />
                Generate Flashcards
              </>
            )}
          </Button>
        </Card>
      ) : (
        <div>
          <h3 className="font-semibold mb-4">Generated Flashcard History</h3>
          {history.length === 0 ? (
            <Card className="p-6 text-center text-gray-500" hover={false}>
              No flashcard decks generated yet. Create your first deck!
            </Card>
          ) : (
            <div className="space-y-4">
              {history.map(deck => (
                <Card key={deck.id} className="p-4" hover={false}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold">{deck.title}</h4>
                      <p className="text-sm text-gray-500">{deck.subject} - {deck.topic} | {deck.card_count} cards | {new Date(deck.created_at).toLocaleDateString()}</p>
                    </div>
                    <Button size="sm" onClick={() => navigate(`/flashcards/${deck.id}`)}>Study</Button>
                  </div>
                  {deck.cards && deck.cards.length > 0 && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-700">View {deck.cards.length} cards</summary>
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                        {deck.cards.map((card, idx) => (
                          <div key={idx} className="bg-gray-50 rounded-lg p-3">
                            <p className="font-medium text-sm text-blue-600">Q: {card.front_text}</p>
                            <p className="text-sm text-gray-700 mt-1">A: {card.back_text}</p>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Homework Detail Page
const HomeworkDetail = () => {
  const { id } = useParams();
  const [hw, setHw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [helpQuestion, setHelpQuestion] = useState('');
  const [helpResponse, setHelpResponse] = useState(null);
  const [helping, setHelping] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    apiFetch(`/homework/${id}`).then(data => {
      setHw(data);
      setEditForm({ title: data.title, subject: data.subject, description: data.description, dueDate: data.due_date?.split('T')[0] || '', status: data.status });
      setLoading(false);
    });
  }, [id]);

  const handleSave = async () => {
    const result = await apiFetch(`/homework/${id}`, { method: 'PUT', body: JSON.stringify(editForm) });
    if (result) { setHw({ ...hw, ...result }); setEditing(false); toast.success('Assignment updated'); }
  };

  const handleDelete = async () => {
    await apiFetch(`/homework/${id}`, { method: 'DELETE' });
    toast.success('Assignment deleted');
    navigate('/homework-helper');
  };

  const handleGetHelp = async () => {
    setHelping(true);
    const result = await apiFetch(`/homework/${id}/help`, { method: 'POST', body: JSON.stringify({ question: helpQuestion }) });
    setHelpResponse(result);
    setHelping(false);
  };

  if (loading) return <LoadingSpinner />;
  if (!hw) return <div className="text-center py-8">Assignment not found</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate('/homework-helper')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={20} /> Back to Homework Helper
      </button>

      <Card className="p-6 mb-6" hover={false}>
        {editing ? (
          <div className="space-y-4">
            <Input label="Title" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Subject" value={editForm.subject} onChange={e => setEditForm({...editForm, subject: e.target.value})} />
              <Input label="Due Date" type="date" value={editForm.dueDate} onChange={e => setEditForm({...editForm, dueDate: e.target.value})} />
            </div>
            <TextArea label="Description" rows={4} value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} />
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select className="w-full px-4 py-2 border rounded-lg" value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}>
                <option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="completed">Completed</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Badge>{hw.subject}</Badge>
                <Badge color={hw.status === 'completed' ? 'green' : hw.status === 'in_progress' ? 'yellow' : 'gray'}>{hw.status}</Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
                <Button variant="danger" onClick={() => setConfirmDelete(true)}><Trash2 size={16} /></Button>
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2">{hw.title}</h1>
            <p className="text-gray-500 mb-4">{hw.description}</p>
            {hw.due_date && <p className="text-sm text-gray-400">Due: {new Date(hw.due_date).toLocaleDateString()}</p>}
          </>
        )}
      </Card>

      <Card className="p-6 mb-6" hover={false}>
        <h3 className="font-semibold mb-4">Get AI Help</h3>
        <TextArea placeholder="Ask a question about this assignment..." value={helpQuestion} onChange={e => setHelpQuestion(e.target.value)} rows={3} />
        <Button onClick={handleGetHelp} disabled={helping || !helpQuestion} className="mt-2">
          {helping ? 'Getting Help...' : <><Sparkles size={18} className="mr-2" />Get AI Help</>}
        </Button>
      </Card>

      {helpResponse && <AIResponseDisplay content={helpResponse.help || helpResponse.ai_help_content} title="AI Tutor Response" />}

      {hw.ai_help_content && !helpResponse && (
        <div className="mt-4">
          <h3 className="font-semibold mb-2">Previous AI Help</h3>
          <AIResponseDisplay content={hw.ai_help_content} title="AI Help" />
        </div>
      )}

      <ConfirmDialog isOpen={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete Assignment" message="Are you sure you want to delete this assignment?" onConfirm={handleDelete} />
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
        <Route path="/codex/custom-viz" element={<ProtectedRoute><CodexCustomVizFeature /></ProtectedRoute>} />
        <Route path="/codex/operations" element={<ProtectedRoute><CodexOperationsFeature /></ProtectedRoute>} />

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
          {/* New AI Features */}
          <Route path="/learning-style" element={<ProtectedRoute><LearningStyleDetector /></ProtectedRoute>} />
          <Route path="/quiz-generator" element={<ProtectedRoute><QuizGenerator /></ProtectedRoute>} />
          <Route path="/progress-predictor" element={<ProtectedRoute><ProgressPredictor /></ProtectedRoute>} />
          <Route path="/concept-explainer" element={<ProtectedRoute><ConceptExplainer /></ProtectedRoute>} />
          <Route path="/study-scheduler" element={<ProtectedRoute><StudyScheduler /></ProtectedRoute>} />
          <Route path="/homework-helper" element={<ProtectedRoute><HomeworkHelper /></ProtectedRoute>} />
          <Route path="/homework/:id" element={<ProtectedRoute><HomeworkDetail /></ProtectedRoute>} />
          <Route path="/math-tutor" element={<ProtectedRoute><MathTutor /></ProtectedRoute>} />
          <Route path="/history-explorer" element={<ProtectedRoute><HistoryExplorer /></ProtectedRoute>} />
          <Route path="/science-lab" element={<ProtectedRoute><ScienceLab /></ProtectedRoute>} />
          <Route path="/flashcard-generator" element={<ProtectedRoute><FlashcardGenerator /></ProtectedRoute>} />
          {/* NEW pages */}
          <Route path="/spaced-repetition" element={<ProtectedRoute><SpacedRepetition /></ProtectedRoute>} />
          <Route path="/adaptive-quiz" element={<ProtectedRoute><AdaptiveQuiz /></ProtectedRoute>} />
          <Route path="/parent-dashboard" element={<ProtectedRoute><ParentDashboard /></ProtectedRoute>} />
          <Route path="/learning-style-recommendations" element={<ProtectedRoute><LearningStyleContentRecommend /></ProtectedRoute>} />
          <Route path="/integrations" element={<ProtectedRoute><IntegrationsAndParent /></ProtectedRoute>} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        
          {/* // === Batch 06 Gaps & Frontend Mounts === */}
          <Route path="/cf-adaptive-quiz-engine" element={<CFAdaptiveQuizEnginePage />} />
          <Route path="/cf-parent-insights" element={<CFParentInsightsPage />} />
          <Route path="/cf-content-recommendation" element={<CFContentRecommendationPage />} />
          <Route path="/cf-automated-tutoring" element={<CFAutomatedTutoringPage />} />
          <Route path="/cf-progress-prediction" element={<CFProgressPredictionPage />} />
          <Route path="/gap-no-teacher" element={<GapNoTeacherPage />} />
          <Route path="/gap-no-curriculum" element={<GapNoCurriculumPage />} />
          <Route path="/gap-no-peer" element={<GapNoPeerPage />} />
          <Route path="/gap-no-dedicated-routes-directory-all-routes-inline" element={<GapNoDedicatedRoutesDirectoryAllRoutesInlinePage />} />
          <Route path="/gap-limited-frontend-only-3-pages-despite-rich-backend" element={<GapLimitedFrontendOnly3PagesDespiteRichBackendPage />} />
          <Route path="/gap-no-real-lms-integration-canvas-blackboard-adapter" element={<GapNoRealLmsIntegrationCanvasBlackboardAdapterPage />} />
          <Route path="/gap-no-payment-billing-for-parent-subscriptions" element={<GapNoPaymentBillingForParentSubscriptionsPage />} />
          <Route path="/gap-no-webhooks" element={<GapNoWebhooksPage />} />
          <Route path="/gap-no-audit-logging-visible" element={<GapNoAuditLoggingVisiblePage />} />
          <Route path="/gap-limited-rbac-student-parent-teacher-separation-unc" element={<GapLimitedRbacStudentParentTeacherSeparationUncPage />} />
          <Route path="/custom-views" element={<ProtectedRoute><CustomViewsPage /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
