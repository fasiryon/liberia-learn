/**
 * DEMO teaching lessons for the Student Experience V3 design preview. Synthetic content written to show the
 * visual blocks across Mathematics, Science, English and Social Studies. Every lesson here is
 * PROTOTYPE_FIXTURE: it is not curriculum, has no release, is never delivered by the lesson delivery seam and
 * is reachable only on the dev-only /design-preview routes. Facts must be checked by a curriculum reviewer
 * before any of this could be adapted into reviewed content.
 */
import { TEACHING_LESSON_CONTRACT_VERSION, type TeachingLesson } from "./contract";

const DEMO_AUTHORITY = { status: "PROTOTYPE_FIXTURE", releaseId: null, note: "Synthetic design-preview content. Not curriculum; not released." } as const;

export const GRADE7_PLACE_VALUE: TeachingLesson = {
  contractVersion: TEACHING_LESSON_CONTRACT_VERSION,
  id: "demo-g7-place-value",
  version: "demo-2",
  title: "Place value: reading large numbers",
  subject: "MATHEMATICS",
  topic: "Number sense",
  grade: 7,
  ageBand: "JUNIOR_SECONDARY",
  authority: DEMO_AUTHORITY,
  objectives: [
    { id: "read", statement: "Read and write whole numbers up to the millions." },
    { id: "value", statement: "Explain the value of each digit from its place." },
    { id: "forms", statement: "Write a number in expanded form and in words." },
  ],
  scenes: [
    {
      id: "intro", kind: "INTRODUCTION", title: "Big numbers are all around us", objectiveIds: ["read"],
      lead: "A school raising money for books, the people living in a county, the cost of a new road: these are **large numbers**. Today you will read numbers up to the millions and explain what each digit is worth.",
      points: ["Read and write whole numbers up to the millions.", "Explain the value of each digit from its place.", "Write a number in expanded form and in words."],
      blocks: [],
      visual: { type: "GROUPED_NUMBER", value: 2_350_480, caption: "Commas split a large number into groups of three digits. Read each group, then say its name." },
      textAlternative: "Big numbers are all around us: money raised by a school, the population of a county, the cost of a road. In this lesson you will read numbers up to the millions and explain what each digit is worth. 2,350,480 has three groups: 2 millions, 350 thousands and 480 ones.",
    },
    {
      id: "explain", kind: "LEARN", title: "Every place is worth ten times more", objectiveIds: ["value"],
      lead: "The **place** of a digit is its position. Its **value** is what it is worth in that place. Each move one place to the left multiplies the value by 10.",
      points: ["Group digits in threes from the right: ones, thousands, millions.", "Read each group, then say its group name.", "A zero holds a place that is empty."],
      blocks: [
        { type: "TEN_TIMES", digit: 3, caption: "The same digit 3, moved one place left at a time." },
        { type: "CALLOUT", tone: "MISTAKE", title: "Common mistake", text: "Reading the digits one by one (“two, three, five…”) hides their values. Say the group names: “two **million**, three hundred fifty **thousand**, four hundred eighty”." },
      ],
      visual: { type: "PLACE_VALUE_CHART", value: 4_205_316, highlight: "millions", caption: "4,205,316: the 4 is in the millions place, so it is worth 4,000,000. The 0 holds the ten-thousands place." },
      hint: "Find the comma groups first. The digit before the first comma (from the left) is in the millions group.",
      textAlternative: "Every place is worth ten times the place to its right. Group digits in threes from the right: ones, thousands, millions. In 4,205,316 the 4 is in the millions place, so it is worth 4 million; the zero holds the ten-thousands place. A digit 3 is worth 3 in the ones place, 30 in the tens place, 300 in the hundreds place, and so on up to 3,000,000 in the millions place.",
    },
    {
      id: "build", kind: "EXPLORE", title: "Build a number", objectiveIds: ["forms"],
      lead: "Change any digit with + and −. Watch the chart, the expanded form and the words change with it.",
      blocks: [{ type: "NUMBER_BUILDER", start: 2_350_480, presets: [2_350_480, 4_205_316, 1_742_009], task: "Make 5,040,009. Which places hold zeros?" }],
      hint: "Start from the left. 5,040,009 has 5 millions, 4 ten-thousands and 9 ones; every other place is 0.",
      textAlternative: "Build a number one place at a time with plus and minus buttons for each place, from millions to ones. The expanded form and the number in words update as you change each digit.",
    },
    {
      id: "example", kind: "WORKED_EXAMPLE", title: "Musu's library fund", objectiveIds: ["value"],
      lead: "Musu's school collected **L$2,350,480** for a new library. What is the value of the digit 3?",
      blocks: [{ type: "STEP_REVEAL", id: "musu-steps", question: "What is the value of the 3 in 2,350,480?", chartValue: 2_350_480, steps: [
        { text: "Split the number into groups: 2 | 350 | 480. The 3 is the first digit of the thousands group." },
        { text: "The first digit of the thousands group is in the hundred-thousands place.", highlight: "hundred-thousands" },
        { text: "Value = digit × place: 3 × 100,000 = **300,000**. The 3 is worth three hundred thousand Liberian dollars.", highlight: "hundred-thousands" },
      ] }],
      textAlternative: "Worked example. Musu's school collected 2,350,480 Liberian dollars. To find the value of the 3, split the number into groups 2, 350 and 480. The 3 is the first digit of the thousands group, which is the hundred-thousands place. Its value is 3 times 100,000, which is 300,000.",
    },
    {
      id: "digits", kind: "GUIDED_PRACTICE", title: "Place the digit cards", objectiveIds: ["read", "value"],
      lead: "Make the number **five million, forty thousand, nine**. Choose a card, then choose the place it belongs in.",
      blocks: [{ type: "DIGIT_CARDS", id: "cards-5040009", target: 5_040_009, prompt: "Make five million, forty thousand, nine." }],
      hint: "Write the group names first: millions | thousands | ones. Five million → 5 | ___ | ___. Forty thousand → ___ | 040 | ___. Nine → ___ | ___ | 009.",
      textAlternative: "Guided practice: place seven digit cards into the millions, hundred-thousands, ten-thousands, thousands, hundreds, tens and ones places to make five million, forty thousand, nine, which is 5,040,009.",
    },
    {
      id: "practice", kind: "PRACTICE", title: "Your turn", objectiveIds: ["value", "forms"],
      lead: "Answer each question. You will see why each answer is right, or what to look at again.",
      blocks: [{ type: "CHOICE_CHECK", id: "pv-check", items: [
        { id: "q1", prompt: "What is the value of the 7 in 1,742,009?", options: ["7,000", "700,000", "70,000"], correctIndex: 1,
          feedback: { correct: "Correct.", incorrect: "Not yet." },
          optionFeedback: [
            "7,000 would need the 7 in the thousands place. Count the places from the right: ones, tens, hundreds, thousands, ten thousands, hundred thousands.",
            "The 7 is in the hundred-thousands place, so it is worth 7 × 100,000 = 700,000.",
            "70,000 is one place too far right. The 7 sits right next to the millions digit.",
          ],
          hint: "Split 1,742,009 into groups: 1 | 742 | 009. Where in its group is the 7?" },
        { id: "q2", prompt: "Which is 3,060,500 in expanded form?", options: ["3,000,000 + 60,000 + 500", "3,000,000 + 600,000 + 50", "300,000 + 60,000 + 500"], correctIndex: 0,
          feedback: { correct: "Correct.", incorrect: "Not yet." },
          optionFeedback: [
            "3 millions, 6 ten-thousands and 5 hundreds. Zeros hold the empty places and are not written in expanded form.",
            "Check where the 6 is: it is in the ten-thousands place, not the hundred-thousands place.",
            "The first digit is in the millions place, so it is worth 3,000,000, not 300,000.",
          ] },
        { id: "q3", prompt: "Which number is “five million, forty thousand, nine”?", options: ["5,409", "5,400,009", "5,040,009"], correctIndex: 2,
          feedback: { correct: "Correct.", incorrect: "Not yet." },
          optionFeedback: [
            "Each group name (million, thousand) needs its own group of three digits.",
            "“Forty thousand” is 40,000, not 400,000. Check the thousands group: it should read 040.",
            "Five million → 5,000,000; forty thousand → 40,000; nine → 9. Together: 5,040,009.",
          ] },
      ] }],
      textAlternative: "Practice: three questions about the value of digits, expanded form and writing a number from words. Each answer shows feedback on this device.",
    },
    {
      id: "review", kind: "REVIEW", title: "Key ideas", objectiveIds: ["read", "value", "forms"],
      lead: "Three ideas to remember from this lesson.",
      points: ["The value of a digit depends on its place.", "Each place is worth ten times the place to its right.", "Group digits in threes to read large numbers: millions, thousands, ones."],
      blocks: [{ type: "CALLOUT", tone: "TIP", title: "Check yourself", text: "Say a number from your day aloud with its group names, for example the price of a bag of rice or the number of people in your town." }],
      visual: { type: "PLACE_VALUE_CHART", value: 5_040_009, caption: "5,040,009: zeros hold the empty places." },
      textAlternative: "Key ideas: the value of a digit depends on its place; each place is worth ten times the place to its right; group digits in threes to read large numbers.",
    },
  ],
};

