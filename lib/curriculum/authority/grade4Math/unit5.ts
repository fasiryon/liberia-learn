import { draftLesson, mcq, objectiveId, p, U } from "./types";

const unit = U.m5;

export const UNIT5_LESSONS = [
  draftLesson({
    slug: "estimating-time", moeObjectiveId: objectiveId("m5", 1), unitId: unit,
    payload: {
      title: "Estimating Time",
      body: "Time is measured in seconds, minutes, hours, days, weeks, months and years.\n60 seconds = 1 minute, 60 minutes = 1 hour, 24 hours = 1 day, 7 days = 1 week.\n\nTo estimate time, compare with something familiar (a benchmark):\n- Clapping your hands once takes about 1 second.\n- Singing the national anthem takes about 1 to 2 minutes.\n- A school lesson takes about 45 minutes.\n- A night's sleep takes about 8 to 10 hours.\n\nChoose the right unit: brushing teeth takes minutes, not hours. Travelling from Monrovia to Gbarnga by car takes hours, not minutes.\n\nGood estimators check themselves. Estimate how long a task takes, time it with a clock or phone, then compare. With practice, estimates get closer.",
      objectives: [
        "Choose a sensible unit of time for an activity.",
        "Estimate how long activities take using benchmarks.",
        "Compare estimates with measured times.",
      ],
      activities: [
        "Estimate then time: learners estimate how long it takes to write their name 10 times, then the teacher times it.",
        "One-minute challenge: learners close their eyes and stand when they think one minute has passed.",
        "Sort cards: activities sorted into seconds, minutes, hours and days.",
      ],
      practice: [
        p("Which unit would you use to measure the time to eat lunch?", "Minutes"),
        p("About how long is a school day: 7 minutes, 7 hours or 7 days?", "7 hours"),
        p("How many minutes are in 2 hours?", "120 minutes"),
        p("How many seconds are in 3 minutes?", "180 seconds"),
      ],
      homework: [
        p("Estimate how long it takes you to walk to school. Then ask an adult to time it. Write both times.", "Answers vary; the estimate and measured time are both recorded"),
        p("How many hours are in 2 days?", "48 hours"),
        p("Which is longer: 90 seconds or 1 minute?", "90 seconds"),
      ],
      quiz: [
        mcq("About how long does it take to tie a shoe?", ["10 seconds", "10 minutes", "10 hours", "10 days"], "10 seconds"),
        mcq("How many minutes are in 1 1/2 hours?", ["90", "60", "150", "100"], "90"),
        mcq("Which activity takes about 1 hour?", ["Walking about 5 kilometres", "Blinking", "Growing a mango tree", "Saying your name"], "Walking about 5 kilometres"),
      ],
      diagnosticCheck: mcq("How many minutes are in one hour?", ["60", "100", "24", "30"], "60"),
      assessment: mcq("Which is the best estimate for the time to wash a plate?", ["30 seconds", "30 minutes", "3 hours", "3 days"], "30 seconds"),
      teacherNotes: "This is a practical lesson. Record each learner's estimate and measured time as teacher-observation evidence.",
      materials: ["Wall clock or phone timer", "Activity cards"],
      offline: "Fully offline: the teacher times tasks with a wall clock or phone. Practical; no device is needed by learners.",
    },
  }),
  draftLesson({
    slug: "elapsed-time", moeObjectiveId: objectiveId("m5", 2), unitId: unit,
    payload: {
      title: "Finding Elapsed Time",
      body: "Elapsed time is how much time passes between a start time and an end time.\n\nCount on in easy jumps: first to the next full hour, then whole hours, then the leftover minutes.\n\nExample: school starts at 8:15 a.m. and break is at 10:40 a.m.\n- 8:15 to 9:00 is 45 minutes.\n- 9:00 to 10:00 is 1 hour.\n- 10:00 to 10:40 is 40 minutes.\nTotal: 1 hour + 45 + 40 minutes = 1 hour 85 minutes = 2 hours 25 minutes.\n\nA time line helps: draw a line, mark the start and end, and draw the jumps above it.\n\nFinding an end time: a football match starts at 3:30 p.m. and lasts 1 hour 45 minutes. 3:30 + 1 hour = 4:30. 4:30 + 30 minutes = 5:00. 5:00 + 15 minutes = 5:15 p.m.\n\nCrossing noon: from 11:20 a.m. to 1:05 p.m. is 40 minutes to noon, then 1 hour 5 minutes, making 1 hour 45 minutes.",
      objectives: [
        "Find elapsed time between two times.",
        "Find an end time or start time given the elapsed time.",
        "Use a time line to count on.",
      ],
      activities: [
        "Paper-plate clocks: learners move the hands from the start time to the end time, counting hours and minutes.",
        "Class time line: find the elapsed time between events in the school day.",
        "Bus schedule (example times): find journey times between towns.",
      ],
      practice: [
        p("From 9:00 a.m. to 11:30 a.m. is how long?", "2 hours 30 minutes"),
        p("From 7:45 a.m. to 8:20 a.m. is how long?", "35 minutes"),
        p("A lesson starts at 1:10 p.m. and lasts 45 minutes. When does it end?", "1:55 p.m."),
        p("From 10:50 a.m. to 1:15 p.m. is how long?", "2 hours 25 minutes"),
      ],
      homework: [
        p("From 6:30 a.m. to 7:15 a.m. is how long?", "45 minutes"),
        p("A market opens at 7:00 a.m. and closes at 6:00 p.m. How long is it open?", "11 hours"),
        p("A bus leaves at 2:40 p.m. and the trip takes 2 hours 35 minutes. When does it arrive?", "5:15 p.m."),
      ],
      quiz: [
        mcq("How long is it from 8:20 a.m. to 9:05 a.m.?", ["45 minutes", "85 minutes", "1 hour 15 minutes", "35 minutes"], "45 minutes"),
        mcq("A film starts at 4:15 p.m. and lasts 1 hour 50 minutes. When does it end?", ["6:05 p.m.", "5:65 p.m.", "5:05 p.m.", "6:15 p.m."], "6:05 p.m."),
        mcq("How long is it from 11:30 a.m. to 2:00 p.m.?", ["2 hours 30 minutes", "3 hours 30 minutes", "9 hours 30 minutes", "1 hour 30 minutes"], "2 hours 30 minutes"),
      ],
      diagnosticCheck: mcq("What time is 30 minutes after 2:15?", ["2:45", "2:30", "3:15", "2:50"], "2:45"),
      assessment: mcq("A class trip leaves at 9:40 a.m. and returns at 12:15 p.m. How long is the trip?", ["2 hours 35 minutes", "3 hours 25 minutes", "2 hours 25 minutes", "3 hours 35 minutes"], "2 hours 35 minutes"),
      teacherNotes: "Learners often subtract times like whole numbers (12:15 - 9:40 = 2:75). Use time lines so they count on in hours and minutes. No Grade 4 clock tool exists online yet; use paper-plate clocks.",
      materials: ["Paper plates and split pins (clocks)", "Wall clock"],
      offline: "Fully offline: paper-plate clocks and drawn time lines. Online manipulative is an open gap (no clock tool for Grades 4-6).",
    },
  }),
  draftLesson({
    slug: "estimate-customary-length", moeObjectiveId: objectiveId("m5", 3), unitId: unit,
    payload: {
      title: "Estimating Length in Customary Units",
      body: "Customary units of length are the inch (in), foot (ft), yard (yd) and mile (mi). They are widely used in Liberia, for example for cloth, timber and height.\n12 inches = 1 foot, 3 feet = 1 yard, 1,760 yards = 1 mile.\n\nUse body benchmarks to estimate:\n- The top part of your thumb is about 1 inch wide.\n- An adult's foot, or a school ruler, is about 1 foot long.\n- An adult's big step, or the distance from nose to fingertip with the arm stretched out, is about 1 yard.\n- A mile takes about 20 minutes to walk.\n\nTo estimate, compare the object with a benchmark: a desk is about 4 rulers long, so about 4 feet.\n\nChoose the unit that fits: a pencil in inches, a classroom in feet or yards, the road from one town to another in miles.",
      objectives: [
        "Know the relationships between inches, feet, yards and miles.",
        "Estimate lengths using body benchmarks.",
        "Choose a sensible customary unit of length.",
      ],
      activities: [
        "Benchmark hunt: learners find objects about 1 inch, 1 foot and 1 yard long.",
        "Estimate then measure: estimate the length of the desk, door and board in feet, then check with a ruler or tape.",
        "Pace the classroom in big steps (yards) and compare with a measuring tape.",
      ],
      practice: [
        p("Which unit would you use for the length of a pencil?", "Inches"),
        p("How many inches are in 2 feet?", "24 inches"),
        p("How many feet are in 4 yards?", "12 feet"),
        p("Is a classroom door about 7 inches, 7 feet or 7 miles tall?", "7 feet"),
      ],
      homework: [
        p("Estimate the length of your bed in feet. Then measure it if you can.", "Answers vary; an estimate and, if possible, a measurement are recorded"),
        p("How many inches are in 1 yard?", "36 inches"),
        p("Which is longer: 2 feet or 20 inches?", "2 feet (24 inches)"),
      ],
      quiz: [
        mcq("About how long is a school exercise book?", ["9 inches", "9 feet", "9 yards", "9 miles"], "9 inches"),
        mcq("How many feet are in 1 yard?", ["3", "12", "36", "10"], "3"),
        mcq("Which unit is best for the distance between two towns?", ["Miles", "Inches", "Feet", "Yards"], "Miles"),
      ],
      diagnosticCheck: mcq("Which is longer?", ["A table", "A pencil", "They are the same", "A pen cap"], "A table"),
      assessment: mcq("About how tall is a Grade 4 learner?", ["4 feet", "4 inches", "4 yards", "4 miles"], "4 feet"),
      teacherNotes: "Record estimate-versus-measure results as teacher-observation evidence. Benchmarks vary by body size; discuss why.",
      materials: ["Rulers", "Measuring tape", "Classroom objects"],
      offline: "Practical and fully offline.",
    },
  }),
  draftLesson({
    slug: "measure-customary-length", moeObjectiveId: objectiveId("m5", 4), unitId: unit,
    payload: {
      title: "Measuring Length in Customary Units",
      body: "To measure length accurately with a ruler:\n1. Line up one end of the object with the 0 mark, not the edge of the ruler.\n2. Keep the object straight along the ruler.\n3. Read the mark at the other end.\n\nRulers show inches with smaller marks for halves and quarters. A length that ends at the long mark between 3 and 4 is 3 1/2 inches.\n\nFor longer objects, use a yardstick or measuring tape. When the object is longer than the ruler, mark where the ruler ends, move it along, and add the lengths.\n\nWrite the unit with every measurement: 5 in, 3 ft, 2 yd. A number without a unit does not tell us the length.\n\nTailors in Liberia measure cloth in yards and inches, and carpenters measure timber in feet and inches.",
      objectives: [
        "Measure lengths to the nearest inch, half inch and quarter inch.",
        "Measure longer lengths in feet and yards.",
        "Record measurements with units.",
      ],
      activities: [
        "Measure five classroom objects to the nearest half inch and record in a table.",
        "Measure the classroom length in feet using a tape, working in pairs.",
        "Error spotting: find what went wrong when a ruler starts at its edge instead of 0.",
      ],
      practice: [
        p("A pencil reaches the 6 1/2 mark on a ruler starting at 0. How long is it?", "6 1/2 inches"),
        p("A crayon starts at the 1 mark and ends at the 4 mark. How long is it?", "3 inches"),
        p("A table is 1 yard and 1 foot long. How many feet is that?", "4 feet"),
        p("A ribbon measures 30 inches. Is it more or less than 1 yard?", "Less (1 yard = 36 inches)"),
      ],
      homework: [
        p("Measure three objects at home to the nearest inch and record them with units.", "Answers vary; each measurement includes a unit"),
        p("A board is 5 feet long. How many inches is that?", "60 inches"),
        p("A cloth is 2 yards long. How many feet is that?", "6 feet"),
      ],
      quiz: [
        mcq("A nail starts at 0 and ends halfway between 2 and 3. How long is it?", ["2 1/2 inches", "2 inches", "3 inches", "2 1/4 inches"], "2 1/2 inches"),
        mcq("Where should the end of an object be placed to measure it?", ["At the 0 mark", "At the edge of the ruler", "At the 1 mark", "Anywhere"], "At the 0 mark"),
        mcq("A stick is 48 inches. How many feet is that?", ["4", "3", "6", "12"], "4"),
      ],
      diagnosticCheck: mcq("How many inches are in 1 foot?", ["12", "10", "3", "36"], "12"),
      assessment: mcq("An object starts at the 2 mark and ends at the 7 1/2 mark. How long is it?", ["5 1/2 inches", "7 1/2 inches", "9 1/2 inches", "5 inches"], "5 1/2 inches"),
      teacherNotes: "Use blunt-ended rulers only. Check learner measurements as teacher-observation evidence. Online, the digital-ruler tool can supplement but not replace real measuring.",
      materials: ["Rulers", "Yardstick or tape", "Objects to measure"],
      offline: "Practical and fully offline.",
    },
  }),
  draftLesson({
    slug: "estimate-customary-mass-capacity", moeObjectiveId: objectiveId("m5", 5), unitId: unit,
    payload: {
      title: "Estimating Mass and Capacity in Customary Units",
      body: "Weight (mass) tells how heavy something is. Customary units are ounces (oz) and pounds (lb): 16 ounces = 1 pound.\nBenchmarks: a slice of bread weighs about 1 ounce, a cup of rice about 7 ounces, and a large tin of tomato paste about 2 pounds. Rice is often sold in 25-pound and 50-pound bags.\n\nCapacity tells how much a container holds. Customary units are cups, pints (pt), quarts (qt) and gallons (gal).\n2 cups = 1 pint, 2 pints = 1 quart, 4 quarts = 1 gallon.\nBenchmarks: a drinking cup holds about 1 cup, and a large water container holds several gallons. Palm oil and kerosene are often sold by the gallon.\n\nTo estimate, compare with a benchmark: this bag feels like about 4 bags of sugar, so about 8 pounds if each sugar bag is 2 pounds.",
      objectives: [
        "Know the relationships between ounces and pounds, and between cups, pints, quarts and gallons.",
        "Estimate mass and capacity using benchmarks.",
      ],
      activities: [
        "Lift and compare: learners hold two objects and predict which is heavier, then check with a balance or scale.",
        "Pouring station: find how many cups fill a pint, quart and gallon container using water or sand.",
        "Market survey: list items sold by the pound or by the gallon.",
      ],
      practice: [
        p("How many ounces are in 2 pounds?", "32 ounces"),
        p("How many cups are in 1 quart?", "4 cups"),
        p("Which is heavier: a 50-pound bag of rice or 40 pounds of cassava?", "The 50-pound bag of rice"),
        p("Is a bucket's capacity about 3 cups or 3 gallons?", "3 gallons"),
      ],
      homework: [
        p("How many quarts are in 2 gallons?", "8 quarts"),
        p("How many pints are in 3 quarts?", "6 pints"),
        p("Name one item at home that weighs about 1 pound.", "Answers vary (for example, a bag of sugar or a tin of milk)"),
      ],
      quiz: [
        mcq("About how much does a pencil weigh?", ["1 ounce or less", "1 pound", "10 pounds", "1 gallon"], "1 ounce or less"),
        mcq("How many pints are in 1 gallon?", ["8", "4", "2", "16"], "8"),
        mcq("Which unit would measure the water in a large drum?", ["Gallons", "Ounces", "Cups", "Inches"], "Gallons"),
      ],
      diagnosticCheck: mcq("Which holds more water?", ["A bucket", "A cup", "A spoon", "A bottle cap"], "A bucket"),
      assessment: mcq("A gallon of palm oil is poured into quart bottles. How many bottles are filled?", ["4", "2", "8", "16"], "4"),
      teacherNotes: "Use water or dry sand only, and wipe spills to prevent slipping. Record estimate-then-check results as teacher-observation evidence.",
      materials: ["Containers (cup, pint, quart, gallon)", "Water or dry sand", "Balance or bathroom scale if available"],
      offline: "Practical and fully offline.",
    },
  }),
  draftLesson({
    slug: "estimate-metric-units", moeObjectiveId: objectiveId("m5", 6), unitId: unit,
    payload: {
      title: "Estimating Length, Capacity and Mass in Metric Units",
      body: "The metric system uses units based on 10.\nLength: millimetre (mm), centimetre (cm), metre (m), kilometre (km).\nCapacity: millilitre (mL), litre (L).\nMass: gram (g), kilogram (kg).\n\nBenchmarks:\n- 1 mm: the thickness of a coin edge. 1 cm: the width of a finger. 1 m: a big step, or the height of a door handle. 1 km: about a 12-minute walk.\n- 1 mL: a few drops of water. 1 L: a large bottle of water.\n- 1 g: a paper clip. 1 kg: a bag of sugar or a large pineapple.\n\nChoose the unit that fits the size: an ant in millimetres, a book in centimetres, a football field in metres, the road to Kakata in kilometres.\n\nEstimate, then measure, and compare. Each time the estimate should get closer.",
      objectives: [
        "Estimate lengths in mm, cm, m and km using benchmarks.",
        "Estimate capacity in mL and L and mass in g and kg.",
        "Choose a sensible metric unit.",
      ],
      activities: [
        "Benchmark kit: learners hold a 1 m stick, a 1 L bottle and a 1 kg bag, then estimate other objects against them.",
        "Estimate then measure: the width of a desk in cm, the length of the classroom in m.",
        "Unit sort: sort cards (ant, road, bottle, bucket, pencil, goat) by the best unit.",
      ],
      practice: [
        p("Which unit for the length of an eraser?", "Centimetres"),
        p("Which unit for the mass of a bag of rice?", "Kilograms"),
        p("About how much does a cup of tea hold: 250 mL or 250 L?", "250 mL"),
        p("Is a classroom about 8 cm, 8 m or 8 km long?", "8 m"),
      ],
      homework: [
        p("Find one item at home that weighs about 1 kg.", "Answers vary (for example, a bag of sugar)"),
        p("Which unit would you use for the distance from Monrovia to Buchanan?", "Kilometres"),
        p("Estimate the capacity of a large water bottle in litres.", "About 1 to 2 L (answers vary)"),
      ],
      quiz: [
        mcq("About how long is a pencil?", ["18 cm", "18 m", "18 mm", "18 km"], "18 cm"),
        mcq("About how much does a paper clip weigh?", ["1 g", "1 kg", "1 L", "1 m"], "1 g"),
        mcq("Which holds about 10 L?", ["A bucket", "A teaspoon", "A cup", "A bottle cap"], "A bucket"),
      ],
      diagnosticCheck: mcq("Which is longer: 1 metre or 1 centimetre?", ["1 metre", "1 centimetre", "They are equal", "Cannot tell"], "1 metre"),
      assessment: mcq("Which is the best estimate for the mass of a large pineapple?", ["1 kg", "1 g", "100 kg", "1 L"], "1 kg"),
      teacherNotes: "Keep the three benchmark objects in the classroom all unit long. Use water or dry sand only, and wipe spills. Record observations as teacher evidence.",
      materials: ["Metre stick", "1 L bottle", "1 kg bag", "Water or dry sand"],
      offline: "Practical and fully offline.",
    },
  }),
  draftLesson({
    slug: "convert-metric-units", moeObjectiveId: objectiveId("m5", 7), unitId: unit,
    payload: {
      title: "Converting Metric Units of Length and Mass",
      body: "Metric units are linked by multiples of 10, 100 and 1,000:\n10 mm = 1 cm, 100 cm = 1 m, 1,000 m = 1 km\n1,000 g = 1 kg\n\nConverting from a larger unit to a smaller unit: multiply, because you need more of the smaller units.\n3 m = 3 x 100 = 300 cm. 4 kg = 4 x 1,000 = 4,000 g.\n\nConverting from a smaller unit to a larger unit: divide, because you need fewer of the larger units.\n500 cm = 500 / 100 = 5 m. 6,000 g = 6,000 / 1,000 = 6 kg.\n\nMixed units: 2 m 45 cm = 200 + 45 = 245 cm. 3,250 g = 3 kg 250 g.\n\nCheck that the answer makes sense: there should be more centimetres than metres for the same length.",
      objectives: [
        "Convert between mm, cm, m and km.",
        "Convert between g and kg.",
        "Write measurements in mixed units.",
      ],
      activities: [
        "Conversion chart: learners build a chart linking mm, cm, m and km with arrows marked x and /.",
        "Metre stick: count 100 cm in 1 m and 10 mm in 1 cm.",
        "Market bags (example weights): convert bag weights from kg to g.",
      ],
      practice: [
        p("5 m = ___ cm", "500"),
        p("7 cm = ___ mm", "70"),
        p("3,000 m = ___ km", "3"),
        p("2 kg 400 g = ___ g", "2,400"),
      ],
      homework: [
        p("8 kg = ___ g", "8,000"),
        p("450 cm = ___ m ___ cm", "4 m 50 cm"),
        p("A road is 6 km long. How many metres is that?", "6,000 m"),
      ],
      quiz: [
        mcq("How many centimetres are in 4 metres?", ["400", "40", "4,000", "4"], "400"),
        mcq("5,000 g = ?", ["5 kg", "50 kg", "500 kg", "0.5 kg"], "5 kg"),
        mcq("3 cm 5 mm = ?", ["35 mm", "305 mm", "8 mm", "350 mm"], "35 mm"),
      ],
      diagnosticCheck: mcq("What is 6 x 100?", ["600", "60", "6,000", "106"], "600"),
      assessment: mcq("A bag of flour weighs 2 kg 750 g. How many grams is that?", ["2,750 g", "2,075 g", "275 g", "27,500 g"], "2,750 g"),
      teacherNotes: "Learners mix up when to multiply and divide. Ask: will there be more or fewer of the new unit? The unit-converter tool is disabled for Grade 4 on purpose; conversions are practised by hand.",
      materials: ["Metre stick", "Conversion chart"],
      offline: "Fully offline.",
    },
  }),
  draftLesson({
    slug: "add-subtract-measurements", moeObjectiveId: objectiveId("m5", 8), unitId: unit,
    payload: {
      title: "Adding and Subtracting Measurements of Length and Mass",
      body: "To add or subtract measurements, first make sure they are in the same units.\n\nAdding: 2 m 65 cm + 1 m 50 cm.\nAdd metres: 2 + 1 = 3 m. Add centimetres: 65 + 50 = 115 cm = 1 m 15 cm.\nTotal: 3 m + 1 m 15 cm = 4 m 15 cm.\n\nSubtracting: 5 kg 200 g - 2 kg 700 g.\nThe grams cannot be taken directly (200 < 700), so regroup 1 kg as 1,000 g: 4 kg 1,200 g - 2 kg 700 g = 2 kg 500 g.\n\nAnother way: change everything to the smaller unit. 5,200 g - 2,700 g = 2,500 g = 2 kg 500 g.\n\nExample: a tailor has 4 m of cloth and cuts 1 m 35 cm for a shirt. 400 cm - 135 cm = 265 cm = 2 m 65 cm is left.",
      objectives: [
        "Add and subtract lengths in mixed metric units with regrouping.",
        "Add and subtract masses in kg and g with regrouping.",
      ],
      activities: [
        "Ribbon joining: join two measured pieces of string and measure the total to check the calculation.",
        "Market scale (example weights): add the weights of two bags and subtract a portion sold.",
        "Two methods: groups solve the same problem in mixed units and in the smaller unit only, then compare.",
      ],
      practice: [
        p("3 m 40 cm + 2 m 35 cm = ?", "5 m 75 cm"),
        p("1 m 80 cm + 2 m 45 cm = ?", "4 m 25 cm"),
        p("6 kg 300 g - 2 kg 800 g = ?", "3 kg 500 g"),
        p("A rope is 10 m long. 3 m 25 cm is cut off. How much is left?", "6 m 75 cm"),
      ],
      homework: [
        p("4 kg 650 g + 3 kg 500 g = ?", "8 kg 150 g"),
        p("7 m 10 cm - 3 m 60 cm = ?", "3 m 50 cm"),
        p("A trader has a 25 kg bag of rice and sells 8 kg 500 g. How much is left?", "16 kg 500 g"),
      ],
      quiz: [
        mcq("What is 2 m 50 cm + 1 m 70 cm?", ["4 m 20 cm", "3 m 120 cm only", "3 m 20 cm", "4 m 120 cm"], "4 m 20 cm"),
        mcq("What is 5 kg - 1 kg 400 g?", ["3 kg 600 g", "4 kg 400 g", "4 kg 600 g", "3 kg 400 g"], "3 kg 600 g"),
        mcq("How many grams is 2 kg 300 g + 700 g?", ["3,000 g", "2,1000 g", "2,370 g", "3,700 g"], "3,000 g"),
      ],
      diagnosticCheck: mcq("How many centimetres are in 1 metre?", ["100", "10", "1,000", "12"], "100"),
      assessment: mcq("A tailor has 5 m of cloth and uses 2 m 45 cm. How much is left?", ["2 m 55 cm", "3 m 55 cm", "2 m 65 cm", "3 m 45 cm"], "2 m 55 cm"),
      teacherNotes: "Learners may write 3 m 120 cm without regrouping, or subtract the smaller number of grams from the larger. Practise regrouping 1 m = 100 cm and 1 kg = 1,000 g explicitly.",
      materials: ["String and metre stick", "Exercise books"],
      offline: "Fully offline.",
    },
  }),
  draftLesson({
    slug: "perimeter-area-rectangles", moeObjectiveId: objectiveId("m5", 9), unitId: unit,
    payload: {
      title: "Perimeter and Area of Squares and Rectangles",
      body: "Perimeter is the distance all the way around a shape. Add the lengths of all the sides.\nA rectangle 6 m long and 4 m wide has perimeter 6 + 4 + 6 + 4 = 20 m. Short cut: 2 x (length + width) = 2 x (6 + 4) = 20 m.\nA square with sides of 5 cm has perimeter 4 x 5 = 20 cm.\n\nArea is the amount of flat space inside a shape, measured in square units (square centimetres, cm², or square metres, m²).\nOn squared paper, count the unit squares. A rectangle 6 squares long and 4 squares wide has 6 x 4 = 24 squares.\nArea of a rectangle = length x width. Area of a square = side x side.\n\nPerimeter and area are different: a 6 m by 4 m garden needs 20 m of fence (perimeter) and has 24 m² of ground to plant (area).\n\nTwo shapes can have the same perimeter and different areas: a 5 by 5 square and a 7 by 3 rectangle both have perimeter 20, but their areas are 25 and 21.",
      objectives: [
        "Find the perimeter of squares and rectangles.",
        "Find the area of squares and rectangles by counting squares and by multiplying.",
        "Explain the difference between perimeter and area.",
      ],
      activities: [
        "Squared paper: draw rectangles with area 12 squares and compare their perimeters.",
        "School garden: measure a garden bed and calculate the fence needed and the planting area.",
        "Chalk grid: walk around a chalk rectangle (perimeter) and fill it with paper squares (area).",
      ],
      practice: [
        p("Find the perimeter of a rectangle 8 cm by 3 cm.", "22 cm"),
        p("Find the area of a rectangle 8 cm by 3 cm.", "24 cm²"),
        p("Find the perimeter and area of a square with 6 m sides.", "Perimeter 24 m, area 36 m²"),
        p("A rectangle has area 40 m² and length 8 m. What is its width?", "5 m"),
      ],
      homework: [
        p("Find the perimeter of a rectangular room 5 m by 4 m.", "18 m"),
        p("Find the area of the same room.", "20 m²"),
        p("A square garden has perimeter 32 m. How long is each side?", "8 m"),
      ],
      quiz: [
        mcq("What is the area of a rectangle 7 m by 5 m?", ["35 m²", "24 m", "12 m²", "35 m"], "35 m²"),
        mcq("What is the perimeter of a square with 9 cm sides?", ["36 cm", "81 cm", "18 cm", "81 cm²"], "36 cm"),
        mcq("Which tells how much fence is needed around a field?", ["Perimeter", "Area", "Volume", "Mass"], "Perimeter"),
      ],
      diagnosticCheck: mcq("How many small squares are in 3 rows of 4 squares?", ["12", "7", "14", "10"], "12"),
      assessment: mcq("A rectangle is 9 m long and 4 m wide. What are its perimeter and area?", ["26 m and 36 m²", "36 m and 26 m²", "13 m and 36 m²", "26 m and 13 m²"], "26 m and 36 m²"),
      teacherNotes: "Learners confuse the two measures and their units. Always ask: around (perimeter, in m) or inside (area, in m²)? No Grade 4 grid tool is enabled online; use squared paper.",
      materials: ["Squared paper", "Chalk", "Measuring tape"],
      offline: "Fully offline with squared paper and chalk grids. Online manipulative is an open gap (coordinate-grid tool is enabled only for Grades 7+).",
    },
  }),
];
