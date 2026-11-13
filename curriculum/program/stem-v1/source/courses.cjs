/**
 * LiberiaLearn STEM Excellence Program V1: the K-12 course catalog (program planning authority).
 *
 * Owner: Chief of Staff. Consumers: Content Factory V4 (lesson production orders) and the
 * Student Experience owner (day navigation). This is NOT a lesson generator and it is not read by
 * lib/curriculum/generationEngine.ts, the legacy generator. It records which courses a STEM-focused
 * school day needs, in which grade, with which unit sequence, interactive teaching blocks and labs.
 *
 * Authority: every unit is LIBERIALEARN_PROPOSED. MOE mapping is a production gate, not a claim
 * made here. A course listed here holds no approved lesson until a specific lesson version passes
 * the program gates in docs/program/STEM_PROGRAM_V1.md.
 *
 * Unit strings are "Unit title :: performance task the learner completes". The performance task is
 * what makes the unit specific: it is the evidence a lesson in that unit must produce.
 */

const STANDARD_WEEK_PERIODS = 30; // Codex STANDARD_45: six 45-minute periods x five days.

/** Weekly STANDARD_45 periods per course. Each band sums to 30. LiberiaLearn proposal; not MOE policy. */
const WEEKLY = {
  "K-2": { ENGLISH: 8, MATH: 7, SCIENCE: 4, SOCIAL_STUDIES: 3, COMPUTING: 2, ENGINEERING: 2, ARTS_PE: 4 },
  "3-5": { ENGLISH: 7, MATH: 7, SCIENCE: 5, SOCIAL_STUDIES: 3, COMPUTING: 3, ENGINEERING: 2, ARTS_PE: 3 },
  "6-9": { ENGLISH: 6, MATH: 6, SCIENCE: 6, SOCIAL_STUDIES: 3, CIVICS: 2, COMPUTING: 3, ENGINEERING: 2, ARTS_PE: 2 },
  "10-12": { ENGLISH: 5, MATH: 6, BIOLOGY: 3, CHEMISTRY: 3, PHYSICS: 3, COMPUTING: 3, ENGINEERING: 2, SOCIAL_STUDIES: 2, CIVICS: 1, ARTS_PE: 2 },
};

const bandOf = (grade) => (grade <= 2 ? "K-2" : grade <= 5 ? "3-5" : grade <= 9 ? "6-9" : "10-12");

/** Course definitions: canonical subject code (lib/curriculum/subjectTaxonomy.ts) and the live inventory subjects it draws on. */
const COURSE_DEFS = {
  MATH: { subject: "MATH", pillar: "M", inventorySubjects: ["MATH"], platform: true },
  SCIENCE: { subject: "SCIENCE", pillar: "S", inventorySubjects: ["SCIENCE"], platform: true },
  BIOLOGY: { subject: "SCIENCE", pillar: "S", inventorySubjects: ["SCIENCE"], platform: true, strand: "BIOLOGY" },
  CHEMISTRY: { subject: "SCIENCE", pillar: "S", inventorySubjects: ["SCIENCE"], platform: true, strand: "CHEMISTRY" },
  PHYSICS: { subject: "SCIENCE", pillar: "S", inventorySubjects: ["SCIENCE"], platform: true, strand: "PHYSICS" },
  COMPUTING: { subject: "COMPUTER_SCIENCE", pillar: "T", inventorySubjects: ["COMPUTER_SCIENCE"], platform: true },
  ENGINEERING: { subject: "ENGINEERING_FOUNDATIONS", pillar: "E", inventorySubjects: ["ENGINEERING_FOUNDATIONS", "ENGINEERING"], platform: true },
  ENGLISH: { subject: "LITERACY", pillar: "LANGUAGE", inventorySubjects: ["ENGLISH", "LITERACY"], platform: true },
  SOCIAL_STUDIES: { subject: "SOCIAL_STUDIES", pillar: "HUMANITIES", inventorySubjects: ["SOCIAL_STUDIES", "HISTORY"], platform: true },
  CIVICS: { subject: "CIVICS", pillar: "HUMANITIES", inventorySubjects: ["CIVICS"], platform: true },
  ARTS_PE: { subject: null, pillar: "WELLBEING", inventorySubjects: [], platform: false },
};

/**
 * Interactive teaching blocks each course needs, by band. EXISTING = teaching-blocks/1.1.0 type in
 * lib/learner-experience/teaching/registry.ts. PROPOSED = needed for STEM excellence but absent;
 * T1 (Student Experience) owns any registry change, as an additive minor version agreed with T2.
 */
