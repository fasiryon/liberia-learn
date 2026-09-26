import { draftLesson, mcq, objectiveId, p, U } from "./types";

const unit = U.m1;

export const UNIT1_LESSONS = [
  draftLesson({
    slug: "read-write-numbers-to-100000", moeObjectiveId: objectiveId("m1", 1), unitId: unit,
    payload: {
      title: "Reading and Writing Numbers to 100,000",
      body: "Every digit in a number has a place, and the place tells its value. From the right, the places are ones, tens, hundreds, thousands, ten thousands and hundred thousands. In 47,305 the 4 is in the ten thousands place, so it is worth 40,000. The 7 is worth 7,000, the 3 is worth 300, the 0 means there are no tens, and the 5 is worth 5.\n\nWe read the number in two parts, split by the comma. First read the thousands group, then say \"thousand\", then read the rest: 47,305 is \"forty-seven thousand, three hundred five\". We never say \"and\" inside a whole number.\n\nExpanded form shows the value of each digit: 47,305 = 40,000 + 7,000 + 300 + 5. A zero keeps a place empty. Without it, 47,305 would become 4,735, a very different number.\n\nNumbers this large appear in daily life: the number of people in a district, the cost of a motorbike in Liberian dollars, or the number of bags of rice arriving at the Freeport. The number 100,000 is one hundred thousand, the first six-digit number.",
      objectives: [
        "Name the place of each digit in a number up to 100,000.",
        "Read and write numbers up to 100,000 in words and numerals.",
        "Write a number in expanded form.",
      ],
      activities: [
        "Draw a place-value chart (hundred thousands to ones) in exercise books and place teacher-called numbers in it.",
        "Pairs: one learner writes a five-digit number, the partner reads it aloud and writes it in words.",
        "Card game: learners arrange five digit cards to make the largest and smallest possible numbers, then read them.",
      ],
      practice: [
        p("Write 62,418 in words.", "sixty-two thousand, four hundred eighteen"),
        p("Write in numerals: thirty thousand, five hundred six.", "30,506"),
        p("What is the value of the 8 in 18,245?", "8,000"),
        p("Write 90,372 in expanded form.", "90,000 + 300 + 70 + 2"),
      ],
      homework: [
        p("Write in numerals: seventy-one thousand, forty.", "71,040"),
        p("Write 55,009 in words.", "fifty-five thousand, nine"),
        p("Which digit is in the ten thousands place of 83,614?", "8"),
      ],
      quiz: [
        mcq("How is 24,060 read?", ["twenty-four thousand, sixty", "twenty-four thousand, six hundred", "two thousand, four hundred sixty", "twenty-four thousand, six"], "twenty-four thousand, sixty"),
        mcq("What is the value of 6 in 36,152?", ["6", "600", "6,000", "60,000"], "6,000"),
        mcq("Which number is 50,000 + 4,000 + 20 + 7?", ["54,207", "54,027", "5,427", "50,427"], "54,027"),
      ],
      diagnosticCheck: mcq("What is the value of 3 in 3,452?", ["3", "30", "300", "3,000"], "3,000"),
      assessment: mcq("Write in numerals: eighty thousand, three hundred four.", ["80,304", "80,340", "8,304", "800,304"], "80,304"),
      teacherNotes: "Watch for learners who drop zeros (writing 8,304 for eighty thousand, three hundred four). Always have them build the number in a place-value chart first.",
      materials: ["Exercise books", "Digit cards 0-9", "Chalk place-value chart"],
      offline: "Fully offline: place-value chart drawn on the board and in books; digit cards cut from paper.",
    },
  }),
  draftLesson({
    slug: "compare-order-numbers-to-100000", moeObjectiveId: objectiveId("m1", 2), unitId: unit,
    payload: {
      title: "Comparing and Ordering Numbers to 100,000",
      body: "To compare two numbers, first count the digits. A number with more digits is greater: 10,200 is greater than 9,875 because it has five digits.\n\nIf both numbers have the same number of digits, compare the digits from the left, place by place. Stop at the first place where they differ. For 43,518 and 43,286, the ten thousands (4 and 4) and thousands (3 and 3) are the same. In the hundreds place 5 is greater than 2, so 43,518 > 43,286.\n\nWe use symbols: > means \"is greater than\", < means \"is less than\" and = means \"is equal to\". The open side of the symbol faces the greater number.\n\nTo order several numbers, compare them in pairs or line them up by place value, then write them from least to greatest (ascending) or greatest to least (descending). A number line helps: numbers further to the right are greater.",
      objectives: [
        "Compare two numbers up to 100,000 using >, < and =.",
        "Order a set of numbers from least to greatest and greatest to least.",
      ],
      activities: [
        "Line up: five learners hold five-digit number cards and arrange themselves from least to greatest; the class checks place by place.",
        "Number line: mark 40,000 to 50,000 on a floor or board number line and place given numbers on it.",
        "Market prices (illustrative): compare the prices of three items listed in Liberian dollars and order them.",
      ],
      practice: [
        p("Write >, < or =: 38,902 ___ 38,920", "<"),
        p("Write >, < or =: 70,001 ___ 9,999", ">"),
        p("Order from least to greatest: 25,310; 25,031; 25,301", "25,031; 25,301; 25,310"),
        p("Order from greatest to least: 61,450; 16,540; 64,150", "64,150; 61,450; 16,540"),
      ],
      homework: [
        p("Write >, < or =: 45,678 ___ 45,687", "<"),
        p("Which is the greatest: 99,100; 91,900; 99,010?", "99,100"),
        p("Order from least to greatest: 12,005; 12,500; 10,250", "10,250; 12,005; 12,500"),
      ],
      quiz: [
        mcq("Which statement is true?", ["52,300 > 53,200", "52,300 < 53,200", "52,300 = 53,200", "53,200 < 52,300"], "52,300 < 53,200"),
        mcq("Which number is the least?", ["30,099", "30,909", "30,990", "39,000"], "30,099"),
        mcq("Which list is ordered from greatest to least?", ["8,500; 85,000; 58,000", "85,000; 58,000; 8,500", "58,000; 85,000; 8,500", "8,500; 58,000; 85,000"], "85,000; 58,000; 8,500"),
      ],
      diagnosticCheck: mcq("Which is greater: 4,209 or 4,290?", ["4,209", "4,290", "They are equal", "Cannot tell"], "4,290"),
      assessment: mcq("Order from least to greatest: 47,200; 42,700; 47,020", ["42,700; 47,020; 47,200", "47,020; 42,700; 47,200", "42,700; 47,200; 47,020", "47,200; 47,020; 42,700"], "42,700; 47,020; 47,200"),
      teacherNotes: "A common error is comparing the last digits instead of starting from the left. Have learners circle the first place where the digits differ.",
      materials: ["Number cards", "Chalk number line", "Exercise books"],
      offline: "Fully offline: floor or chalk number line and paper number cards. Online, the number-line tool can be used for placement.",
    },
  }),
  draftLesson({
    slug: "rounding-whole-numbers", moeObjectiveId: objectiveId("m1", 3), unitId: unit,
    payload: {
      title: "Rounding Whole Numbers to the Nearest Ten, Hundred and Thousand",
      body: "Rounding gives a number that is close to the real one and easier to work with. We round when an exact number is not needed, such as saying a school has about 600 pupils.\n\nTo round, find the place you are rounding to and look at the digit just to its right. If that digit is 5 or more, round up: add one to the rounding place. If it is 4 or less, round down: keep the rounding place the same. Every digit to the right becomes zero.\n\nRound 3,467 to the nearest hundred: the hundreds digit is 4, and the digit to its right is 6. Six is 5 or more, so round up to 3,500.\n\nRound 12,381 to the nearest thousand: the thousands digit is 2, and the next digit is 3. Three is less than 5, so round down to 12,000.\n\nOn a number line, rounding means finding which of the two nearest round numbers is closer. The halfway point (like 3,450 between 3,400 and 3,500) rounds up.",
      objectives: [
        "Round whole numbers to the nearest ten, hundred and thousand.",
        "Use a number line to explain rounding.",
      ],
      activities: [
        "Number-line hill: draw a number line from 3,400 to 3,500; learners mark 3,467 and decide which end is closer.",
        "Round the register: each group rounds its class enrollment and the school total to the nearest ten and hundred.",
        "Rounding relay: teams round a called number to a called place; the first correct team scores.",
      ],
      practice: [
        p("Round 74 to the nearest ten.", "70"),
        p("Round 2,851 to the nearest hundred.", "2,900"),
        p("Round 46,500 to the nearest thousand.", "47,000"),
        p("Round 9,049 to the nearest hundred.", "9,000"),
      ],
      homework: [
        p("Round 635 to the nearest ten.", "640"),
        p("Round 18,420 to the nearest thousand.", "18,000"),
        p("Round 7,950 to the nearest hundred.", "8,000"),
      ],
      quiz: [
        mcq("Round 5,672 to the nearest hundred.", ["5,600", "5,700", "5,670", "6,000"], "5,700"),
        mcq("Round 23,499 to the nearest thousand.", ["23,000", "24,000", "23,500", "20,000"], "23,000"),
        mcq("Which number rounds to 400 when rounded to the nearest hundred?", ["349", "351", "450", "455"], "351"),
      ],
      diagnosticCheck: mcq("Which ten is 38 closer to?", ["30", "40", "It is exactly halfway", "50"], "40"),
      assessment: mcq("Round 64,508 to the nearest thousand.", ["64,000", "65,000", "64,500", "60,000"], "65,000"),
      teacherNotes: "Learners often change the digit they look at instead of the rounding place, or forget to replace the digits on the right with zeros. The halfway rule (5 rounds up) needs explicit practice.",
      materials: ["Chalk number line", "Class enrollment figures"],
      offline: "Fully offline: number lines drawn on the board or in books. Online, the number-line tool shows the two nearest round numbers.",
    },
  }),
  draftLesson({
    slug: "add-subtract-population-data", moeObjectiveId: objectiveId("m1", 4), unitId: unit,
    payload: {
      title: "Adding and Subtracting with Population Data",
      body: "A population changes in three main ways: babies are born, people die, and people move in or out (migration). We use addition and subtraction to follow these changes.\n\nThe numbers in this lesson are example data for a made-up district. They are for practice and are not real statistics.\n\nSuppose a district had 48,250 people at the start of a year. During the year there were 1,375 births and 412 deaths. To find the new population, add the births and subtract the deaths: 48,250 + 1,375 = 49,625, then 49,625 - 412 = 49,213.\n\nWhen adding or subtracting large numbers, line up the digits by place value, starting with the ones. Regroup (carry) when a column adds to 10 or more. When subtracting, regroup (borrow) from the next place if the top digit is smaller.\n\nAlways check your answer. Estimate first by rounding (48,000 + 1,000 - 400 is about 48,600, so 49,213 is reasonable), and check subtraction by adding back: 49,213 + 412 = 49,625.",
      objectives: [
        "Add and subtract whole numbers up to 100,000 with regrouping.",
        "Use births, deaths and migration data to find population change.",
        "Check answers by estimating and by inverse operations.",
      ],
      activities: [
        "Worked example on the board: start population, add births and people moving in, subtract deaths and people moving out.",
        "Group task: each group receives an example data card for a made-up town and calculates the end-of-year population.",
        "Check and swap: groups check another group's answer using addition to undo subtraction.",
      ],
      practice: [
        p("Add: 36,487 + 12,758", "49,245"),
        p("Subtract: 50,000 - 17,364", "32,636"),
        p("A town had 23,640 people. 845 babies were born and 290 people died. What is the new population?", "24,195"),
        p("In a year, 1,230 people moved into a district and 978 moved out. How many more people moved in than out?", "252"),
      ],
      homework: [
        p("Add: 45,906 + 28,395", "74,301"),
        p("Subtract: 81,205 - 46,718", "34,487"),
        p("A district of 62,500 people had 1,104 births, 386 deaths and 520 people moving out. What is the new population?", "62,698"),
      ],
      quiz: [
        mcq("What is 27,568 + 14,736?", ["42,304", "41,304", "42,204", "41,294"], "42,304"),
        mcq("What is 60,402 - 25,819?", ["34,583", "35,583", "34,683", "45,417"], "34,583"),
        mcq("A town had 15,000 people. There were 600 births and 250 deaths. What is the new population?", ["15,350", "15,850", "14,650", "15,600"], "15,350"),
      ],
      diagnosticCheck: mcq("What is 486 + 257?", ["733", "743", "643", "7,313"], "743"),
      assessment: mcq("A district had 34,280 people. 1,150 people moved in and 2,075 moved out. What is the new population?", ["33,355", "35,430", "37,505", "32,205"], "33,355"),
      teacherNotes: "State clearly that all population figures are example data. Regrouping across zeros (as in 50,000 - 17,364) is the most frequent error; model it step by step.",
      materials: ["Example data cards (made-up towns)", "Exercise books"],
      offline: "Fully offline: data cards are printed or copied onto the board.",
    },
  }),
];