export const GRADE5_WATER_CYCLE: TeachingLesson = {
  contractVersion: TEACHING_LESSON_CONTRACT_VERSION,
  id: "demo-g5-water-cycle", version: "demo-1", title: "The water cycle", subject: "SCIENCE", topic: "Earth and weather",
  grade: 5, ageBand: "UPPER_PRIMARY", authority: DEMO_AUTHORITY,
  objectives: [{ id: "stages", statement: "Name and describe the four stages of the water cycle." }, { id: "explain", statement: "Explain where rain comes from." }],
  scenes: [
    { id: "intro", kind: "INTRODUCTION", title: "Where does rain come from?", objectiveIds: ["explain"], blocks: [],
      lead: "In the rainy season, rain falls almost every day. That water is not new: the same water moves again and again between the land, the sea and the sky. This journey is called the **water cycle**.",
      points: ["Water changes between liquid and gas (water vapour).", "The sun's heat drives the cycle.", "The same water is used again and again."],
      textAlternative: "Rain is not new water. The same water moves again and again between land, sea and sky. This is the water cycle, and the sun's heat drives it." },
    { id: "cycle", kind: "EXPLORE", title: "Follow a drop of water", objectiveIds: ["stages"],
      lead: "Choose each stage to see what happens to the water. Go round the cycle in order.",
      blocks: [],
      visual: { type: "PROCESS_CYCLE", id: "water-cycle", title: "The water cycle", stages: [
        { id: "evaporation", label: "Evaporation", detail: "The sun heats water in the ocean, rivers and puddles. Some of it turns into an invisible gas called water vapour and rises into the air." },
        { id: "condensation", label: "Condensation", detail: "High in the sky the air is cooler. The water vapour cools and turns back into tiny drops of liquid water. Millions of these drops make a cloud." },
        { id: "precipitation", label: "Precipitation", detail: "The tiny drops join together and become heavy. When they are too heavy to float, they fall as rain." },
        { id: "collection", label: "Collection", detail: "Rain collects in rivers, lakes, the ocean and under the ground. Then the sun heats it and the cycle starts again." },
      ] },
      hint: "Start with the sun heating the ocean. What happens to the water next?",
      textAlternative: "The water cycle has four stages. Evaporation: the sun heats water and it rises as water vapour. Condensation: the vapour cools high in the sky and forms tiny drops that make clouds. Precipitation: the drops join and fall as rain. Collection: rain collects in rivers, lakes, the ocean and the ground, and the cycle starts again." },
    { id: "check", kind: "PRACTICE", title: "Check your understanding", objectiveIds: ["stages", "explain"], lead: "Answer each question.",
      blocks: [{ type: "CHOICE_CHECK", id: "water-check", items: [
        { id: "w1", prompt: "What makes water evaporate from the ocean?", options: ["The heat of the sun", "The wind blowing clouds", "Fish swimming in the water"], correctIndex: 0, feedback: { correct: "Correct.", incorrect: "Not yet." },
          optionFeedback: ["Yes. The sun's heat turns liquid water into water vapour, which rises.", "Wind moves clouds, but clouds are already water drops. Evaporation needs heat.", "Animals do not make water rise into the air. Think about what heats the ocean."] },
        { id: "w2", prompt: "Clouds are made of…", options: ["smoke", "tiny drops of water", "water vapour you cannot see"], correctIndex: 1, feedback: { correct: "Correct.", incorrect: "Not yet." },
          optionFeedback: ["Smoke comes from burning. Clouds form from water.", "Yes. Water vapour cools and condenses into tiny drops; many drops make a cloud.", "Water vapour is invisible. We can see a cloud because the vapour has already condensed into drops."] },
      ] }],
      textAlternative: "Two questions about evaporation and clouds, with feedback for each answer." },
    { id: "review", kind: "REVIEW", title: "Key ideas", objectiveIds: ["stages"], lead: "Remember the four stages in order.", blocks: [],
      points: ["Evaporation: the sun turns water into vapour.", "Condensation: vapour cools into drops that form clouds.", "Precipitation: heavy drops fall as rain.", "Collection: water gathers and the cycle repeats."],
      textAlternative: "Evaporation, condensation, precipitation and collection, then the cycle repeats." },
  ],
};

