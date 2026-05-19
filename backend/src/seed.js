const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'ai_tutor_db',
  user: process.env.DB_USER || 'tutor_user',
  password: process.env.DB_PASSWORD || 'tutor_password',
});

async function seed() {
  console.log('Starting database seeding...');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Drop all existing tables so schema changes take effect
    await client.query(`
      DROP TABLE IF EXISTS
        progress_letters, guardian_links,
        adaptive_quiz_questions, topic_confidence, sr_card_state,
        password_reset_tokens, email_verification_tokens, token_blacklist,
        user_vocabulary_progress, user_video_progress, user_flashcard_progress,
        quiz_attempts, problem_attempts, user_learning_paths, user_achievements,
        chat_messages, chat_sessions, lab_simulations, history_explorations,
        math_solver_results, ai_widget_queries, writing_assistant_results,
        ai_generated_content, math_tutoring_sessions, homework_assignments,
        concept_explanations, progress_predictions, study_schedules,
        learning_style_questions, learning_style_assessments,
        performance_analytics, study_sessions, essays, writing_prompts,
        vocabulary_words, video_lessons, flashcards, flashcard_decks,
        math_problems, achievements, goals, practice_problems,
        quiz_questions, quizzes, study_materials, user_learning_paths,
        science_experiments, historical_events, learning_paths, users
      CASCADE
    `);
    console.log('Dropped existing tables');

    // Read and execute schema statements one at a time
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    const statements = schema.split(';').filter(s => s.trim().length > 0);
    for (const stmt of statements) {
      await client.query(stmt);
    }
    console.log('Schema created successfully');

    // Seed Users
    const passwordHash = await bcrypt.hash('password123', 10);
    const users = await client.query(`
      INSERT INTO users (email, password_hash, full_name, role, grade_level, learning_style, email_verified) VALUES
      ('student@demo.com', $1, 'Demo Student', 'student', '10th Grade', 'visual', true),
      ('teacher@demo.com', $1, 'Demo Teacher', 'teacher', null, null, true),
      ('admin@demo.com', $1, 'Admin User', 'admin', null, null, true),
      ('john@example.com', $1, 'John Smith', 'student', '9th Grade', 'auditory', true),
      ('sarah@example.com', $1, 'Sarah Johnson', 'student', '11th Grade', 'reading_writing', true),
      ('mike@example.com', $1, 'Mike Williams', 'student', '10th Grade', 'kinesthetic', true)
      RETURNING id
    `, [passwordHash]);
    console.log('Users seeded (6 users)');
    const studentId = users.rows[0].id;

    // Seed Learning Paths (17 items)
    const learningPaths = await client.query(`
      INSERT INTO learning_paths (title, description, subject, difficulty_level, estimated_hours, icon, color) VALUES
      ('Algebra Fundamentals', 'Master the basics of algebra including variables, equations, and functions', 'Mathematics', 'Beginner', 20, 'calculator', 'blue'),
      ('Calculus Mastery', 'Learn differential and integral calculus from scratch', 'Mathematics', 'Advanced', 40, 'chart-line', 'purple'),
      ('English Literature', 'Explore classic and modern literary works', 'English', 'Intermediate', 30, 'book-open', 'green'),
      ('World History', 'Journey through major historical events and civilizations', 'History', 'Intermediate', 35, 'globe', 'amber'),
      ('Biology Essentials', 'Understand life sciences from cells to ecosystems', 'Science', 'Beginner', 25, 'leaf', 'emerald'),
      ('Chemistry Basics', 'Learn atomic structure, reactions, and chemical bonds', 'Science', 'Intermediate', 30, 'flask', 'cyan'),
      ('Physics Principles', 'Explore mechanics, thermodynamics, and waves', 'Science', 'Advanced', 45, 'atom', 'indigo'),
      ('Creative Writing', 'Develop your storytelling and writing skills', 'English', 'Beginner', 15, 'pencil', 'pink'),
      ('Computer Science Intro', 'Learn programming fundamentals and algorithms', 'Technology', 'Beginner', 35, 'code', 'slate'),
      ('Spanish Language', 'Build conversational Spanish skills', 'Languages', 'Beginner', 50, 'message-circle', 'orange'),
      ('Geometry Deep Dive', 'Master shapes, proofs, and spatial reasoning', 'Mathematics', 'Intermediate', 25, 'shapes', 'teal'),
      ('Essay Writing Mastery', 'Perfect your academic writing skills', 'English', 'Intermediate', 20, 'file-text', 'rose'),
      ('Environmental Science', 'Understand climate, ecosystems, and sustainability', 'Science', 'Beginner', 22, 'tree', 'lime'),
      ('Statistics and Probability', 'Learn data analysis and probability theory', 'Mathematics', 'Intermediate', 28, 'bar-chart', 'violet'),
      ('American History', 'Explore US history from colonization to modern day', 'History', 'Intermediate', 32, 'flag', 'red'),
      ('Art History', 'Journey through artistic movements and masterpieces', 'Arts', 'Beginner', 18, 'palette', 'fuchsia'),
      ('Music Theory', 'Learn notes, scales, chords, and composition', 'Arts', 'Beginner', 24, 'music', 'sky')
      RETURNING id
    `);
    console.log('Learning paths seeded (17 items)');
    const lpIds = learningPaths.rows.map(r => r.id);

    // Seed Study Materials (17 items)
    await client.query(`
      INSERT INTO study_materials (title, content, subject, topic, material_type, difficulty_level, learning_path_id) VALUES
      ('Introduction to Variables', 'Variables are symbols that represent unknown values in mathematical expressions. They are fundamental to algebra and allow us to write general formulas. For example, in the expression 2x + 3, x is a variable that can take any value.', 'Mathematics', 'Algebra', 'lesson', 'Beginner', $1),
      ('Solving Linear Equations', 'A linear equation is an equation where the highest power of the variable is 1. To solve, isolate the variable by performing inverse operations on both sides.', 'Mathematics', 'Algebra', 'lesson', 'Beginner', $2),
      ('Quadratic Equations', 'Quadratic equations have the form ax2 + bx + c = 0. They can be solved using factoring, completing the square, or the quadratic formula.', 'Mathematics', 'Algebra', 'lesson', 'Intermediate', $3),
      ('Cell Structure and Function', 'All living organisms are made up of cells. Cells are the basic structural and functional units of life.', 'Science', 'Biology', 'lesson', 'Beginner', $4),
      ('Photosynthesis Process', 'Photosynthesis is the process by which plants convert light energy into chemical energy stored in glucose.', 'Science', 'Biology', 'lesson', 'Intermediate', $5),
      ('DNA and Genetics', 'DNA (deoxyribonucleic acid) is the hereditary material in humans and almost all organisms.', 'Science', 'Biology', 'lesson', 'Intermediate', $6),
      ('Shakespeare Introduction', 'William Shakespeare (1564-1616) was an English playwright and poet widely regarded as the greatest writer in the English language.', 'English', 'Literature', 'lesson', 'Intermediate', $7),
      ('World War I Overview', 'World War I (1914-1918) was a global conflict that reshaped the political landscape of Europe and the world.', 'History', 'Modern History', 'lesson', 'Intermediate', $8),
      ('Atomic Structure', 'Atoms are the basic building blocks of matter. They consist of protons and neutrons in the nucleus, with electrons orbiting.', 'Science', 'Chemistry', 'lesson', 'Beginner', $9),
      ('Newtons Laws of Motion', 'Isaac Newton formulated three fundamental laws of motion that form the foundation of classical mechanics.', 'Science', 'Physics', 'lesson', 'Intermediate', $10),
      ('Introduction to Python', 'Python is a high-level, interpreted programming language known for its simplicity and readability.', 'Technology', 'Programming', 'lesson', 'Beginner', $11),
      ('Spanish Greetings', 'Learn basic Spanish greetings: Hola (Hello), Buenos dias (Good morning), Buenas tardes (Good afternoon).', 'Languages', 'Spanish', 'lesson', 'Beginner', $12),
      ('Triangle Properties', 'A triangle is a polygon with three edges and three vertices. The sum of interior angles equals 180 degrees.', 'Mathematics', 'Geometry', 'lesson', 'Beginner', $13),
      ('Thesis Statement Writing', 'A thesis statement is a sentence that expresses the main idea of your essay and tells readers what to expect.', 'English', 'Writing', 'lesson', 'Intermediate', $14),
      ('Climate Change Science', 'Climate change refers to long-term shifts in temperatures and weather patterns.', 'Science', 'Environmental', 'lesson', 'Intermediate', $15),
      ('Mean Median and Mode', 'Mean is the average. Median is the middle value. Mode is the most frequent value.', 'Mathematics', 'Statistics', 'lesson', 'Beginner', $16),
      ('The American Revolution', 'The American Revolution (1765-1783) was a political upheaval that led to the formation of the United States.', 'History', 'American History', 'lesson', 'Intermediate', $17)
    `, [lpIds[0], lpIds[0], lpIds[0], lpIds[4], lpIds[4], lpIds[4], lpIds[2], lpIds[3], lpIds[5], lpIds[6], lpIds[8], lpIds[9], lpIds[10], lpIds[11], lpIds[12], lpIds[13], lpIds[14]]);
    console.log('Study materials seeded (17 items)');

    // Seed Quizzes (17 items)
    const quizzes = await client.query(`
      INSERT INTO quizzes (user_id, title, description, subject, topic, difficulty_level, time_limit_minutes, passing_score, is_adaptive, is_ai_generated) VALUES
      ($1, 'Algebra Basics Quiz', 'Test your understanding of basic algebraic concepts', 'Mathematics', 'Algebra', 'Beginner', 15, 70, false, false),
      ($1, 'Biology Cell Quiz', 'Quiz on cell structure and function', 'Science', 'Biology', 'Beginner', 20, 70, false, false),
      ($1, 'Shakespeare Quiz', 'Test your knowledge of Shakespeares works', 'English', 'Literature', 'Intermediate', 25, 70, false, false),
      ($1, 'World War I Quiz', 'Quiz on WWI events and causes', 'History', 'Modern History', 'Intermediate', 20, 70, false, false),
      ($1, 'Chemistry Elements Quiz', 'Test your knowledge of chemical elements', 'Science', 'Chemistry', 'Beginner', 15, 70, false, false),
      ($1, 'Physics Motion Quiz', 'Quiz on Newtons laws of motion', 'Science', 'Physics', 'Intermediate', 20, 70, true, false),
      ($1, 'Geometry Shapes Quiz', 'Test your understanding of geometric shapes', 'Mathematics', 'Geometry', 'Beginner', 15, 70, false, false),
      ($1, 'Grammar Fundamentals', 'Quiz on English grammar rules', 'English', 'Grammar', 'Beginner', 20, 70, false, false),
      ($1, 'Spanish Vocabulary Quiz', 'Test basic Spanish vocabulary', 'Languages', 'Spanish', 'Beginner', 15, 70, false, false),
      ($1, 'Environmental Science Quiz', 'Quiz on environmental concepts', 'Science', 'Environmental', 'Intermediate', 20, 70, false, false),
      ($1, 'Statistics Basics Quiz', 'Test your statistics knowledge', 'Mathematics', 'Statistics', 'Beginner', 25, 70, false, false),
      ($1, 'American History Quiz', 'Quiz on US historical events', 'History', 'American History', 'Intermediate', 20, 70, false, false),
      ($1, 'Calculus Derivatives Quiz', 'Test your understanding of derivatives', 'Mathematics', 'Calculus', 'Advanced', 30, 70, true, false),
      ($1, 'Computer Science Basics', 'Quiz on programming fundamentals', 'Technology', 'Programming', 'Beginner', 20, 70, false, false),
      ($1, 'Art Movements Quiz', 'Test your knowledge of art history', 'Arts', 'Art History', 'Beginner', 15, 70, false, false),
      ($1, 'Music Theory Quiz', 'Quiz on basic music theory', 'Arts', 'Music', 'Beginner', 15, 70, false, false),
      ($1, 'Adaptive Math Quiz', 'Adaptive difficulty mathematics quiz', 'Mathematics', 'Mixed', 'Intermediate', 30, 70, true, false)
      RETURNING id
    `, [studentId]);
    console.log('Quizzes seeded (17 items)');
    const quizIds = quizzes.rows.map(r => r.id);

    // Seed Quiz Questions
    await client.query(`
      INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, difficulty_level) VALUES
      ($1, 'What is the value of x in: 2x + 5 = 15?', 'multiple_choice', '["x = 5", "x = 10", "x = 7.5", "x = 20"]', 'x = 5', 'Subtract 5 from both sides to get 2x = 10, then divide by 2', 1, 'Beginner'),
      ($1, 'Simplify: 3(x + 2) - x', 'multiple_choice', '["2x + 6", "2x + 2", "4x + 6", "3x + 6"]', '2x + 6', 'Distribute 3 to get 3x + 6 - x = 2x + 6', 1, 'Beginner'),
      ($1, 'What is the slope of y = 3x - 7?', 'multiple_choice', '["3", "-7", "7", "-3"]', '3', 'In slope-intercept form y = mx + b, m is the slope', 1, 'Beginner')
    `, [quizIds[0]]);

    await client.query(`
      INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, difficulty_level) VALUES
      ($1, 'What is the powerhouse of the cell?', 'multiple_choice', '["Nucleus", "Mitochondria", "Ribosome", "Golgi apparatus"]', 'Mitochondria', 'Mitochondria produce ATP through cellular respiration', 1, 'Beginner'),
      ($1, 'Which organelle contains DNA?', 'multiple_choice', '["Ribosome", "Lysosome", "Nucleus", "Vacuole"]', 'Nucleus', 'The nucleus contains the cells genetic material', 1, 'Beginner'),
      ($1, 'What is the function of ribosomes?', 'multiple_choice', '["Energy production", "Protein synthesis", "Waste removal", "Cell division"]', 'Protein synthesis', 'Ribosomes assemble amino acids into proteins', 1, 'Beginner')
    `, [quizIds[1]]);

    await client.query(`
      INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, difficulty_level) VALUES
      ($1, 'Who wrote Romeo and Juliet?', 'multiple_choice', '["Charles Dickens", "William Shakespeare", "Jane Austen", "Mark Twain"]', 'William Shakespeare', 'Shakespeare wrote Romeo and Juliet around 1594-1596', 1, 'Beginner'),
      ($1, 'In which play does the character Hamlet appear?', 'multiple_choice', '["Macbeth", "Othello", "Hamlet", "King Lear"]', 'Hamlet', 'Hamlet is the protagonist of the play Hamlet', 1, 'Beginner'),
      ($1, 'What type of play is A Midsummer Nights Dream?', 'multiple_choice', '["Tragedy", "Comedy", "History", "Romance"]', 'Comedy', 'It is one of Shakespeares most popular comedies', 1, 'Intermediate')
    `, [quizIds[2]]);

    console.log('Quiz questions seeded (9 questions across 3 quizzes)');

    // Seed Practice Problems (16 items)
    await client.query(`
      INSERT INTO practice_problems (title, problem_text, subject, topic, difficulty_level, solution, hints) VALUES
      ('Solve for x', 'Solve the equation: 3x - 7 = 14', 'Mathematics', 'Algebra', 'Beginner', 'x = 7. Add 7 to both sides: 3x = 21. Divide by 3: x = 7', '["Add 7 to both sides first", "Then divide by 3"]'),
      ('Quadratic Equation', 'Solve: x squared minus 5x plus 6 = 0', 'Mathematics', 'Algebra', 'Intermediate', 'x = 2 or x = 3. Factor: (x-2)(x-3) = 0', '["Try to factor the equation", "Find two numbers that multiply to 6 and add to -5"]'),
      ('Word Problem', 'A train travels 240 miles in 4 hours. What is its average speed?', 'Mathematics', 'Algebra', 'Beginner', 'Speed = Distance/Time = 240/4 = 60 mph', '["Use the formula: Speed = Distance divided by Time"]'),
      ('Cell Division', 'Explain the difference between mitosis and meiosis', 'Science', 'Biology', 'Intermediate', 'Mitosis produces 2 identical diploid cells. Meiosis produces 4 haploid cells.', '["Think about the number of resulting cells"]'),
      ('Chemical Reaction', 'Balance the equation: H2 + O2 -> H2O', 'Science', 'Chemistry', 'Beginner', '2H2 + O2 -> 2H2O', '["Count atoms on each side"]'),
      ('Physics Force', 'A 10 kg object accelerates at 5 m/s squared. What is the force?', 'Science', 'Physics', 'Beginner', 'F = ma = 10 x 5 = 50 N', '["Use Newtons second law: F = ma"]'),
      ('Essay Analysis', 'Identify the thesis statement in a paragraph about climate change', 'English', 'Writing', 'Intermediate', 'The thesis is usually the last sentence of the introduction', '["Look at the introduction paragraph"]'),
      ('Historical Analysis', 'What were the main causes of the American Revolution?', 'History', 'American History', 'Intermediate', 'Taxation without representation, British policies, desire for self-governance', '["Think about what colonists were protesting"]'),
      ('Geometry Proof', 'Prove that the angles of a triangle sum to 180 degrees', 'Mathematics', 'Geometry', 'Intermediate', 'Draw a line parallel to one side through the opposite vertex.', '["Consider drawing an auxiliary line"]'),
      ('Derivative Problem', 'Find the derivative of f(x) = x cubed + 2x squared - 5x + 3', 'Mathematics', 'Calculus', 'Advanced', 'f prime(x) = 3x squared + 4x - 5', '["Apply the power rule"]'),
      ('Spanish Translation', 'Translate: Where is the library?', 'Languages', 'Spanish', 'Beginner', 'Donde esta la biblioteca?', '["Where = Donde", "is = esta"]'),
      ('Statistics Problem', 'Find the mean of: 5, 8, 12, 3, 7', 'Mathematics', 'Statistics', 'Beginner', 'Mean = 35/5 = 7', '["Add all numbers", "Divide by count"]'),
      ('Programming Logic', 'Write pseudocode for finding the largest number in a list', 'Technology', 'Programming', 'Beginner', 'Set max to first element, loop and update max', '["Compare each element"]'),
      ('Environmental Issue', 'Explain the greenhouse effect', 'Science', 'Environmental', 'Intermediate', 'Solar radiation is trapped by greenhouse gases', '["Think about how light enters vs leaves"]'),
      ('Literary Analysis', 'Identify the symbolism in The Great Gatsby green light', 'English', 'Literature', 'Intermediate', 'The green light symbolizes Gatsbys hopes and dreams', '["Think about what Gatsby is looking at"]'),
      ('Music Intervals', 'What interval is from C to G?', 'Arts', 'Music', 'Beginner', 'A perfect fifth (7 semitones)', '["Count the letter names"]')
    `);
    console.log('Practice problems seeded (16 items)');

    // Seed Flashcard Decks (16 decks)
    const decks = await client.query(`
      INSERT INTO flashcard_decks (user_id, title, description, subject, topic, card_count, is_ai_generated) VALUES
      ($1, 'Algebra Terms', 'Essential algebra vocabulary', 'Mathematics', 'Algebra', 5, false),
      ($1, 'Biology Cell Parts', 'Cell organelles and functions', 'Science', 'Biology', 5, false),
      ($1, 'Chemistry Elements', 'Common chemical elements', 'Science', 'Chemistry', 5, false),
      ($1, 'Spanish Basics', 'Common Spanish words', 'Languages', 'Spanish', 5, false),
      ($1, 'Historical Figures', 'Important people in history', 'History', 'General', 5, false),
      ($1, 'Literary Terms', 'Literary devices and terms', 'English', 'Literature', 5, false),
      ($1, 'Physics Formulas', 'Key physics equations', 'Science', 'Physics', 5, false),
      ($1, 'Grammar Rules', 'English grammar essentials', 'English', 'Grammar', 5, false),
      ($1, 'Geography Capitals', 'World capitals', 'Geography', 'General', 5, false),
      ($1, 'Computer Terms', 'Programming vocabulary', 'Technology', 'Programming', 5, false),
      ($1, 'Art Movements', 'Major art movements', 'Arts', 'Art History', 5, false),
      ($1, 'Music Terminology', 'Musical terms and definitions', 'Arts', 'Music', 5, false),
      ($1, 'Math Symbols', 'Mathematical notation', 'Mathematics', 'General', 5, false),
      ($1, 'Science Units', 'Units of measurement', 'Science', 'General', 5, false),
      ($1, 'French Basics', 'Common French words', 'Languages', 'French', 5, false),
      ($1, 'SAT Vocabulary', 'High-frequency SAT words', 'English', 'Vocabulary', 5, false)
      RETURNING id
    `, [studentId]);
    console.log('Flashcard decks seeded (16 decks)');
    const deckIds = decks.rows.map(r => r.id);

    // Seed flashcards for first 4 decks
    await client.query(`
      INSERT INTO flashcards (deck_id, front_text, back_text) VALUES
      ($1, 'Variable', 'A symbol representing an unknown value'),
      ($1, 'Coefficient', 'A number multiplied by a variable'),
      ($1, 'Expression', 'A mathematical phrase with numbers and variables'),
      ($1, 'Equation', 'A statement that two expressions are equal'),
      ($1, 'Function', 'A relation where each input has exactly one output')
    `, [deckIds[0]]);

    await client.query(`
      INSERT INTO flashcards (deck_id, front_text, back_text) VALUES
      ($1, 'Nucleus', 'Control center containing DNA'),
      ($1, 'Mitochondria', 'Powerhouse of the cell, produces ATP'),
      ($1, 'Ribosome', 'Site of protein synthesis'),
      ($1, 'Cell Membrane', 'Controls what enters and exits the cell'),
      ($1, 'Chloroplast', 'Site of photosynthesis in plant cells')
    `, [deckIds[1]]);

    await client.query(`
      INSERT INTO flashcards (deck_id, front_text, back_text) VALUES
      ($1, 'H - Hydrogen', 'Lightest element, atomic number 1'),
      ($1, 'O - Oxygen', 'Essential for respiration, atomic number 8'),
      ($1, 'C - Carbon', 'Basis of organic chemistry, atomic number 6'),
      ($1, 'Na - Sodium', 'Reactive metal, atomic number 11'),
      ($1, 'Fe - Iron', 'Used in hemoglobin, atomic number 26')
    `, [deckIds[2]]);

    await client.query(`
      INSERT INTO flashcards (deck_id, front_text, back_text) VALUES
      ($1, 'Hola', 'Hello'),
      ($1, 'Gracias', 'Thank you'),
      ($1, 'Por favor', 'Please'),
      ($1, 'Buenos dias', 'Good morning'),
      ($1, 'Adios', 'Goodbye')
    `, [deckIds[3]]);
    console.log('Flashcards seeded (20 cards across 4 decks)');

    // Seed Video Lessons (16 items)
    await client.query(`
      INSERT INTO video_lessons (title, description, subject, topic, video_url, thumbnail_url, duration_minutes, instructor) VALUES
      ('Introduction to Algebra', 'Learn the basics of algebraic expressions', 'Mathematics', 'Algebra', 'https://www.youtube.com/watch?v=NybHckSEQBI', 'https://img.youtube.com/vi/NybHckSEQBI/hqdefault.jpg', 15, 'Khan Academy'),
      ('Cell Biology - The Cell', 'Understanding the building blocks of life', 'Science', 'Biology', 'https://www.youtube.com/watch?v=URUJD5NEXC8', 'https://img.youtube.com/vi/URUJD5NEXC8/hqdefault.jpg', 8, 'Amoeba Sisters'),
      ('Shakespeare Introduction', 'An introduction to the Bard', 'English', 'Literature', 'https://www.youtube.com/watch?v=YqXAifCKLAo', 'https://img.youtube.com/vi/YqXAifCKLAo/hqdefault.jpg', 12, 'Crash Course'),
      ('World War I Summary', 'The causes and effects of WWI', 'History', 'Modern History', 'https://www.youtube.com/watch?v=dHSQAEam2yc', 'https://img.youtube.com/vi/dHSQAEam2yc/hqdefault.jpg', 10, 'Crash Course'),
      ('The Periodic Table', 'Atoms and elements explained', 'Science', 'Chemistry', 'https://www.youtube.com/watch?v=0RRVV4Diomg', 'https://img.youtube.com/vi/0RRVV4Diomg/hqdefault.jpg', 12, 'Crash Course'),
      ('Newtons Laws of Motion', 'The three laws of motion', 'Science', 'Physics', 'https://www.youtube.com/watch?v=kKKM8Y-u7ds', 'https://img.youtube.com/vi/kKKM8Y-u7ds/hqdefault.jpg', 11, 'Crash Course'),
      ('How to Write an Essay', 'Academic writing tips', 'English', 'Writing', 'https://www.youtube.com/watch?v=DOJ1sG6bJCU', 'https://img.youtube.com/vi/DOJ1sG6bJCU/hqdefault.jpg', 5, 'TED-Ed'),
      ('Spanish for Beginners', 'Start your Spanish journey', 'Languages', 'Spanish', 'https://www.youtube.com/watch?v=DAp_v7EH9AA', 'https://img.youtube.com/vi/DAp_v7EH9AA/hqdefault.jpg', 35, 'SpanishPod101'),
      ('Introduction to Geometry', 'Points, lines, and angles', 'Mathematics', 'Geometry', 'https://www.youtube.com/watch?v=302eJ3TzJQU', 'https://img.youtube.com/vi/302eJ3TzJQU/hqdefault.jpg', 10, 'Khan Academy'),
      ('Ecology Explained', 'Understanding ecosystems', 'Science', 'Environmental', 'https://www.youtube.com/watch?v=izRvPaAWgyw', 'https://img.youtube.com/vi/izRvPaAWgyw/hqdefault.jpg', 10, 'Crash Course'),
      ('Statistics Basics', 'Mean, Median, Mode', 'Mathematics', 'Statistics', 'https://www.youtube.com/watch?v=uhxtUt_-GyM', 'https://img.youtube.com/vi/uhxtUt_-GyM/hqdefault.jpg', 10, 'Khan Academy'),
      ('The American Revolution', 'How America gained independence', 'History', 'American History', 'https://www.youtube.com/watch?v=HlNW7dGJAfc', 'https://img.youtube.com/vi/HlNW7dGJAfc/hqdefault.jpg', 12, 'Crash Course'),
      ('Essence of Calculus', 'Visual intro to calculus', 'Mathematics', 'Calculus', 'https://www.youtube.com/watch?v=WUvTyaaNkzM', 'https://img.youtube.com/vi/WUvTyaaNkzM/hqdefault.jpg', 17, '3Blue1Brown'),
      ('Python Basics', 'First steps in programming', 'Technology', 'Programming', 'https://www.youtube.com/watch?v=kqtD5dpn9C8', 'https://img.youtube.com/vi/kqtD5dpn9C8/hqdefault.jpg', 60, 'freeCodeCamp'),
      ('History of Art', 'Major art movements', 'Arts', 'Art History', 'https://www.youtube.com/watch?v=_6WJ7aOV8bY', 'https://img.youtube.com/vi/_6WJ7aOV8bY/hqdefault.jpg', 20, 'Crash Course'),
      ('Music Theory Basics', 'Notes, scales, and chords', 'Arts', 'Music', 'https://www.youtube.com/watch?v=rgaTLrZGlUU', 'https://img.youtube.com/vi/rgaTLrZGlUU/hqdefault.jpg', 16, 'Andrew Huang')
    `);
    console.log('Video lessons seeded (16 items)');

    // Seed Vocabulary Words (16 items)
    await client.query(`
      INSERT INTO vocabulary_words (word, definition, part_of_speech, example_sentence, pronunciation, difficulty_level, subject) VALUES
      ('Ephemeral', 'Lasting for a very short time', 'adjective', 'The ephemeral beauty of cherry blossoms draws visitors.', 'ih-FEM-er-uhl', 'Advanced', 'English'),
      ('Ubiquitous', 'Present everywhere', 'adjective', 'Smartphones have become ubiquitous.', 'yoo-BIK-wi-tuhs', 'Advanced', 'English'),
      ('Hypothesis', 'A proposed explanation', 'noun', 'The scientist tested her hypothesis.', 'hahy-POTH-uh-sis', 'Intermediate', 'Science'),
      ('Photosynthesis', 'Process plants use to convert light to energy', 'noun', 'Photosynthesis occurs in leaves.', 'foh-toh-SIN-thuh-sis', 'Intermediate', 'Science'),
      ('Benevolent', 'Well meaning and kindly', 'adjective', 'The benevolent donor gave millions.', 'buh-NEV-uh-luhnt', 'Intermediate', 'English'),
      ('Algorithm', 'Step-by-step procedure', 'noun', 'The sorting algorithm organized data.', 'AL-guh-rith-uhm', 'Intermediate', 'Technology'),
      ('Metaphor', 'Implied comparison', 'noun', 'Life is a journey is a metaphor.', 'MET-uh-for', 'Beginner', 'English'),
      ('Ecosystem', 'Community of organisms', 'noun', 'The coral reef is an ecosystem.', 'EE-koh-sis-tuhm', 'Beginner', 'Science'),
      ('Ambiguous', 'Open to interpretation', 'adjective', 'The statement was ambiguous.', 'am-BIG-yoo-uhs', 'Intermediate', 'English'),
      ('Derivative', 'Rate of change in calculus', 'noun', 'The derivative of x squared is 2x.', 'dih-RIV-uh-tiv', 'Advanced', 'Mathematics'),
      ('Catalyst', 'Speeds up a reaction', 'noun', 'Enzymes act as catalysts.', 'KAT-l-ist', 'Intermediate', 'Science'),
      ('Eloquent', 'Fluent or persuasive', 'adjective', 'The speech was eloquent.', 'EL-uh-kwuhnt', 'Intermediate', 'English'),
      ('Paradox', 'Contradictory but possibly true', 'noun', 'The grandfather paradox is famous.', 'PAR-uh-doks', 'Intermediate', 'English'),
      ('Synthesis', 'Combination of parts', 'noun', 'The synthesis led to a breakthrough.', 'SIN-thuh-sis', 'Intermediate', 'Science'),
      ('Pragmatic', 'Sensible and realistic', 'adjective', 'She took a pragmatic approach.', 'prag-MAT-ik', 'Advanced', 'English'),
      ('Empirical', 'Based on observation', 'adjective', 'The evidence was empirical.', 'em-PIR-i-kuhl', 'Advanced', 'Science')
    `);
    console.log('Vocabulary words seeded (16 items)');

    // Seed Writing Prompts (16 items)
    await client.query(`
      INSERT INTO writing_prompts (title, prompt_text, genre, difficulty_level, word_count_target) VALUES
      ('A Day in the Future', 'Imagine waking up 100 years in the future. Describe your day.', 'Creative Fiction', 'Beginner', 500),
      ('Climate Change Essay', 'Discuss causes and effects of climate change.', 'Argumentative', 'Intermediate', 750),
      ('My Greatest Challenge', 'Describe a challenge you overcame.', 'Personal Narrative', 'Beginner', 500),
      ('Technology Impact', 'How has technology changed communication?', 'Analytical', 'Intermediate', 800),
      ('The Mystery Box', 'You find a mysterious box. What happens?', 'Creative Fiction', 'Beginner', 600),
      ('School Start Times', 'Should school start later? Argue your position.', 'Persuasive', 'Intermediate', 700),
      ('Letter to Future Self', 'Write to yourself 10 years from now.', 'Personal Narrative', 'Beginner', 400),
      ('Social Media Analysis', 'Analyze social media role in society.', 'Analytical', 'Advanced', 1000),
      ('The Hero Journey', 'Create a story following the hero journey.', 'Creative Fiction', 'Intermediate', 800),
      ('Compare Two Books', 'Compare two books you have read.', 'Comparative', 'Intermediate', 600),
      ('Invention Proposal', 'Describe an invention to improve daily life.', 'Expository', 'Intermediate', 700),
      ('Poetry Analysis', 'Analyze themes in a poem.', 'Analytical', 'Advanced', 600),
      ('Last Day on Earth', 'How would you spend your last day?', 'Creative Fiction', 'Beginner', 500),
      ('Education Reform', 'What changes would you make to education?', 'Argumentative', 'Advanced', 900),
      ('Cultural Traditions', 'Describe an important cultural tradition.', 'Personal Narrative', 'Beginner', 500),
      ('Artificial Intelligence', 'Discuss ethical implications of AI.', 'Argumentative', 'Advanced', 1000)
    `);
    console.log('Writing prompts seeded (16 items)');

    // Seed Math Problems (16 items)
    await client.query(`
      INSERT INTO math_problems (problem_text, problem_type, difficulty_level, solution_steps, final_answer, topic) VALUES
      ('Solve: 2x + 5 = 13', 'Linear Equation', 'Beginner', '["Subtract 5: 2x = 8", "Divide by 2: x = 4"]', 'x = 4', 'Algebra'),
      ('Factor: x squared minus 9', 'Factoring', 'Beginner', '["Difference of squares", "(x+3)(x-3)"]', '(x+3)(x-3)', 'Algebra'),
      ('Find derivative: f(x) = 3x squared + 2x - 5', 'Derivative', 'Intermediate', '["Apply power rule", "6x + 2"]', '6x + 2', 'Calculus'),
      ('Calculate: 15 percent of 80', 'Percentage', 'Beginner', '["0.15 times 80 = 12"]', '12', 'Arithmetic'),
      ('Solve: x squared minus 5x plus 6 = 0', 'Quadratic', 'Intermediate', '["Factor: (x-2)(x-3) = 0"]', 'x = 2 or x = 3', 'Algebra'),
      ('Area of circle with radius 5', 'Geometry', 'Beginner', '["A = pi times r squared"]', '25pi', 'Geometry'),
      ('Integrate: integral of 2x dx', 'Integration', 'Intermediate', '["Power rule: x squared + C"]', 'x squared + C', 'Calculus'),
      ('Simplify: (3x squared y)(4xy cubed)', 'Simplification', 'Beginner', '["Multiply coefficients and add exponents"]', '12x cubed y fourth', 'Algebra'),
      ('Find mean of: 4, 8, 6, 5, 9', 'Statistics', 'Beginner', '["Sum: 32, Count: 5, Mean: 6.4"]', '6.4', 'Statistics'),
      ('Solve: 3(x - 2) = 2(x + 1)', 'Linear Equation', 'Intermediate', '["Distribute and solve"]', 'x = 8', 'Algebra'),
      ('Find sin(30 degrees)', 'Trigonometry', 'Beginner', '["Special angle value"]', '0.5', 'Trigonometry'),
      ('Compound interest: P=1000, r=5%, t=2', 'Finance', 'Intermediate', '["A = P(1+r)^t"]', '$1,102.50', 'Finance'),
      ('Slope between (2,3) and (6,11)', 'Slope', 'Beginner', '["m = (y2-y1)/(x2-x1)"]', 'm = 2', 'Algebra'),
      ('Solve: |x - 3| = 7', 'Absolute Value', 'Intermediate', '["Two cases: x-3=7 or x-3=-7"]', 'x = 10 or x = -4', 'Algebra'),
      ('Probability of rolling 6 on die', 'Probability', 'Beginner', '["1 favorable out of 6"]', '1/6', 'Probability'),
      ('Evaluate: log base 2 of 8', 'Logarithm', 'Intermediate', '["2 to what power = 8"]', '3', 'Algebra')
    `);
    console.log('Math problems seeded (16 items)');

    // Seed Achievements (16 items)
    await client.query(`
      INSERT INTO achievements (title, description, icon, points, category, criteria) VALUES
      ('First Steps', 'Complete your first lesson', 'star', 10, 'Learning', '{"lessons_completed": 1}'),
      ('Quiz Master', 'Score 100% on any quiz', 'trophy', 50, 'Quizzes', '{"perfect_score": true}'),
      ('Bookworm', 'Complete 10 study materials', 'book', 30, 'Learning', '{"materials_completed": 10}'),
      ('Consistent Learner', 'Study for 7 days in a row', 'calendar', 40, 'Dedication', '{"streak_days": 7}'),
      ('Math Whiz', 'Solve 25 math problems', 'calculator', 35, 'Mathematics', '{"problems_solved": 25}'),
      ('Wordsmith', 'Learn 50 vocabulary words', 'abc', 30, 'Vocabulary', '{"words_learned": 50}'),
      ('Essay Expert', 'Get an A grade on essay', 'file-text', 45, 'Writing', '{"essay_grade_a": true}'),
      ('Quick Learner', 'Complete lesson in under 10 min', 'zap', 20, 'Learning', '{"fast_completion": true}'),
      ('Night Owl', 'Study after 10 PM', 'moon', 15, 'Dedication', '{"late_study": true}'),
      ('Early Bird', 'Study before 7 AM', 'sun', 15, 'Dedication', '{"early_study": true}'),
      ('Goal Getter', 'Complete 5 goals', 'target', 40, 'Goals', '{"goals_completed": 5}'),
      ('Video Scholar', 'Watch 10 video lessons', 'video', 25, 'Learning', '{"videos_watched": 10}'),
      ('Flash Master', 'Review 100 flashcards', 'layers', 30, 'Learning', '{"flashcards_reviewed": 100}'),
      ('Chat Champion', 'Have 10 AI conversations', 'message-circle', 20, 'AI Tutor', '{"chat_sessions": 10}'),
      ('Perfect Week', 'Study every day for a week', 'award', 50, 'Dedication', '{"perfect_week": true}'),
      ('Subject Expert', 'Complete all materials in one subject', 'graduation-cap', 60, 'Learning', '{"subject_complete": true}')
    `);
    console.log('Achievements seeded (16 items)');

    // Seed goals for demo user
    await client.query(`
      INSERT INTO goals (user_id, title, description, target_date, category, status, progress_percentage) VALUES
      ($1, 'Master Algebra', 'Complete algebra path with 90% scores', '2025-06-30', 'Learning', 'in_progress', 45),
      ($1, 'Read 10 Books', 'Read 10 literature books', '2025-05-31', 'Reading', 'in_progress', 30),
      ($1, 'Improve Essay Writing', 'Get consistent A grades', '2025-04-30', 'Writing', 'in_progress', 60),
      ($1, 'Learn 200 Spanish Words', 'Build vocabulary', '2025-07-31', 'Languages', 'in_progress', 25),
      ($1, 'Complete Physics Course', 'Finish all physics modules', '2025-08-31', 'Learning', 'in_progress', 15),
      ($1, 'Ace Statistics', 'Get above 90% on quizzes', '2025-09-30', 'Learning', 'in_progress', 10),
      ($1, 'Write 5 Essays', 'Complete 5 graded essays', '2025-06-15', 'Writing', 'in_progress', 20),
      ($1, 'Study 100 Hours', 'Log 100 hours total', '2025-12-31', 'Dedication', 'in_progress', 35),
      ($1, 'Master Flashcards', 'Review all decks at 90% confidence', '2025-05-15', 'Learning', 'in_progress', 40),
      ($1, 'Earn 10 Achievements', 'Unlock 10 badges', '2025-07-01', 'Goals', 'in_progress', 50),
      ($1, 'Complete Geometry', 'Finish geometry deep dive', '2025-04-15', 'Learning', 'in_progress', 55),
      ($1, 'Watch All Videos', 'Complete all math videos', '2025-08-01', 'Learning', 'in_progress', 20),
      ($1, 'Practice Daily', 'Solve 1 problem daily for 30 days', '2025-03-30', 'Dedication', 'in_progress', 70),
      ($1, 'SAT Prep', 'Score above 1400', '2025-10-15', 'Testing', 'in_progress', 15),
      ($1, 'Learn French Basics', 'Complete French flashcards', '2025-11-30', 'Languages', 'in_progress', 5)
    `, [studentId]);
    console.log('Goals seeded (15 items)');

    // ==================== NEW AI FEATURE SEED DATA ====================

    // Seed Learning Style Questions (16 items)
    await client.query(`
      INSERT INTO learning_style_questions (question_text, options, style_weights, category) VALUES
      ('When learning something new, I prefer to:', '["Watch a video or demonstration", "Listen to an explanation", "Read instructions or a manual", "Try it hands-on myself"]', '{"visual": [1,0,0,0], "auditory": [0,1,0,0], "reading_writing": [0,0,1,0], "kinesthetic": [0,0,0,1]}', 'learning_preference'),
      ('In class, I remember best when:', '["I see diagrams and charts", "The teacher explains verbally", "I take detailed notes", "We do activities or experiments"]', '{"visual": [1,0,0,0], "auditory": [0,1,0,0], "reading_writing": [0,0,1,0], "kinesthetic": [0,0,0,1]}', 'learning_preference'),
      ('When giving directions, I would:', '["Draw a map", "Give verbal instructions", "Write out the steps", "Walk with them to show the way"]', '{"visual": [1,0,0,0], "auditory": [0,1,0,0], "reading_writing": [0,0,1,0], "kinesthetic": [0,0,0,1]}', 'communication'),
      ('I find it easiest to study with:', '["Color-coded notes and highlighters", "Audio recordings or podcasts", "Textbooks and written materials", "Practice problems and simulations"]', '{"visual": [1,0,0,0], "auditory": [0,1,0,0], "reading_writing": [0,0,1,0], "kinesthetic": [0,0,0,1]}', 'study_habits'),
      ('During a lecture, I often:', '["Doodle or create diagrams", "Focus intently on listening", "Write extensive notes", "Fidget or want to move around"]', '{"visual": [1,0,0,0], "auditory": [0,1,0,0], "reading_writing": [0,0,1,0], "kinesthetic": [0,0,0,1]}', 'behavior'),
      ('To remember a phone number, I would:', '["Visualize the numbers in my head", "Repeat it out loud several times", "Write it down immediately", "Type it into my phone right away"]', '{"visual": [1,0,0,0], "auditory": [0,1,0,0], "reading_writing": [0,0,1,0], "kinesthetic": [0,0,0,1]}', 'memory'),
      ('When assembling furniture, I prefer:', '["Looking at the picture diagrams", "Having someone explain each step", "Reading the written instructions", "Figuring it out by trial and error"]', '{"visual": [1,0,0,0], "auditory": [0,1,0,0], "reading_writing": [0,0,1,0], "kinesthetic": [0,0,0,1]}', 'problem_solving'),
      ('I enjoy hobbies that involve:', '["Art, photography, or design", "Music, podcasts, or discussions", "Reading, writing, or puzzles", "Sports, crafts, or building things"]', '{"visual": [1,0,0,0], "auditory": [0,1,0,0], "reading_writing": [0,0,1,0], "kinesthetic": [0,0,0,1]}', 'interests'),
      ('When reading for pleasure, I:', '["Visualize scenes vividly", "Prefer audiobooks", "Enjoy physical books or e-readers", "Act out or imagine doing activities in the story"]', '{"visual": [1,0,0,0], "auditory": [0,1,0,0], "reading_writing": [0,0,1,0], "kinesthetic": [0,0,0,1]}', 'reading_style'),
      ('In group projects, I usually:', '["Create visual presentations", "Lead discussions", "Write reports and documentation", "Build prototypes or handle logistics"]', '{"visual": [1,0,0,0], "auditory": [0,1,0,0], "reading_writing": [0,0,1,0], "kinesthetic": [0,0,0,1]}', 'collaboration'),
      ('I get distracted by:', '["Messy or cluttered environments", "Sounds and conversations nearby", "Poorly written content", "Being stuck in one position too long"]', '{"visual": [1,0,0,0], "auditory": [0,1,0,0], "reading_writing": [0,0,1,0], "kinesthetic": [0,0,0,1]}', 'distractions'),
      ('To learn a new language, I would:', '["Watch foreign films with subtitles", "Listen to language learning podcasts", "Study grammar books and flashcards", "Travel and practice speaking"]', '{"visual": [1,0,0,0], "auditory": [0,1,0,0], "reading_writing": [0,0,1,0], "kinesthetic": [0,0,0,1]}', 'language_learning'),
      ('When explaining something to others, I:', '["Use diagrams and pictures", "Talk through it verbally", "Write it out step by step", "Demonstrate by doing it"]', '{"visual": [1,0,0,0], "auditory": [0,1,0,0], "reading_writing": [0,0,1,0], "kinesthetic": [0,0,0,1]}', 'teaching'),
      ('I remember peoples names best when:', '["I associate their face with the name", "I hear the name spoken repeatedly", "I see the name written down", "I shake hands while being introduced"]', '{"visual": [1,0,0,0], "auditory": [0,1,0,0], "reading_writing": [0,0,1,0], "kinesthetic": [0,0,0,1]}', 'memory'),
      ('During problem-solving, I:', '["Draw diagrams or flowcharts", "Talk through the problem aloud", "Write out possible solutions", "Build models or prototypes"]', '{"visual": [1,0,0,0], "auditory": [0,1,0,0], "reading_writing": [0,0,1,0], "kinesthetic": [0,0,0,1]}', 'problem_solving'),
      ('My ideal study environment has:', '["Good lighting and organized visuals", "Quiet space or background music", "Comfortable place to read and write", "Space to move around and stand"]', '{"visual": [1,0,0,0], "auditory": [0,1,0,0], "reading_writing": [0,0,1,0], "kinesthetic": [0,0,0,1]}', 'environment')
    `);
    console.log('Learning style questions seeded (16 items)');

    // Seed Historical Events (16 items)
    await client.query(`
      INSERT INTO historical_events (title, description, event_date, era, region, key_figures, causes, effects, related_events, image_url) VALUES
      ('American Revolution', 'The war for American independence from Britain', '1775-1783', 'Modern Era', 'North America', '["George Washington", "Thomas Jefferson", "Benjamin Franklin"]', '["Taxation without representation", "British colonial policies"]', '["Birth of the United States", "Spread of democratic ideals"]', '["French Revolution", "Declaration of Independence"]', null),
      ('French Revolution', 'Overthrow of French monarchy and establishment of republic', '1789-1799', 'Modern Era', 'Europe', '["Napoleon Bonaparte", "Robespierre", "Louis XVI"]', '["Financial crisis", "Social inequality", "Enlightenment ideas"]', '["End of absolute monarchy", "Rise of Napoleon"]', '["American Revolution", "Napoleonic Wars"]', null),
      ('World War I', 'The Great War that reshaped Europe', '1914-1918', 'Modern Era', 'Global', '["Archduke Franz Ferdinand", "Woodrow Wilson", "Kaiser Wilhelm II"]', '["Assassination of Franz Ferdinand", "Nationalism", "Alliance systems"]', '["Fall of empires", "Treaty of Versailles", "Seeds of WWII"]', '["World War II", "Russian Revolution"]', null),
      ('World War II', 'The deadliest conflict in human history', '1939-1945', 'Modern Era', 'Global', '["Adolf Hitler", "Winston Churchill", "Franklin D. Roosevelt"]', '["Treaty of Versailles", "Rise of fascism", "German expansion"]', '["United Nations formed", "Cold War begins", "Decolonization"]', '["World War I", "Cold War"]', null),
      ('Renaissance', 'Period of cultural and artistic rebirth in Europe', '1400-1600', 'Renaissance', 'Europe', '["Leonardo da Vinci", "Michelangelo", "Galileo"]', '["Fall of Constantinople", "Rise of wealthy merchant class"]', '["Scientific revolution", "Protestant Reformation"]', '["Protestant Reformation", "Age of Exploration"]', null),
      ('Industrial Revolution', 'Transition to new manufacturing processes', '1760-1840', 'Modern Era', 'Europe', '["James Watt", "Eli Whitney", "George Stephenson"]', '["Agricultural improvements", "New inventions"]', '["Urbanization", "Rise of capitalism", "Labor movements"]', '["American Revolution", "French Revolution"]', null),
      ('Fall of Rome', 'End of the Western Roman Empire', '476 CE', 'Ancient', 'Europe', '["Romulus Augustulus", "Odoacer"]', '["Economic decline", "Barbarian invasions", "Political instability"]', '["Dark Ages begin", "Rise of feudalism"]', '["Byzantine Empire", "Medieval period"]', null),
      ('Moon Landing', 'First humans walk on the Moon', 'July 20, 1969', 'Modern Era', 'Space', '["Neil Armstrong", "Buzz Aldrin", "Michael Collins"]', '["Space Race", "Cold War competition"]', '["Inspired space exploration", "Technological advances"]', '["Cold War", "Space Race"]', null),
      ('Civil Rights Movement', 'Struggle for African American equality', '1954-1968', 'Modern Era', 'North America', '["Martin Luther King Jr.", "Rosa Parks", "Malcolm X"]', '["Segregation laws", "Racial discrimination"]', '["Civil Rights Act", "Voting Rights Act"]', '["American Civil War", "Womens Rights Movement"]', null),
      ('Ancient Egypt', 'One of the oldest civilizations in history', '3100-30 BCE', 'Ancient', 'Africa', '["Cleopatra", "Tutankhamun", "Ramesses II"]', '["Nile River", "Agricultural surplus"]', '["Pyramids", "Hieroglyphics", "Advanced medicine"]', '["Roman Empire", "Greek civilization"]', null),
      ('Protestant Reformation', 'Religious reform movement against Catholic Church', '1517-1648', 'Renaissance', 'Europe', '["Martin Luther", "John Calvin", "Henry VIII"]', '["Church corruption", "Sale of indulgences"]', '["Split in Christianity", "Religious wars"]', '["Renaissance", "Thirty Years War"]', null),
      ('Russian Revolution', 'Bolshevik overthrow of Russian government', '1917', 'Modern Era', 'Europe', '["Vladimir Lenin", "Tsar Nicholas II", "Leon Trotsky"]', '["WWI failures", "Economic hardship", "Political repression"]', '["Soviet Union formed", "Communist ideology spreads"]', '["World War I", "Cold War"]', null),
      ('Age of Exploration', 'European exploration of the world', '1400-1600', 'Renaissance', 'Global', '["Christopher Columbus", "Vasco da Gama", "Ferdinand Magellan"]', '["Desire for trade routes", "Technological advances"]', '["Colonization", "Columbian Exchange"]', '["Renaissance", "Colonial era"]', null),
      ('Cold War', 'Political tension between USA and USSR', '1947-1991', 'Modern Era', 'Global', '["John F. Kennedy", "Nikita Khrushchev", "Ronald Reagan"]', '["Ideological differences", "Post-WWII power vacuum"]', '["Nuclear arms race", "Proxy wars", "Space Race"]', '["World War II", "Fall of Berlin Wall"]', null),
      ('Ancient Greece', 'Birthplace of democracy and philosophy', '800-31 BCE', 'Ancient', 'Europe', '["Socrates", "Plato", "Alexander the Great"]', '["Geographic factors", "Cultural exchange"]', '["Democracy", "Philosophy", "Olympic Games"]', '["Roman Empire", "Persian Wars"]', null),
      ('Chinese Revolution', 'Communist revolution in China', '1949', 'Modern Era', 'Asia', '["Mao Zedong", "Chiang Kai-shek"]', '["Civil war", "Nationalist failures", "Peasant support"]', '["Peoples Republic of China", "Cold War dynamics"]', '["Cold War", "Korean War"]', null)
    `);
    console.log('Historical events seeded (16 items)');

    // Seed Science Experiments (16 items)
    await client.query(`
      INSERT INTO science_experiments (title, description, subject, topic, difficulty_level, materials, procedure, expected_results, safety_notes, virtual_simulation_data) VALUES
      ('Vinegar Volcano', 'Classic baking soda and vinegar reaction', 'Chemistry', 'Chemical Reactions', 'Beginner', '["Baking soda", "Vinegar", "Food coloring", "Dish soap", "Container"]', '["Add baking soda to container", "Add dish soap and food coloring", "Pour in vinegar", "Observe the reaction"]', 'Fizzing eruption due to CO2 production from acid-base reaction', 'Non-toxic but messy. Conduct on protected surface.', '{"reaction_type": "acid_base", "co2_production": true}'),
      ('Plant Growth Light Experiment', 'Study how light affects plant growth', 'Biology', 'Photosynthesis', 'Beginner', '["3 identical plants", "Light sources", "Ruler", "Journal"]', '["Place plants in different light conditions", "Water equally", "Measure growth daily", "Record observations"]', 'Plants with more light grow taller and greener', 'None - safe for all ages', '{"variables": ["light_intensity", "growth_rate"]}'),
      ('Density Tower', 'Create layers of liquids with different densities', 'Physics', 'Density', 'Beginner', '["Honey", "Corn syrup", "Dish soap", "Water", "Vegetable oil", "Rubbing alcohol"]', '["Pour liquids slowly into tall container", "Start with densest", "Add small objects to float at different levels"]', 'Distinct layers form based on density differences', 'Rubbing alcohol is flammable. Keep away from heat.', '{"layers": 6, "density_order": ["honey", "corn_syrup", "soap", "water", "oil", "alcohol"]}'),
      ('Egg in Vinegar', 'Observe osmosis and acid-base reactions', 'Biology', 'Cell Biology', 'Beginner', '["Raw egg", "White vinegar", "Clear jar", "Water", "Corn syrup"]', '["Submerge egg in vinegar for 24-48 hours", "Observe shell dissolving", "Transfer to water/corn syrup to see osmosis"]', 'Shell dissolves, egg becomes rubbery. Size changes in different solutions.', 'Handle raw eggs carefully. Wash hands after.', '{"osmosis": true, "acid_reaction": true}'),
      ('Static Electricity', 'Demonstrate static charge with balloons', 'Physics', 'Electricity', 'Beginner', '["Balloons", "Wool cloth", "Small paper pieces", "Wall"]', '["Inflate balloon", "Rub with wool vigorously", "Hold near paper pieces", "Touch to wall"]', 'Balloon attracts paper and sticks to wall due to static charge', 'Balloons are choking hazard for young children', '{"charge_type": "static", "demonstrates": ["attraction", "charge_transfer"]}'),
      ('Crystal Growing', 'Grow crystals from supersaturated solution', 'Chemistry', 'Solutions', 'Intermediate', '["Sugar or salt", "Hot water", "String", "Pencil", "Jar"]', '["Dissolve maximum sugar/salt in hot water", "Suspend string in solution", "Wait several days", "Observe crystal formation"]', 'Crystals form on string as water evaporates', 'Use caution with hot water', '{"crystal_type": "sugar_or_salt", "days_required": 7}'),
      ('DNA Extraction', 'Extract DNA from fruits', 'Biology', 'Genetics', 'Intermediate', '["Strawberries", "Dish soap", "Salt", "Rubbing alcohol", "Coffee filter"]', '["Mash strawberries", "Mix with soap and salt solution", "Filter", "Add cold alcohol", "Observe DNA strands"]', 'White stringy DNA precipitates in alcohol layer', 'Rubbing alcohol is toxic. Do not ingest.', '{"dna_visible": true, "best_fruits": ["strawberry", "banana"]}'),
      ('Pendulum Period', 'Investigate factors affecting pendulum swing', 'Physics', 'Mechanics', 'Intermediate', '["String", "Weights", "Stopwatch", "Protractor", "Stand"]', '["Create pendulums of different lengths", "Time 10 swings", "Change weight and angle", "Compare results"]', 'Period depends only on length, not mass or angle (for small angles)', 'Secure pendulum properly to prevent falling', '{"formula": "T = 2pi*sqrt(L/g)", "variables": ["length", "angle", "mass"]}'),
      ('Acid-Base Indicators', 'Test pH with natural indicators', 'Chemistry', 'Acids and Bases', 'Intermediate', '["Red cabbage", "Various household liquids", "Cups", "Strainer"]', '["Boil cabbage to extract indicator", "Add indicator to test liquids", "Observe color changes", "Create pH scale"]', 'Different colors indicate different pH levels', 'Some test substances may be caustic. Wear gloves.', '{"ph_scale": true, "colors": {"acidic": "red", "neutral": "purple", "basic": "green"}}'),
      ('Electromagnet', 'Build an electromagnet from wire and battery', 'Physics', 'Magnetism', 'Intermediate', '["Iron nail", "Copper wire", "D battery", "Paper clips"]', '["Wrap wire around nail many times", "Connect ends to battery", "Test magnetic strength with paper clips", "Vary coil turns"]', 'More coils create stronger magnetic field', 'Wire may get hot. Disconnect when not in use.', '{"coils_affect_strength": true, "temporary_magnet": true}'),
      ('Enzyme Action', 'Study enzyme activity with catalase', 'Biology', 'Biochemistry', 'Advanced', '["Potato or liver", "Hydrogen peroxide", "Test tubes", "Ice bath", "Hot water bath"]', '["Cut potato/liver into pieces", "Test at different temperatures", "Add hydrogen peroxide", "Measure bubbling rate"]', 'Enzyme activity varies with temperature, optimal around 37C', 'Hydrogen peroxide can irritate skin. Wear gloves.', '{"enzyme": "catalase", "optimal_temp": 37, "substrate": "h2o2"}'),
      ('Refraction Experiment', 'Study light bending through different media', 'Physics', 'Optics', 'Intermediate', '["Laser pointer", "Glass of water", "Protractor", "White paper"]', '["Shine laser through water at angles", "Measure incident and refracted angles", "Calculate refractive index", "Try different liquids"]', 'Light bends according to Snells Law', 'Never shine laser in eyes', '{"snells_law": true, "water_index": 1.33}'),
      ('Fermentation', 'Observe yeast fermentation', 'Biology', 'Microbiology', 'Intermediate', '["Yeast", "Sugar", "Warm water", "Balloon", "Bottle"]', '["Mix yeast and sugar in warm water", "Attach balloon to bottle", "Observe balloon inflation", "Test different sugar amounts"]', 'CO2 produced inflates balloon as yeast ferments sugar', 'Use warm, not hot water (kills yeast)', '{"produces": ["co2", "ethanol"], "optimal_temp": 35}'),
      ('Newtons Cradle Physics', 'Demonstrate conservation of momentum', 'Physics', 'Mechanics', 'Advanced', '["Metal balls", "String", "Frame", "Ruler"]', '["Construct cradle with suspended balls", "Release one ball from height", "Observe momentum transfer", "Try multiple balls"]', 'Energy and momentum conserved through collisions', 'Ensure frame is stable', '{"conservation": ["momentum", "energy"], "elastic_collision": true}'),
      ('Gel Electrophoresis', 'Separate molecules by size', 'Biology', 'Molecular Biology', 'Advanced', '["Agarose gel", "Buffer solution", "DNA samples", "Power supply", "Staining dye"]', '["Prepare gel", "Load samples", "Apply electric current", "Stain and visualize"]', 'DNA fragments separate by size, smaller moves faster', 'Handle electricity and chemicals with care', '{"separates_by": "size", "dna_charge": "negative"}'),
      ('Chemical Equilibrium', 'Demonstrate Le Chateliers principle', 'Chemistry', 'Equilibrium', 'Advanced', '["Cobalt chloride solution", "HCl", "Water", "Heat source", "Ice bath"]', '["Prepare cobalt chloride solution", "Add HCl to shift equilibrium", "Heat and cool", "Observe color changes"]', 'Color shifts indicate equilibrium position changes', 'HCl is corrosive. Use in ventilated area with gloves.', '{"principle": "le_chatelier", "color_indicator": true}')
    `);
    console.log('Science experiments seeded (16 items)');

    // Seed Homework Assignments for demo user (16 items)
    await client.query(`
      INSERT INTO homework_assignments (user_id, title, subject, description, due_date, status) VALUES
      ($1, 'Algebra Problem Set 1', 'Mathematics', 'Complete problems 1-20 on linear equations', '2025-02-15', 'pending'),
      ($1, 'Cell Biology Essay', 'Science', 'Write 500 words about mitochondria function', '2025-02-18', 'pending'),
      ($1, 'Shakespeare Analysis', 'English', 'Analyze Act 1 of Romeo and Juliet', '2025-02-20', 'pending'),
      ($1, 'WWI Timeline', 'History', 'Create timeline of major WWI events', '2025-02-22', 'in_progress'),
      ($1, 'Chemistry Lab Report', 'Science', 'Write up results from acid-base experiment', '2025-02-25', 'pending'),
      ($1, 'Geometry Proofs', 'Mathematics', 'Complete triangle congruence proofs', '2025-02-28', 'pending'),
      ($1, 'Spanish Vocabulary Quiz Prep', 'Languages', 'Study chapters 3-4 vocabulary', '2025-03-01', 'pending'),
      ($1, 'Physics Problem Set', 'Science', 'Solve Newtons law problems 1-15', '2025-03-05', 'pending'),
      ($1, 'Poetry Analysis', 'English', 'Analyze symbolism in The Road Not Taken', '2025-03-08', 'pending'),
      ($1, 'Statistics Homework', 'Mathematics', 'Calculate mean, median, mode for datasets', '2025-03-10', 'pending'),
      ($1, 'American Revolution Essay', 'History', 'Discuss causes of the American Revolution', '2025-03-12', 'pending'),
      ($1, 'Python Programming Assignment', 'Technology', 'Write a basic calculator program', '2025-03-15', 'pending'),
      ($1, 'Art History Presentation', 'Arts', 'Present on Impressionism movement', '2025-03-18', 'pending'),
      ($1, 'Environmental Science Report', 'Science', 'Research local ecosystem', '2025-03-20', 'pending'),
      ($1, 'Calculus Derivatives', 'Mathematics', 'Find derivatives of 20 functions', '2025-03-22', 'pending'),
      ($1, 'French Translation Exercise', 'Languages', 'Translate short story passage', '2025-03-25', 'pending')
    `, [studentId]);
    console.log('Homework assignments seeded (16 items)');

    // Seed Study Schedules for demo user
    await client.query(`
      INSERT INTO study_schedules (user_id, title, schedule_data, ai_optimized, optimization_notes, start_date, end_date) VALUES
      ($1, 'Weekly Study Plan', '{"monday": [{"subject": "Mathematics", "time": "16:00-17:30", "topic": "Algebra"}], "tuesday": [{"subject": "Science", "time": "16:00-17:00", "topic": "Biology"}], "wednesday": [{"subject": "English", "time": "16:00-17:30", "topic": "Literature"}], "thursday": [{"subject": "History", "time": "16:00-17:00", "topic": "WWI"}], "friday": [{"subject": "Mathematics", "time": "16:00-17:30", "topic": "Geometry"}]}', false, null, '2025-02-01', '2025-06-30')
    `, [studentId]);
    console.log('Study schedules seeded (1 item)');

    // Seed sample essays
    await client.query(`
      INSERT INTO essays (user_id, title, content, prompt, subject, word_count, status) VALUES
      ($1, 'The Impact of Technology', 'Technology has fundamentally transformed education in the 21st century. From online learning platforms to interactive whiteboards, digital tools have created new opportunities.', 'How has technology changed education?', 'English', 87, 'draft'),
      ($1, 'Climate Change Solutions', 'Climate change represents one of the greatest challenges facing humanity today. The evidence is clear: global temperatures are rising.', 'Discuss climate change causes and solutions.', 'Science', 82, 'draft')
    `, [studentId]);
    console.log('Sample essays seeded (2 items)');

    // Seed study sessions
    await client.query(`
      INSERT INTO study_sessions (user_id, subject, duration_minutes, activity_type, started_at, ended_at) VALUES
      ($1, 'Mathematics', 45, 'quiz', NOW() - interval '7 days', NOW() - interval '7 days' + interval '45 minutes'),
      ($1, 'Science', 30, 'reading', NOW() - interval '6 days', NOW() - interval '6 days' + interval '30 minutes'),
      ($1, 'English', 60, 'essay', NOW() - interval '5 days', NOW() - interval '5 days' + interval '60 minutes'),
      ($1, 'Mathematics', 25, 'practice', NOW() - interval '4 days', NOW() - interval '4 days' + interval '25 minutes'),
      ($1, 'History', 40, 'video', NOW() - interval '3 days', NOW() - interval '3 days' + interval '40 minutes'),
      ($1, 'Science', 35, 'flashcards', NOW() - interval '2 days', NOW() - interval '2 days' + interval '35 minutes'),
      ($1, 'Mathematics', 50, 'quiz', NOW() - interval '1 day', NOW() - interval '1 day' + interval '50 minutes'),
      ($1, 'English', 20, 'vocabulary', NOW(), NOW() + interval '20 minutes')
    `, [studentId]);
    console.log('Study sessions seeded (8 items)');

    // Seed performance analytics
    await client.query(`
      INSERT INTO performance_analytics (user_id, subject, metric_type, metric_value) VALUES
      ($1, 'Mathematics', 'quiz_score', 85),
      ($1, 'Mathematics', 'quiz_score', 72),
      ($1, 'Mathematics', 'quiz_score', 90),
      ($1, 'Science', 'quiz_score', 78),
      ($1, 'Science', 'quiz_score', 82),
      ($1, 'English', 'quiz_score', 88),
      ($1, 'English', 'essay_score', 75),
      ($1, 'History', 'quiz_score', 70),
      ($1, 'Mathematics', 'practice_accuracy', 80),
      ($1, 'Science', 'practice_accuracy', 75)
    `, [studentId]);
    console.log('Performance analytics seeded (10 items)');

    // Create sample chat sessions (15 sessions)
    const chatSessions = [];
    const chatTopics = [
      { title: 'Help with Algebra', subject: 'Mathematics', q: 'Can you help me understand quadratic equations?', a: 'Of course! A quadratic equation is a polynomial equation of degree 2. The standard form is ax squared + bx + c = 0.' },
      { title: 'Biology Questions', subject: 'Science', q: 'What is the difference between DNA and RNA?', a: 'DNA is double-stranded and contains deoxyribose sugar, while RNA is single-stranded and contains ribose sugar.' },
      { title: 'Essay Structure Help', subject: 'English', q: 'How do I write a strong thesis statement?', a: 'A strong thesis statement clearly states your main argument and gives the reader a roadmap for your essay.' },
      { title: 'History Discussion', subject: 'History', q: 'Why did the Roman Empire fall?', a: 'The fall of the Roman Empire was caused by multiple factors including economic troubles, military overspending, and barbarian invasions.' },
      { title: 'Chemistry Help', subject: 'Science', q: 'How do I balance chemical equations?', a: 'To balance equations, count atoms on each side and adjust coefficients until both sides are equal.' },
      { title: 'Physics Concepts', subject: 'Science', q: 'Can you explain gravity?', a: 'Gravity is a fundamental force that attracts objects with mass toward each other. On Earth, it accelerates objects at about 9.8 m/s squared.' },
      { title: 'Spanish Practice', subject: 'Languages', q: 'How do I conjugate regular -ar verbs?', a: 'For regular -ar verbs, remove the -ar ending and add: -o, -as, -a, -amos, -ais, -an for present tense.' },
      { title: 'Geometry Questions', subject: 'Mathematics', q: 'How do I find the area of a triangle?', a: 'The area of a triangle is calculated as A = (1/2) times base times height.' },
      { title: 'Literary Analysis', subject: 'English', q: 'What are common literary devices?', a: 'Common literary devices include metaphor, simile, personification, alliteration, and symbolism.' },
      { title: 'Calculus Intro', subject: 'Mathematics', q: 'What is a derivative?', a: 'A derivative measures the rate of change of a function. It tells you the slope of the tangent line at any point.' },
      { title: 'Environmental Science', subject: 'Science', q: 'What causes climate change?', a: 'Climate change is primarily caused by increased greenhouse gas emissions from burning fossil fuels and deforestation.' },
      { title: 'Statistics Help', subject: 'Mathematics', q: 'What is standard deviation?', a: 'Standard deviation measures the spread of data around the mean. A low SD means data points are close to the mean.' },
      { title: 'Programming Help', subject: 'Technology', q: 'What is a variable in programming?', a: 'A variable is a named container that stores a value in memory. You can change its value during program execution.' },
      { title: 'Art History Chat', subject: 'Arts', q: 'What defined the Impressionist movement?', a: 'Impressionism emphasized capturing light and movement with visible brushstrokes, outdoor scenes, and everyday subjects.' },
      { title: 'Music Theory Chat', subject: 'Arts', q: 'What is a major scale?', a: 'A major scale follows the pattern whole-whole-half-whole-whole-whole-half steps, creating a bright, happy sound.' }
    ];
    for (const ct of chatTopics) {
      const cs = await client.query(`INSERT INTO chat_sessions (user_id, title, subject) VALUES ($1, $2, $3) RETURNING id`, [studentId, ct.title, ct.subject]);
      await client.query(`INSERT INTO chat_messages (session_id, role, content) VALUES ($1, 'user', $2), ($1, 'assistant', $3)`, [cs.rows[0].id, ct.q, ct.a]);
    }
    console.log('Chat sessions seeded (15 sessions with messages)');

    // Seed additional essays (13 more to reach 15 total)
    await client.query(`
      INSERT INTO essays (user_id, title, content, prompt, subject, word_count, status) VALUES
      ($1, 'The American Dream', 'The concept of the American Dream has evolved significantly since its inception. Originally coined by James Truslow Adams, it represented the idea that anyone could achieve success through hard work. Today, many question whether this dream remains accessible to all. Economic inequality, rising costs of education, and systemic barriers have made the path to success more challenging for many Americans.', 'Is the American Dream still achievable?', 'English', 156, 'submitted'),
      ($1, 'Photosynthesis Explained', 'Photosynthesis is the biological process by which plants convert light energy into chemical energy. This process occurs primarily in the chloroplasts of plant cells, specifically using a pigment called chlorophyll. The overall equation shows that carbon dioxide and water, in the presence of light, produce glucose and oxygen.', 'Explain the process of photosynthesis', 'Science', 120, 'graded'),
      ($1, 'World War II Causes', 'The causes of World War II are complex and interconnected. The Treaty of Versailles imposed harsh conditions on Germany after WWI, creating economic hardship and resentment. The rise of fascism in Italy and Nazism in Germany provided aggressive ideologies. The failure of appeasement policies allowed territorial expansion to go unchecked.', 'Analyze the causes of World War II', 'History', 135, 'draft'),
      ($1, 'Social Media Impact', 'Social media has fundamentally altered how humans communicate and interact. Platforms like Instagram and TikTok have created new forms of self-expression while also raising concerns about mental health, privacy, and misinformation. Studies show that excessive social media use correlates with increased anxiety and depression in teenagers.', 'How does social media affect society?', 'English', 128, 'submitted'),
      ($1, 'Understanding Gravity', 'Gravity is one of the four fundamental forces of nature. Isaac Newton first described it mathematically, showing that every object with mass attracts every other object. Einstein later refined this understanding with general relativity, describing gravity as the curvature of spacetime caused by mass and energy.', 'Explain gravity and its importance', 'Science', 118, 'draft'),
      ($1, 'Democracy in America', 'Democracy in America has been both celebrated and criticized since the nations founding. The system of checks and balances created by the Constitution aims to prevent tyranny. However, challenges like voter suppression, gerrymandering, and the influence of money in politics continue to test democratic ideals.', 'Evaluate American democracy', 'History', 115, 'graded'),
      ($1, 'The Art of Persuasion', 'Persuasive writing requires a clear thesis, strong evidence, and logical reasoning. Aristotles three modes of persuasion - ethos, pathos, and logos - remain relevant today. Effective persuasion acknowledges counterarguments while demonstrating why the writers position is stronger.', 'Write about persuasive techniques', 'English', 108, 'submitted'),
      ($1, 'Introduction to Python', 'Python is one of the most popular programming languages in the world. Its clean syntax and extensive libraries make it ideal for beginners and professionals alike. Python is used in web development, data science, artificial intelligence, and scientific computing.', 'Write about Python programming', 'Technology', 95, 'draft'),
      ($1, 'The Civil Rights Movement', 'The Civil Rights Movement of the 1950s and 1960s transformed American society. Led by figures like Martin Luther King Jr. and Rosa Parks, the movement fought against racial segregation and discrimination. Key achievements include the Civil Rights Act of 1964 and the Voting Rights Act of 1965.', 'Discuss the Civil Rights Movement', 'History', 122, 'graded'),
      ($1, 'Renewable Energy Future', 'The transition to renewable energy is essential for combating climate change. Solar and wind power have become increasingly cost-effective, while battery technology continues to improve. Countries worldwide are setting ambitious targets for carbon neutrality.', 'Discuss the future of renewable energy', 'Science', 98, 'draft'),
      ($1, 'Shakespeare Analysis', 'Shakespeare''s works continue to resonate because they explore timeless themes of love, power, jealousy, and mortality. His innovative use of language created thousands of words and phrases still used today. The complexity of his characters reflects the depth of human psychology.', 'Why is Shakespeare still relevant?', 'English', 105, 'submitted'),
      ($1, 'Algebra in Real Life', 'Algebra is not just an abstract mathematical concept - it has practical applications in everyday life. From calculating tips and discounts to understanding loan interest rates, algebraic thinking helps us make informed decisions. Engineers, scientists, and programmers use algebra constantly.', 'How is algebra used in daily life?', 'Mathematics', 110, 'draft'),
      ($1, 'The Water Cycle', 'The water cycle is a continuous process that circulates water through the Earths systems. Evaporation from oceans and lakes creates water vapor that rises and condenses into clouds. Precipitation returns water to the surface, where it flows into rivers and groundwater, completing the cycle.', 'Describe the water cycle', 'Science', 112, 'graded')
    `, [studentId]);
    console.log('Additional essays seeded (+13, total 15)');

    // Seed additional study sessions (7 more to reach 15)
    await client.query(`
      INSERT INTO study_sessions (user_id, subject, duration_minutes, activity_type, started_at, ended_at) VALUES
      ($1, 'History', 35, 'reading', NOW() - interval '8 days', NOW() - interval '8 days' + interval '35 minutes'),
      ($1, 'Languages', 20, 'flashcards', NOW() - interval '9 days', NOW() - interval '9 days' + interval '20 minutes'),
      ($1, 'Science', 55, 'quiz', NOW() - interval '10 days', NOW() - interval '10 days' + interval '55 minutes'),
      ($1, 'Mathematics', 40, 'practice', NOW() - interval '11 days', NOW() - interval '11 days' + interval '40 minutes'),
      ($1, 'Technology', 30, 'reading', NOW() - interval '12 days', NOW() - interval '12 days' + interval '30 minutes'),
      ($1, 'English', 45, 'essay', NOW() - interval '13 days', NOW() - interval '13 days' + interval '45 minutes'),
      ($1, 'Arts', 25, 'video', NOW() - interval '14 days', NOW() - interval '14 days' + interval '25 minutes')
    `, [studentId]);
    console.log('Additional study sessions seeded (+7, total 15)');

    // Seed additional performance analytics (5 more to reach 15)
    await client.query(`
      INSERT INTO performance_analytics (user_id, subject, metric_type, metric_value) VALUES
      ($1, 'History', 'essay_score', 82),
      ($1, 'Languages', 'quiz_score', 68),
      ($1, 'Technology', 'quiz_score', 91),
      ($1, 'Arts', 'quiz_score', 85),
      ($1, 'Mathematics', 'essay_score', 77)
    `, [studentId]);
    console.log('Additional performance analytics seeded (+5, total 15)');

    // Seed quiz questions for remaining quizzes (quizIds[3] through quizIds[16])
    // Quiz 4: World War I
    await client.query(`
      INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, difficulty_level) VALUES
      ($1, 'What event triggered World War I?', 'multiple_choice', '["Assassination of Archduke Franz Ferdinand", "Sinking of the Lusitania", "Treaty of Versailles", "Russian Revolution"]', 'Assassination of Archduke Franz Ferdinand', 'The assassination in Sarajevo in 1914 triggered the chain of alliances', 1, 'Beginner'),
      ($1, 'Which countries were in the Triple Entente?', 'multiple_choice', '["France, Russia, Britain", "Germany, Austria, Italy", "USA, Japan, China", "Spain, Portugal, Netherlands"]', 'France, Russia, Britain', 'The Triple Entente was the alliance opposing the Central Powers', 1, 'Intermediate'),
      ($1, 'In what year did the US enter WWI?', 'multiple_choice', '["1914", "1915", "1917", "1918"]', '1917', 'The US declared war on Germany in April 1917', 1, 'Beginner')
    `, [quizIds[3]]);
    // Quiz 5: Chemistry Elements
    await client.query(`
      INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, difficulty_level) VALUES
      ($1, 'What is the atomic number of Carbon?', 'multiple_choice', '["4", "6", "8", "12"]', '6', 'Carbon has 6 protons in its nucleus', 1, 'Beginner'),
      ($1, 'Which element has the symbol Na?', 'multiple_choice', '["Nitrogen", "Neon", "Sodium", "Nickel"]', 'Sodium', 'Na comes from the Latin natrium', 1, 'Beginner'),
      ($1, 'What is the most abundant element in the universe?', 'multiple_choice', '["Oxygen", "Carbon", "Helium", "Hydrogen"]', 'Hydrogen', 'Hydrogen makes up about 75% of all normal matter', 1, 'Beginner')
    `, [quizIds[4]]);
    // Quiz 6: Physics Motion
    await client.query(`
      INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, difficulty_level) VALUES
      ($1, 'What is Newtons First Law about?', 'multiple_choice', '["Inertia", "Force equals mass times acceleration", "Action and reaction", "Gravity"]', 'Inertia', 'An object at rest stays at rest unless acted upon by an external force', 1, 'Beginner'),
      ($1, 'What unit is force measured in?', 'multiple_choice', '["Joules", "Watts", "Newtons", "Pascals"]', 'Newtons', 'The SI unit of force is the Newton (N)', 1, 'Beginner'),
      ($1, 'If F = ma, what is the force on a 5 kg object accelerating at 3 m/s squared?', 'multiple_choice', '["8 N", "15 N", "1.67 N", "2 N"]', '15 N', 'F = 5 x 3 = 15 N', 1, 'Intermediate')
    `, [quizIds[5]]);
    // Quiz 7: Geometry
    await client.query(`
      INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, difficulty_level) VALUES
      ($1, 'How many degrees in a triangle?', 'multiple_choice', '["90", "180", "270", "360"]', '180', 'The sum of interior angles of a triangle is always 180 degrees', 1, 'Beginner'),
      ($1, 'What is the area formula for a rectangle?', 'multiple_choice', '["length + width", "length x width", "2(l + w)", "l squared"]', 'length x width', 'Area = length times width for rectangles', 1, 'Beginner'),
      ($1, 'What type of triangle has all sides equal?', 'multiple_choice', '["Scalene", "Isosceles", "Equilateral", "Right"]', 'Equilateral', 'An equilateral triangle has all three sides equal', 1, 'Beginner')
    `, [quizIds[6]]);
    // Quiz 8: Grammar
    await client.query(`
      INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, difficulty_level) VALUES
      ($1, 'What is a noun?', 'multiple_choice', '["An action word", "A describing word", "A person, place, or thing", "A connecting word"]', 'A person, place, or thing', 'Nouns name people, places, things, or ideas', 1, 'Beginner'),
      ($1, 'Which is a conjunction?', 'multiple_choice', '["quickly", "and", "beautiful", "run"]', 'and', 'Conjunctions connect words, phrases, or clauses', 1, 'Beginner'),
      ($1, 'What is the past tense of run?', 'multiple_choice', '["runned", "ran", "runed", "running"]', 'ran', 'Run is an irregular verb with past tense ran', 1, 'Beginner')
    `, [quizIds[7]]);
    // Quiz 9: Spanish Vocabulary
    await client.query(`
      INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, difficulty_level) VALUES
      ($1, 'What does "gato" mean?', 'multiple_choice', '["Dog", "Cat", "Bird", "Fish"]', 'Cat', 'Gato is the Spanish word for cat', 1, 'Beginner'),
      ($1, 'How do you say "water" in Spanish?', 'multiple_choice', '["Leche", "Jugo", "Agua", "Cafe"]', 'Agua', 'Agua means water in Spanish', 1, 'Beginner'),
      ($1, 'What does "rojo" mean?', 'multiple_choice', '["Blue", "Green", "Red", "Yellow"]', 'Red', 'Rojo is the Spanish word for red', 1, 'Beginner')
    `, [quizIds[8]]);
    // Quiz 10: Environmental Science
    await client.query(`
      INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, difficulty_level) VALUES
      ($1, 'What is the main greenhouse gas?', 'multiple_choice', '["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"]', 'Carbon dioxide', 'CO2 is the primary greenhouse gas from human activities', 1, 'Beginner'),
      ($1, 'What is biodiversity?', 'multiple_choice', '["Number of humans", "Variety of life forms", "Amount of water", "Air quality"]', 'Variety of life forms', 'Biodiversity refers to the variety of all living organisms', 1, 'Beginner'),
      ($1, 'What causes acid rain?', 'multiple_choice', '["CO2 emissions", "SO2 and NOx emissions", "Ozone depletion", "Deforestation"]', 'SO2 and NOx emissions', 'Sulfur dioxide and nitrogen oxides react with water vapor', 1, 'Intermediate')
    `, [quizIds[9]]);
    // Quiz 11: Statistics
    await client.query(`
      INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, difficulty_level) VALUES
      ($1, 'What is the median of 2, 4, 6, 8, 10?', 'multiple_choice', '["4", "6", "8", "30"]', '6', 'The median is the middle value when sorted', 1, 'Beginner'),
      ($1, 'What is the mode of 1, 2, 2, 3, 4?', 'multiple_choice', '["1", "2", "3", "2.4"]', '2', 'The mode is the most frequently occurring value', 1, 'Beginner'),
      ($1, 'What is a sample in statistics?', 'multiple_choice', '["The entire population", "A subset of the population", "A graph", "A percentage"]', 'A subset of the population', 'A sample is a subset selected for analysis', 1, 'Beginner')
    `, [quizIds[10]]);
    // Quiz 12: American History
    await client.query(`
      INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, difficulty_level) VALUES
      ($1, 'Who was the first US President?', 'multiple_choice', '["Thomas Jefferson", "John Adams", "George Washington", "Benjamin Franklin"]', 'George Washington', 'Washington served from 1789 to 1797', 1, 'Beginner'),
      ($1, 'What year was the Declaration of Independence signed?', 'multiple_choice', '["1774", "1776", "1778", "1783"]', '1776', 'The Declaration was adopted on July 4, 1776', 1, 'Beginner'),
      ($1, 'What was the Louisiana Purchase?', 'multiple_choice', '["A treaty", "A land acquisition from France", "A battle", "A trade agreement"]', 'A land acquisition from France', 'The US bought the territory from France in 1803', 1, 'Intermediate')
    `, [quizIds[11]]);
    // Quiz 13: Calculus Derivatives
    await client.query(`
      INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, difficulty_level) VALUES
      ($1, 'What is the derivative of x cubed?', 'multiple_choice', '["x squared", "3x squared", "3x", "x to the fourth"]', '3x squared', 'Using the power rule: d/dx(x^n) = nx^(n-1)', 1, 'Intermediate'),
      ($1, 'What is the derivative of a constant?', 'multiple_choice', '["1", "0", "The constant itself", "Undefined"]', '0', 'The derivative of any constant is zero', 1, 'Beginner'),
      ($1, 'What does the derivative represent geometrically?', 'multiple_choice', '["Area under curve", "Slope of tangent line", "Y-intercept", "Maximum value"]', 'Slope of tangent line', 'The derivative gives the slope of the tangent at a point', 1, 'Intermediate')
    `, [quizIds[12]]);
    // Quiz 14: Computer Science
    await client.query(`
      INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, difficulty_level) VALUES
      ($1, 'What is an algorithm?', 'multiple_choice', '["A programming language", "A step-by-step procedure", "A type of computer", "A data type"]', 'A step-by-step procedure', 'An algorithm is a finite sequence of well-defined instructions', 1, 'Beginner'),
      ($1, 'What does HTML stand for?', 'multiple_choice', '["Hyper Text Markup Language", "High Tech Modern Language", "Hyper Transfer Method Link", "Home Tool Markup Language"]', 'Hyper Text Markup Language', 'HTML is the standard markup language for web pages', 1, 'Beginner'),
      ($1, 'What is a loop in programming?', 'multiple_choice', '["A type of variable", "A repeated execution of code", "A function", "An error"]', 'A repeated execution of code', 'Loops repeat a block of code until a condition is met', 1, 'Beginner')
    `, [quizIds[13]]);
    // Quiz 15: Art Movements
    await client.query(`
      INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, difficulty_level) VALUES
      ($1, 'Who painted the Mona Lisa?', 'multiple_choice', '["Michelangelo", "Leonardo da Vinci", "Raphael", "Donatello"]', 'Leonardo da Vinci', 'Da Vinci painted the Mona Lisa around 1503-1519', 1, 'Beginner'),
      ($1, 'What art movement did Claude Monet belong to?', 'multiple_choice', '["Cubism", "Surrealism", "Impressionism", "Baroque"]', 'Impressionism', 'Monet was a founder of the French Impressionist movement', 1, 'Beginner'),
      ($1, 'What is the Baroque period known for?', 'multiple_choice', '["Simplicity", "Drama and grandeur", "Abstract forms", "Minimalism"]', 'Drama and grandeur', 'Baroque art emphasized dramatic movement and elaborate detail', 1, 'Intermediate')
    `, [quizIds[14]]);
    // Quiz 16: Music Theory
    await client.query(`
      INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, difficulty_level) VALUES
      ($1, 'How many notes are in a chromatic scale?', 'multiple_choice', '["7", "8", "12", "15"]', '12', 'The chromatic scale has 12 semitones per octave', 1, 'Beginner'),
      ($1, 'What does forte mean in music?', 'multiple_choice', '["Soft", "Loud", "Fast", "Slow"]', 'Loud', 'Forte (f) means to play loudly', 1, 'Beginner'),
      ($1, 'How many beats does a whole note get in 4/4 time?', 'multiple_choice', '["1", "2", "3", "4"]', '4', 'A whole note receives 4 beats in 4/4 time', 1, 'Beginner')
    `, [quizIds[15]]);
    // Quiz 17: Adaptive Math
    await client.query(`
      INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, difficulty_level) VALUES
      ($1, 'What is 15% of 200?', 'multiple_choice', '["15", "20", "30", "35"]', '30', '0.15 x 200 = 30', 1, 'Beginner'),
      ($1, 'Solve: 5x - 3 = 2x + 9', 'multiple_choice', '["x = 2", "x = 4", "x = 6", "x = 3"]', 'x = 4', '3x = 12, x = 4', 1, 'Intermediate'),
      ($1, 'What is the derivative of sin(x)?', 'multiple_choice', '["cos(x)", "-sin(x)", "-cos(x)", "tan(x)"]', 'cos(x)', 'The derivative of sin(x) is cos(x)', 1, 'Advanced')
    `, [quizIds[16]]);
    console.log('Quiz questions seeded for all 17 quizzes (51 questions total)');

    // Seed flashcards for remaining 12 decks (deckIds[4] through deckIds[15])
    // Deck 5: Historical Figures
    await client.query(`INSERT INTO flashcards (deck_id, front_text, back_text) VALUES
      ($1, 'George Washington', 'First President of the United States (1789-1797)'),
      ($1, 'Julius Caesar', 'Roman dictator assassinated in 44 BCE'),
      ($1, 'Cleopatra', 'Last active ruler of the Ptolemaic Kingdom of Egypt'),
      ($1, 'Napoleon Bonaparte', 'French military leader who became Emperor of France'),
      ($1, 'Martin Luther King Jr.', 'American civil rights leader who advocated nonviolent protest')
    `, [deckIds[4]]);
    // Deck 6: Literary Terms
    await client.query(`INSERT INTO flashcards (deck_id, front_text, back_text) VALUES
      ($1, 'Metaphor', 'A comparison without using like or as'),
      ($1, 'Simile', 'A comparison using like or as'),
      ($1, 'Alliteration', 'Repetition of initial consonant sounds'),
      ($1, 'Onomatopoeia', 'Words that imitate natural sounds'),
      ($1, 'Irony', 'Expression meaning the opposite of its literal meaning')
    `, [deckIds[5]]);
    // Deck 7: Physics Formulas
    await client.query(`INSERT INTO flashcards (deck_id, front_text, back_text) VALUES
      ($1, 'F = ma', 'Force equals mass times acceleration (Newtons 2nd Law)'),
      ($1, 'E = mc squared', 'Energy equals mass times speed of light squared'),
      ($1, 'v = d/t', 'Velocity equals distance divided by time'),
      ($1, 'KE = 1/2 mv squared', 'Kinetic energy equals half mass times velocity squared'),
      ($1, 'W = Fd', 'Work equals force times distance')
    `, [deckIds[6]]);
    // Deck 8: Grammar Rules
    await client.query(`INSERT INTO flashcards (deck_id, front_text, back_text) VALUES
      ($1, 'Its vs It''s', 'Its = possessive; It''s = it is or it has'),
      ($1, 'Their/There/They''re', 'Their = possessive; There = place; They''re = they are'),
      ($1, 'Effect vs Affect', 'Effect = noun (result); Affect = verb (to influence)'),
      ($1, 'Who vs Whom', 'Who = subject; Whom = object of verb or preposition'),
      ($1, 'Comma Splice', 'Error: joining two independent clauses with just a comma')
    `, [deckIds[7]]);
    // Deck 9: Geography Capitals
    await client.query(`INSERT INTO flashcards (deck_id, front_text, back_text) VALUES
      ($1, 'France', 'Paris'),
      ($1, 'Japan', 'Tokyo'),
      ($1, 'Brazil', 'Brasilia'),
      ($1, 'Australia', 'Canberra'),
      ($1, 'Egypt', 'Cairo')
    `, [deckIds[8]]);
    // Deck 10: Computer Terms
    await client.query(`INSERT INTO flashcards (deck_id, front_text, back_text) VALUES
      ($1, 'Variable', 'A named storage location in memory'),
      ($1, 'Function', 'A reusable block of code that performs a task'),
      ($1, 'Array', 'An ordered collection of elements'),
      ($1, 'Boolean', 'A data type with only true or false values'),
      ($1, 'Loop', 'A structure that repeats code until a condition is met')
    `, [deckIds[9]]);
    // Deck 11: Art Movements
    await client.query(`INSERT INTO flashcards (deck_id, front_text, back_text) VALUES
      ($1, 'Renaissance', 'Rebirth of classical art and learning (14th-17th century)'),
      ($1, 'Impressionism', 'Emphasis on light and color with visible brushstrokes'),
      ($1, 'Cubism', 'Objects shown from multiple viewpoints simultaneously'),
      ($1, 'Surrealism', 'Art exploring the unconscious mind and dreams'),
      ($1, 'Pop Art', 'Art based on popular culture and mass media imagery')
    `, [deckIds[10]]);
    // Deck 12: Music Terminology
    await client.query(`INSERT INTO flashcards (deck_id, front_text, back_text) VALUES
      ($1, 'Allegro', 'Fast tempo'),
      ($1, 'Piano (p)', 'Play softly'),
      ($1, 'Crescendo', 'Gradually getting louder'),
      ($1, 'Staccato', 'Short, detached notes'),
      ($1, 'Tempo', 'The speed of the music')
    `, [deckIds[11]]);
    // Deck 13: Math Symbols
    await client.query(`INSERT INTO flashcards (deck_id, front_text, back_text) VALUES
      ($1, 'Pi', 'Approximately 3.14159, ratio of circumference to diameter'),
      ($1, 'Sigma', 'Summation symbol, adds up a series of values'),
      ($1, 'Delta', 'Change in a quantity'),
      ($1, 'Infinity', 'A quantity without bound or end'),
      ($1, 'Square Root', 'A value that when multiplied by itself gives the number')
    `, [deckIds[12]]);
    // Deck 14: Science Units
    await client.query(`INSERT INTO flashcards (deck_id, front_text, back_text) VALUES
      ($1, 'Meter (m)', 'SI unit of length'),
      ($1, 'Kilogram (kg)', 'SI unit of mass'),
      ($1, 'Second (s)', 'SI unit of time'),
      ($1, 'Ampere (A)', 'SI unit of electric current'),
      ($1, 'Kelvin (K)', 'SI unit of temperature')
    `, [deckIds[13]]);
    // Deck 15: French Basics
    await client.query(`INSERT INTO flashcards (deck_id, front_text, back_text) VALUES
      ($1, 'Bonjour', 'Hello / Good morning'),
      ($1, 'Merci', 'Thank you'),
      ($1, 'S''il vous plait', 'Please'),
      ($1, 'Au revoir', 'Goodbye'),
      ($1, 'Oui / Non', 'Yes / No')
    `, [deckIds[14]]);
    // Deck 16: SAT Vocabulary
    await client.query(`INSERT INTO flashcards (deck_id, front_text, back_text) VALUES
      ($1, 'Abridge', 'To shorten or condense'),
      ($1, 'Benign', 'Gentle, not harmful'),
      ($1, 'Cogent', 'Clear, logical, and convincing'),
      ($1, 'Deft', 'Skillful and quick'),
      ($1, 'Elicit', 'To draw out a response')
    `, [deckIds[15]]);
    console.log('Flashcards seeded for all 16 decks (80 cards total)');

    // Seed user_achievements (15 items)
    const achievementsResult = await client.query('SELECT id FROM achievements ORDER BY created_at LIMIT 15');
    const achievementIds = achievementsResult.rows.map(r => r.id);
    for (let i = 0; i < Math.min(15, achievementIds.length); i++) {
      await client.query(
        `INSERT INTO user_achievements (user_id, achievement_id, earned_at) VALUES ($1, $2, NOW() - interval '${i + 1} days')`,
        [studentId, achievementIds[i]]
      );
    }
    console.log('User achievements seeded (15 items)');

    // Seed user_learning_paths (15 items)
    for (let i = 0; i < Math.min(15, lpIds.length); i++) {
      const progress = Math.floor(Math.random() * 80) + 10;
      await client.query(
        `INSERT INTO user_learning_paths (user_id, learning_path_id, progress_percentage, started_at) VALUES ($1, $2, $3, NOW() - interval '${(i + 1) * 3} days')`,
        [studentId, lpIds[i], progress]
      );
    }
    console.log('User learning paths seeded (15 items)');

    // Seed quiz_attempts (15 items)
    for (let i = 0; i < Math.min(15, quizIds.length); i++) {
      const score = Math.floor(Math.random() * 40) + 60;
      const totalPoints = 3;
      const timeTaken = Math.floor(Math.random() * 600) + 120;
      await client.query(
        `INSERT INTO quiz_attempts (user_id, quiz_id, score, total_points, time_taken_seconds, answers, started_at, completed_at)
         VALUES ($1, $2, $3, $4, $5, '[]', NOW() - interval '${(i + 1) * 2} days', NOW() - interval '${(i + 1) * 2} days' + interval '${timeTaken} seconds')`,
        [studentId, quizIds[i], score, totalPoints, timeTaken]
      );
    }
    console.log('Quiz attempts seeded (15 items)');

    await client.query('COMMIT');

    console.log('\n=============================================');
    console.log('  Database seeding completed successfully!');
    console.log('=============================================');
    console.log('\nSeeded data summary:');
    console.log('  - 6 Users (incl. admin)');
    console.log('  - 17 Learning Paths');
    console.log('  - 17 Study Materials');
    console.log('  - 17 Quizzes with 51 Questions');
    console.log('  - 16 Practice Problems');
    console.log('  - 16 Flashcard Decks with 80 Cards');
    console.log('  - 16 Video Lessons');
    console.log('  - 16 Vocabulary Words');
    console.log('  - 16 Writing Prompts');
    console.log('  - 16 Math Problems');
    console.log('  - 16 Achievements');
    console.log('  - 15 Goals');
    console.log('  - 15 Essays');
    console.log('  - 15 Study Sessions');
    console.log('  - 15 Performance Analytics');
    console.log('  - 15 Chat Sessions');
    console.log('  - 15 User Achievements');
    console.log('  - 15 User Learning Paths');
    console.log('  - 15 Quiz Attempts');
    console.log('  - 16 Learning Style Questions');
    console.log('  - 16 Historical Events');
    console.log('  - 16 Science Experiments');
    console.log('  - 16 Homework Assignments');
    console.log('  - Study Schedules');
    console.log('\nDemo Accounts:');
    console.log('  Student: student@demo.com / password123');
    console.log('  Teacher: teacher@demo.com / password123');
    console.log('  Admin:   admin@demo.com / password123');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seeding error:', error.message);
    console.error('Detail:', error.detail || 'No additional detail');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
