import { draftLesson, mcq, objectiveId, p, U } from "./types";

const unit = U.m2;

export const UNIT2_LESSONS = [
  draftLesson({
    slug: "multiplication-facts-properties", moeObjectiveId: objectiveId("m2", 1), unitId: unit,
    payload: {
      title: "Multiplication Facts and Properties",
      body: "Multiplication is repeated addition of equal groups. Four groups of 6 bottle caps is 6 + 6 + 6 + 6 = 24, written 4 x 6 = 24. An array (rows and columns) shows the same thing: 4 rows of 6.\n\nMultiplication has properties that make facts easier:\n- Commutative (order) property: 4 x 6 = 6 x 4. Turning the array sideways does not change the total.\n- Identity property of one: any number times 1 is itself (9 x 1 = 9).\n- Zero property: any number times 0 is 0 (9 x 0 = 0). Nine empty groups hold nothing.\n- Associative (grouping) property: (2 x 3) x 4 = 2 x (3 x 4) = 24.\n- Distributive property: split a hard fact into easier ones. 7 x 8 = 7 x 5 + 7 x 3 = 35 + 21 = 56.\n\nKnowing facts up to 10 x 10 quickly helps with every later topic: long multiplication, division, fractions and area.",
      objectives: [
        "Recall multiplication facts up to 10 x 10.",
        "Identify and use the commutative, identity, zero, associative and distributive properties.",
      ],
      activities: [
        "Build arrays with bottle caps or stones for 3 x 5 and 5 x 3 and compare the totals.",
        "Fact families: learners write the four facts for 6, 7 and 42 (6 x 7, 7 x 6, 42 / 6, 42 / 7).",
        "Break-apart: split 8 x 7 into 8 x 5 + 8 x 2 using a drawn array.",
      ],
      practice: [
        p("7 x 9 = ?", "63"),
        p("Which property shows 5 x 8 = 8 x 5?", "Commutative (order) property"),
        p("Use the distributive property: 6 x 12 = 6 x 10 + 6 x 2 = ?", "72"),
        p("What is 145 x 0?", "0"),
      ],
      homework: [
        p("8 x 6 = ?", "48"),
        p("Fill the blank: (3 x 2) x 5 = 3 x (2 x ___)", "5"),
        p("Write two multiplication facts for an array of 4 rows of 9.", "4 x 9 = 36 and 9 x 4 = 36"),
      ],
      quiz: [
        mcq("What is 9 x 8?", ["72", "63", "81", "64"], "72"),
        mcq("Which is an example of the identity property?", ["7 x 1 = 7", "7 x 0 = 0", "7 x 2 = 2 x 7", "7 x 3 = 21"], "7 x 1 = 7"),
        mcq("Which equals 4 x 13?", ["4 x 10 + 4 x 3", "4 x 10 + 3", "4 + 13", "4 x 10 x 3"], "4 x 10 + 4 x 3"),
      ],
      diagnosticCheck: mcq("What is 5 + 5 + 5 + 5?", ["20", "25", "15", "9"], "20"),
      assessment: mcq("Which property says 6 x 0 = 0?", ["Zero property", "Identity property", "Commutative property", "Distributive property"], "Zero property"),
      teacherNotes: "Learners confuse the identity property (x 1) with the zero property (x 0). Use empty and single groups of objects to show the difference.",
      materials: ["Bottle caps or stones", "Exercise books"],
      offline: "Fully offline: arrays built with counters or drawn as dots. Online, the multiplication-table tool shows rows and columns.",
    },
  }),
  draftLesson({
    slug: "multiply-multiples-of-10", moeObjectiveId: objectiveId("m2", 2), unitId: unit,
    payload: {
      title: "Multiplying Multiples of 10, 100 and 1,000",
      body: "Multiplying by 10 moves every digit one place to the left and puts a zero in the ones place: 7 x 10 = 70. Multiplying by 100 moves digits two places (7 x 100 = 700), and by 1,000 three places (7 x 1,000 = 7,000).\n\nUse a basic fact and then count zeros. For 6 x 400, think 6 x 4 = 24, then 400 has two zeros, so 6 x 400 = 2,400. For 3 x 5,000, think 3 x 5 = 15, add three zeros: 15,000.\n\nBe careful when the basic fact already ends in zero: 5 x 60 is 5 x 6 = 30 plus one zero, which is 300. There are two zeros in the answer, not one.\n\nThis skill helps with money in Liberian dollars: if a bag of charcoal costs L$500 (example price), then 4 bags cost 4 x 500 = L$2,000.",
      objectives: [
        "Multiply a one-digit number by multiples of 10, 100 and 1,000.",
        "Explain the pattern of zeros using place value.",
      ],
      activities: [
        "Pattern table: learners complete 3 x 2, 3 x 20, 3 x 200, 3 x 2,000 and describe the pattern.",
        "Place-value slide: move digit cards across a place-value chart to show multiplying by 10 and 100.",
        "Shop problems with example prices in Liberian dollars.",
      ],
      practice: [
        p("8 x 70 = ?", "560"),
        p("4 x 300 = ?", "1,200"),
        p("9 x 6,000 = ?", "54,000"),
        p("5 x 800 = ?", "4,000"),
      ],
      homework: [
        p("7 x 90 = ?", "630"),
        p("6 x 5,000 = ?", "30,000"),
        p("A notebook costs L$40 (example price). How much do 8 notebooks cost?", "L$320"),
      ],
      quiz: [
        mcq("What is 6 x 700?", ["4,200", "420", "42,000", "4,020"], "4,200"),
        mcq("What is 5 x 40?", ["200", "20", "2,000", "240"], "200"),
        mcq("What is 3 x 9,000?", ["27,000", "2,700", "270,000", "12,000"], "27,000"),
      ],
      diagnosticCheck: mcq("What is 4 x 10?", ["40", "14", "400", "4"], "40"),
      assessment: mcq("What is 8 x 500?", ["4,000", "400", "40,000", "8,500"], "4,000"),
      teacherNotes: "Watch the 5 x 40 and 5 x 800 type: learners often lose a zero because the basic fact already ends in 0.",
      materials: ["Digit cards", "Place-value chart"],
      offline: "Fully offline.",
    },
  }),
  draftLesson({
    slug: "multiply-by-one-digit", moeObjectiveId: objectiveId("m2", 3), unitId: unit,
    payload: {
      title: "Multiplying 2-, 3- and 4-Digit Numbers by a 1-Digit Number",
      body: "To multiply a larger number by a one-digit number, multiply each place, starting with the ones, and regroup when a product is 10 or more.\n\nExample: 348 x 6.\n- Ones: 8 x 6 = 48. Write 8, carry 4 tens.\n- Tens: 4 x 6 = 24, plus the 4 carried = 28. Write 8, carry 2 hundreds.\n- Hundreds: 3 x 6 = 18, plus 2 = 20. Write 20.\nSo 348 x 6 = 2,088.\n\nYou can also use expanded form (the distributive property): 348 x 6 = 300 x 6 + 40 x 6 + 8 x 6 = 1,800 + 240 + 48 = 2,088.\n\nEstimate to check: 348 is about 350, and 350 x 6 = 2,100, so 2,088 is reasonable.",
      objectives: [
        "Multiply 2-, 3- and 4-digit numbers by a 1-digit number with regrouping.",
        "Check a product by estimating.",
      ],
      activities: [
        "Area model: draw a rectangle split into 300, 40 and 8 to show 348 x 6.",
        "Compare methods: half the class uses expanded form, half uses the standard method; compare answers.",
        "Word problems: bundles of copybooks, crates of soft drinks, boxes of chalk.",
      ],
      practice: [
        p("47 x 3 = ?", "141"),
        p("256 x 4 = ?", "1,024"),
        p("1,305 x 7 = ?", "9,135"),
        p("A crate holds 24 bottles. How many bottles are in 9 crates?", "216"),
      ],
      homework: [
        p("68 x 5 = ?", "340"),
        p("419 x 8 = ?", "3,352"),
        p("2,146 x 3 = ?", "6,438"),
      ],
      quiz: [
        mcq("What is 73 x 6?", ["438", "428", "4,218", "448"], "438"),
        mcq("What is 524 x 3?", ["1,572", "1,562", "1,672", "15,612"], "1,572"),
        mcq("Which is the best estimate for 612 x 5?", ["3,000", "300", "30,000", "600"], "3,000"),
      ],
      diagnosticCheck: mcq("What is 7 x 8?", ["56", "54", "48", "63"], "56"),
      assessment: mcq("What is 1,468 x 4?", ["5,872", "5,862", "4,872", "5,672"], "5,872"),
      teacherNotes: "The most common error is forgetting to add the carried digit, or adding it before multiplying. Have learners write carried digits small above the next column.",
      materials: ["Exercise books", "Grid paper for area models"],
      offline: "Fully offline.",
    },
  }),
  draftLesson({
    slug: "divide-by-one-digit", moeObjectiveId: objectiveId("m2", 4), unitId: unit,
    payload: {
      title: "Dividing 2-, 3- and 4-Digit Numbers by a 1-Digit Divisor",
      body: "Division shares a number into equal groups. In 84 / 4 = 21, 84 is the dividend, 4 is the divisor and 21 is the quotient.\n\nLong division works from the left, one place at a time: divide, multiply, subtract, bring down.\n\nExample: 752 / 4.\n- Hundreds: 7 / 4 = 1, 1 x 4 = 4, 7 - 4 = 3. Bring down 5 to make 35.\n- Tens: 35 / 4 = 8, 8 x 4 = 32, 35 - 32 = 3. Bring down 2 to make 32.\n- Ones: 32 / 4 = 8, 8 x 4 = 32, 32 - 32 = 0.\nSo 752 / 4 = 188.\n\nSometimes there is a remainder: 53 / 5 = 10 remainder 3, because 10 x 5 = 50 and 3 is left over. The remainder must always be less than the divisor.\n\nCheck division by multiplying: quotient x divisor + remainder = dividend. 188 x 4 = 752.",
      objectives: [
        "Divide 2-, 3- and 4-digit numbers by a 1-digit divisor using long division.",
        "Interpret remainders and check division by multiplication.",
      ],
      activities: [
        "Fair sharing: share 96 bottle caps among 4 groups, first by tens, then by ones.",
        "Board routine: learners chant divide, multiply, subtract, bring down while working a problem together.",
        "Check partners: one learner divides, the partner checks by multiplying.",
      ],
      practice: [
        p("96 / 4 = ?", "24"),
        p("635 / 5 = ?", "127"),
        p("2,184 / 6 = ?", "364"),
        p("59 / 7 = ?", "8 remainder 3"),
      ],
      homework: [
        p("78 / 3 = ?", "26"),
        p("852 / 4 = ?", "213"),
        p("3,465 / 5 = ?", "693"),
      ],
      quiz: [
        mcq("What is 144 / 6?", ["24", "26", "34", "22"], "24"),
        mcq("What is 47 / 5?", ["9 remainder 2", "9 remainder 4", "8 remainder 7", "9"], "9 remainder 2"),
        mcq("Which checks 312 / 8 = 39?", ["39 x 8 = 312", "39 + 8 = 312", "312 x 8 = 39", "312 - 39 = 8"], "39 x 8 = 312"),
      ],
      diagnosticCheck: mcq("What is 36 / 9?", ["4", "3", "6", "27"], "4"),
      assessment: mcq("What is 1,728 / 8?", ["216", "206", "226", "261"], "216"),
      teacherNotes: "Learners may leave a remainder larger than the divisor. Ask: could another group be made? If yes, the quotient is too small.",
      materials: ["Bottle caps", "Exercise books"],
      offline: "Fully offline.",
    },
  }),
  draftLesson({
    slug: "divide-zero-in-quotient", moeObjectiveId: objectiveId("m2", 5), unitId: unit,
    payload: {
      title: "Division with Zero in the Quotient",
      body: "Sometimes a step in long division cannot make a group. Then we write 0 in that place of the quotient. Leaving it out gives a wrong answer.\n\nExample: 824 / 4.\n- Hundreds: 8 / 4 = 2. 2 x 4 = 8, 8 - 8 = 0. Bring down 2.\n- Tens: 2 / 4 = 0 (2 is smaller than 4). Write 0 in the tens place. 0 x 4 = 0, 2 - 0 = 2. Bring down 4 to make 24.\n- Ones: 24 / 4 = 6.\nSo 824 / 4 = 206, not 26.\n\nCheck: 206 x 4 = 824. And 26 x 4 = 104, which shows that 26 is wrong.\n\nEstimating also catches the mistake: 824 / 4 is about 800 / 4 = 200, so the answer must be in the hundreds.",
      objectives: [
        "Divide whole numbers where the quotient has a zero.",
        "Use estimation to check the number of digits in a quotient.",
      ],
      activities: [
        "Error hunt: learners find the mistake in a worked answer 624 / 3 = 28 (correct: 208).",
        "Estimate first: before dividing, learners predict whether the answer has 2 or 3 digits.",
        "Money sharing: share L$615 (example amount) equally among 3 people.",
      ],
      practice: [
        p("618 / 6 = ?", "103"),
        p("927 / 9 = ?", "103"),
        p("1,640 / 8 = ?", "205"),
        p("2,436 / 4 = ?", "609"),
      ],
      homework: [
        p("515 / 5 = ?", "103"),
        p("3,210 / 3 = ?", "1,070"),
        p("L$615 is shared equally among 3 people (example amount). How much does each get?", "L$205"),
      ],
      quiz: [
        mcq("What is 408 / 4?", ["102", "12", "120", "1,002"], "102"),
        mcq("What is 721 / 7?", ["103", "13", "130", "113"], "103"),
        mcq("A learner wrote 630 / 3 = 21. What is correct?", ["210", "21", "201", "2,010"], "210"),
      ],
      diagnosticCheck: mcq("What is 0 / 5?", ["0", "5", "1", "It cannot be done"], "0"),
      assessment: mcq("What is 2,418 / 6?", ["403", "43", "430", "413"], "403"),
      teacherNotes: "The key error is skipping the zero. Require an estimate before every problem so learners know how many digits to expect.",
      materials: ["Exercise books"],
      offline: "Fully offline.",
    },
  }),
  draftLesson({
    slug: "division-word-problems", moeObjectiveId: objectiveId("m2", 6), unitId: unit,
    payload: {
      title: "Solving Problems Involving Division",
      body: "To solve a word problem, read it carefully and ask: What do I know? What must I find? Is this sharing into equal groups, or finding how many groups?\n\nSharing: 96 pencils are shared equally among 8 learners. How many does each get? 96 / 8 = 12.\n\nGrouping: 96 pencils are packed 8 to a box. How many boxes? 96 / 8 = 12 boxes.\n\nThe remainder must make sense in the story:\n- 50 learners ride in taxis that carry 4 each. 50 / 4 = 12 remainder 2. We need 13 taxis, because the last 2 learners must also ride. Round the quotient up.\n- L$50 buys pens at L$4 each (example price). 50 / 4 = 12 remainder 2. You can buy 12 pens, and L$2 is change. The remainder is left over.\n\nAlways write the answer as a sentence with units, and check it by multiplying.",
      objectives: [
        "Solve sharing and grouping problems using division.",
        "Decide what a remainder means in a word problem.",
      ],
      activities: [
        "Sort the story: groups sort problem cards into sharing and grouping.",
        "Remainder decisions: for each problem, decide whether to round up, drop the remainder or report it.",
        "Learners write their own division story about their school or market.",
      ],
      practice: [
        p("A farmer packs 168 eggs into trays of 6. How many trays does he fill?", "28 trays"),
        p("75 learners travel in buses that carry 20 each. How many buses are needed?", "4 buses"),
        p("L$90 is shared equally among 4 children (example amount). How much does each get, and how much is left?", "L$22 each, L$2 left"),
        p("A 144-page book is read at 9 pages a day. How many days does it take?", "16 days"),
      ],
      homework: [
        p("A rice bag of 100 cups is shared into bowls of 8 cups. How many full bowls, and how many cups are left?", "12 full bowls, 4 cups left"),
        p("225 chairs are arranged in 9 equal rows. How many chairs are in each row?", "25 chairs"),
        p("46 mangoes are packed in bags of 5. How many bags are needed to pack all the mangoes?", "10 bags"),
      ],
      quiz: [
        mcq("33 learners sit on benches that hold 4 each. How many benches are needed?", ["9", "8", "8 remainder 1", "7"], "9"),
        mcq("A teacher shares 120 exercise books equally among 5 classes. How many does each class get?", ["24", "25", "600", "115"], "24"),
        mcq("L$70 buys pencils at L$8 each (example price). How many pencils can be bought?", ["8", "9", "7", "10"], "8"),
      ],
      diagnosticCheck: mcq("What is 45 / 5?", ["9", "8", "40", "50"], "9"),
      assessment: mcq("250 learners go on a trip. Each bus carries 30 learners. How many buses are needed?", ["9", "8", "8 remainder 10", "10"], "9"),
      teacherNotes: "Make learners say what the remainder means before answering. Ask each time: does the answer need rounding up, or is the remainder left over?",
      materials: ["Problem cards", "Counters"],
      offline: "Fully offline.",
    },
  }),
];