export const GRADE4_PARTS_OF_SPEECH: TeachingLesson = {
  contractVersion: TEACHING_LESSON_CONTRACT_VERSION,
  id: "demo-g4-parts-of-speech", version: "demo-1", title: "Nouns, verbs and adjectives", subject: "ENGLISH", topic: "Grammar",
  grade: 4, ageBand: "UPPER_PRIMARY", authority: DEMO_AUTHORITY,
  objectives: [{ id: "identify", statement: "Identify nouns, verbs and adjectives in a sentence." }],
  scenes: [
    { id: "intro", kind: "LEARN", title: "Words have jobs", objectiveIds: ["identify"], lead: "Every word in a sentence does a job. Today you will sort words by their job.",
      points: ["A **noun** names a person, place or thing: *farmer*, *market*, *rice*.", "A **verb** tells an action: *plants*, *runs*, *sings*.", "An **adjective** describes a noun: *tall*, *green*, *happy*."],
      blocks: [{ type: "CALLOUT", tone: "TIP", title: "Try this test", text: "Put “the” in front of a word. If it makes sense (*the farmer*), the word is probably a noun." }],
      textAlternative: "A noun names a person, place or thing. A verb tells an action. An adjective describes a noun." },
    { id: "sort", kind: "PRACTICE", title: "Sort the words", objectiveIds: ["identify"], lead: "The tall farmer plants rice in the green field. Choose a word, then choose its group.",
      blocks: [{ type: "SORT", id: "speech-sort", prompt: "The tall farmer plants rice in the green field.", groups: [{ id: "noun", label: "Noun" }, { id: "verb", label: "Verb" }, { id: "adjective", label: "Adjective" }], cards: [
        { id: "farmer", text: "farmer", group: "noun", why: "A farmer is a person, so “farmer” is a noun." },
        { id: "plants", text: "plants", group: "verb", why: "“Plants” tells what the farmer does here, so it is a verb." },
        { id: "tall", text: "tall", group: "adjective", why: "“Tall” describes the farmer, so it is an adjective." },
        { id: "rice", text: "rice", group: "noun", why: "Rice is a thing, so “rice” is a noun." },
        { id: "green", text: "green", group: "adjective", why: "“Green” describes the field, so it is an adjective." },
        { id: "field", text: "field", group: "noun", why: "A field is a place, so “field” is a noun." },
      ] }],
      hint: "Ask: is it a person, place or thing? Is it an action? Does it describe something?",
      textAlternative: "Sort six words from the sentence 'The tall farmer plants rice in the green field' into nouns (farmer, rice, field), verbs (plants) and adjectives (tall, green)." },
    { id: "review", kind: "REVIEW", title: "Key ideas", objectiveIds: ["identify"], lead: "A word's job decides its group.", blocks: [],
      points: ["Nouns name.", "Verbs act.", "Adjectives describe."], textAlternative: "Nouns name, verbs act, adjectives describe." },
  ],
};