const BLOCKS = {
  MATH: {
    "K-2": { existing: ["ARRAY_MODEL", "SHAPE_MODEL", "SORT", "CHECK"], proposed: ["TEN_FRAME_COUNTERS", "AUDIO_PROMPT"] },
    "3-5": { existing: ["ARRAY_MODEL", "AREA_MODEL", "FRACTION_MODEL", "FRACTION_NUMBER_LINE", "PLACE_VALUE_CHART", "WORKED_SOLUTION", "NUMERIC_RESPONSE", "MISTAKE_ANALYSIS"], proposed: ["GRAPH_BUILDER"] },
    "6-9": { existing: ["FRACTION_COMPARE", "SHAPE_MODEL", "EQUATION", "WORKED_SOLUTION", "NUMERIC_RESPONSE", "MISTAKE_ANALYSIS", "DATA_PLOT"], proposed: ["COORDINATE_PLANE", "FUNCTION_TABLE", "EQUATION_BALANCE", "GRAPH_BUILDER"] },
    "10-12": { existing: ["EQUATION", "WORKED_SOLUTION", "NUMERIC_RESPONSE", "MISTAKE_ANALYSIS", "DATA_PLOT"], proposed: ["COORDINATE_PLANE", "FUNCTION_TABLE", "GRAPH_BUILDER", "PROBABILITY_SIMULATOR"] },
  },
  SCIENCE: {
    "K-2": { existing: ["SORT", "SEQUENCE", "PROCESS_CYCLE", "CHECK"], proposed: ["OBSERVATION_LOG", "AUDIO_PROMPT"] },
    "3-5": { existing: ["PREDICT_OBSERVE", "PROCESS_CYCLE", "DATA_PLOT", "SORT", "CHECK"], proposed: ["MEASUREMENT_TABLE", "FAIR_TEST_PLANNER"] },
    "6-9": { existing: ["PARTICLE_MODEL", "PREDICT_OBSERVE", "DATA_PLOT", "PROCESS_CYCLE", "WRITING_ORGANIZER"], proposed: ["MEASUREMENT_TABLE", "FAIR_TEST_PLANNER", "GRAPH_BUILDER"] },
  },
  SENIOR_SCIENCE: { "10-12": { existing: ["PARTICLE_MODEL", "PREDICT_OBSERVE", "DATA_PLOT", "EQUATION", "WORKED_SOLUTION", "NUMERIC_RESPONSE"], proposed: ["MEASUREMENT_TABLE", "FAIR_TEST_PLANNER", "GRAPH_BUILDER", "UNCERTAINTY_CALCULATOR"] } },
  COMPUTING: {
    "K-2": { existing: ["SEQUENCE", "SORT", "CHECK"], proposed: ["GRID_ROBOT_PROGRAM"] },
    "3-5": { existing: ["SEQUENCE", "SORT", "MISTAKE_ANALYSIS"], proposed: ["GRID_ROBOT_PROGRAM", "BLOCK_PROGRAM"] },
    "6-9": { existing: ["MISTAKE_ANALYSIS", "STEP_REVEAL", "CHECK"], proposed: ["BLOCK_PROGRAM", "CODE_TRACE", "CODE_RUNNER"] },
    "10-12": { existing: ["MISTAKE_ANALYSIS", "STEP_REVEAL"], proposed: ["CODE_TRACE", "CODE_RUNNER"] },
  },
  ENGINEERING: {
    "K-2": { existing: ["SEQUENCE", "CHECK"], proposed: ["DESIGN_CYCLE", "OBSERVATION_LOG"] },
    "3-5": { existing: ["SHAPE_MODEL", "DATA_PLOT"], proposed: ["DESIGN_CYCLE", "MEASUREMENT_TABLE"] },
    "6-9": { existing: ["SHAPE_MODEL", "DATA_PLOT", "WORKED_SOLUTION"], proposed: ["DESIGN_CYCLE", "MEASUREMENT_TABLE", "BUDGET_CONSTRAINT_TABLE"] },
    "10-12": { existing: ["DATA_PLOT", "EQUATION", "WORKED_SOLUTION"], proposed: ["DESIGN_CYCLE", "MEASUREMENT_TABLE", "BUDGET_CONSTRAINT_TABLE"] },
  },
  ENGLISH: {
    "K-2": { existing: ["SENTENCE_BUILDER", "SEQUENCE", "SORT"], proposed: ["PHONICS_BLENDER", "AUDIO_PROMPT"] },
    "3-5": { existing: ["READING_PASSAGE", "SOURCE_EVIDENCE", "SENTENCE_BUILDER", "WRITING_ORGANIZER"], proposed: [] },
    "6-9": { existing: ["READING_PASSAGE", "SOURCE_EVIDENCE", "WRITING_ORGANIZER", "SENTENCE_BUILDER"], proposed: [] },
    "10-12": { existing: ["READING_PASSAGE", "SOURCE_EVIDENCE", "WRITING_ORGANIZER"], proposed: [] },
  },
  HUMANITIES: {
    "K-2": { existing: ["SORT", "SEQUENCE", "MAP_EXPLORER"], proposed: ["AUDIO_PROMPT"] },
    "3-5": { existing: ["MAP_EXPLORER", "SEQUENCE", "SOURCE_EVIDENCE", "SORT"], proposed: [] },
    "6-9": { existing: ["MAP_EXPLORER", "SOURCE_EVIDENCE", "SEQUENCE", "DATA_PLOT", "WRITING_ORGANIZER"], proposed: [] },
    "10-12": { existing: ["SOURCE_EVIDENCE", "SEQUENCE", "DATA_PLOT", "WRITING_ORGANIZER"], proposed: [] },
  },
};

const blockKey = (course) => (["BIOLOGY", "CHEMISTRY", "PHYSICS"].includes(course) ? "SENIOR_SCIENCE" : ["SOCIAL_STUDIES", "CIVICS"].includes(course) ? "HUMANITIES" : course);

