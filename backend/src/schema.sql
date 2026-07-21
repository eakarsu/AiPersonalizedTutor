-- AI Personalized Tutor Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'student',
    grade_level VARCHAR(50),
    learning_style VARCHAR(100),
    email_verified BOOLEAN DEFAULT false,
    avatar_url VARCHAR(500),
    bio TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Password Reset Tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email Verification Tokens
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Token Blacklist (for logout)
CREATE TABLE IF NOT EXISTS token_blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash VARCHAR(500) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Learning Paths
CREATE TABLE IF NOT EXISTS learning_paths (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    subject VARCHAR(100) NOT NULL,
    difficulty_level VARCHAR(50),
    estimated_hours INTEGER,
    icon VARCHAR(100),
    color VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Learning Path Progress
CREATE TABLE IF NOT EXISTS user_learning_paths (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    learning_path_id UUID REFERENCES learning_paths(id) ON DELETE CASCADE,
    progress_percentage INTEGER DEFAULT 0,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Study Materials
CREATE TABLE IF NOT EXISTS study_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT,
    subject VARCHAR(100) NOT NULL,
    topic VARCHAR(255),
    material_type VARCHAR(50),
    difficulty_level VARCHAR(50),
    learning_path_id UUID REFERENCES learning_paths(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Quizzes
CREATE TABLE IF NOT EXISTS quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    subject VARCHAR(100) NOT NULL,
    topic VARCHAR(255),
    difficulty_level VARCHAR(50),
    time_limit_minutes INTEGER,
    passing_score INTEGER DEFAULT 70,
    is_adaptive BOOLEAN DEFAULT false,
    is_ai_generated BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Quiz Questions
CREATE TABLE IF NOT EXISTS quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) DEFAULT 'multiple_choice',
    options JSONB,
    correct_answer TEXT NOT NULL,
    explanation TEXT,
    points INTEGER DEFAULT 1,
    difficulty_level VARCHAR(50)
);

-- Quiz Attempts
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
    score INTEGER,
    total_points INTEGER,
    time_taken_seconds INTEGER,
    answers JSONB,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Practice Problems
CREATE TABLE IF NOT EXISTS practice_problems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    problem_text TEXT NOT NULL,
    subject VARCHAR(100) NOT NULL,
    topic VARCHAR(255),
    difficulty_level VARCHAR(50),
    solution TEXT,
    hints JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Problem Attempts
CREATE TABLE IF NOT EXISTS problem_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    problem_id UUID REFERENCES practice_problems(id) ON DELETE CASCADE,
    user_answer TEXT,
    is_correct BOOLEAN,
    time_taken_seconds INTEGER,
    hints_used INTEGER DEFAULT 0,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Flashcard Decks
CREATE TABLE IF NOT EXISTS flashcard_decks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    subject VARCHAR(100) NOT NULL,
    topic VARCHAR(255),
    card_count INTEGER DEFAULT 0,
    is_ai_generated BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Flashcards
CREATE TABLE IF NOT EXISTS flashcards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deck_id UUID REFERENCES flashcard_decks(id) ON DELETE CASCADE,
    front_text TEXT NOT NULL,
    back_text TEXT NOT NULL,
    image_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Flashcard Progress
CREATE TABLE IF NOT EXISTS user_flashcard_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    flashcard_id UUID REFERENCES flashcards(id) ON DELETE CASCADE,
    confidence_level INTEGER DEFAULT 0,
    times_reviewed INTEGER DEFAULT 0,
    last_reviewed_at TIMESTAMP
);

-- Video Lessons
CREATE TABLE IF NOT EXISTS video_lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    subject VARCHAR(100) NOT NULL,
    topic VARCHAR(255),
    video_url VARCHAR(500),
    thumbnail_url VARCHAR(500),
    duration_minutes INTEGER,
    instructor VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Video Progress
CREATE TABLE IF NOT EXISTS user_video_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    video_id UUID REFERENCES video_lessons(id) ON DELETE CASCADE,
    watched_seconds INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT false,
    last_watched_at TIMESTAMP
);

-- AI Chat Sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    subject VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Goals
CREATE TABLE IF NOT EXISTS goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    target_date DATE,
    category VARCHAR(100),
    status VARCHAR(50) DEFAULT 'in_progress',
    progress_percentage INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vocabulary Words
CREATE TABLE IF NOT EXISTS vocabulary_words (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    word VARCHAR(255) NOT NULL,
    definition TEXT NOT NULL,
    part_of_speech VARCHAR(50),
    example_sentence TEXT,
    pronunciation VARCHAR(255),
    difficulty_level VARCHAR(50),
    subject VARCHAR(100) DEFAULT 'English',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Vocabulary Progress
CREATE TABLE IF NOT EXISTS user_vocabulary_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    word_id UUID REFERENCES vocabulary_words(id) ON DELETE CASCADE,
    mastery_level INTEGER DEFAULT 0,
    times_practiced INTEGER DEFAULT 0,
    last_practiced_at TIMESTAMP
);

