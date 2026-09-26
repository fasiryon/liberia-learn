import { draftLesson, mcq, objectiveId, p, U } from "./types";

const unit = U.m4;

export const UNIT4_LESSONS = [
  draftLesson({
    slug: "multiply-tens-by-tens", moeObjectiveId: objectiveId("m4", 1), unitId: unit,
    payload: {
      title: "Multiplying Multiples of 10, 100 and 1,000 by 2-Digit Multiples of 10",
      body: "To multiply numbers that end in zeros, multiply the non-zero parts, then add all the zeros from both numbers.\n\n30 x 40: 3 x 4 = 12, and there are two zeros in total (one in 30, one in 40). So 30 x 40 = 1,200.\n\n20 x 300: 2 x 3 = 6, three zeros in total. So 20 x 300 = 6,000.\n\n50 x 80: 5 x 8 = 40, two zeros in total, giving 4,000. The answer has three zeros because 40 already ends in zero.\n\nWhy it works: 30 x 40 = 3 x 10 x 4 x 10 = (3 x 4) x (10 x 10) = 12 x 100.\n\nThis is the mental step behind long multiplication and estimation.",
      objectives: [
        "Multiply multiples of 10, 100 and 1,000 by 2-digit multiples of 10 mentally.",
        "Explain the zeros rule using place value.",
      ],
      activities: [
        "Pattern ladder: 2 x 3, 20 x 3, 20 x 30, 20 x 300 written in a column; learners describe the pattern.",
        "Quick-fire mental rounds with individual chalkboards.",
        "Area model: a 30 by 40 rectangle split into 12 blocks of 10 x 10.",
      ],
      practice: [
        p("40 x 60 = ?", "2,400"),
        p("20 x 700 = ?", "14,000"),
        p("50 x 60 = ?", "3,000"),
        p("30 x 3,000 = ?", "90,000"),
      ],
      homework: [
        p("70 x 80 = ?", "5,600"),
        p("40 x 500 = ?", "20,000"),
        p("A school orders 30 boxes of chalk with 100 sticks each. How many sticks?", "3,000"),
      ],
      quiz: [
        mcq("What is 60 x 30?", ["1,800", "180", "18,000", "900"], "1,800"),
        mcq("What is 20 x 500?", ["10,000", "1,000", "100,000", "7,000"], "10,000"),
        mcq("What is 90 x 40?", ["3,600", "360", "36,000", "130"], "3,600"),
      ],
      diagnosticCheck: mcq("What is 7 x 100?", ["700", "70", "7,000", "107"], "700"),
      assessment: mcq("What is 80 x 600?", ["48,000", "4,800", "480,000", "14,000"], "48,000"),
      teacherNotes: "Products like 50 x 60 and 20 x 500 catch learners who count zeros only in the factors. Always compute the basic fact first.",
      materials: ["Individual chalkboards"],
      offline: "Fully offline.",
    },
  }),
  draftLesson({
    slug: "estimate-products", moeObjectiveId: objectiveId("m4", 2), unitId: unit,
    payload: {
      title: "Estimating Products with 2-Digit Multipliers",
      body: "An estimate is a quick, close answer. It tells you whether an exact answer is reasonable.\n\nTo estimate a product, round each factor to its greatest place, then multiply mentally.\n\n38 x 52: round 38 to 40 and 52 to 50. 40 x 50 = 2,000. The exact answer (1,976) is close.\n\n412 x 27: round 412 to 400 and 27 to 30. 400 x 30 = 12,000.\n\nIf both factors are rounded up, the estimate is more than the exact answer. If both are rounded down, it is less.\n\nUse estimates to check your work. If you calculate 38 x 52 = 19,760, the estimate of 2,000 shows the answer is ten times too big.",
      objectives: [
        "Estimate products by rounding factors.",
        "Use estimates to judge whether an answer is reasonable.",
      ],
      activities: [
        "Reasonable or not: learners judge given answers using estimates.",
        "Shopping estimate: estimate the cost of 28 items at L$49 each (example price) before calculating.",
        "Over or under: predict whether each estimate is above or below the exact answer.",
      ],
      practice: [
        p("Estimate 47 x 21.", "50 x 20 = 1,000"),
        p("Estimate 68 x 33.", "70 x 30 = 2,100"),
        p("Estimate 295 x 42.", "300 x 40 = 12,000"),
        p("Is 19 x 31 = 5,890 reasonable? Estimate to check.", "No. 20 x 30 = 600, so the answer should be near 600 (exact 589)"),
      ],
      homework: [
        p("Estimate 58 x 49.", "60 x 50 = 3,000"),
        p("Estimate 812 x 19.", "800 x 20 = 16,000"),
        p("A bus trip costs L$38 (example price). Estimate the cost for 62 learners.", "40 x 60 = L$2,400"),
      ],
      quiz: [
        mcq("Which is the best estimate of 42 x 67?", ["2,800", "280", "28,000", "4,200"], "2,800"),
        mcq("Which is the best estimate of 509 x 31?", ["15,000", "1,500", "150,000", "5,000"], "15,000"),
        mcq("A learner says 23 x 48 = 11,040. What does an estimate show?", ["The answer is too big; it should be near 1,000", "The answer is correct", "The answer is too small", "Estimates cannot check this"], "The answer is too big; it should be near 1,000"),
      ],
      diagnosticCheck: mcq("Round 67 to the nearest ten.", ["70", "60", "65", "100"], "70"),
      assessment: mcq("Which is the best estimate of 78 x 22?", ["1,600", "160", "16,000", "1,400"], "1,600"),
      teacherNotes: "Learners may think an estimate is wrong because it differs from the exact answer. Stress that estimates are meant to be close, not exact.",
      materials: ["Exercise books"],
      offline: "Fully offline.",
    },
  }),
  draftLesson({
    slug: "multiply-by-two-digit", moeObjectiveId: objectiveId("m4", 3), unitId: unit,
    payload: {
      title: "Multiplying by a 2-Digit Multiplier",
      body: "To multiply by a 2-digit number, split the multiplier into tens and ones, find two partial products, and add them.\n\nExample: 46 x 23.\n- Multiply by the ones: 46 x 3 = 138.\n- Multiply by the tens: 46 x 20 = 920. (Write a 0 in the ones place first, then multiply by 2.)\n- Add: 138 + 920 = 1,058.\n\nThe same method works for larger numbers: 312 x 14 = 312 x 4 + 312 x 10 = 1,248 + 3,120 = 4,368.\n\nAn area model shows why: a rectangle 46 by 23 splits into 40 x 20, 40 x 3, 6 x 20 and 6 x 3. The parts add to 800 + 120 + 120 + 18 = 1,058.\n\nAlways estimate first: 46 x 23 is about 50 x 20 = 1,000.",
      objectives: [
        "Multiply 2-, 3- and 4-digit numbers by 2-digit multipliers.",
        "Use partial products and an area model.",
      ],
      activities: [
        "Area model on grid paper for 14 x 12, counting squares to confirm.",
        "Partial-product relay: one learner multiplies by ones, the next by tens, the third adds.",
        "Estimate-then-calculate cards.",
      ],
      practice: [
        p("34 x 12 = ?", "408"),
        p("57 x 26 = ?", "1,482"),
        p("243 x 15 = ?", "3,645"),
        p("1,205 x 32 = ?", "38,560"),
      ],
      homework: [
        p("48 x 21 = ?", "1,008"),
        p("136 x 24 = ?", "3,264"),
        p("A classroom has 28 desks. Each desk costs L$1,250 (example price). What is the total cost?", "L$35,000"),
      ],
      quiz: [
        mcq("What is 25 x 16?", ["400", "150", "175", "410"], "400"),
        mcq("What is 63 x 42?", ["2,646", "2,546", "378", "2,466"], "2,646"),
        mcq("Which partial products give 35 x 24?", ["35 x 4 and 35 x 20", "35 x 2 and 35 x 4", "30 x 20 and 5 x 4", "35 x 24 and 0"], "35 x 4 and 35 x 20"),
      ],
      diagnosticCheck: mcq("What is 46 x 3?", ["138", "128", "148", "1,218"], "138"),
      assessment: mcq("What is 128 x 36?", ["4,608", "4,508", "1,152", "4,618"], "4,608"),
      teacherNotes: "The main error is forgetting the placeholder zero when multiplying by the tens digit (writing 92 instead of 920). The area model makes the tens visible.",
      materials: ["Grid paper", "Exercise books"],
      offline: "Fully offline.",
    },
  }),
  draftLesson({
    slug: "divide-multiples-mentally", moeObjectiveId: objectiveId("m4", 4), unitId: unit,
    payload: {
      title: "Dividing Multiples of 10, 100 and 1,000 by 2-Digit Divisors Mentally",
      body: "Basic facts and zeros help us divide mentally.\n\n800 / 20: cross out one zero from each number to get 80 / 2 = 40. This works because dividing both numbers by 10 keeps the quotient the same.\n\n3,600 / 40: cross out one zero from each to get 360 / 4 = 90.\n\n4,500 / 50: cross out one zero from each to get 450 / 5 = 90.\n\nOnly cross out the same number of zeros from both numbers.\n\nCheck by multiplying: 40 x 90 = 3,600.\n\nUse related facts: if 12 / 3 = 4, then 120 / 30 = 4, 1,200 / 30 = 40 and 12,000 / 30 = 400.",
      objectives: [
        "Divide multiples of 10, 100 and 1,000 by 2-digit multiples of 10 mentally.",
        "Use basic division facts and place value patterns.",
      ],
      activities: [
        "Fact ladder: 15 / 3, 150 / 30, 1,500 / 30, 15,000 / 30; learners describe the pattern.",
        "Mental round with chalkboards.",
        "Check by multiplication: partners check each other's quotients.",
      ],
      practice: [
        p("600 / 30 = ?", "20"),
        p("2,400 / 60 = ?", "40"),
        p("8,000 / 40 = ?", "200"),
        p("3,500 / 70 = ?", "50"),
      ],
      homework: [
        p("900 / 30 = ?", "30"),
        p("4,800 / 80 = ?", "60"),
        p("L$6,000 is shared among 20 families (example amount). How much does each family get?", "L$300"),
      ],
      quiz: [
        mcq("What is 1,200 / 40?", ["30", "3", "300", "48"], "30"),
        mcq("What is 5,400 / 90?", ["60", "6", "600", "54"], "60"),
        mcq("Which fact helps with 2,800 / 70?", ["28 / 7 = 4", "28 / 70 = 4", "2 / 7", "280 x 7"], "28 / 7 = 4"),
      ],
      diagnosticCheck: mcq("What is 56 / 8?", ["7", "6", "8", "48"], "7"),
      assessment: mcq("What is 7,200 / 80?", ["90", "9", "900", "72"], "90"),
      teacherNotes: "Learners may cross out unequal numbers of zeros. Require them to check each quotient by multiplying.",
      materials: ["Individual chalkboards"],
      offline: "Fully offline.",
    },
  }),
  draftLesson({
    slug: "estimate-quotients", moeObjectiveId: objectiveId("m4", 5), unitId: unit,
    payload: {
      title: "Estimating Quotients with 2-Digit Divisors",
      body: "To estimate a quotient, use compatible numbers: numbers close to the real ones that divide easily.\n\n365 / 18: round 18 to 20, then look for a multiple of 20 near 365. 360 / 20 = 18. So 365 / 18 is about 18 (the exact answer is 20 remainder 5).\n\n2,730 / 41: round 41 to 40. 2,800 / 40 = 70. So the quotient is about 70 (the exact answer is 66 remainder 24).\n\nEstimates tell us how many digits the quotient has and where to start in long division. They also catch big mistakes: if you calculate 2,730 / 41 = 6, the estimate of 70 shows you missed a digit.",
      objectives: [
        "Estimate quotients using compatible numbers.",
        "Use an estimate to predict the number of digits in a quotient.",
      ],
      activities: [
        "Compatible-number match: pair each division with an easy compatible division.",
        "Predict digits: before dividing, learners write whether the quotient has 1, 2 or 3 digits.",
        "Story estimates: about how many trips does a truck carrying 48 bags make to move 1,000 bags?",
      ],
      practice: [
        p("Estimate 238 / 39.", "240 / 40 = 6"),
        p("Estimate 1,795 / 29.", "1,800 / 30 = 60"),
        p("Estimate 4,150 / 62.", "4,200 / 60 = 70"),
        p("How many digits will the quotient of 912 / 31 have?", "2 digits (about 900 / 30 = 30)"),
      ],
      homework: [
        p("Estimate 478 / 81.", "480 / 80 = 6"),
        p("Estimate 3,520 / 69.", "3,500 / 70 = 50"),
        p("About how many trips does a truck carrying 48 bags make to move 1,000 bags?", "About 20 (1,000 / 50)"),
      ],
      quiz: [
        mcq("Which is the best estimate of 553 / 71?", ["8", "80", "5", "800"], "8"),
        mcq("Which compatible numbers suit 2,390 / 58?", ["2,400 / 60", "2,000 / 50", "2,390 / 50", "3,000 / 60"], "2,400 / 60"),
        mcq("A learner says 6,320 / 79 = 8. What does an estimate show?", ["The answer should be near 80", "The answer is correct", "The answer should be near 800", "The answer should be near 8,000"], "The answer should be near 80"),
      ],
      diagnosticCheck: mcq("What is 240 / 60?", ["4", "40", "6", "400"], "4"),
      assessment: mcq("Which is the best estimate of 1,640 / 42?", ["40", "4", "400", "30"], "40"),
      teacherNotes: "Rounding the dividend and divisor separately to their nearest ten often gives awkward divisions. Teach choosing a compatible dividend from the divisor's multiples.",
      materials: ["Match cards"],
      offline: "Fully offline.",
    },
  }),
  draftLesson({
    slug: "divide-by-two-digit", moeObjectiveId: objectiveId("m4", 6), unitId: unit,
    payload: {
      title: "Dividing by a 2-Digit Divisor",
      body: "Long division by a 2-digit divisor uses the same steps: divide, multiply, subtract, bring down. Estimates help choose each digit.\n\nExample: 864 / 24.\n- 86 / 24: think 80 / 20 = 4, but 4 x 24 = 96 is too big. Try 3: 3 x 24 = 72. 86 - 72 = 14. Bring down 4 to make 144.\n- 144 / 24: think 140 / 20 = 7, but 7 x 24 = 168 is too big. Try 6: 6 x 24 = 144. 144 - 144 = 0.\nSo 864 / 24 = 36.\n\nIf a trial digit makes a product that is too big, try one less. If the remainder is bigger than the divisor, try one more.\n\nCheck: 36 x 24 = 864.\n\nMaking a short multiples list for the divisor (24, 48, 72, 96, 120, 144 ...) makes each step faster.",
      objectives: [
        "Divide 2-, 3- and 4-digit numbers by 2-digit divisors.",
        "Adjust trial quotient digits and check by multiplication.",
      ],
      activities: [
        "Multiples list: before dividing by 24, learners list its first nine multiples.",
        "Trial and adjust: pairs work 864 / 24 and record each trial digit.",
        "Real problem: 1,152 books packed 32 to a box. How many boxes?",
      ],
      practice: [
        p("96 / 12 = ?", "8"),
        p("672 / 21 = ?", "32"),
        p("1,152 / 32 = ?", "36"),
        p("850 / 25 = ?", "34"),
      ],
      homework: [
        p("588 / 14 = ?", "42"),
        p("2,275 / 35 = ?", "65"),
        p("715 / 22 = ?", "32 remainder 11"),
      ],
      quiz: [
        mcq("What is 408 / 17?", ["24", "23", "34", "14"], "24"),
        mcq("What is 1,350 / 45?", ["30", "3", "300", "35"], "30"),
        mcq("What is 500 / 23?", ["21 remainder 17", "21 remainder 7", "22 remainder 6", "20 remainder 40"], "21 remainder 17"),
      ],
      diagnosticCheck: mcq("What is 3 x 24?", ["72", "62", "48", "96"], "72"),
      assessment: mcq("What is 2,016 / 36?", ["56", "46", "66", "506"], "56"),
      teacherNotes: "Trial digits are often one too big. Encourage learners to write the product before subtracting so the size problem is visible.",
      materials: ["Exercise books"],
      offline: "Fully offline.",
    },
  }),
  draftLesson({
    slug: "read-write-decimals-hundredths", moeObjectiveId: objectiveId("m4", 7), unitId: unit,
    payload: {
      title: "Reading and Writing Decimals to Hundredths",
      body: "A decimal shows parts of a whole using place value. The decimal point separates whole numbers from parts.\n\nTo the right of the point: the first place is tenths (one part of 10 equal parts), the second is hundredths (one part of 100 equal parts).\n0.1 = 1/10, 0.01 = 1/100, 0.35 = 35/100.\n\nIn 4.27, 4 is ones, 2 is tenths (0.2) and 7 is hundredths (0.07). Read it as \"four and twenty-seven hundredths\" or \"four point two seven\".\n\nA hundred grid shows hundredths: shade 35 of 100 small squares to show 0.35.\n\nMoney uses hundredths: in US dollars, used alongside Liberian dollars, $2.75 is 2 dollars and 75 cents, and 75 cents is 75/100 of a dollar.\n\nA zero holds an empty place: 0.05 is five hundredths, but 0.5 is five tenths (fifty hundredths).",
      objectives: [
        "Read and write decimals to hundredths in words, numerals and fractions.",
        "Identify the value of each digit in a decimal.",
      ],
      activities: [
        "Hundred grids: shade 0.4, 0.04 and 0.44 and compare.",
        "Money link: write amounts like 3 dollars 45 cents as 3.45.",
        "Place-value chart with a decimal point: learners place digits for teacher-called decimals.",
      ],
      practice: [
        p("Write 0.63 as a fraction.", "63/100"),
        p("Write 7/10 as a decimal.", "0.7"),
        p("Write in numerals: five and eight hundredths.", "5.08"),
        p("What is the value of the 9 in 3.19?", "9 hundredths (0.09)"),
      ],
      homework: [
        p("Write 0.4 as a fraction.", "4/10"),
        p("Write in numerals: twelve and thirty-six hundredths.", "12.36"),
        p("Write 2.05 in words.", "two and five hundredths"),
      ],
      quiz: [
        mcq("Which decimal equals 47/100?", ["0.47", "4.7", "0.047", "47.0"], "0.47"),
        mcq("What is the value of 6 in 8.61?", ["6 tenths", "6 hundredths", "6 ones", "6 tens"], "6 tenths"),
        mcq("How is 3.09 read?", ["three and nine hundredths", "three and nine tenths", "thirty-nine", "three and ninety hundredths"], "three and nine hundredths"),
      ],
      diagnosticCheck: mcq("How many equal parts make one whole in tenths?", ["10", "100", "1", "5"], "10"),
      assessment: mcq("Write in numerals: six and four hundredths.", ["6.04", "6.4", "6.004", "64.0"], "6.04"),
      teacherNotes: "Learners often write 5.8 for five and eight hundredths. Use the place-value chart to show the empty tenths place.",
      materials: ["Hundred grids", "Place-value chart with decimal point"],
      offline: "Fully offline with printed or drawn hundred grids. Online, the number-line tool shows tenths and hundredths.",
    },
  }),
  draftLesson({
    slug: "compare-order-decimals", moeObjectiveId: objectiveId("m4", 8), unitId: unit,
    payload: {
      title: "Comparing and Ordering Decimals to Hundredths",
      body: "To compare decimals, line up the decimal points and compare place by place from the left.\n\n3.47 and 3.52: the ones are equal (3 and 3). In the tenths, 4 < 5, so 3.47 < 3.52.\n\nWhen the decimals have different numbers of places, add a zero so both have hundredths: 0.6 = 0.60. Then 0.60 > 0.58, so 0.6 > 0.58.\n\nA longer decimal is not always bigger: 0.9 > 0.45, because 9 tenths is more than 4 tenths.\n\nOn a number line from 0 to 1 marked in tenths, 0.45 sits halfway between 0.4 and 0.5, and 0.9 is further right.\n\nTo order decimals, compare them in pairs or write them all with the same number of places, then order them like whole numbers: 0.30, 0.03, 0.33 become 0.03 < 0.30 < 0.33.",
      objectives: [
        "Compare decimals to hundredths using >, < and =.",
        "Order decimals from least to greatest and greatest to least.",
      ],
      activities: [
        "Number line 0 to 1: learners place 0.25, 0.5, 0.75 and 0.05.",
        "Race times (example data): order the finishing times 12.45 s, 12.4 s and 12.54 s from fastest to slowest.",
        "Grid comparison: shade 0.6 and 0.58 on hundred grids to see which is bigger.",
      ],
      practice: [
        p("Write >, < or =: 0.7 ___ 0.69", ">"),
        p("Write >, < or =: 2.30 ___ 2.3", "="),
        p("Order from least to greatest: 0.5, 0.05, 0.55", "0.05, 0.5, 0.55"),
        p("Which is greater: 4.08 or 4.8?", "4.8"),
      ],
      homework: [
        p("Write >, < or =: 1.25 ___ 1.52", "<"),
        p("Order from greatest to least: 3.1, 3.01, 3.11", "3.11, 3.1, 3.01"),
        p("Which is the least: 0.9, 0.19, 0.91?", "0.19"),
      ],
      quiz: [
        mcq("Which is the greatest?", ["0.8", "0.75", "0.08", "0.78"], "0.8"),
        mcq("Which statement is true?", ["0.4 > 0.35", "0.4 < 0.35", "0.4 = 0.35", "0.35 > 0.4"], "0.4 > 0.35"),
        mcq("Order from least to greatest: 2.6, 2.06, 2.66", ["2.06, 2.6, 2.66", "2.6, 2.06, 2.66", "2.66, 2.6, 2.06", "2.06, 2.66, 2.6"], "2.06, 2.6, 2.66"),
      ],
      diagnosticCheck: mcq("Which is greater: 5 tenths or 3 tenths?", ["5 tenths", "3 tenths", "They are equal", "Cannot tell"], "5 tenths"),
      assessment: mcq("Order from least to greatest: 0.45, 0.4, 0.54", ["0.4, 0.45, 0.54", "0.45, 0.4, 0.54", "0.54, 0.45, 0.4", "0.4, 0.54, 0.45"], "0.4, 0.45, 0.54"),
      teacherNotes: "The misconception 'longer is larger' (0.45 > 0.9) is very common. Always add zeros to equalise places and use hundred grids.",
      materials: ["Hundred grids", "Chalk number line"],
      offline: "Fully offline. Online, the number-line tool supports placing decimals.",
    },
  }),
];