export const GRADE6_LIBERIA_TIMELINE: TeachingLesson = {
  contractVersion: TEACHING_LESSON_CONTRACT_VERSION,
  id: "demo-g6-liberia-timeline", version: "demo-1", title: "Reading a timeline", subject: "SOCIAL_STUDIES", topic: "History skills",
  grade: 6, ageBand: "UPPER_PRIMARY", authority: DEMO_AUTHORITY,
  objectives: [{ id: "order", statement: "Put events in time order and read them on a timeline." }],
  scenes: [
    { id: "intro", kind: "LEARN", title: "Events happen in order", objectiveIds: ["order"], lead: "A **timeline** shows events in the order they happened, from earliest to latest. Years help us put them in order.",
      points: ["Earlier years go first (on the left or the top).", "The space between events shows how much time passed.", "Read the year, then the event."],
      blocks: [], textAlternative: "A timeline shows events in time order, earliest first. Read the year, then the event." },
    { id: "order", kind: "PRACTICE", title: "Put the events in order", objectiveIds: ["order"], lead: "Move each event up or down until they are in time order, earliest first. Then check.",
      blocks: [{ type: "SEQUENCE", id: "liberia-order", prompt: "Order these events from earliest to latest.", events: [
        { id: "1822", label: "Settlers arrive at Providence Island", marker: "1822", detail: "Free Black settlers from the United States land at Providence Island, near present-day Monrovia." },
        { id: "1847", label: "Liberia declares independence", marker: "1847", detail: "On 26 July 1847 Liberia declares itself an independent republic." },
        { id: "1945", label: "Liberia helps found the United Nations", marker: "1945", detail: "Liberia is one of the countries that sign the United Nations Charter in 1945." },
        { id: "2006", label: "Africa's first elected woman president", marker: "2006", detail: "Ellen Johnson Sirleaf becomes President of Liberia, the first elected woman head of state in Africa." },
      ] }],
      hint: "Look at the years. The smallest year happened first.",
      textAlternative: "Order four events: settlers arrive at Providence Island in 1822; Liberia declares independence in 1847; Liberia helps found the United Nations in 1945; Ellen Johnson Sirleaf becomes the first elected woman president in Africa in 2006." },
    { id: "review", kind: "REVIEW", title: "Key ideas", objectiveIds: ["order"], lead: "Timelines turn dates into a picture of time.", blocks: [],
      points: ["Earliest first.", "Read the year, then the event.", "Gaps show how much time passed."], textAlternative: "Timelines show events earliest first; gaps show how much time passed." },
  ],
};

/** Every demo lesson by preview slug. The Grade 7 lesson keeps its P0 address. */
export const DEMO_TEACHING_LESSONS: Readonly<Record<string, TeachingLesson>> = {
  "grade-7-place-value": GRADE7_PLACE_VALUE,
  "grade-5-water-cycle": GRADE5_WATER_CYCLE,
  "grade-4-parts-of-speech": GRADE4_PARTS_OF_SPEECH,
  "grade-6-liberia-timeline": GRADE6_LIBERIA_TIMELINE,
};
