import { draftLesson, mcq, objectiveId, p, U } from "./types";

const unit = U.m3;

/** Objective 4 (parts of a set) is covered by ll-g4-math-fractions-equal-parts-2026.1. */
export const UNIT3_LESSONS = [
  draftLesson({
    slug: "even-and-odd-numbers", moeObjectiveId: objectiveId("m3", 1), unitId: unit,
    payload: {
      title: "Even and Odd Numbers",
      body: "An even number can be split into two equal groups with nothing left over. An odd number always has one left over. Pair up 8 bottle caps and every cap has a partner, so 8 is even. Pair up 9 and one cap is left alone, so 9 is odd.\n\nYou only need to look at the ones digit. If it is 0, 2, 4, 6 or 8, the number is even. If it is 1, 3, 5, 7 or 9, the number is odd. So 4,736 is even and 52,019 is odd.\n\nOn a hundred chart, even and odd numbers alternate, making columns of evens and columns of odds.\n\nPatterns:\n- even + even = even (4 + 6 = 10)\n- odd + odd = even (3 + 5 = 8)\n- even + odd = odd (4 + 5 = 9)",
      objectives: [
        "Identify even and odd numbers using the ones digit.",
        "Describe the sums of even and odd numbers.",
      ],
      activities: [
        "Partner up: learners pair counters for numbers 1 to 20 and sort them into even and odd.",
        "Hundred chart: shade the even numbers and describe the pattern.",
        "Line game: learners with even-numbered cards stand on the left, odd on the right.",
      ],
      practice: [
        p("Is 3,574 even or odd?", "Even"),
        p("Is 10,001 even or odd?", "Odd"),
        p("Write the next three even numbers after 98.", "100, 102, 104"),
        p("Is odd + odd even or odd? Give an example.", "Even, for example 7 + 9 = 16"),
      ],
      homework: [
        p("List all the odd numbers between 40 and 50.", "41, 43, 45, 47, 49"),
        p("Is 2,468 + 1,357 even or odd?", "Odd"),
        p("Is the number of days in a week even or odd?", "Odd (7)"),
      ],
      quiz: [
        mcq("Which number is odd?", ["3,450", "7,812", "6,093", "5,000"], "6,093"),
        mcq("Which number is even?", ["29", "41", "56", "87"], "56"),
        mcq("Even + odd = ?", ["Odd", "Even", "Zero", "It depends"], "Odd"),
      ],
      diagnosticCheck: mcq("Can 10 counters be shared equally between 2 people?", ["Yes, 5 each", "No, one is left", "Yes, 4 each", "No"], "Yes, 5 each"),
      assessment: mcq("Which list has only even numbers?", ["12, 30, 48", "12, 31, 48", "15, 30, 48", "11, 33, 55"], "12, 30, 48"),
      teacherNotes: "Some learners judge a number by its first digit (thinking 3,574 is odd). Point to the ones digit every time.",
      materials: ["Counters", "Hundred chart"],
      offline: "Fully offline: printed or hand-drawn hundred chart.",
    },
  }),
  draftLesson({
    slug: "factors-and-multiples", moeObjectiveId: objectiveId("m3", 2), unitId: unit,
    payload: {
      title: "Factors and Multiples",
      body: "Factors are numbers that multiply together to make a number. Since 3 x 4 = 12, 3 and 4 are factors of 12. The factors of 12 are 1, 2, 3, 4, 6 and 12. Every number has 1 and itself as factors.\n\nTo find all factors, look for factor pairs: 1 x 12, 2 x 6, 3 x 4. Stop when the pairs start to repeat.\n\nA multiple of a number is what you get when you multiply it by a whole number. The multiples of 4 are 4, 8, 12, 16, 20 and so on: the numbers you say when skip-counting by 4. The list of multiples never ends.\n\nFactors and multiples are linked: 3 is a factor of 12, and 12 is a multiple of 3.\n\nA number with exactly two factors (1 and itself) is prime, such as 2, 3, 5, 7, 11 and 13. A number with more than two factors, such as 12, is composite. The number 1 is neither.",
      objectives: [
        "Find all the factors of a number up to 100.",
        "List multiples of a number.",
        "Identify prime and composite numbers.",
      ],
      activities: [
        "Array hunt: with 12 counters, learners make every possible rectangle array and record the factor pairs.",
        "Skip-count chant: count by 6s and 7s and write the first ten multiples.",
        "Sieve: on a hundred chart, cross out multiples of 2, 3, 5 and 7 (not the numbers themselves) to find primes.",
      ],
      practice: [
        p("List all the factors of 18.", "1, 2, 3, 6, 9, 18"),
        p("List the first five multiples of 7.", "7, 14, 21, 28, 35"),
        p("Is 5 a factor of 45?", "Yes, 5 x 9 = 45"),
        p("Is 21 prime or composite?", "Composite (3 x 7)"),
      ],
      homework: [
        p("List all the factors of 24.", "1, 2, 3, 4, 6, 8, 12, 24"),
        p("List the first six multiples of 9.", "9, 18, 27, 36, 45, 54"),
        p("Write all the prime numbers between 20 and 30.", "23, 29"),
      ],
      quiz: [
        mcq("Which is NOT a factor of 20?", ["3", "4", "5", "10"], "3"),
        mcq("Which is a multiple of 6?", ["42", "32", "16", "26"], "42"),
        mcq("Which number is prime?", ["17", "15", "21", "27"], "17"),
      ],
      diagnosticCheck: mcq("What is 4 x 6?", ["24", "20", "28", "10"], "24"),
      assessment: mcq("Which list shows all the factors of 16?", ["1, 2, 4, 8, 16", "2, 4, 8", "1, 2, 4, 6, 8, 16", "16, 32, 48"], "1, 2, 4, 8, 16"),
      teacherNotes: "Learners mix up factors and multiples. Anchor the words: factors are few and fit inside the number; multiples are many and grow bigger.",
      materials: ["Counters", "Hundred chart"],
      offline: "Fully offline. Online, the multiplication-table tool helps learners read factor pairs.",
    },
  }),
  draftLesson({
    slug: "lcm-and-gcf", moeObjectiveId: objectiveId("m3", 3), unitId: unit,
    payload: {
      title: "Least Common Multiple and Greatest Common Factor",
      body: "The least common multiple (LCM) of two numbers is the smallest number that is a multiple of both.\nMultiples of 4: 4, 8, 12, 16, 20, 24 ...\nMultiples of 6: 6, 12, 18, 24 ...\nThe common multiples are 12, 24, ... and the least is 12. So LCM(4, 6) = 12.\n\nThe greatest common factor (GCF) is the largest number that is a factor of both.\nFactors of 12: 1, 2, 3, 4, 6, 12\nFactors of 18: 1, 2, 3, 6, 9, 18\nThe common factors are 1, 2, 3 and 6, and the greatest is 6. So GCF(12, 18) = 6.\n\nWhere they are used:\n- LCM: two buses leave the park together, one every 4 minutes and one every 6 minutes. They leave together again after 12 minutes.\n- GCF: 12 oranges and 18 bananas are packed into identical bags with none left over. The most bags possible is 6, each with 2 oranges and 3 bananas.\n\nThe GCF also helps simplify fractions, and the LCM helps add fractions.",
      objectives: [
        "Find the least common multiple of two numbers by listing multiples.",
        "Find the greatest common factor of two numbers by listing factors.",
        "Use LCM and GCF to solve simple problems.",
      ],
      activities: [
        "Two-colour hundred chart: circle multiples of 4 in one colour and 6 in another; the first number with both colours is the LCM.",
        "Factor lists side by side: groups list factors of two numbers and box the common ones.",
        "Packing problem: share 12 oranges and 18 bananas into identical bags using real or drawn fruit.",
      ],
      practice: [
        p("Find the LCM of 3 and 5.", "15"),
        p("Find the LCM of 6 and 8.", "24"),
        p("Find the GCF of 16 and 24.", "8"),
        p("Find the GCF of 9 and 15.", "3"),
      ],
      homework: [
        p("Find the LCM of 4 and 10.", "20"),
        p("Find the GCF of 20 and 30.", "10"),
        p("One bell rings every 6 minutes and another every 9 minutes. They ring together now. After how many minutes will they ring together again?", "18 minutes"),
      ],
      quiz: [
        mcq("What is the LCM of 2 and 7?", ["14", "7", "9", "28"], "14"),
        mcq("What is the GCF of 12 and 30?", ["6", "3", "12", "60"], "6"),
        mcq("24 pencils and 36 pens are put into identical packs with none left. What is the greatest number of packs?", ["12", "6", "24", "4"], "12"),
      ],
      diagnosticCheck: mcq("Which is a common factor of 8 and 12?", ["4", "3", "6", "8"], "4"),
      assessment: mcq("What is the LCM of 8 and 12?", ["24", "48", "4", "96"], "24"),
      teacherNotes: "Keep the two ideas apart: LCM is found from multiples and is at least as big as the larger number; GCF is found from factors and is at most the smaller number.",
      materials: ["Hundred chart", "Coloured chalk or pencils"],
      offline: "Fully offline.",
    },
  }),
  draftLesson({
    slug: "equivalent-fractions", moeObjectiveId: objectiveId("m3", 5), unitId: unit,
    payload: {
      title: "Writing Equivalent Fractions",
      body: "Equivalent fractions name the same amount using different numbers. Fold a strip of paper in half and shade one half: 1/2. Fold it again. The same shaded part is now 2 of 4 equal parts: 2/4. Fold once more and it is 4/8. So 1/2 = 2/4 = 4/8.\n\nTo make an equivalent fraction, multiply the numerator and the denominator by the same number:\n1/3 = (1 x 2)/(3 x 2) = 2/6\n1/3 = (1 x 4)/(3 x 4) = 4/12\n\nYou can also divide both by the same number: 6/8 = (6 / 2)/(8 / 2) = 3/4.\n\nMultiplying only the top or only the bottom changes the amount. 1/2 and 2/2 are not equal: 2/2 is a whole.\n\nFraction strips placed under each other show which fractions line up exactly. Those are equivalent.",
      objectives: [
        "Recognise equivalent fractions using fraction strips.",
        "Write equivalent fractions by multiplying or dividing the numerator and denominator by the same number.",
      ],
      activities: [
        "Paper folding: fold strips into halves, quarters and eighths and label the equivalent fractions.",
        "Fraction wall: build a wall of strips (1, halves, thirds, quarters, sixths, eighths) and find fractions that line up.",
        "Missing number: learners fill 3/5 = ?/10 and explain their rule.",
      ],
      practice: [
        p("Complete: 1/2 = ?/6", "3"),
        p("Complete: 2/3 = 8/?", "12"),
        p("Write two fractions equivalent to 3/4.", "For example 6/8 and 9/12"),
        p("Are 2/5 and 4/10 equivalent?", "Yes"),
      ],
      homework: [
        p("Complete: 1/4 = ?/12", "3"),
        p("Complete: 5/6 = 10/?", "12"),
        p("Are 3/4 and 4/5 equivalent?", "No"),
      ],
      quiz: [
        mcq("Which fraction is equivalent to 2/3?", ["4/6", "3/4", "2/6", "4/3"], "4/6"),
        mcq("Complete: 3/5 = ?/15", ["9", "6", "3", "5"], "9"),
        mcq("Which pair is NOT equivalent?", ["1/3 and 2/5", "1/2 and 5/10", "2/4 and 1/2", "3/6 and 1/2"], "1/3 and 2/5"),
      ],
      diagnosticCheck: mcq("A strip is cut into 4 equal parts and 1 part is shaded. What fraction is shaded?", ["1/4", "4/1", "1/3", "3/4"], "1/4"),
      assessment: mcq("Which fraction is equivalent to 1/2?", ["2/4", "1/3", "2/3", "3/4"], "2/4"),
      teacherNotes: "Some learners add the same number to top and bottom (1/2 -> 2/3). Show with strips that 2/3 is larger than 1/2.",
      materials: ["Paper strips", "Fraction wall chart"],
      offline: "Fully offline with folded paper strips. Online, the fraction-visualizer tool shows the strips.",
    },
  }),
  draftLesson({
    slug: "simplifying-fractions", moeObjectiveId: objectiveId("m3", 6), unitId: unit,
    payload: {
      title: "Simplifying Fractions",
      body: "A fraction is in simplest form when the numerator and denominator have no common factor except 1. Simplifying does not change the amount. It writes the same fraction with smaller numbers.\n\nTo simplify, divide the numerator and denominator by a common factor. Keep going until the only common factor is 1.\n\n8/12: both are divisible by 2, giving 4/6. Both are divisible by 2 again, giving 2/3. Now 2 and 3 share only 1, so 8/12 = 2/3.\n\nThe fastest way is to divide by the greatest common factor in one step. GCF(8, 12) = 4, so 8/12 = (8 / 4)/(12 / 4) = 2/3.\n\nWith fraction strips, 8/12 and 2/3 line up exactly: the same length with fewer, larger parts.",
      objectives: [
        "Simplify a fraction by dividing by common factors.",
        "Use the GCF to write a fraction in simplest form in one step.",
      ],
      activities: [
        "Strip check: show 6/8 and 3/4 with fraction strips and confirm they are the same length.",
        "Step race: simplify 12/16 one factor at a time, then in one step with the GCF, and compare.",
        "Sort cards: fractions already in simplest form versus fractions that can be simplified.",
      ],
      practice: [
        p("Simplify 6/9.", "2/3"),
        p("Simplify 10/15.", "2/3"),
        p("Simplify 12/16.", "3/4"),
        p("Is 5/8 in simplest form?", "Yes"),
      ],
      homework: [
        p("Simplify 4/10.", "2/5"),
        p("Simplify 9/12.", "3/4"),
        p("Simplify 14/21.", "2/3"),
      ],
      quiz: [
        mcq("What is 8/10 in simplest form?", ["4/5", "2/5", "8/10", "1/2"], "4/5"),
        mcq("Which fraction is already in simplest form?", ["3/7", "4/8", "6/9", "5/10"], "3/7"),
        mcq("Simplify 15/20.", ["3/4", "5/4", "3/5", "1/5"], "3/4"),
      ],
      diagnosticCheck: mcq("What is the GCF of 6 and 9?", ["3", "6", "9", "18"], "3"),
      assessment: mcq("What is 18/24 in simplest form?", ["3/4", "9/12", "6/8", "2/3"], "3/4"),
      teacherNotes: "Learners sometimes divide only the numerator. Insist on writing both divisions each time until the pattern is secure.",
      materials: ["Fraction strips", "Exercise books"],
      offline: "Fully offline. Online, the fraction-visualizer tool compares a fraction and its simplest form.",
    },
  }),
  draftLesson({
    slug: "adding-fractions", moeObjectiveId: objectiveId("m3", 7), unitId: unit,
    payload: {
      title: "Adding Fractions",
      body: "When fractions have the same denominator, the parts are the same size, so we add the numerators and keep the denominator.\n2/8 + 3/8 = 5/8 (2 eighths plus 3 eighths is 5 eighths).\n\nDo not add the denominators. 2/8 + 3/8 is not 5/16: eighths plus eighths are still eighths.\n\nIf the answer can be simplified, simplify it: 1/6 + 3/6 = 4/6 = 2/3. If the numerator is bigger than the denominator, the answer is more than one whole: 3/4 + 2/4 = 5/4 = 1 1/4.\n\nWhen denominators are different but related, first change one fraction to an equivalent fraction with the same denominator:\n1/2 + 1/4 = 2/4 + 1/4 = 3/4.\n\nThe MOE activity uses counters to show adding fractions: 3 counters out of 10 plus 4 counters out of 10 makes 7 out of 10.",
      objectives: [
        "Add fractions with the same denominator.",
        "Add fractions with related denominators by making equivalent fractions.",
        "Simplify sums and write sums greater than one as mixed numbers.",
      ],
      activities: [
        "Strip joining: put a 2/8 strip next to a 3/8 strip and read the total length.",
        "Counters: with sets of 10 counters, show 3/10 + 4/10.",
        "Cassava bread sharing (drawn): one child eats 1/4 and another 2/4. What fraction was eaten?",
      ],
      practice: [
        p("2/5 + 1/5 = ?", "3/5"),
        p("3/10 + 5/10 = ? (simplest form)", "4/5"),
        p("1/2 + 1/4 = ?", "3/4"),
        p("5/6 + 3/6 = ? (as a mixed number)", "1 1/3"),
      ],
      homework: [
        p("4/9 + 2/9 = ? (simplest form)", "2/3"),
        p("1/3 + 1/6 = ? (simplest form)", "1/2"),
        p("Musu walks 3/8 km to the pump and 3/8 km back. How far does she walk?", "6/8 km = 3/4 km"),
      ],
      quiz: [
        mcq("What is 3/7 + 2/7?", ["5/7", "5/14", "6/7", "1/7"], "5/7"),
        mcq("What is 1/4 + 1/2?", ["3/4", "2/6", "2/4", "1/6"], "3/4"),
        mcq("What is 2/3 + 2/3?", ["1 1/3", "4/6", "4/9", "2/3"], "1 1/3"),
      ],
      diagnosticCheck: mcq("Complete: 1/2 = ?/4", ["2", "1", "4", "3"], "2"),
      assessment: mcq("What is 3/8 + 1/4?", ["5/8", "4/12", "4/8", "1/2"], "5/8"),
      teacherNotes: "The most common error is adding denominators (2/8 + 3/8 = 5/16). Ask: are the parts still eighths? Show it with strips.",
      materials: ["Fraction strips", "Counters"],
      offline: "Fully offline with paper strips and counters. Online, the fraction-visualizer tool joins strips.",
    },
  }),
  draftLesson({
    slug: "subtracting-fractions", moeObjectiveId: objectiveId("m3", 8), unitId: unit,
    payload: {
      title: "Subtracting Fractions",
      body: "Subtracting fractions with the same denominator works like adding. Subtract the numerators and keep the denominator.\n7/10 - 3/10 = 4/10 = 2/5.\n\nTaking away from a whole: 1 - 3/8. Write 1 as 8/8, then 8/8 - 3/8 = 5/8.\n\nWith related denominators, first make the denominators the same:\n3/4 - 1/2 = 3/4 - 2/4 = 1/4.\n\nCheck subtraction with addition: 1/4 + 2/4 = 3/4.\n\nIn a story: a bottle of palm oil is 5/6 full, and 2/6 is used for cooking. 5/6 - 2/6 = 3/6 = 1/2 of the bottle is left.",
      objectives: [
        "Subtract fractions with the same denominator.",
        "Subtract a fraction from a whole.",
        "Subtract fractions with related denominators.",
      ],
      activities: [
        "Strip removal: start with a 7/10 strip, cover 3/10 and read what is left.",
        "Whole take-away: fold a paper into eighths, tear off 3/8 and name the rest.",
        "Story problems about sharing food, cloth and time.",
      ],
      practice: [
        p("5/7 - 2/7 = ?", "3/7"),
        p("9/12 - 3/12 = ? (simplest form)", "1/2"),
        p("1 - 2/5 = ?", "3/5"),
        p("5/6 - 1/3 = ? (simplest form)", "1/2"),
      ],
      homework: [
        p("7/8 - 5/8 = ? (simplest form)", "1/4"),
        p("1 - 5/9 = ?", "4/9"),
        p("A cloth is 3/4 m long. Fatu cuts off 1/2 m. How much is left?", "1/4 m"),
      ],
      quiz: [
        mcq("What is 6/9 - 2/9?", ["4/9", "4/0", "8/9", "4/18"], "4/9"),
        mcq("What is 1 - 1/4?", ["3/4", "0/4", "1/3", "4/4"], "3/4"),
        mcq("What is 1/2 - 1/4?", ["1/4", "0", "2/4", "1/2"], "1/4"),
      ],
      diagnosticCheck: mcq("How many quarters make one whole?", ["4", "2", "3", "8"], "4"),
      assessment: mcq("What is 7/8 - 1/4?", ["5/8", "6/4", "3/4", "6/8"], "5/8"),
      teacherNotes: "Taking a fraction from 1 is hard for learners until they rename 1 as a fraction (8/8). Practise renaming wholes before subtracting.",
      materials: ["Fraction strips", "Paper for folding"],
      offline: "Fully offline. Online, the fraction-visualizer tool supports removal.",
    },
  }),
  draftLesson({
    slug: "multi-step-problems", moeObjectiveId: objectiveId("m3", 9), unitId: unit,
    payload: {
      title: "Solving Multi-Step Problems",
      body: "A multi-step problem needs more than one operation. Plan before calculating:\n1. Read the whole problem. What is the question?\n2. List what you know.\n3. Decide the steps and their order.\n4. Calculate each step and label it.\n5. Check that the answer makes sense.\n\nExample: Kollie buys 3 exercise books at L$45 each and a pen for L$30 (example prices). He pays with L$200. How much change does he get?\nStep 1: cost of books: 3 x 45 = L$135.\nStep 2: total cost: 135 + 30 = L$165.\nStep 3: change: 200 - 165 = L$35.\n\nA bar model helps: draw one long bar for L$200 and split it into the costs and the unknown change.\n\nMulti-step problems can mix whole numbers and fractions: a class of 36 learners, 1/4 of them walk more than 3 km to school. 36 / 4 = 9 learners walk far, and 36 - 9 = 27 do not.",
      objectives: [
        "Plan and solve problems that need two or more operations.",
        "Use bar models to organise multi-step problems.",
        "Check that answers are reasonable.",
      ],
      activities: [
        "Step cards: groups put the steps of a solved problem in the right order.",
        "Bar models: draw bar models for three shopping problems with example prices.",
        "Write a two-step problem about the school garden for a partner to solve.",
      ],
      practice: [
        p("A trader has 240 oranges. She sells 85 in the morning and 97 in the afternoon. How many are left?", "58"),
        p("4 packs of 12 pencils are shared equally among 6 learners. How many pencils does each get?", "8"),
        p("Kebeh has L$500 (example amount). She buys 2 cups of rice at L$120 each. How much money is left?", "L$260"),
        p("A class has 30 learners. 1/3 of them are absent. How many are present?", "20"),
      ],
      homework: [
        p("A farmer picks 125 pineapples each day for 4 days, then sells 380. How many are left?", "120"),
        p("5 bags hold 24 mangoes each. The mangoes are repacked into boxes of 10. How many boxes are needed?", "12"),
        p("A school has 3 classes of 42 learners and 2 classes of 38 learners. How many learners are there in all?", "202"),
      ],
      quiz: [
        mcq("3 bundles of 25 sticks and 15 loose sticks. How many sticks in all?", ["90", "75", "43", "105"], "90"),
        mcq("L$300 is paid for 4 items at L$65 each (example prices). What is the change?", ["L$40", "L$260", "L$35", "L$60"], "L$40"),
        mcq("Which operations are needed? 'Find the total of 6 boxes of 8 eggs and 5 loose eggs.'", ["Multiply, then add", "Add, then divide", "Subtract, then multiply", "Divide only"], "Multiply, then add"),
      ],
      diagnosticCheck: mcq("What is 6 x 20 + 5?", ["125", "150", "130", "31"], "125"),
      assessment: mcq("A bus has 48 seats. 29 people get on at the first stop and 13 at the second. How many seats are still empty?", ["6", "19", "35", "42"], "6"),
      teacherNotes: "Learners grab numbers and use one operation. Require a written plan (or bar model) before any calculation.",
      materials: ["Step cards", "Exercise books"],
      offline: "Fully offline.",
    },
  }),
];