/** Units per grade and course. Grade 0 = Kindergarten. */
const UNITS = {
  MATH: {
    0: ["Counting to 20 with objects :: count a pile of seeds two ways and show the total is the same", "More, fewer, the same :: match two groups one-to-one and say which has more", "Shapes around us :: find circles, triangles and rectangles in the classroom and sort them", "Patterns with beads and seeds :: copy, extend and create an AB and ABB pattern", "Comparing length and weight :: order three sticks by length and two bags by weight", "Joining and separating within 10 :: act out a market story and record it with counters"],
    1: ["Numbers to 100 in tens and ones :: bundle sticks into tens and write the number", "Addition and subtraction within 20 :: solve a story problem with make-ten and explain the strategy", "Place value tens and ones :: show 47 three ways and say what each digit is worth", "Measuring length with units :: measure a desk with hand spans and with cubes, explain why counts differ", "Time and Liberian money :: pay for an item with coins and count the change", "Halves and quarters of shapes :: fold paper into equal parts and explain what equal means"],
    2: ["Numbers to 1,000 :: build 3-digit numbers with base-ten blocks and compare them", "Add and subtract within 100 with regrouping :: solve a two-step market problem and check by the inverse", "Equal groups: the start of multiplication :: arrange 12 mangoes in equal rows in every way possible", "Measuring in centimetres, metres and kilograms :: estimate, then measure, and record the difference", "Picture and bar graphs :: survey the class and draw a bar graph that answers a question", "Fractions of shapes and sets :: shade 1/2, 1/3, 1/4 of shapes and of a set of bottle caps"],
    3: ["Multiplication and division facts with arrays :: use an array to show why 6 x 4 = 4 x 6 and 24 / 6 = 4", "Place value to 10,000 and rounding :: round a town population and justify on a number line", "Fractions on the number line :: place unit and non-unit fractions between 0 and 1", "Area by counting squares :: compare the area of two garden plots on grid paper", "Perimeter :: find the fence needed around a plot and contrast it with area", "Scaled bar graphs :: read and draw a graph where one square stands for 5"],
    4: ["Multi-digit multiplication :: multiply a 3-digit by a 1-digit number with the area model and an algorithm", "Division with remainders :: share 157 exercise books among 6 classes and interpret the remainder", "Equivalent and comparing fractions :: prove 2/3 = 4/6 with models and order fractions with benchmarks", "Decimals: tenths and hundredths :: link money to decimals and place them on a number line", "Angles, lines and symmetry :: measure angles with a protractor and classify them", "Measurement conversions :: convert between metres and centimetres in a building task"],
    5: ["Multiplication models and multi-digit multiplication :: split both factors in an area model and explain every partial product", "Division with two-digit divisors :: estimate, divide and check a bulk-buying problem", "Adding and subtracting unlike fractions :: rename with a common unit on a model before computing", "Decimal operations :: add, subtract and multiply decimals in a shopping budget", "Volume of rectangular prisms :: build boxes from unit cubes and derive V = l x w x h", "Coordinate plane and patterns :: plot a rule-generated pattern and describe the relationship"],
    6: ["Ratios and rates :: compare two cooking ratios with a table and a double number line", "Percent :: find discounts and VAT on market prices and check by estimation", "Dividing fractions :: explain 3/4 / 1/8 with a measurement model", "Integers on the number line :: model temperatures and bank balances with negatives", "Expressions and one-step equations :: write and solve an equation from a story and check it", "Area of triangles and polygons; mean and median :: decompose shapes, and summarise rainfall data"],
    7: ["Number sense and place value: millions to thousandths :: read, write and compare large and small quantities in context", "Fractions: one whole, equal units :: represent, rename and combine fractions on models and number lines", "Area and perimeter of rectangles and triangles :: decide which measurement a real problem needs and compute it with units", "Proportional relationships :: test whether a table is proportional and find the unit rate", "Linear equations :: solve two-step equations and model a mobile-money tariff", "Probability and data :: run a chance experiment, compare experimental and theoretical probability"],
    8: ["Exponents and scientific notation :: compare distances in the solar system in scientific notation", "Linear functions and slope :: interpret slope as a rate in a taxi-fare graph", "Systems of linear equations :: solve a two-supplier price comparison by graph and by substitution", "The Pythagorean theorem :: prove it with areas and find a ladder length", "Transformations and congruence :: describe a sequence of moves that maps one figure to another", "Bivariate data and scatter plots :: fit a line to height-armspan data and judge the fit"],
    9: ["Algebraic expressions and polynomials :: expand and factor expressions using an area model", "Linear equations and inequalities :: model a budget constraint and graph the solution set", "Quadratics and factoring :: find when a thrown ball lands by factoring", "Functions :: distinguish linear, quadratic and exponential growth from tables", "Similar triangles and geometric reasoning :: measure a tree height with shadows and justify by similarity", "Statistics and sampling :: design a fair survey and explain sampling bias"],
    10: ["Quadratic functions :: maximise the area of a fenced plot with fixed fencing", "Right-triangle trigonometry :: find the height of a building from an angle of elevation", "Circle geometry :: prove and apply angle properties of circles", "Sequences and series :: model savings with arithmetic and geometric series", "Matrices and transformations :: represent a transformation with a matrix", "Probability :: compute compound probabilities and check by simulation"],
    11: ["Exponential and logarithmic functions :: model population growth and solve for doubling time", "Trigonometric functions and identities :: model tide or daylight data with a sine curve", "Vectors :: resolve forces on a sloped roof", "Coordinate geometry :: find equations of lines and circles from conditions", "Statistical inference basics :: estimate a mean with a confidence statement", "Financial mathematics :: compare loan offers using compound interest"],
    12: ["Differentiation :: find the rate of change of a quantity and an optimum", "Introduction to integration :: find area under a velocity-time graph as distance", "Probability distributions :: use the binomial distribution for a quality-control problem", "Mathematical modelling project :: model a Liberian water, energy or transport problem end to end", "WASSCE review: number and algebra :: diagnose and repair errors on past-style items", "WASSCE review: geometry, trigonometry and statistics :: timed mixed practice with worked feedback"],
  },
  SCIENCE: {
    0: ["Using our senses to observe :: describe a mystery object using touch, sight, sound and smell (no tasting)", "Living and non-living things :: sort pictures and objects and explain one reason", "Plants need water and light :: plant beans in two conditions and draw what happens each week", "Weather today :: record sun, rain or wind each day for two weeks on a picture chart", "Sinking and floating :: predict, test and sort ten classroom objects", "Pushes and pulls :: make a toy car move faster or slower and say what changed"],
    1: ["Parts of a plant :: label root, stem, leaf and flower on a real plant and say each job", "Animals and their homes :: match Liberian animals to habitats and explain the fit", "Day, night and the sun :: track a shadow at morning, noon and afternoon", "Materials and their properties :: test which material keeps rain off a toy best", "Water around us :: find where water collects at school and why", "Keeping my body healthy :: plan a healthy plate from local foods"],
    2: ["Life cycles :: sequence the life cycle of a frog and a butterfly from observations", "Soil types :: compare how fast water drains through sand, clay and loam", "States of water :: observe ice melting and water drying and describe the change", "Light and shadows :: make a shadow longer and shorter and explain why", "Sound and vibration :: make a drum and show that sound comes from vibration", "Habitats of Liberia :: compare rainforest and mangrove habitats"],
    3: ["Plant growth fair test :: change one variable and keep others the same", "Food chains :: build a food chain from a Liberian forest and predict a change", "Magnets :: test which materials are magnetic and how distance matters", "Rocks, soil and erosion :: model erosion on a slope with and without plants", "The water cycle :: explain where rain comes from with a cycle model", "Measuring temperature :: read a thermometer and record temperatures through a day"],
    4: ["Digestion and the human body :: model the path of food and the job of each organ", "Simple electric circuits :: build a working circuit and explain why a break stops it", "Forces and motion :: measure how ramp height changes how far a car rolls", "Mixtures and separation :: separate sand, salt and water and explain each step", "Recording weather :: collect a week of rainfall and temperature data and graph it", "Ecosystems and conservation :: explain how deforestation affects one food web"],
    5: ["Earth and water :: trace rainfall from the sky to the St. Paul River and the ocean", "Heat transfer :: compare which cup keeps water warm longest", "Simple machines :: lift a load with a lever and measure the effort", "Animal systems and habitats :: explain how body structures help survival", "The solar system and seasons :: model day length and the dry and rainy seasons", "Scientific problem-solving in agriculture :: design a fair test of seedling growth"],
    6: ["Cells and microscopes :: identify plant and animal cell parts and their jobs", "Energy forms and transformations :: trace energy from the sun to a cooked meal", "The particle model of matter :: explain dissolving with particles", "Plant reproduction :: dissect a flower and explain pollination", "Earth's layers and rocks :: model rock formation and the rock cycle", "Health and disease :: explain how malaria spreads and how nets interrupt it"],
    7: ["Observation and inference :: separate what you observe from what you infer in an investigation", "States of matter and energy :: predict and explain melting, freezing and evaporation with the particle model", "Mixtures, solutions and separation :: purify muddy water and evaluate the method", "Human body and nutrition :: analyse a meal for nutrients and justify a balanced diet", "Weather and climate :: compare a month of local weather data with climate averages", "Ecosystems and energy flow :: build an energy pyramid and predict effects of overfishing"],
    8: ["Atoms, elements and the periodic table :: explain periodic patterns from atomic structure", "Chemical reactions :: distinguish physical and chemical change by evidence and balance a simple equation", "Forces and gravity :: test how mass and height affect falling objects", "Waves, sound and light :: measure the relationship between frequency and wavelength", "Cell division :: sequence mitosis and explain why it matters for growth", "Earthquakes and plate tectonics :: explain where earthquakes happen using plate boundaries"],
    9: ["Electricity and magnetism :: build an electromagnet and test what changes its strength", "Acids, bases and indicators :: make a cabbage indicator and classify household liquids", "Heredity and variation :: predict offspring traits with a Punnett square", "Ecosystem balance :: model predator-prey populations and explain fluctuations", "Energy resources and hydropower :: evaluate Mount Coffee hydropower against other sources", "The heart and circulation :: measure pulse before and after exercise and explain the change"],
  },
  BIOLOGY: {
    10: ["Cell biology :: compare cell structures and relate each to function", "Classification of living things :: build a dichotomous key for local organisms", "Photosynthesis :: test the effect of light intensity on oxygen production", "Nutrition in animals and humans :: test foods for starch, sugar and protein", "Transport in plants and animals :: model blood flow and measure transpiration", "Ecology of Liberian forests :: survey a quadrat and calculate species abundance"],
    11: ["Respiration :: measure CO2 output from germinating seeds", "Excretion and homeostasis :: explain how kidneys regulate water", "Coordination and the nervous system :: measure reaction time and analyse variation", "Reproduction :: compare sexual and asexual reproduction in plants and animals", "Genetics :: solve monohybrid crosses and explain sex-linked inheritance", "Evolution and adaptation :: explain adaptation using natural selection evidence"],
    12: ["Ecology and conservation :: propose a conservation plan for a threatened Liberian species", "Biotechnology and disease :: explain how vaccines work and evaluate public-health data", "Microorganisms and public health :: explain water-borne disease spread and control", "WASSCE biology practical skills :: plan, record and analyse a practical", "Data analysis in biology :: interpret graphs and calculate rates from experimental data", "Integrated WASSCE review :: diagnose and repair misconceptions across topics"],
  },
  CHEMISTRY: {
    10: ["Particulate nature of matter and separation :: choose and justify a separation method", "Atomic structure :: derive electron configuration and explain isotopes", "The periodic table :: predict properties from group and period trends", "Chemical bonding :: explain properties of ionic and covalent substances", "Stoichiometry and the mole :: calculate reacting masses and percentage yield", "Acids, bases and salts :: prepare a salt and calculate concentration by titration data"],
    11: ["Redox reactions :: identify oxidation and reduction in rusting iron", "Rates of reaction :: measure how temperature changes reaction rate", "Chemical equilibrium :: predict shifts with Le Chatelier's principle", "Energetics :: calculate enthalpy change from temperature data", "Electrochemistry :: build a simple cell and explain electron flow", "Introduction to organic chemistry :: name and draw hydrocarbons and their reactions"],
    12: ["Organic functional groups :: identify alcohols, acids and esters by tests", "Industrial chemistry in Liberia :: explain the chemistry of iron-ore and rubber processing", "Environmental chemistry and water purification :: design and evaluate a water-treatment sequence", "Quantitative analysis :: carry out titration calculations with uncertainty", "WASSCE chemistry practical skills :: plan, record and analyse a practical", "Integrated WASSCE review :: diagnose and repair errors across topics"],
  },
  PHYSICS: {
    10: ["Measurement, units and uncertainty :: measure a length several times and report mean and uncertainty", "Motion and kinematics :: analyse a velocity-time graph to find acceleration and distance", "Forces and Newton's laws :: predict motion from net force and test with a trolley", "Work, energy and power :: calculate the power of a learner climbing stairs", "Pressure and fluids :: explain why a dam wall is thicker at the base", "Heat and temperature :: measure specific heat capacity of water"],
    11: ["Waves :: measure wave speed and relate frequency and wavelength", "Light and optics :: trace rays through lenses and find focal length", "Sound :: measure the speed of sound with echoes", "Current electricity :: test Ohm's law and analyse series and parallel circuits", "Magnetism :: map magnetic fields and explain the motor effect", "Oscillations and the pendulum :: test what affects a pendulum's period"],
    12: ["Electromagnetic induction and generators :: explain how Mount Coffee generates electricity", "Electronics :: build and analyse a diode and transistor circuit", "Atomic and nuclear physics :: explain radioactive decay with half-life data", "Energy systems :: compare solar and grid electricity for a rural clinic", "WASSCE physics practical skills :: plan, record and analyse a practical", "Integrated WASSCE review :: diagnose and repair errors across topics"],
  },
  COMPUTING: {
    0: ["Following step-by-step instructions :: follow and give three-step instructions to a partner (unplugged)", "Sequences in daily routines :: order picture cards for getting ready for school", "Sorting by attributes :: sort objects by colour, size or shape and explain the rule", "Repeating patterns as loops :: clap and draw a repeating pattern and say what repeats", "Moving on a grid :: guide a friend across a floor grid with arrow cards", "Safe and kind with devices :: show how to hold, share and put away a tablet"],
    1: ["Algorithms as recipes :: write picture steps to make a cup of lemonade", "Debugging wrong instructions :: find and fix the wrong step in an instruction card", "Grid robot paths :: plan a path for a robot to reach a target on a grid", "Loops in patterns :: replace repeated arrows with one repeat card", "Data: sorting and counting :: count and tally class pets and make a pictograph", "Using a tablet safely :: open, use and close an app independently and safely"],
    2: ["Sequences and loops with arrows :: program a grid robot with a loop to reach a goal", "Events and simple conditions :: act out 'if it rains, then...' rules", "Pictographs and data :: collect data and answer a question from the pictograph", "Debugging :: find the bug in a robot program and test the fix", "Passwords and privacy :: explain why passwords are private", "Stories as sequences :: sequence a short story in a block-based storyboard"],
    3: ["Block coding sequences :: program a character to move through a scene", "Loops :: use a loop to draw a shape and explain why the loop is shorter", "Conditionals :: make a character react to an event", "Data tables :: organise collected data in a table and read it", "Internet safety :: identify safe and unsafe online behaviour", "Animated story project :: plan, build, test and improve a short animation"],
    4: ["Variables :: keep score in a game with a variable", "Nested loops :: draw a pattern of shapes with a loop inside a loop", "Conditionals with input :: build a quiz that responds to answers", "Binary numbers :: represent numbers 0-15 in binary with cards", "How networks carry messages :: model packet routing with a class relay", "Game project :: design, build, test and refine a simple game"],
    5: ["Procedures and functions :: refactor repeated code into a procedure", "Debugging strategies :: trace a program step by step to find a logic error", "Data collection and spreadsheets :: record rainfall in a spreadsheet and make a chart", "Pixels and binary images :: encode a black-and-white image as binary", "Online safety and misinformation :: check a claim against two sources", "Simulation project :: build a rainfall counter that totals a week's data"],
    6: ["Algorithms and efficiency :: compare two sorting methods by counting steps", "Variables and operators :: compute change in a shop program", "Lists :: store and search a class list", "Spreadsheet formulas :: model a school-garden budget with formulas", "The internet and networks :: explain how a web page reaches a phone", "Interactive project :: build an interactive quiz with scoring"],
    7: ["Algorithm design and flowcharts :: design a flowchart for a mobile-money transfer and test it by hand", "Introduction to text programming :: write, run and debug a short program with input and output", "Conditionals and loops in code :: write a program that validates a PIN with three attempts", "Data and charts :: analyse market-price data with a spreadsheet chart", "Cybersecurity basics :: explain phishing and strong authentication", "Project: mobile-money simulator :: specify, build, test and refine a balance-tracking program"],
    8: ["Functions and parameters :: write reusable functions with parameters and return values", "Lists and iteration :: process a list of test scores to find mean and max", "Data analysis with code :: answer a question from a dataset with a program", "Hardware and logic gates :: build truth tables for AND, OR, NOT", "Networks and encryption :: encrypt and decrypt with a Caesar cipher and explain its weakness", "Project: market price tracker :: build a program that records and summarises prices"],
    9: ["Data structures :: choose between lists and dictionaries for a contact book", "Search and sort algorithms :: implement linear and binary search and compare steps", "Data science basics :: clean and visualise a small dataset", "Web pages :: build a page with HTML and CSS about a local business", "Ethics and AI literacy :: evaluate an AI system's errors and fairness", "Capstone app :: specify, build, test and present an app for a school need"],
    10: ["Programming fundamentals :: write tested programs with clear decomposition", "Object-oriented programming :: model a library system with classes", "Databases and SQL :: query a school-records database (synthetic data)", "Computer systems :: explain the fetch-decode-execute cycle", "Networking :: explain IP addressing and DNS", "Software project :: deliver a tested program to a written specification"],
    11: ["Algorithms and complexity :: compare algorithm growth rates experimentally", "Data structures :: implement a stack and a queue and use them", "Web applications :: build a form that validates and stores data", "Data science and machine learning basics :: train and evaluate a simple classifier and explain its limits", "Cybersecurity :: threat-model a mobile-money app", "Team software project :: plan, build, review and test as a team"],
    12: ["Software engineering practice :: write requirements, tests and a design document", "AI and society :: analyse benefits and risks of AI in Liberian services", "Advanced algorithms :: apply recursion and graph search to a routing problem", "Systems design :: design a system for offline-first data collection", "Capstone :: deliver, test and present a complete software product", "WASSCE ICT review :: diagnose and repair errors across topics"],
  },
  ENGINEERING: {
    0: ["Build a tall tower :: build the tallest tower from local materials and explain what made it stand", "A paper bridge :: make a paper bridge hold a cup and fold it to make it stronger", "A shelter for a toy animal :: build a shelter that stays dry when sprinkled", "Ramps and rolling :: change a ramp so a ball rolls further", "Strong shapes :: test whether triangles or squares of straws are stronger", "Share and improve :: show a design, hear an idea and make one change"],
    1: ["A bag to carry books :: design and test a carrier that holds three books", "A sun shade :: build a shade that keeps a toy cool and test it", "Ramp and ball :: design a ramp for a ball to stop on a target", "A boat that floats :: build a boat that carries the most pebbles", "A musical instrument :: make an instrument that plays high and low sounds", "Improve a design :: test, find one problem and redesign"],
    2: ["Wind spinner :: design a spinner that turns in a light breeze", "Simple water filter :: compare cloth, sand and gravel layers (adult-led, water not for drinking)", "A strong bridge :: build a bridge across a 20 cm gap that holds the most weight", "Seed-planting tool :: design a tool that plants seeds at equal spacing", "Marble run :: build a run that takes as long as possible", "Design journal :: record ideas, tests and changes in pictures and words"],
    3: ["The engineering design cycle :: define, imagine, plan, build, test and improve a pencil holder", "Structures and loads :: test how shape changes the strength of a column", "Levers :: build a lever that lifts a load with the least effort", "Rain catchment model :: design a roof gutter model that collects the most water", "Insulated cooler box :: design a box that keeps ice longest and measure melt time", "Design reflection :: compare two designs using test data"],
    4: ["Flashlight circuit :: design and build a working flashlight with a switch", "Water filter design :: test filter designs by measured clarity and flow rate (not for drinking)", "Wind-powered lifter :: design a wind machine that lifts a load", "Earthquake-resistant tower :: build a tower and test it on a shake table", "Protective packaging :: design packaging that protects an egg in a drop test", "Design showcase :: present a design with test evidence"],
    5: ["Pulleys for a well bucket :: design a pulley system and measure effort", "Truss bridges :: load-test truss designs and record failure points", "Solar oven :: design an oven and measure temperature rise over time", "Irrigation channel :: design a channel that delivers water evenly to a plot", "Specifications and fair tests :: write criteria and constraints before building", "Design review :: critique and improve a peer design with evidence"],
    6: ["Criteria and constraints :: write a design brief with budget and materials limits", "Gears and mechanisms :: build a gear train and calculate the ratio", "Electric circuit design :: design a circuit with two switches for a door alarm", "Sustainable housing model :: design a house model that stays cool and test it", "Water purification design :: design a multi-stage filter and evaluate it (not for drinking)", "Product design :: design a product that solves a classroom problem"],
    7: ["Design briefs and budgets :: write a brief with measurable criteria and a cost limit", "Garden-bed design :: design a raised bed using area and perimeter within a fencing budget", "Rain-gutter capacity :: design a gutter and test its capacity against a rainfall rate", "Trusses and structures :: model forces in a truss and test a prototype", "Hand-crank generator :: build a generator that lights an LED and measure output", "Prototype, test and refine :: run two test-refine cycles and report data"],
    8: ["Mechanisms and motion :: design a linkage that converts rotary to linear motion", "Electrical systems :: design a solar charging circuit with protection", "Materials testing :: compare tensile strength of local fibres", "Solar lamp design :: design a lamp that runs four hours and test it", "Bridge project :: design a bridge to a load specification and test to failure", "Technical sketching :: produce orthographic sketches of a design"],
    9: ["Systems thinking :: map a water-supply system and its failure points", "Sensors and electronics :: build a moisture sensor circuit for a garden", "Mechanical advantage :: design a lifting system for a load with measured efficiency", "Water systems :: design a community water storage plan within constraints", "Energy infrastructure :: analyse the Mount Coffee hydropower system and propose an improvement", "Capstone design :: deliver a design, prototype and test report for a school need"],
    10: ["Engineering drawing :: produce scaled drawings of a component", "Statics and structures :: calculate forces in a simple frame", "Circuit analysis :: design and verify a circuit to a specification", "Engineering materials :: select materials using property data", "Manufacturing processes :: plan the manufacture of a simple product", "Design project :: specify, build and test to requirements"],
    11: ["Mechanical design :: design a mechanism to a torque requirement", "Microcontrollers :: program a microcontroller to read a sensor (or simulator if no hardware)", "Fluids and water engineering :: size a pipe and pump for a water system", "Energy systems design :: size a solar system for a rural clinic", "Civil infrastructure :: design drainage for a road section", "Team engineering project :: plan, build and test as a team"],
    12: ["Engineering capstone :: deliver a full design-build-test project for a community problem", "Project management :: plan a project schedule and budget", "Ethics and safety :: analyse an engineering failure case", "Sustainable design :: evaluate a design's life-cycle impact", "Prototype and test :: run a structured test plan and report", "Portfolio :: assemble evidence of design competence"],
  },
  ENGLISH: {
    0: ["Listening and speaking :: listen to a story and answer who, what, where", "Letter sounds :: match ten letters to their sounds with pictures", "Rhymes and syllables :: clap syllables and find rhyming words", "Print concepts :: show the front, the title and where to start reading", "Retelling a story :: retell a story in order with picture cards", "Early writing :: write own name and label a drawing with sounds"],
    1: ["Short vowels and phonics :: blend and read CVC words", "High-frequency words :: read and use 50 sight words in sentences", "Reading simple sentences :: read a decodable text with accuracy", "Retelling and main events :: retell beginning, middle and end", "Writing sentences :: write a complete sentence with a capital and full stop", "Speaking to an audience :: tell the class about a family event"],
    2: ["Long vowels and blends :: read and spell words with blends and long vowels", "Reading fluency :: read a passage aloud with expression", "Comprehension :: answer literal and simple inference questions", "Narrative writing :: write a three-sentence story with a beginning, middle and end", "Nouns and verbs :: sort and use nouns and verbs", "Oral presentation :: present a short report with a picture"],
    3: ["Fluency and expression :: read a passage at grade-level pace with expression", "Main idea and details :: find the main idea of an informational text", "Paragraphs :: write a paragraph with a topic sentence and details", "Vocabulary from context :: work out word meanings from context clues", "Poetry :: read and perform a poem and explain an image in it", "Informational text :: use text features to find information"],
    4: ["Comprehension strategies :: predict, question and summarise a text", "Text features :: use headings, captions and diagrams to answer questions", "Opinion writing :: write an opinion paragraph with two reasons", "Grammar: sentences and agreement :: correct subject-verb agreement errors", "Folktales :: compare two Liberian folktales and their lessons", "Short research :: answer a question from two sources"],
    5: ["Reading comprehension :: answer literal and inferential questions and cite the text", "Descriptive writing :: write a description using sensory detail", "Reading science texts :: explain a process described in a science text", "Grammar and mechanics :: use commas and conjunctions correctly", "Persuasive writing :: write a persuasive letter to the principal", "Research skills :: take notes from a source and write in own words"],
    6: ["Grammar and mechanics :: edit a paragraph for punctuation and agreement", "Literature :: analyse a character's motivation with evidence", "Introduction to argument :: state a claim and support it with reasons and evidence", "Vocabulary :: use roots and affixes to work out meanings", "Summary writing :: summarise an informational text objectively", "Speech :: deliver a two-minute informative speech"],
    7: ["Reading for evidence :: select and quote evidence that supports an answer about an informational text", "Essay structure and argument :: write a structured argumentative essay with a counterclaim", "Literary analysis :: analyse theme and character in a short story", "Grammar for clarity :: combine sentences for clarity and variety", "Scientific writing :: write a lab report with method, results and conclusion", "Debate :: argue a position and respond to an opposing argument"],
    8: ["Literary analysis :: analyse how setting shapes conflict", "Argument writing :: write an argument with credible evidence and reasoning", "Informational writing :: explain a technical process clearly", "Grammar and style :: use active and passive voice purposefully", "Research :: write a short research report with citations", "Media literacy :: evaluate a news report for bias and evidence"],
    9: ["Literature :: analyse a novel's theme across chapters", "Argument and rhetoric :: analyse persuasive techniques in a speech", "Technical writing :: write instructions a peer can follow", "Grammar and usage :: edit for complex-sentence errors", "Research :: synthesise three sources into an argument", "Oral communication :: lead a structured discussion"],
    10: ["WASSCE comprehension :: answer comprehension items with evidence", "Summary writing :: summarise a passage to a word limit", "Essay writing: argumentative and expository :: plan and write a timed essay", "Literature in English: prose :: analyse a set text's characterisation", "Lexis and structure :: use vocabulary and grammar accurately in context", "Oral English :: distinguish vowel and consonant sounds and stress"],
    11: ["Literature in English: drama :: analyse a play's conflict and staging", "Literature in English: poetry :: analyse imagery and form", "Advanced essay writing :: write letters, speeches and articles to purpose", "Research and citation :: write a referenced report", "Technical and scientific communication :: present data in writing", "WASSCE comprehension practice :: timed comprehension with feedback"],
    12: ["WASSCE essay mastery :: write timed essays across genres", "WASSCE comprehension and summary :: timed mixed practice with worked feedback", "Literature review :: compare set texts across genres", "Lexis and structure review :: diagnose and repair grammar errors", "Oral English review :: practise WASSCE oral items", "Professional communication :: write a CV and application letter"],
  },
  SOCIAL_STUDIES: {
    0: ["Me and my family :: draw and describe the people in my family", "My school :: draw a map of the classroom and name places in it", "Community helpers :: match helpers to the jobs they do", "Rules keep us safe :: explain one class rule and why we have it", "Where things are :: use near, far, left and right to describe locations", "Celebrations in Liberia :: describe a national or family celebration"],
    1: ["My community :: identify places and services in my community", "Simple maps :: make a map of the school with a key", "Needs and wants :: sort needs and wants", "Rules, rights and duties :: explain a right and a matching duty", "Long ago and today :: compare daily life then and now", "Our flag and symbols :: explain the parts of the Liberian flag"],
    2: ["Neighbourhoods and towns :: compare a town and a village", "Maps and directions :: use cardinal directions on a map", "Work and trade :: explain how goods reach the market", "Leaders in my community :: describe what a town chief does", "Liberian culture :: describe a tradition from a Liberian ethnic group", "Caring for our environment :: plan a clean-up and explain why"],
    3: ["My county :: locate my county and its capital on a map", "Landforms and water :: identify rivers, hills and coast on a map of Liberia", "Liberian people and cultures :: compare two ethnic groups' traditions", "Local government :: explain the roles of local leaders", "Goods and services :: explain how money is used to trade", "History through sources :: use a photograph as a source about the past"],
    4: ["Regions of Liberia :: compare coastal and inland regions", "Natural resources :: map Liberia's natural resources and their uses", "Early history of Liberia :: sequence key events with a timeline", "National government :: describe the three branches of government", "Trade and economy :: explain imports and exports with examples", "Citizenship :: explain the responsibilities of a citizen"],
    5: ["Geography of Liberia :: locate counties, capitals and natural features on a map", "Counties and natural resources :: link resources to livelihoods by county", "Liberia in West Africa :: locate neighbouring countries and ECOWAS", "Rights and responsibilities :: apply rights and duties to a community case", "History through sources :: compare two accounts of the same event", "Economy and livelihoods :: explain how farmers, fishers and traders earn a living"],
    6: ["Founding of Liberia :: analyse sources about the founding period", "Government and constitution :: explain how a law is made", "Population and settlement :: interpret population data by county", "Africa and the world :: locate African regions and major features", "Economic activity :: compare primary, secondary and tertiary activities", "Peace and conflict resolution :: apply a conflict-resolution process to a case"],
    7: ["General geography: the Earth :: explain latitude, longitude and time zones", "Maps and scale :: calculate real distances from a map scale", "Weather and climate of Liberia :: interpret rainfall and temperature charts", "Population and migration :: explain push and pull factors with data", "Resources and economy :: evaluate a natural-resource decision", "West African history :: sequence and explain major West African kingdoms"],
    8: ["Liberian geography :: analyse regional differences with maps and data", "Natural resources and the environment :: evaluate forest and mining trade-offs", "Liberian history :: analyse the causes and consequences of a historical event", "Economic development :: compare development indicators", "Regional cooperation :: explain the role of ECOWAS and the AU", "Historical sources :: evaluate the reliability of two sources"],
    9: ["Modern Liberian history :: analyse the civil wars and peace process with sources", "Geography of Africa :: compare African climate zones with data", "Economics :: explain supply and demand with a market example", "Globalisation :: analyse how global trade affects Liberia", "Environment and sustainability :: evaluate a climate-adaptation plan", "Research project :: answer a historical or geographic question with sources"],
    10: ["History of West Africa :: analyse colonialism and independence movements", "Physical geography :: explain landform processes", "Human geography :: analyse urbanisation in Monrovia", "Economic history of Liberia :: analyse the role of rubber and iron ore", "Map and data skills :: interpret topographic maps", "Historical argument :: write a source-based historical argument"],
    11: ["World history :: analyse causes and effects of the world wars on Africa", "Geography of resources :: evaluate resource management with data", "Development and inequality :: compare development pathways", "Liberia since 2003 :: analyse post-conflict reconstruction", "Fieldwork skills :: plan and carry out a local geography survey", "Historical argument :: compare historians' interpretations"],
    12: ["WASSCE history review :: timed source-based questions with feedback", "WASSCE geography review :: map and data questions with feedback", "Contemporary Africa :: analyse a current regional issue with sources", "Liberia's future :: evaluate a national development plan", "Research project :: complete a source-based investigation", "Integrated review :: diagnose and repair misconceptions"],
  },
  CIVICS: {
    6: ["The Constitution of Liberia :: explain key constitutional principles with articles", "Rights and responsibilities :: apply a constitutional right to a case", "Elections and voting :: explain how a fair election works"],
    7: ["Counties and capitals of Liberia :: locate counties and capitals on a geographic map and reason about neighbours and directions", "Liberian history and national symbols :: explain the meaning of national symbols with sources", "Government structure :: compare the roles of the three branches", "Rule of law :: explain how courts protect rights", "Citizenship in the community :: plan a civic action and its evidence of impact", "Human rights :: apply the Universal Declaration to a local case"],
    8: ["Liberian history and governance :: analyse a constitutional change", "Local and national government :: compare county and national responsibilities", "Elections and participation :: analyse turnout data", "Rights and the courts :: analyse a court case summary", "Civic responsibility :: evaluate a community project", "Media and citizenship :: evaluate political information for accuracy"],
    9: ["Constitutional democracy :: analyse checks and balances", "Public policy :: evaluate a public policy with evidence", "International organisations :: explain Liberia's role in the UN and ECOWAS", "Peacebuilding :: analyse reconciliation processes", "Economic citizenship :: explain taxes and public services", "Civic research :: present a policy proposal with evidence"],
    10: ["Government and the Constitution :: analyse separation of powers", "Rights and responsibilities in law :: apply legal rights to cases"],
    11: ["Public policy and governance :: evaluate a national policy", "Elections and representation :: compare electoral systems"],
    12: ["Citizenship and nation-building :: present a civic proposal with evidence", "WASSCE civic education review :: timed mixed practice with feedback"],
  },
};

