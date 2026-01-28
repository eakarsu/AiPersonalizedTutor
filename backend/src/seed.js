const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '../.env' });

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

    // Read and execute schema statements one at a time
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    const statements = schema.split(';').filter(s => s.trim().length > 0);
    for (const stmt of statements) {
      await client.query(stmt);
    }
    console.log('Schema created successfully');

    // Clear existing data
    await client.query('TRUNCATE users, learning_paths, study_materials, quizzes, quiz_questions, practice_problems, flashcard_decks, flashcards, video_lessons, vocabulary_words, writing_prompts, math_problems, achievements, goals, chat_sessions, chat_messages, essays, study_sessions, performance_analytics, user_achievements CASCADE');
    console.log('Existing data cleared');

    // Seed Users
    const passwordHash = await bcrypt.hash('password123', 10);
    const users = await client.query(`
      INSERT INTO users (email, password_hash, full_name, role, grade_level) VALUES
      ('student@demo.com', $1, 'Demo Student', 'student', '10th Grade'),
      ('teacher@demo.com', $1, 'Demo Teacher', 'teacher', null),
      ('john@example.com', $1, 'John Smith', 'student', '9th Grade'),
      ('sarah@example.com', $1, 'Sarah Johnson', 'student', '11th Grade'),
      ('mike@example.com', $1, 'Mike Williams', 'student', '10th Grade')
      RETURNING id
    `, [passwordHash]);
    console.log('Users seeded (5 users)');
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

    // Seed Study Materials (17 items) - each with correct learning_path_id
    await client.query(`
      INSERT INTO study_materials (title, content, subject, topic, material_type, difficulty_level, learning_path_id) VALUES
      ('Introduction to Variables', 'Variables are symbols that represent unknown values in mathematical expressions. They are fundamental to algebra and allow us to write general formulas. For example, in the expression 2x + 3, x is a variable that can take any value.', 'Mathematics', 'Algebra', 'lesson', 'Beginner', $1),
      ('Solving Linear Equations', 'A linear equation is an equation where the highest power of the variable is 1. To solve, isolate the variable by performing inverse operations on both sides. For example: 2x + 5 = 11, subtract 5 from both sides to get 2x = 6, then divide by 2 to get x = 3.', 'Mathematics', 'Algebra', 'lesson', 'Beginner', $2),
      ('Quadratic Equations', 'Quadratic equations have the form ax2 + bx + c = 0. They can be solved using factoring, completing the square, or the quadratic formula: x = (-b +/- sqrt(b2-4ac)) / 2a. The discriminant b2-4ac determines the nature of solutions.', 'Mathematics', 'Algebra', 'lesson', 'Intermediate', $3),
      ('Cell Structure and Function', 'All living organisms are made up of cells. Cells are the basic structural and functional units of life. They contain organelles such as the nucleus (control center), mitochondria (energy production), ribosomes (protein synthesis), and cell membrane (barrier).', 'Science', 'Biology', 'lesson', 'Beginner', $4),
      ('Photosynthesis Process', 'Photosynthesis is the process by which plants convert light energy into chemical energy stored in glucose. The equation is: 6CO2 + 6H2O + light energy -> C6H12O6 + 6O2. It occurs in chloroplasts, primarily in leaf cells.', 'Science', 'Biology', 'lesson', 'Intermediate', $5),
      ('DNA and Genetics', 'DNA (deoxyribonucleic acid) is the hereditary material in humans and almost all organisms. It consists of two strands forming a double helix. The four bases are Adenine, Thymine, Guanine, and Cytosine. Genes are segments of DNA that code for proteins.', 'Science', 'Biology', 'lesson', 'Intermediate', $6),
      ('Shakespeare Introduction', 'William Shakespeare (1564-1616) was an English playwright and poet widely regarded as the greatest writer in the English language. He wrote approximately 39 plays, 154 sonnets, and several longer poems. His works include tragedies, comedies, and histories.', 'English', 'Literature', 'lesson', 'Intermediate', $7),
      ('World War I Overview', 'World War I (1914-1918) was a global conflict that reshaped the political landscape of Europe and the world. It was triggered by the assassination of Archduke Franz Ferdinand and involved alliance systems, imperialism, and nationalism as underlying causes.', 'History', 'Modern History', 'lesson', 'Intermediate', $8),
      ('Atomic Structure', 'Atoms are the basic building blocks of matter. They consist of protons (positive charge) and neutrons (no charge) in the nucleus, with electrons (negative charge) orbiting in shells. The atomic number equals the number of protons and defines the element.', 'Science', 'Chemistry', 'lesson', 'Beginner', $9),
      ('Newtons Laws of Motion', 'Isaac Newton formulated three fundamental laws: 1) An object at rest stays at rest unless acted upon by a force (inertia). 2) Force equals mass times acceleration (F=ma). 3) For every action there is an equal and opposite reaction.', 'Science', 'Physics', 'lesson', 'Intermediate', $10),
      ('Introduction to Python', 'Python is a high-level, interpreted programming language known for its simplicity and readability. It uses indentation for code blocks and supports multiple programming paradigms. Variables do not need explicit type declarations.', 'Technology', 'Programming', 'lesson', 'Beginner', $11),
      ('Spanish Greetings', 'Learn basic Spanish greetings: Hola (Hello), Buenos dias (Good morning), Buenas tardes (Good afternoon), Buenas noches (Good evening/night), Adios (Goodbye), Hasta luego (See you later), Como estas? (How are you?).', 'Languages', 'Spanish', 'lesson', 'Beginner', $12),
      ('Triangle Properties', 'A triangle is a polygon with three edges and three vertices. The sum of interior angles equals 180 degrees. Types include: equilateral (all sides equal), isosceles (two sides equal), and scalene (no sides equal). Area = 1/2 base x height.', 'Mathematics', 'Geometry', 'lesson', 'Beginner', $13),
      ('Thesis Statement Writing', 'A thesis statement is a sentence that expresses the main idea of your essay and tells readers what to expect. It should be specific, arguable, and placed at the end of your introduction paragraph. A strong thesis takes a clear position.', 'English', 'Writing', 'lesson', 'Intermediate', $14),
      ('Climate Change Science', 'Climate change refers to long-term shifts in temperatures and weather patterns, primarily caused by human activities since the 1800s, mainly the burning of fossil fuels like coal, oil, and gas, which produces heat-trapping greenhouse gases.', 'Science', 'Environmental', 'lesson', 'Intermediate', $15),
      ('Mean Median and Mode', 'Mean is the average (sum divided by count). Median is the middle value when data is ordered. Mode is the most frequent value. For the set {2, 3, 5, 5, 7}: mean = 4.4, median = 5, mode = 5. Each measures central tendency differently.', 'Mathematics', 'Statistics', 'lesson', 'Beginner', $16),
      ('The American Revolution', 'The American Revolution (1765-1783) was a political upheaval that led to the formation of the United States. Key causes included taxation without representation, the Stamp Act, Boston Tea Party, and desire for self-governance inspired by Enlightenment ideas.', 'History', 'American History', 'lesson', 'Intermediate', $17)
    `, [lpIds[0], lpIds[0], lpIds[0], lpIds[4], lpIds[4], lpIds[4], lpIds[2], lpIds[3], lpIds[5], lpIds[6], lpIds[8], lpIds[9], lpIds[10], lpIds[11], lpIds[12], lpIds[13], lpIds[14]]);
    console.log('Study materials seeded (17 items)');

    // Seed Quizzes (17 items)
    const quizzes = await client.query(`
      INSERT INTO quizzes (title, description, subject, topic, difficulty_level, time_limit_minutes, passing_score, is_adaptive) VALUES
      ('Algebra Basics Quiz', 'Test your understanding of basic algebraic concepts', 'Mathematics', 'Algebra', 'Beginner', 15, 70, false),
      ('Biology Cell Quiz', 'Quiz on cell structure and function', 'Science', 'Biology', 'Beginner', 20, 70, false),
      ('Shakespeare Quiz', 'Test your knowledge of Shakespeares works', 'English', 'Literature', 'Intermediate', 25, 70, false),
      ('World War I Quiz', 'Quiz on WWI events and causes', 'History', 'Modern History', 'Intermediate', 20, 70, false),
      ('Chemistry Elements Quiz', 'Test your knowledge of chemical elements', 'Science', 'Chemistry', 'Beginner', 15, 70, false),
      ('Physics Motion Quiz', 'Quiz on Newtons laws of motion', 'Science', 'Physics', 'Intermediate', 20, 70, true),
      ('Geometry Shapes Quiz', 'Test your understanding of geometric shapes', 'Mathematics', 'Geometry', 'Beginner', 15, 70, false),
      ('Grammar Fundamentals', 'Quiz on English grammar rules', 'English', 'Grammar', 'Beginner', 20, 70, false),
      ('Spanish Vocabulary Quiz', 'Test basic Spanish vocabulary', 'Languages', 'Spanish', 'Beginner', 15, 70, false),
      ('Environmental Science Quiz', 'Quiz on environmental concepts', 'Science', 'Environmental', 'Intermediate', 20, 70, false),
      ('Statistics Basics Quiz', 'Test your statistics knowledge', 'Mathematics', 'Statistics', 'Beginner', 25, 70, false),
      ('American History Quiz', 'Quiz on US historical events', 'History', 'American History', 'Intermediate', 20, 70, false),
      ('Calculus Derivatives Quiz', 'Test your understanding of derivatives', 'Mathematics', 'Calculus', 'Advanced', 30, 70, true),
      ('Computer Science Basics', 'Quiz on programming fundamentals', 'Technology', 'Programming', 'Beginner', 20, 70, false),
      ('Art Movements Quiz', 'Test your knowledge of art history', 'Arts', 'Art History', 'Beginner', 15, 70, false),
      ('Music Theory Quiz', 'Quiz on basic music theory', 'Arts', 'Music', 'Beginner', 15, 70, false),
      ('Adaptive Math Quiz', 'Adaptive difficulty mathematics quiz', 'Mathematics', 'Mixed', 'Intermediate', 30, 70, true)
      RETURNING id
    `);
    console.log('Quizzes seeded (17 items)');
    const quizIds = quizzes.rows.map(r => r.id);

    // Seed Quiz Questions - insert per quiz to avoid parameter issues
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

    await client.query(`
      INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, difficulty_level) VALUES
      ($1, 'When did World War I begin?', 'multiple_choice', '["1912", "1914", "1916", "1918"]', '1914', 'WWI began in July 1914 after the assassination of Archduke Franz Ferdinand', 1, 'Beginner'),
      ($1, 'What event triggered WWI?', 'multiple_choice', '["Invasion of Poland", "Assassination of Archduke Franz Ferdinand", "Sinking of Lusitania", "Treaty of Versailles"]', 'Assassination of Archduke Franz Ferdinand', 'The assassination on June 28, 1914 triggered the war', 1, 'Intermediate'),
      ($1, 'Which treaty ended WWI?', 'multiple_choice', '["Treaty of Paris", "Treaty of Versailles", "Treaty of Vienna", "Treaty of Berlin"]', 'Treaty of Versailles', 'The Treaty of Versailles was signed on June 28, 1919', 1, 'Intermediate')
    `, [quizIds[3]]);

    await client.query(`
      INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, difficulty_level) VALUES
      ($1, 'What is the chemical symbol for gold?', 'multiple_choice', '["Go", "Gd", "Au", "Ag"]', 'Au', 'Au comes from the Latin word aurum', 1, 'Beginner'),
      ($1, 'How many protons does hydrogen have?', 'multiple_choice', '["0", "1", "2", "3"]', '1', 'Hydrogen is the simplest element with one proton', 1, 'Beginner'),
      ($1, 'What is the chemical formula for water?', 'multiple_choice', '["HO", "H2O", "H2O2", "OH2"]', 'H2O', 'Water consists of 2 hydrogen atoms and 1 oxygen atom', 1, 'Beginner')
    `, [quizIds[4]]);

    await client.query(`
      INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, difficulty_level) VALUES
      ($1, 'What is Newtons First Law also known as?', 'multiple_choice', '["Law of Acceleration", "Law of Inertia", "Law of Action-Reaction", "Law of Gravity"]', 'Law of Inertia', 'An object at rest stays at rest unless acted upon by a force', 1, 'Intermediate'),
      ($1, 'F = ma is which of Newtons laws?', 'multiple_choice', '["First", "Second", "Third", "Fourth"]', 'Second', 'The second law relates force, mass, and acceleration', 1, 'Intermediate')
    `, [quizIds[5]]);

    await client.query(`
      INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, difficulty_level) VALUES
      ($1, 'How many degrees are in a triangle?', 'multiple_choice', '["90", "180", "270", "360"]', '180', 'The sum of interior angles in a triangle is always 180 degrees', 1, 'Beginner'),
      ($1, 'What is the area formula for a rectangle?', 'multiple_choice', '["length + width", "length x width", "2(l+w)", "l^2"]', 'length x width', 'Area of a rectangle equals length multiplied by width', 1, 'Beginner')
    `, [quizIds[6]]);

    await client.query(`
      INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, difficulty_level) VALUES
      ($1, 'Which sentence is correct?', 'multiple_choice', '["Their going home", "They are going home", "There going home", "Thier going home"]', 'They are going home', 'They are is the correct subject-verb combination', 1, 'Beginner'),
      ($1, 'What is a noun?', 'multiple_choice', '["An action word", "A describing word", "A person place or thing", "A connecting word"]', 'A person place or thing', 'Nouns name people, places, things, or ideas', 1, 'Beginner')
    `, [quizIds[7]]);

    console.log('Quiz questions seeded (24 questions across 8 quizzes)');

    // Seed Practice Problems (16 items) - no parameters needed
    await client.query(`
      INSERT INTO practice_problems (title, problem_text, subject, topic, difficulty_level, solution, hints) VALUES
      ('Solve for x', 'Solve the equation: 3x - 7 = 14', 'Mathematics', 'Algebra', 'Beginner', 'x = 7. Add 7 to both sides: 3x = 21. Divide by 3: x = 7', '["Add 7 to both sides first", "Then divide by 3"]'),
      ('Quadratic Equation', 'Solve: x squared minus 5x plus 6 = 0', 'Mathematics', 'Algebra', 'Intermediate', 'x = 2 or x = 3. Factor: (x-2)(x-3) = 0', '["Try to factor the equation", "Find two numbers that multiply to 6 and add to -5"]'),
      ('Word Problem', 'A train travels 240 miles in 4 hours. What is its average speed?', 'Mathematics', 'Algebra', 'Beginner', 'Speed = Distance/Time = 240/4 = 60 mph', '["Use the formula: Speed = Distance divided by Time"]'),
      ('Cell Division', 'Explain the difference between mitosis and meiosis', 'Science', 'Biology', 'Intermediate', 'Mitosis produces 2 identical diploid cells for growth/repair. Meiosis produces 4 haploid cells for reproduction.', '["Think about the number of resulting cells", "Consider the purpose of each process"]'),
      ('Chemical Reaction', 'Balance the equation: H2 + O2 -> H2O', 'Science', 'Chemistry', 'Beginner', '2H2 + O2 -> 2H2O', '["Count hydrogen and oxygen atoms on each side", "You need to balance both elements"]'),
      ('Physics Force', 'A 10 kg object accelerates at 5 m/s squared. What is the force?', 'Science', 'Physics', 'Beginner', 'F = ma = 10 x 5 = 50 N', '["Use Newtons second law: F = ma"]'),
      ('Essay Analysis', 'Identify the thesis statement in a given paragraph about climate change', 'English', 'Writing', 'Intermediate', 'The thesis is usually the last sentence of the introduction that states the main argument', '["Look at the introduction paragraph", "Find the sentence that makes a claim"]'),
      ('Historical Analysis', 'What were the main causes of the American Revolution?', 'History', 'American History', 'Intermediate', 'Taxation without representation, British policies, desire for self-governance, Enlightenment ideas', '["Think about what colonists were protesting", "Consider economic and political factors"]'),
      ('Geometry Proof', 'Prove that the angles of a triangle sum to 180 degrees', 'Mathematics', 'Geometry', 'Intermediate', 'Draw a line parallel to one side through the opposite vertex. Use alternate interior angles.', '["Consider drawing an auxiliary line", "Use properties of parallel lines"]'),
      ('Derivative Problem', 'Find the derivative of f(x) = x cubed + 2x squared - 5x + 3', 'Mathematics', 'Calculus', 'Advanced', 'f prime(x) = 3x squared + 4x - 5 using the power rule', '["Apply the power rule to each term", "Derivative of constant is 0"]'),
      ('Spanish Translation', 'Translate: Where is the library?', 'Languages', 'Spanish', 'Beginner', 'Donde esta la biblioteca?', '["Where = Donde", "is = esta", "library = biblioteca"]'),
      ('Statistics Problem', 'Find the mean of: 5, 8, 12, 3, 7', 'Mathematics', 'Statistics', 'Beginner', 'Mean = (5+8+12+3+7)/5 = 35/5 = 7', '["Add all numbers together", "Divide by how many numbers there are"]'),
      ('Programming Logic', 'Write pseudocode for finding the largest number in a list', 'Technology', 'Programming', 'Beginner', 'Set max to first element, loop through list, if current > max, update max', '["You need to compare each element", "Keep track of the largest found so far"]'),
      ('Environmental Issue', 'Explain the greenhouse effect', 'Science', 'Environmental', 'Intermediate', 'Solar radiation enters atmosphere, some is absorbed by Earth, infrared radiation is trapped by greenhouse gases, warming the planet', '["Think about how light enters vs leaves", "Consider the role of CO2"]'),
      ('Literary Analysis', 'Identify the symbolism in The Great Gatsby green light', 'English', 'Literature', 'Intermediate', 'The green light symbolizes Gatsbys hopes and dreams, particularly his desire for Daisy and the American Dream', '["Think about what Gatsby is looking at", "Consider themes of hope and longing"]'),
      ('Music Intervals', 'What interval is from C to G?', 'Arts', 'Music', 'Beginner', 'A perfect fifth (7 semitones)', '["Count the letter names from C to G", "Consider the quality of the interval"]')
    `);
    console.log('Practice problems seeded (16 items)');

    // Seed Flashcard Decks (16 decks)
    const decks = await client.query(`
      INSERT INTO flashcard_decks (title, description, subject, topic, card_count) VALUES
      ('Algebra Terms', 'Essential algebra vocabulary', 'Mathematics', 'Algebra', 5),
      ('Biology Cell Parts', 'Cell organelles and functions', 'Science', 'Biology', 5),
      ('Chemistry Elements', 'Common chemical elements', 'Science', 'Chemistry', 5),
      ('Spanish Basics', 'Common Spanish words', 'Languages', 'Spanish', 5),
      ('Historical Figures', 'Important people in history', 'History', 'General', 5),
      ('Literary Terms', 'Literary devices and terms', 'English', 'Literature', 5),
      ('Physics Formulas', 'Key physics equations', 'Science', 'Physics', 5),
      ('Grammar Rules', 'English grammar essentials', 'English', 'Grammar', 5),
      ('Geography Capitals', 'World capitals', 'Geography', 'General', 5),
      ('Computer Terms', 'Programming vocabulary', 'Technology', 'Programming', 5),
      ('Art Movements', 'Major art movements', 'Arts', 'Art History', 5),
      ('Music Terminology', 'Musical terms and definitions', 'Arts', 'Music', 5),
      ('Math Symbols', 'Mathematical notation', 'Mathematics', 'General', 5),
      ('Science Units', 'Units of measurement', 'Science', 'General', 5),
      ('French Basics', 'Common French words', 'Languages', 'French', 5),
      ('SAT Vocabulary', 'High-frequency SAT words', 'English', 'Vocabulary', 5)
      RETURNING id
    `);
    console.log('Flashcard decks seeded (16 decks)');
    const deckIds = decks.rows.map(r => r.id);

    // Seed flashcards - one query per deck
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

    await client.query(`
      INSERT INTO flashcards (deck_id, front_text, back_text) VALUES
      ($1, 'George Washington', 'First President of the United States'),
      ($1, 'Abraham Lincoln', '16th President, abolished slavery'),
      ($1, 'Cleopatra', 'Last active ruler of the Ptolemaic Kingdom of Egypt'),
      ($1, 'Napoleon Bonaparte', 'French emperor who conquered much of Europe'),
      ($1, 'Martin Luther King Jr.', 'Civil rights leader, I Have a Dream speech')
    `, [deckIds[4]]);

    await client.query(`
      INSERT INTO flashcards (deck_id, front_text, back_text) VALUES
      ($1, 'Metaphor', 'Comparison without using like or as'),
      ($1, 'Simile', 'Comparison using like or as'),
      ($1, 'Alliteration', 'Repetition of initial consonant sounds'),
      ($1, 'Personification', 'Giving human qualities to non-human things'),
      ($1, 'Irony', 'Saying the opposite of what is meant')
    `, [deckIds[5]]);

    await client.query(`
      INSERT INTO flashcards (deck_id, front_text, back_text) VALUES
      ($1, 'F = ma', 'Force equals mass times acceleration (Newtons 2nd Law)'),
      ($1, 'E = mc2', 'Energy equals mass times speed of light squared'),
      ($1, 'v = d/t', 'Velocity equals distance divided by time'),
      ($1, 'KE = 1/2mv2', 'Kinetic energy equals half mass times velocity squared'),
      ($1, 'W = Fd', 'Work equals force times distance')
    `, [deckIds[6]]);

    await client.query(`
      INSERT INTO flashcards (deck_id, front_text, back_text) VALUES
      ($1, 'Noun', 'A person, place, thing, or idea'),
      ($1, 'Verb', 'An action or state of being word'),
      ($1, 'Adjective', 'A word that describes a noun'),
      ($1, 'Adverb', 'A word that modifies a verb, adjective, or another adverb'),
      ($1, 'Preposition', 'A word showing relationship between a noun and another word')
    `, [deckIds[7]]);

    console.log('Flashcards seeded (40 cards across 8 decks)');

    // Seed Video Lessons (16 items) - no parameters needed
    await client.query(`
      INSERT INTO video_lessons (title, description, subject, topic, video_url, thumbnail_url, duration_minutes, instructor) VALUES
      ('Introduction to Algebra', 'Learn the basics of algebraic expressions and equations', 'Mathematics', 'Algebra', 'https://www.youtube.com/watch?v=NybHckSEQBI', 'https://img.youtube.com/vi/NybHckSEQBI/hqdefault.jpg', 15, 'Khan Academy'),
      ('Cell Biology - The Cell', 'Understanding the building blocks of life', 'Science', 'Biology', 'https://www.youtube.com/watch?v=URUJD5NEXC8', 'https://img.youtube.com/vi/URUJD5NEXC8/hqdefault.jpg', 8, 'Amoeba Sisters'),
      ('Shakespeare Introduction', 'An introduction to the Bard and his works', 'English', 'Literature', 'https://www.youtube.com/watch?v=YqXAifCKLAo', 'https://img.youtube.com/vi/YqXAifCKLAo/hqdefault.jpg', 12, 'Crash Course'),
      ('World War I Summary', 'The causes and effects of the Great War', 'History', 'Modern History', 'https://www.youtube.com/watch?v=dHSQAEam2yc', 'https://img.youtube.com/vi/dHSQAEam2yc/hqdefault.jpg', 10, 'Crash Course'),
      ('The Periodic Table Explained', 'Atoms, elements, and the periodic table', 'Science', 'Chemistry', 'https://www.youtube.com/watch?v=0RRVV4Diomg', 'https://img.youtube.com/vi/0RRVV4Diomg/hqdefault.jpg', 12, 'Crash Course'),
      ('Newtons Laws of Motion', 'Understanding the three laws of motion', 'Science', 'Physics', 'https://www.youtube.com/watch?v=kKKM8Y-u7ds', 'https://img.youtube.com/vi/kKKM8Y-u7ds/hqdefault.jpg', 11, 'Crash Course'),
      ('How to Write an Essay', 'Tips for academic writing success', 'English', 'Writing', 'https://www.youtube.com/watch?v=DOJ1sG6bJCU', 'https://img.youtube.com/vi/DOJ1sG6bJCU/hqdefault.jpg', 5, 'TED-Ed'),
      ('Spanish for Beginners', 'Start your Spanish language journey', 'Languages', 'Spanish', 'https://www.youtube.com/watch?v=DAp_v7EH9AA', 'https://img.youtube.com/vi/DAp_v7EH9AA/hqdefault.jpg', 35, 'SpanishPod101'),
      ('Introduction to Geometry', 'Points, lines, angles and shapes', 'Mathematics', 'Geometry', 'https://www.youtube.com/watch?v=302eJ3TzJQU', 'https://img.youtube.com/vi/302eJ3TzJQU/hqdefault.jpg', 10, 'Khan Academy'),
      ('Ecology - Rules for Living on Earth', 'Understanding ecosystems and ecology', 'Science', 'Environmental', 'https://www.youtube.com/watch?v=izRvPaAWgyw', 'https://img.youtube.com/vi/izRvPaAWgyw/hqdefault.jpg', 10, 'Crash Course'),
      ('Statistics - Mean Median Mode', 'Data analysis fundamentals explained', 'Mathematics', 'Statistics', 'https://www.youtube.com/watch?v=uhxtUt_-GyM', 'https://img.youtube.com/vi/uhxtUt_-GyM/hqdefault.jpg', 10, 'Khan Academy'),
      ('The American Revolution', 'How America gained independence', 'History', 'American History', 'https://www.youtube.com/watch?v=HlNW7dGJAfc', 'https://img.youtube.com/vi/HlNW7dGJAfc/hqdefault.jpg', 12, 'Crash Course'),
      ('Essence of Calculus', 'Visual introduction to derivatives and integrals', 'Mathematics', 'Calculus', 'https://www.youtube.com/watch?v=WUvTyaaNkzM', 'https://img.youtube.com/vi/WUvTyaaNkzM/hqdefault.jpg', 17, '3Blue1Brown'),
      ('Programming Basics - Python', 'Your first steps in programming', 'Technology', 'Programming', 'https://www.youtube.com/watch?v=kqtD5dpn9C8', 'https://img.youtube.com/vi/kqtD5dpn9C8/hqdefault.jpg', 60, 'freeCodeCamp'),
      ('History of Art in 20 Minutes', 'Major art movements from caves to modern', 'Arts', 'Art History', 'https://www.youtube.com/watch?v=_6WJ7aOV8bY', 'https://img.youtube.com/vi/_6WJ7aOV8bY/hqdefault.jpg', 20, 'Crash Course'),
      ('Music Theory in 16 Minutes', 'Notes, scales, chords and rhythm', 'Arts', 'Music', 'https://www.youtube.com/watch?v=rgaTLrZGlUU', 'https://img.youtube.com/vi/rgaTLrZGlUU/hqdefault.jpg', 16, 'Andrew Huang')
    `);
    console.log('Video lessons seeded (16 items)');

    // Seed Vocabulary Words (16 items) - no parameters needed
    await client.query(`
      INSERT INTO vocabulary_words (word, definition, part_of_speech, example_sentence, pronunciation, difficulty_level, subject) VALUES
      ('Ephemeral', 'Lasting for a very short time', 'adjective', 'The ephemeral beauty of cherry blossoms draws millions of visitors each spring.', 'ih-FEM-er-uhl', 'Advanced', 'English'),
      ('Ubiquitous', 'Present, appearing, or found everywhere', 'adjective', 'Smartphones have become ubiquitous in modern society.', 'yoo-BIK-wi-tuhs', 'Advanced', 'English'),
      ('Hypothesis', 'A proposed explanation for a phenomenon', 'noun', 'The scientist tested her hypothesis through careful experimentation.', 'hahy-POTH-uh-sis', 'Intermediate', 'Science'),
      ('Photosynthesis', 'The process by which plants convert light to energy', 'noun', 'Photosynthesis occurs primarily in the leaves of plants.', 'foh-toh-SIN-thuh-sis', 'Intermediate', 'Science'),
      ('Benevolent', 'Well meaning and kindly', 'adjective', 'The benevolent donor gave millions to charity.', 'buh-NEV-uh-luhnt', 'Intermediate', 'English'),
      ('Algorithm', 'A step-by-step procedure for calculations', 'noun', 'The sorting algorithm organized the data efficiently.', 'AL-guh-rith-uhm', 'Intermediate', 'Technology'),
      ('Metaphor', 'A figure of speech making an implied comparison', 'noun', 'Life is a journey is a common metaphor.', 'MET-uh-for', 'Beginner', 'English'),
      ('Ecosystem', 'A community of living organisms and their environment', 'noun', 'The coral reef is a diverse marine ecosystem.', 'EE-koh-sis-tuhm', 'Beginner', 'Science'),
      ('Ambiguous', 'Open to more than one interpretation', 'adjective', 'The ambiguous statement confused everyone.', 'am-BIG-yoo-uhs', 'Intermediate', 'English'),
      ('Derivative', 'A rate of change in calculus', 'noun', 'The derivative of x squared is 2x.', 'dih-RIV-uh-tiv', 'Advanced', 'Mathematics'),
      ('Catalyst', 'A substance that speeds up a chemical reaction', 'noun', 'Enzymes act as catalysts in biological processes.', 'KAT-l-ist', 'Intermediate', 'Science'),
      ('Eloquent', 'Fluent or persuasive in speaking or writing', 'adjective', 'The eloquent speech moved the audience to tears.', 'EL-uh-kwuhnt', 'Intermediate', 'English'),
      ('Paradox', 'A seemingly contradictory statement that may be true', 'noun', 'The grandfather paradox is a famous time travel puzzle.', 'PAR-uh-doks', 'Intermediate', 'English'),
      ('Synthesis', 'The combination of parts to make a whole', 'noun', 'The synthesis of ideas led to a breakthrough.', 'SIN-thuh-sis', 'Intermediate', 'Science'),
      ('Pragmatic', 'Dealing with things sensibly and realistically', 'adjective', 'She took a pragmatic approach to solving the problem.', 'prag-MAT-ik', 'Advanced', 'English'),
      ('Empirical', 'Based on observation or experience rather than theory', 'adjective', 'The empirical evidence supported the hypothesis.', 'em-PIR-i-kuhl', 'Advanced', 'Science')
    `);
    console.log('Vocabulary words seeded (16 items)');

    // Seed Writing Prompts (16 items)
    await client.query(`
      INSERT INTO writing_prompts (title, prompt_text, genre, difficulty_level, word_count_target) VALUES
      ('A Day in the Future', 'Imagine waking up 100 years in the future. Describe your day and the world around you.', 'Creative Fiction', 'Beginner', 500),
      ('Climate Change Essay', 'Discuss the causes and effects of climate change and propose solutions for individuals.', 'Argumentative', 'Intermediate', 750),
      ('My Greatest Challenge', 'Describe a challenge you have faced and how you overcame it.', 'Personal Narrative', 'Beginner', 500),
      ('Technology Impact', 'How has technology changed the way we communicate? Analyze both positive and negative effects.', 'Analytical', 'Intermediate', 800),
      ('The Mystery Box', 'You find a mysterious box in your attic. What is inside and what happens next?', 'Creative Fiction', 'Beginner', 600),
      ('Should School Start Later?', 'Present arguments for or against changing school start times to later in the morning.', 'Persuasive', 'Intermediate', 700),
      ('A Letter to My Future Self', 'Write a letter to yourself 10 years from now.', 'Personal Narrative', 'Beginner', 400),
      ('Social Media Analysis', 'Analyze the role of social media in modern society.', 'Analytical', 'Advanced', 1000),
      ('The Hero Journey', 'Create a short story following the heros journey structure.', 'Creative Fiction', 'Intermediate', 800),
      ('Compare and Contrast', 'Compare two books you have read this year.', 'Comparative', 'Intermediate', 600),
      ('Invention Proposal', 'Describe an invention that would improve daily life and explain how it works.', 'Expository', 'Intermediate', 700),
      ('Poetry Analysis', 'Analyze the themes and literary devices in a poem of your choice.', 'Analytical', 'Advanced', 600),
      ('The Last Day on Earth', 'If you knew it was your last day on Earth, how would you spend it?', 'Creative Fiction', 'Beginner', 500),
      ('Education Reform', 'What changes would you make to the education system and why?', 'Argumentative', 'Advanced', 900),
      ('Cultural Traditions', 'Describe an important cultural tradition in your family or community.', 'Personal Narrative', 'Beginner', 500),
      ('Artificial Intelligence', 'Discuss the ethical implications of artificial intelligence.', 'Argumentative', 'Advanced', 1000)
    `);
    console.log('Writing prompts seeded (16 items)');

    // Seed Math Problems (16 items)
    await client.query(`
      INSERT INTO math_problems (problem_text, problem_type, difficulty_level, solution_steps, final_answer, topic) VALUES
      ('Solve: 2x + 5 = 13', 'Linear Equation', 'Beginner', '["Subtract 5 from both sides: 2x = 8", "Divide by 2: x = 4"]', 'x = 4', 'Algebra'),
      ('Factor: x squared minus 9', 'Factoring', 'Beginner', '["Recognize difference of squares: a2 - b2 = (a+b)(a-b)", "Apply formula with a=x, b=3"]', '(x+3)(x-3)', 'Algebra'),
      ('Find the derivative: f(x) = 3x squared + 2x - 5', 'Derivative', 'Intermediate', '["Apply power rule to each term", "d/dx(3x2) = 6x", "d/dx(2x) = 2", "d/dx(-5) = 0"]', '6x + 2', 'Calculus'),
      ('Calculate: 15 percent of 80', 'Percentage', 'Beginner', '["Convert 15% to decimal: 0.15", "Multiply: 0.15 times 80 = 12"]', '12', 'Arithmetic'),
      ('Solve: x squared minus 5x plus 6 = 0', 'Quadratic', 'Intermediate', '["Factor: (x-2)(x-3) = 0", "Set each factor to 0", "x - 2 = 0 gives x = 2", "x - 3 = 0 gives x = 3"]', 'x = 2 or x = 3', 'Algebra'),
      ('Find the area of a circle with radius 5', 'Geometry', 'Beginner', '["Use formula A = pi times r squared", "A = pi times 25 = 25pi"]', '25pi or approximately 78.54 square units', 'Geometry'),
      ('Integrate: integral of 2x dx', 'Integration', 'Intermediate', '["Apply power rule for integration", "Add 1 to exponent and divide by new exponent", "integral of 2x dx = x squared + C"]', 'x squared + C', 'Calculus'),
      ('Simplify: (3x squared y)(4xy cubed)', 'Simplification', 'Beginner', '["Multiply coefficients: 3 times 4 = 12", "Add exponents of x: 2 + 1 = 3", "Add exponents of y: 1 + 3 = 4"]', '12x cubed y to the 4th', 'Algebra'),
      ('Find mean of: 4, 8, 6, 5, 9', 'Statistics', 'Beginner', '["Sum all values: 4+8+6+5+9 = 32", "Divide by count: 32/5 = 6.4"]', '6.4', 'Statistics'),
      ('Solve: 3(x - 2) = 2(x + 1)', 'Linear Equation', 'Intermediate', '["Distribute: 3x - 6 = 2x + 2", "Subtract 2x from both sides: x - 6 = 2", "Add 6 to both sides: x = 8"]', 'x = 8', 'Algebra'),
      ('Find sin(30 degrees)', 'Trigonometry', 'Beginner', '["Recall special angle value", "sin(30) = 1/2"]', '0.5 or 1/2', 'Trigonometry'),
      ('Calculate compound interest: P=1000, r=5 percent, t=2 years', 'Finance', 'Intermediate', '["Use formula A = P(1+r)^t", "A = 1000(1.05)^2", "A = 1000 times 1.1025"]', '$1,102.50', 'Finance'),
      ('Find the slope between (2,3) and (6,11)', 'Slope', 'Beginner', '["Use formula m = (y2-y1)/(x2-x1)", "m = (11-3)/(6-2) = 8/4"]', 'm = 2', 'Algebra'),
      ('Solve: absolute value of (x - 3) = 7', 'Absolute Value', 'Intermediate', '["Set up two equations: x-3=7 and x-3=-7", "Solve first: x = 10", "Solve second: x = -4"]', 'x = 10 or x = -4', 'Algebra'),
      ('Find the probability of rolling a 6 on a fair die', 'Probability', 'Beginner', '["Total possible outcomes = 6", "Favorable outcomes (rolling 6) = 1", "P = favorable/total = 1/6"]', '1/6 or approximately 0.167', 'Probability'),
      ('Evaluate: log base 2 of 8', 'Logarithm', 'Intermediate', '["Ask: 2 to what power equals 8?", "2 cubed = 8", "Therefore log2(8) = 3"]', '3', 'Algebra')
    `);
    console.log('Math problems seeded (16 items)');

    // Seed Achievements (16 items)
    await client.query(`
      INSERT INTO achievements (title, description, icon, points, category, criteria) VALUES
      ('First Steps', 'Complete your first lesson', 'star', 10, 'Learning', '{"lessons_completed": 1}'),
      ('Quiz Master', 'Score 100 percent on any quiz', 'trophy', 50, 'Quizzes', '{"perfect_score": true}'),
      ('Bookworm', 'Complete 10 study materials', 'book', 30, 'Learning', '{"materials_completed": 10}'),
      ('Consistent Learner', 'Study for 7 days in a row', 'calendar', 40, 'Dedication', '{"streak_days": 7}'),
      ('Math Whiz', 'Solve 25 math problems correctly', 'calculator', 35, 'Mathematics', '{"problems_solved": 25}'),
      ('Wordsmith', 'Learn 50 vocabulary words', 'abc', 30, 'Vocabulary', '{"words_learned": 50}'),
      ('Essay Expert', 'Get an A grade on an essay', 'file-text', 45, 'Writing', '{"essay_grade_a": true}'),
      ('Quick Learner', 'Complete a lesson in under 10 minutes', 'zap', 20, 'Learning', '{"fast_completion": true}'),
      ('Night Owl', 'Study after 10 PM', 'moon', 15, 'Dedication', '{"late_study": true}'),
      ('Early Bird', 'Study before 7 AM', 'sun', 15, 'Dedication', '{"early_study": true}'),
      ('Goal Getter', 'Complete 5 goals', 'target', 40, 'Goals', '{"goals_completed": 5}'),
      ('Video Scholar', 'Watch 10 video lessons', 'video', 25, 'Learning', '{"videos_watched": 10}'),
      ('Flash Master', 'Review 100 flashcards', 'layers', 30, 'Learning', '{"flashcards_reviewed": 100}'),
      ('Chat Champion', 'Have 10 AI tutor conversations', 'message-circle', 20, 'AI Tutor', '{"chat_sessions": 10}'),
      ('Perfect Week', 'Study every day for a week', 'award', 50, 'Dedication', '{"perfect_week": true}'),
      ('Subject Expert', 'Complete all materials in one subject', 'graduation-cap', 60, 'Learning', '{"subject_complete": true}')
    `);
    console.log('Achievements seeded (16 items)');

    // Seed goals for demo user
    await client.query(`
      INSERT INTO goals (user_id, title, description, target_date, category, status, progress_percentage) VALUES
      ($1, 'Master Algebra', 'Complete the algebra learning path with 90 percent quiz scores', '2025-06-30', 'Learning', 'in_progress', 45),
      ($1, 'Read 10 Books', 'Read 10 literature books this semester', '2025-05-31', 'Reading', 'in_progress', 30),
      ($1, 'Improve Essay Writing', 'Get consistent A grades on essays', '2025-04-30', 'Writing', 'in_progress', 60),
      ($1, 'Learn 200 Spanish Words', 'Build vocabulary for conversational Spanish', '2025-07-31', 'Languages', 'in_progress', 25),
      ($1, 'Complete Physics Course', 'Finish all physics modules and pass final quiz', '2025-08-31', 'Learning', 'in_progress', 15),
      ($1, 'Ace Statistics', 'Get above 90 percent on all statistics quizzes', '2025-09-30', 'Learning', 'in_progress', 10),
      ($1, 'Write 5 Essays', 'Complete 5 graded essays this term', '2025-06-15', 'Writing', 'in_progress', 20),
      ($1, 'Study 100 Hours', 'Log 100 hours of total study time', '2025-12-31', 'Dedication', 'in_progress', 35),
      ($1, 'Master Flashcards', 'Review all flashcard decks with 90 percent confidence', '2025-05-15', 'Learning', 'in_progress', 40),
      ($1, 'Earn 10 Achievements', 'Unlock 10 achievement badges', '2025-07-01', 'Goals', 'in_progress', 50),
      ($1, 'Complete Geometry', 'Finish geometry deep dive learning path', '2025-04-15', 'Learning', 'in_progress', 55),
      ($1, 'Watch All Videos', 'Complete all video lessons in Mathematics', '2025-08-01', 'Learning', 'in_progress', 20),
      ($1, 'Practice Daily', 'Solve at least 1 practice problem every day for 30 days', '2025-03-30', 'Dedication', 'in_progress', 70),
      ($1, 'SAT Prep', 'Score above 1400 on SAT practice tests', '2025-10-15', 'Testing', 'in_progress', 15),
      ($1, 'Learn French Basics', 'Complete French basics flashcard deck', '2025-11-30', 'Languages', 'in_progress', 5)
    `, [studentId]);
    console.log('Goals seeded (15 items)');

    // Create sample chat sessions
    const chatSession1 = await client.query(`
      INSERT INTO chat_sessions (user_id, title, subject) VALUES ($1, 'Help with Algebra', 'Mathematics') RETURNING id
    `, [studentId]);
    await client.query(`
      INSERT INTO chat_messages (session_id, role, content) VALUES
      ($1, 'user', 'Can you help me understand quadratic equations?'),
      ($1, 'assistant', 'Of course! A quadratic equation is a polynomial equation of degree 2, meaning the highest power of the variable is 2. The standard form is ax squared + bx + c = 0, where a, b, and c are constants and a is not zero. There are three main methods to solve them: factoring, completing the square, and the quadratic formula. Would you like me to explain each method?'),
      ($1, 'user', 'Yes, please explain factoring first.'),
      ($1, 'assistant', 'Factoring is the simplest method when it works. The goal is to rewrite the equation as a product of two binomials. For example, x squared - 5x + 6 = 0 can be factored as (x-2)(x-3) = 0. To factor, you look for two numbers that multiply to give c (6) and add to give b (-5). Those numbers are -2 and -3. Then set each factor equal to zero: x-2=0 gives x=2, and x-3=0 gives x=3.')
    `, [chatSession1.rows[0].id]);

    const chatSession2 = await client.query(`
      INSERT INTO chat_sessions (user_id, title, subject) VALUES ($1, 'Biology Questions', 'Science') RETURNING id
    `, [studentId]);
    await client.query(`
      INSERT INTO chat_messages (session_id, role, content) VALUES
      ($1, 'user', 'What is the difference between prokaryotic and eukaryotic cells?'),
      ($1, 'assistant', 'Great question! The main differences are: 1) Nucleus: Eukaryotic cells have a membrane-bound nucleus containing DNA, while prokaryotic cells have their DNA in a nucleoid region without a membrane. 2) Size: Eukaryotic cells are generally larger (10-100 micrometers) than prokaryotic cells (1-10 micrometers). 3) Organelles: Eukaryotic cells have membrane-bound organelles like mitochondria, ER, and Golgi apparatus, while prokaryotic cells lack these. 4) Examples: Bacteria are prokaryotes, while animal and plant cells are eukaryotes.')
    `, [chatSession2.rows[0].id]);
    console.log('Chat sessions seeded (2 sessions with messages)');

    // Seed some sample essays for demo user
    await client.query(`
      INSERT INTO essays (user_id, title, content, prompt, subject, word_count, status) VALUES
      ($1, 'The Impact of Technology on Education', 'Technology has fundamentally transformed the landscape of education in the 21st century. From online learning platforms to interactive whiteboards, digital tools have created new opportunities for students and teachers alike. The integration of technology in classrooms has enabled personalized learning, where students can progress at their own pace and receive immediate feedback on their work. However, this digital revolution also raises important questions about equity, screen time, and the role of human connection in learning.', 'How has technology changed the way we learn? Discuss both benefits and challenges.', 'English', 87, 'draft'),
      ($1, 'Climate Change Solutions', 'Climate change represents one of the greatest challenges facing humanity today. The evidence is clear: global temperatures are rising, ice caps are melting, and extreme weather events are becoming more frequent. While the problem may seem overwhelming, there are practical steps that individuals and communities can take to reduce their carbon footprint and mitigate the effects of climate change. This essay explores both the causes and potential solutions to this global crisis.', 'Discuss the causes and effects of climate change and propose solutions.', 'Science', 82, 'draft')
    `, [studentId]);
    console.log('Sample essays seeded (2 items)');

    // Seed study sessions for analytics
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

    await client.query('COMMIT');

    console.log('\n=============================================');
    console.log('  Database seeding completed successfully!');
    console.log('=============================================');
    console.log('\nSeeded data summary:');
    console.log('  - 5 Users');
    console.log('  - 17 Learning Paths');
    console.log('  - 17 Study Materials');
    console.log('  - 17 Quizzes with 24 Questions');
    console.log('  - 16 Practice Problems');
    console.log('  - 16 Flashcard Decks with 40 Cards');
    console.log('  - 16 Video Lessons');
    console.log('  - 16 Vocabulary Words');
    console.log('  - 16 Writing Prompts');
    console.log('  - 16 Math Problems');
    console.log('  - 16 Achievements');
    console.log('  - 15 Goals');
    console.log('  - 2 Chat Sessions with Messages');
    console.log('  - 2 Sample Essays');
    console.log('  - 8 Study Sessions');
    console.log('  - 10 Performance Analytics');
    console.log('\nDemo Accounts:');
    console.log('  Student: student@demo.com / password123');
    console.log('  Teacher: teacher@demo.com / password123');

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