-- Essays
CREATE TABLE IF NOT EXISTS essays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    prompt TEXT,
    subject VARCHAR(100),
    word_count INTEGER DEFAULT 0,
    ai_feedback TEXT,
    ai_score INTEGER,
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Writing Prompts
CREATE TABLE IF NOT EXISTS writing_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    prompt_text TEXT NOT NULL,
    genre VARCHAR(100),
    difficulty_level VARCHAR(50),
    word_count_target INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance Analytics
CREATE TABLE IF NOT EXISTS performance_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(100) NOT NULL,
    metric_type VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,2),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Study Sessions
CREATE TABLE IF NOT EXISTS study_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(100),
    duration_minutes INTEGER,
    activity_type VARCHAR(100),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP
);

-- Achievements
CREATE TABLE IF NOT EXISTS achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    points INTEGER DEFAULT 0,
    category VARCHAR(100),
    criteria JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Achievements
CREATE TABLE IF NOT EXISTS user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Math Problems (specific for Math Problem Solver)
CREATE TABLE IF NOT EXISTS math_problems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    problem_text TEXT NOT NULL,
    problem_type VARCHAR(100),
    difficulty_level VARCHAR(50),
    solution_steps JSONB,
    final_answer TEXT,
    topic VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== NEW AI FEATURE TABLES ====================

-- Learning Style Assessments
CREATE TABLE IF NOT EXISTS learning_style_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    visual_score INTEGER DEFAULT 0,
    auditory_score INTEGER DEFAULT 0,
    reading_writing_score INTEGER DEFAULT 0,
    kinesthetic_score INTEGER DEFAULT 0,
    dominant_style VARCHAR(100),
    ai_analysis TEXT,
    recommendations JSONB,
    assessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Learning Style Questions (for assessment quiz)
CREATE TABLE IF NOT EXISTS learning_style_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_text TEXT NOT NULL,
    options JSONB NOT NULL,
    style_weights JSONB NOT NULL,
    category VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Study Schedules
CREATE TABLE IF NOT EXISTS study_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    schedule_data JSONB NOT NULL,
    ai_optimized BOOLEAN DEFAULT false,
    optimization_notes TEXT,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Progress Predictions
CREATE TABLE IF NOT EXISTS progress_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(100),
    current_score DECIMAL(5,2),
    predicted_score DECIMAL(5,2),
    prediction_date DATE,
    target_date DATE,
    confidence_level DECIMAL(5,2),
    ai_insights TEXT,
    recommendations JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Concept Explanations (saved AI explanations)
CREATE TABLE IF NOT EXISTS concept_explanations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    concept_name VARCHAR(255) NOT NULL,
    subject VARCHAR(100) NOT NULL,
    explanation TEXT NOT NULL,
    difficulty_level VARCHAR(50),
    examples JSONB,
    analogies JSONB,
    related_concepts JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Homework Assignments
CREATE TABLE IF NOT EXISTS homework_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    subject VARCHAR(100) NOT NULL,
    description TEXT,
    due_date DATE,
    status VARCHAR(50) DEFAULT 'pending',
    ai_help_content TEXT,
    ai_hints JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Math Tutoring Sessions
CREATE TABLE IF NOT EXISTS math_tutoring_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    topic VARCHAR(255) NOT NULL,
    problem TEXT,
    step_by_step_solution TEXT,
    hints JSONB,
    practice_problems JSONB,
    session_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Historical Events (for History Explorer)