/** Registered labs (lib/labs/registry.ts ids only) linked to course-grade cells. Page-only labs are not claimed. */
const LABS = {
  "SCIENCE:7": ["molecule-motion", "weather-system", "ecosystem-balance"],
  "SCIENCE:8": ["periodic-table", "chemical-reaction", "gravity-explorer", "wave-motion", "cell-division", "tectonic-plates"],
  "SCIENCE:9": ["electric-circuit", "ecosystem-balance", "human-heart"],
  "SCIENCE:4": ["electric-circuit"],
  "SCIENCE:5": ["weather-system"],
  "SCIENCE:6": ["molecule-motion"],
  "BIOLOGY:10": ["human-heart", "ecosystem-balance"],
  "BIOLOGY:11": ["cell-division"],
  "CHEMISTRY:10": ["periodic-table", "molecule-motion"],
  "CHEMISTRY:11": ["chemical-reaction"],
  "PHYSICS:10": ["gravity-explorer"],
  "PHYSICS:11": ["wave-motion", "electric-circuit", "pendulum-lab"],
  "ENGINEERING:7": ["electric-circuit"],
  "ENGINEERING:8": ["electric-circuit"],
};

function buildCourses() {
  const out = [];
  for (let grade = 0; grade <= 12; grade++) {
    const band = bandOf(grade);
    for (const [course, weeklyPeriods] of Object.entries(WEEKLY[band])) {
      const def = COURSE_DEFS[course];
      // K-5 Social Studies carries civics content (MOE Social Studies 1-6); Grade 6 adds a short civics strand within the 6-9 band.
      if (course === "CIVICS" && !UNITS.CIVICS[grade]) throw new Error(`civics units missing for grade ${grade}`);
      if (course === "SCIENCE" && grade >= 10) continue;
      const units = def.platform ? UNITS[course]?.[grade] : [];
      if (def.platform && (!units || units.length === 0)) throw new Error(`no units for ${course} grade ${grade}`);
      const blocks = def.platform ? BLOCKS[blockKey(course)][band === "6-9" ? "6-9" : band] : { existing: [], proposed: [] };
      out.push({
        courseId: `stem1-${grade === 0 ? "k" : `g${grade}`}-${course.toLowerCase().replace(/_/g, "-")}`,
        grade,
        gradeLabel: grade === 0 ? "K" : String(grade),
        band,
        course,
        subject: def.subject,
        strand: def.strand ?? null,
        pillar: def.pillar,
        platformDelivered: def.platform,
        weeklyPeriods,
        authority: def.platform ? "LIBERIALEARN_PROPOSED_MOE_MAPPING_REQUIRED" : "TEACHER_LED_NOT_PLATFORM_CONTENT",
        inventorySubjects: def.inventorySubjects,
        units: (units ?? []).map((text, index) => {
          const [title, task] = text.split(" :: ");
          if (!title || !task) throw new Error(`unit needs "title :: task": ${course} g${grade} #${index + 1}`);
          return { unit: index + 1, title, performanceTask: task };
        }),
        blocks,
        labs: LABS[`${course}:${grade}`] ?? [],
      });
    }
  }
  return out;
}

module.exports = { STANDARD_WEEK_PERIODS, WEEKLY, COURSE_DEFS, BLOCKS, UNITS, LABS, bandOf, buildCourses };