CREATE TABLE IF NOT EXISTS historical_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    event_date VARCHAR(100),
    era VARCHAR(100),
    region VARCHAR(100),
    key_figures JSONB,
    causes JSONB,
    effects JSONB,
    related_events JSONB,
    image_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- History Explorations (user's exploration sessions)
CREATE TABLE IF NOT EXISTS history_explorations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID REFERENCES historical_events(id) ON DELETE SET NULL,
    query TEXT,
    ai_response TEXT,
    follow_up_questions JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Science Experiments (for Lab Simulator)
CREATE TABLE IF NOT EXISTS science_experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    subject VARCHAR(100) NOT NULL,
    topic VARCHAR(255),
    difficulty_level VARCHAR(50),
    materials JSONB,
    procedure JSONB,
    expected_results TEXT,
    safety_notes TEXT,
    virtual_simulation_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lab Simulations (user's simulation runs)
CREATE TABLE IF NOT EXISTS lab_simulations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    experiment_id UUID REFERENCES science_experiments(id) ON DELETE SET NULL,
    user_inputs JSONB,
    ai_results TEXT,
    observations TEXT,
    conclusions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI Generated Content Log (for tracking AI-generated content)
CREATE TABLE IF NOT EXISTS ai_generated_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content_type VARCHAR(100) NOT NULL,
    input_prompt TEXT,
    generated_content TEXT NOT NULL,
    model_used VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Writing Assistant Results
CREATE TABLE IF NOT EXISTS writing_assistant_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    original_text TEXT NOT NULL,
    improved_text TEXT NOT NULL,
    improvement_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ask AI Widget Queries
CREATE TABLE IF NOT EXISTS ai_widget_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    context VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Math Solver Results
CREATE TABLE IF NOT EXISTS math_solver_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    problem TEXT NOT NULL,
    solution TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_learning_paths_subject ON learning_paths(subject);
CREATE INDEX IF NOT EXISTS idx_study_materials_subject ON study_materials(subject);
CREATE INDEX IF NOT EXISTS idx_quizzes_subject ON quizzes(subject);
CREATE INDEX IF NOT EXISTS idx_practice_problems_subject ON practice_problems(subject);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_vocabulary_difficulty ON vocabulary_words(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_essays_user ON essays(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_style_user ON learning_style_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_study_schedules_user ON study_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_predictions_user ON progress_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_homework_user ON homework_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_math_tutoring_user ON math_tutoring_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_historical_events_era ON historical_events(era);
CREATE INDEX IF NOT EXISTS idx_science_experiments_subject ON science_experiments(subject);
CREATE INDEX IF NOT EXISTS idx_writing_assistant_user ON writing_assistant_results(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_widget_queries_user ON ai_widget_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_math_solver_user ON math_solver_results(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_email_verify_token ON email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_hash ON token_blacklist(token_hash);

-- ==================== NEW: Spaced Repetition (SM-2) ====================
-- Per-user, per-flashcard scheduling state for the SM-2 algorithm.
CREATE TABLE IF NOT EXISTS sr_card_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    flashcard_id UUID REFERENCES flashcards(id) ON DELETE CASCADE,
    repetitions INTEGER DEFAULT 0,
    interval_days INTEGER DEFAULT 1,        -- next review interval
    ease_factor DECIMAL(4,2) DEFAULT 2.50,  -- SM-2 EF
    next_review_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_reviewed_at TIMESTAMP,
    last_quality INTEGER,                    -- 0..5 most recent grade
    UNIQUE(user_id, flashcard_id)
);
CREATE INDEX IF NOT EXISTS idx_sr_user_due ON sr_card_state(user_id, next_review_at);

-- ==================== NEW: Adaptive Quiz Confidence ====================
-- Per-user, per-topic running confidence used to scale next-question difficulty.
CREATE TABLE IF NOT EXISTS topic_confidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(100) NOT NULL,
    topic VARCHAR(255) NOT NULL,
    confidence DECIMAL(5,2) DEFAULT 50.00, -- 0..100
    correct_count INTEGER DEFAULT 0,
    incorrect_count INTEGER DEFAULT 0,
    last_difficulty VARCHAR(50) DEFAULT 'medium',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, subject, topic)
);
CREATE INDEX IF NOT EXISTS idx_topic_confidence_user ON topic_confidence(user_id);

-- AI-generated adaptive quiz questions. ai_results stores the raw model JSON for traceability.
CREATE TABLE IF NOT EXISTS adaptive_quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(100) NOT NULL,
    topic VARCHAR(255) NOT NULL,
    difficulty VARCHAR(50),
    question_text TEXT NOT NULL,
    options JSONB,
    correct_answer TEXT,
    explanation TEXT,
    ai_results JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_adaptive_q_user ON adaptive_quiz_questions(user_id);

-- ==================== NEW: Parent / Teacher Linkage ====================
-- Many-to-many: a parent or teacher can link to one or more student users.
CREATE TABLE IF NOT EXISTS guardian_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guardian_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    student_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    relationship VARCHAR(50) NOT NULL,    -- "parent", "teacher", "tutor"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(guardian_user_id, student_user_id)
);
CREATE INDEX IF NOT EXISTS idx_guardian_links_guardian ON guardian_links(guardian_user_id);
CREATE INDEX IF NOT EXISTS idx_guardian_links_student ON guardian_links(student_user_id);

-- Weekly AI-generated progress letters (one row per student per week).
CREATE TABLE IF NOT EXISTS progress_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    letter_html TEXT NOT NULL,
    metrics JSONB,
    ai_results JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_user_id, week_start)
);
CREATE INDEX IF NOT EXISTS idx_progress_letters_student ON progress_letters(student_user_id);
