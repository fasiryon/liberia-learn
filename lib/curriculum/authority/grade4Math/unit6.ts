import { draftLesson, mcq, objectiveId, p, U } from "./types";

const unit = U.m6;

export const UNIT6_LESSONS = [
  draftLesson({
    slug: "lines-segments-rays", moeObjectiveId: objectiveId("m6", 1), unitId: unit,
    payload: {
      title: "Lines, Line Segments, Rays, Intersecting and Parallel Lines",
      body: "A point marks an exact place and is named with a capital letter, such as point A.\n\nA line is straight and goes on forever in both directions. It is drawn with an arrow at each end and named by two points on it: line AB.\n\nA line segment is part of a line with two endpoints: segment AB. The edge of a desk is a segment.\n\nA ray has one endpoint and goes on forever in one direction, like a beam of light from a torch. Ray AB starts at A and passes through B.\n\nIntersecting lines cross at one point, like the two roads at a junction.\n\nParallel lines are always the same distance apart and never meet, like the two rails of a railway track or the lines in an exercise book.\n\nLook for these in the classroom: window frames, floor tiles and the corners of the board.",
      objectives: [
        "Identify and draw points, lines, line segments and rays.",
        "Identify intersecting and parallel lines.",
        "Name lines, segments and rays using points.",
      ],
      activities: [
        "Classroom hunt: find and list examples of segments, parallel lines and intersecting lines.",
        "Draw and label: learners draw line AB, segment CD and ray EF using a ruler.",
        "Body shapes: pairs use their arms to show parallel and intersecting lines.",
      ],
      practice: [
        p("How many endpoints does a line segment have?", "2"),
        p("How many endpoints does a ray have?", "1"),
        p("Do parallel lines ever meet?", "No"),
        p("Name a real object that shows parallel lines.", "For example, railway tracks or lines in an exercise book"),
      ],
      homework: [
        p("Draw ray PQ and label it.", "A ray starting at P and passing through Q, with an arrow beyond Q"),
        p("Find two examples of intersecting lines at home.", "Answers vary (for example, window bars or a cross on a door)"),
        p("Which has no endpoints: a line, a segment or a ray?", "A line"),
      ],
      quiz: [
        mcq("Which figure has exactly one endpoint?", ["Ray", "Line", "Line segment", "Point"], "Ray"),
        mcq("Two lines that never meet are called:", ["Parallel", "Intersecting", "Rays", "Segments"], "Parallel"),
        mcq("The edge of a ruler is best described as a:", ["Line segment", "Line", "Ray", "Point"], "Line segment"),
      ],
      diagnosticCheck: mcq("Which is a straight edge?", ["The side of a book", "A circle", "A ball", "A coin's rim"], "The side of a book"),
      assessment: mcq("Two roads cross at a junction. They are:", ["Intersecting lines", "Parallel lines", "Rays", "Points"], "Intersecting lines"),
      teacherNotes: "Learners confuse lines and segments. Stress the arrows: arrows mean the figure goes on forever.",
      materials: ["Rulers", "Exercise books"],
      offline: "Fully offline.",
    },
  }),
  draftLesson({
    slug: "angles-perpendicular-lines", moeObjectiveId: objectiveId("m6", 2), unitId: unit,
    payload: {
      title: "Right Angles, Smaller and Larger Angles, and Perpendicular Lines",
      body: "An angle is made when two rays meet at a common endpoint, called the vertex. The size of an angle is how far one ray turns from the other.\n\nA right angle is a square corner, like the corner of a page. It is often marked with a small square.\n\nFold a piece of paper in half and then in half again to make a right-angle tester. Use it to check angles:\n- An angle smaller than a right angle is acute (the tester covers it).\n- An angle larger than a right angle but smaller than a straight line is obtuse (the angle opens wider than the tester).\n\nPerpendicular lines meet or cross to make right angles, like the edges of a door frame or the cross in a plus sign.\n\nAll perpendicular lines intersect, but not all intersecting lines are perpendicular. Only lines that meet at right angles are perpendicular.",
      objectives: [
        "Identify right angles and angles smaller or larger than a right angle.",
        "Identify perpendicular lines.",
        "Use a folded-paper tester to classify angles.",
      ],
      activities: [
        "Make a right-angle tester by folding paper; test corners in the classroom.",
        "Arm angles: learners show a right angle, a smaller angle and a larger angle with their arms.",
        "Sort drawn angles into smaller than, equal to and larger than a right angle.",
      ],
      practice: [
        p("Is the corner of a book a right angle?", "Yes"),
        p("An angle is wider than the tester. Is it smaller or larger than a right angle?", "Larger (obtuse)"),
        p("What do we call lines that meet at a right angle?", "Perpendicular lines"),
        p("Are the hands of a clock at 3:00 perpendicular?", "Yes, they make a right angle"),
      ],
      homework: [
        p("Find three right angles at home.", "Answers vary (for example, door corners, table corners, window frames)"),
        p("Draw an angle smaller than a right angle.", "Any acute angle"),
        p("Are the hands of a clock at 1:00 making an angle smaller or larger than a right angle?", "Smaller"),
      ],
      quiz: [
        mcq("An angle that is exactly a square corner is a:", ["Right angle", "Straight angle", "Smaller angle", "Larger angle"], "Right angle"),
        mcq("Perpendicular lines meet at:", ["A right angle", "No point", "A smaller angle only", "Two points"], "A right angle"),
        mcq("At 5:00, the clock hands make an angle that is:", ["Larger than a right angle", "A right angle", "Smaller than a right angle", "A straight line"], "Larger than a right angle"),
      ],
      diagnosticCheck: mcq("Which has a square corner?", ["A sheet of paper", "A circle", "An egg", "A ball"], "A sheet of paper"),
      assessment: mcq("Which pair of lines is perpendicular?", ["The two edges at the corner of a door", "Railway tracks", "Lines in an exercise book", "Two lines far apart that never meet"], "The two edges at the corner of a door"),
      teacherNotes: "The protractor tool is enabled only for Grades 7+, and Grade 4 does not measure degrees. The folded-paper tester is the manipulative. Online manipulative is an open gap.",
      materials: ["Paper for testers", "Drawn angle cards"],
      offline: "Fully offline with folded-paper right-angle testers.",
    },
  }),
  draftLesson({
    slug: "polygons", moeObjectiveId: objectiveId("m6", 3), unitId: unit,
    payload: {
      title: "Polygons: Triangles, Quadrilaterals, Pentagons and Hexagons",
      body: "A polygon is a closed flat shape made of straight sides. A circle is not a polygon because it has no straight sides. An open shape is not a polygon.\n\nPolygons are named by their number of sides (and corners, called vertices):\n- Triangle: 3 sides\n- Quadrilateral: 4 sides (squares, rectangles and other four-sided shapes)\n- Pentagon: 5 sides\n- Hexagon: 6 sides\n\nThe number of sides always equals the number of vertices.\n\nSome quadrilaterals have special names. A square has 4 equal sides and 4 right angles. A rectangle has 4 right angles and opposite sides equal.\n\nPolygons are everywhere: triangular roof ends, rectangular doors, and the hexagon patterns on some footballs.",
      objectives: [
        "Identify polygons and non-polygons.",
        "Name triangles, quadrilaterals, pentagons and hexagons by their sides and vertices.",
      ],
      activities: [
        "Stick shapes: make polygons from sticks or straws and count sides and vertices.",
        "Sort cut-out shapes into polygons and non-polygons, then by number of sides.",
        "Shape walk: find polygons in the school building.",
      ],
      practice: [
        p("How many sides does a pentagon have?", "5"),
        p("What is a polygon with 6 sides called?", "A hexagon"),
        p("Is a circle a polygon?", "No, it has no straight sides"),
        p("How many vertices does a quadrilateral have?", "4"),
      ],
      homework: [
        p("Draw a hexagon and count its vertices.", "6 vertices"),
        p("Name a quadrilateral that has 4 equal sides and 4 right angles.", "A square"),
        p("Find a triangle shape at home or in your town.", "Answers vary (for example, a roof end)"),
      ],
      quiz: [
        mcq("Which shape has 3 sides?", ["Triangle", "Square", "Pentagon", "Hexagon"], "Triangle"),
        mcq("Which is NOT a polygon?", ["A circle", "A triangle", "A rectangle", "A hexagon"], "A circle"),
        mcq("A shape has 5 sides and 5 vertices. It is a:", ["Pentagon", "Hexagon", "Quadrilateral", "Triangle"], "Pentagon"),
      ],
      diagnosticCheck: mcq("How many sides does a square have?", ["4", "3", "5", "6"], "4"),
      assessment: mcq("Which shape has 6 straight sides?", ["Hexagon", "Pentagon", "Circle", "Quadrilateral"], "Hexagon"),
      teacherNotes: "Learners may think only regular shapes count (for example, that a long thin triangle is not a triangle). Show many irregular examples.",
      materials: ["Sticks or straws", "Cut-out shapes"],
      offline: "Fully offline.",
    },
  }),
  draftLesson({
    slug: "parts-of-a-circle", moeObjectiveId: objectiveId("m6", 4), unitId: unit,
    payload: {
      title: "Parts of a Circle",
      body: "A circle is a round shape where every point on the edge is the same distance from the centre.\n\nParts of a circle:\n- Centre: the point in the middle.\n- Radius: a segment from the centre to the edge. All radii of a circle are the same length.\n- Diameter: a segment across the circle through the centre. The diameter is twice the radius: if the radius is 4 cm, the diameter is 8 cm.\n- Circumference: the distance around the circle (its perimeter).\n- Chord: any segment joining two points on the edge. The diameter is the longest chord.\n\nTo draw a circle without a compass, tie a string to a pencil, hold the other end still at the centre, and turn the pencil around. The string is the radius.\n\nCircles appear in wheels, the rims of cooking pots and the top of a drum.",
      objectives: [
        "Identify the centre, radius, diameter, chord and circumference of a circle.",
        "Know that the diameter is twice the radius.",
      ],
      activities: [
        "String circles: draw circles outside with a string and chalk; label the centre and radius.",
        "Fold a paper circle in half to find a diameter, and again to find the centre.",
        "Measure radii of a drawn circle to show they are all equal.",
      ],
      practice: [
        p("A circle has a radius of 5 cm. What is its diameter?", "10 cm"),
        p("A circle has a diameter of 12 m. What is its radius?", "6 m"),
        p("What is the distance around a circle called?", "The circumference"),
        p("Does a diameter pass through the centre?", "Yes"),
      ],
      homework: [
        p("A bicycle wheel has a radius of 30 cm. What is its diameter?", "60 cm"),
        p("Draw a circle and label its centre, a radius and a diameter.", "Circle with centre, one radius and one diameter labelled"),
        p("Which is the longest chord in a circle?", "The diameter"),
      ],
      quiz: [
        mcq("A segment from the centre to the edge of a circle is the:", ["Radius", "Diameter", "Circumference", "Chord"], "Radius"),
        mcq("A circle has a diameter of 14 cm. The radius is:", ["7 cm", "28 cm", "14 cm", "3.5 cm"], "7 cm"),
        mcq("The circumference of a circle is:", ["The distance around it", "The line through the centre", "The middle point", "Half the diameter"], "The distance around it"),
      ],
      diagnosticCheck: mcq("Which object is shaped like a circle?", ["The top of a drum", "A door", "A book", "A roof end"], "The top of a drum"),
      assessment: mcq("The radius of a pot's rim is 9 cm. What is its diameter?", ["18 cm", "9 cm", "4.5 cm", "27 cm"], "18 cm"),
      teacherNotes: "Learners mix up radius and diameter. Tie the words to the actions: radius from the centre, diameter all the way across.",
      materials: ["String and chalk", "Paper circles"],
      offline: "Fully offline.",
    },
  }),
  draftLesson({
    slug: "solid-figures", moeObjectiveId: objectiveId("m6", 5), unitId: unit,
    payload: {
      title: "Solid Figures: Spheres, Cylinders, Cones, Cubes and Rectangular Prisms",
      body: "Solid (3D) figures take up space. They have length, width and height.\n\nParts of solids: faces (flat surfaces), edges (where two faces meet) and vertices (corners).\n\n- Sphere: perfectly round, like a ball. No faces, edges or vertices.\n- Cylinder: two circular flat faces joined by a curved surface, like a tin of milk.\n- Cone: one circular flat face and a curved surface that comes to a point, like a funnel.\n- Cube: 6 square faces, 12 edges and 8 vertices, like a die.\n- Rectangular prism: 6 rectangular faces, 12 edges and 8 vertices, like a box of matches or a brick.\n\nPictures of solids hide some faces. Turning a real object around lets you see and count every face, edge and vertex.\n\nGeometry is the foundation of building: bricks are rectangular prisms, water tanks are often cylinders, and roofs of round huts are cones.",
      objectives: [
        "Identify spheres, cylinders, cones, cubes and rectangular prisms.",
        "Count faces, edges and vertices of cubes and rectangular prisms.",
        "Connect solid figures to objects used in building and daily life.",
      ],
      activities: [
        "Object table: learners sort real objects (ball, tin, funnel, die, box, brick) into solid types.",
        "Turn and count: in pairs, turn a box around and tally its faces, edges and vertices.",
        "Feel bag: identify a solid by touch only and explain what gave it away.",
      ],
      practice: [
        p("How many faces does a cube have?", "6"),
        p("Which solid is shaped like a tin of tomato paste?", "Cylinder"),
        p("How many vertices does a rectangular prism have?", "8"),
        p("Which solid has one flat face and one point?", "Cone"),
      ],
      homework: [
        p("Find one object at home for each: sphere, cylinder, cube.", "Answers vary (for example, orange, cup, die)"),
        p("How many edges does a cube have?", "12"),
        p("Which solid has no flat faces?", "Sphere"),
      ],
      quiz: [
        mcq("A football is shaped like a:", ["Sphere", "Cylinder", "Cone", "Cube"], "Sphere"),
        mcq("How many edges does a rectangular prism have?", ["12", "6", "8", "4"], "12"),
        mcq("Which solid has two circular faces?", ["Cylinder", "Cone", "Sphere", "Cube"], "Cylinder"),
      ],
      diagnosticCheck: mcq("Which is a flat shape (not solid)?", ["A square drawn on paper", "A box", "A ball", "A tin"], "A square drawn on paper"),
      assessment: mcq("A brick has 6 rectangular faces. It is a:", ["Rectangular prism", "Cube", "Cylinder", "Cone"], "Rectangular prism"),
      teacherNotes: "This objective is classified THREE_D: rotating solids reveals hidden faces. No 3D engine exists yet, so real objects are the required manipulative. Do not substitute static 3D pictures and call it a lab.",
      materials: ["Ball", "Tin", "Funnel or paper cone", "Die", "Box", "Brick"],
      offline: "Fully offline with real objects; this is the required fallback until a 3D manipulative exists.",
    },
  }),
  draftLesson({
    slug: "read-interpret-graphs", moeObjectiveId: objectiveId("m6", 6), unitId: unit,
    payload: {
      title: "Reading and Interpreting Bar Graphs, Line Graphs and Pie Charts",
      body: "Graphs show data as pictures so we can compare quickly. All data in this lesson is example data.\n\nA bar graph uses bars to compare amounts. Read the title, the labels and the scale. Example: a bar graph of learners' favourite fruits shows mango 12, banana 8, orange 5 and pineapple 9. Mango is the most popular, and 12 - 5 = 7 more learners chose mango than orange.\n\nA line graph shows how something changes over time. Points are joined by lines. Example: the height of a plant each week: 2 cm, 5 cm, 9 cm, 12 cm. The line goes up, showing the plant is growing, fastest between weeks 2 and 3.\n\nA pie chart shows parts of a whole as slices of a circle. A half-circle slice is half of the data, and a quarter slice is a quarter. If a quarter of 40 learners walk to school by the main road, that is 10 learners.\n\nWhen reading any graph, ask: What is it about? What is the scale? What is the largest and smallest? What changed?\n\nThe words mode, median and mean (average) describe data. You will calculate them in the next lesson.",
      objectives: [
        "Read and interpret bar graphs, line graphs and pie charts.",
        "Answer comparison questions from graphs.",
        "Recognise the words mode, median and mean.",
      ],
      activities: [
        "Class survey: collect favourite fruits and build a bar graph on the board.",
        "Line graph: plot the example plant heights and describe the change.",
        "Paper pie: fold a paper circle into halves and quarters to represent survey fractions.",
      ],
      practice: [
        p("In the fruit bar graph (mango 12, banana 8, orange 5, pineapple 9), which fruit is least popular?", "Orange"),
        p("How many learners were surveyed in the fruit graph?", "34"),
        p("In the plant line graph (2, 5, 9, 12 cm), how much did the plant grow from week 1 to week 4?", "10 cm"),
        p("A pie chart shows half of 30 learners like football. How many is that?", "15"),
      ],
      homework: [
        p("How many more learners chose pineapple than banana?", "1"),
        p("In which week-to-week period did the plant grow the least (2, 5, 9, 12 cm)?", "Week 1 to week 2, or week 3 to week 4 (3 cm each)"),
        p("A pie chart shows a quarter of 20 families use solar lamps. How many families?", "5"),
      ],
      quiz: [
        mcq("Which graph best shows change over time?", ["Line graph", "Pie chart", "Bar graph of favourite colours", "A table of names"], "Line graph"),
        mcq("A bar graph shows rice 15 bags, beans 9 bags. How many more bags of rice?", ["6", "24", "15", "9"], "6"),
        mcq("A pie chart slice is half the circle. What fraction of the data is it?", ["1/2", "1/4", "1/3", "2/3"], "1/2"),
      ],
      diagnosticCheck: mcq("Which is more: 12 or 8?", ["12", "8", "They are equal", "Cannot tell"], "12"),
      assessment: mcq("A bar graph shows books read: Musa 6, Esther 9, Jallah 4. Who read the most?", ["Esther", "Musa", "Jallah", "They read the same"], "Esther"),
      teacherNotes: "State that graph data is example data. Learners often misread scales that count by 2s or 5s; practise reading bars that fall between gridlines.",
      materials: ["Squared paper", "Paper circles"],
      offline: "Fully offline.",
    },
  }),
  draftLesson({
    slug: "mode-median-mean", moeObjectiveId: objectiveId("m6", 7), unitId: unit,
    payload: {
      title: "Finding the Mode, Median and Mean",
      body: "Mode, median and mean each describe a typical value in a set of data. This lesson uses example data about family sizes in a made-up village; it is not real census data.\n\nFamily sizes in 7 homes: 4, 6, 5, 4, 8, 4, 5.\n\nMode: the value that appears most often. 4 appears three times, so the mode is 4.\n\nMedian: the middle value when the data is in order. Order: 4, 4, 4, 5, 5, 6, 8. The middle (4th) value is 5, so the median is 5. With an even number of values, the median is halfway between the two middle values.\n\nMean (average): add all values and divide by how many there are. For a second example village with 6 homes of sizes 4, 6, 5, 4, 8, 3: the sum is 30, and 30 / 6 = 5. The mean is 5.\n\nThe mean shares the total equally: if 30 people were spread evenly over 6 homes, each home would have 5.\n\nEach measure tells something different. The mode shows the most common size; the median is not pulled by one very large value; the mean uses every value.",
      objectives: [
        "Find the mode of a data set.",
        "Find the median by ordering data.",
        "Find the mean by adding and dividing.",
      ],
      activities: [
        "Class data: record the number of people in each learner's household (voluntary, no names) and find the mode and median.",
        "Levelling towers: build towers of cubes for a data set and move cubes until all towers are equal; the height is the mean.",
        "Compare: find all three measures for the same data and discuss which describes it best.",
      ],
      practice: [
        p("Find the mode: 3, 7, 5, 7, 2, 7, 5", "7"),
        p("Find the median: 9, 3, 6, 2, 8", "6"),
        p("Find the mean: 4, 8, 6, 2", "5"),
        p("Find the median: 2, 4, 6, 10", "5"),
      ],
      homework: [
        p("Find the mode and median: 12, 15, 12, 18, 20", "Mode 12, median 15"),
        p("Find the mean: 10, 20, 30, 40, 50", "30"),
        p("Rainfall in 4 days was 6 mm, 10 mm, 4 mm and 8 mm (example data). What was the mean daily rainfall?", "7 mm"),
      ],
      quiz: [
        mcq("What is the mode of 2, 3, 3, 5, 3, 6?", ["3", "5", "2", "6"], "3"),
        mcq("What is the median of 7, 1, 5, 3, 9?", ["5", "3", "7", "9"], "5"),
        mcq("What is the mean of 6, 9, 3?", ["6", "9", "18", "3"], "6"),
      ],
      diagnosticCheck: mcq("Put in order from least to greatest: 5, 2, 8", ["2, 5, 8", "8, 5, 2", "5, 2, 8", "2, 8, 5"], "2, 5, 8"),
      assessment: mcq("Example population data: the number of births in a clinic over 5 months was 12, 15, 9, 15, 14. What is the mean?", ["13", "15", "14", "65"], "13"),
      teacherNotes: "Collect household data only voluntarily and without names. Learners often forget to order data before finding the median. Keep mean problems to whole-number answers at this grade.",
      materials: ["Linking cubes or stacked bottle caps", "Exercise books"],
      offline: "Fully offline.",
    },
  }),
  draftLesson({
    slug: "word-problems-with-diagrams", moeObjectiveId: objectiveId("m6", 8), unitId: unit,
    payload: {
      title: "Solving Word Problems by Drawing Diagrams",
      body: "A diagram turns words into a picture that shows how the numbers are related. Useful diagrams include bar models, number lines, arrays, tables and sketches of shapes.\n\nExample 1 (bar model): Saah has 3 times as many mangoes as Korto. Together they have 48. How many does Korto have? Draw 1 bar for Korto and 3 equal bars for Saah: 4 equal bars make 48, so 1 bar = 48 / 4 = 12. Korto has 12, and Saah has 36.\n\nExample 2 (sketch): a rectangular garden is 10 m long and 6 m wide. Posts are placed at every corner and every 2 m along the sides. How many posts? Sketch it and count: the perimeter is 32 m, and with a post every 2 m around a closed shape there are 32 / 2 = 16 posts.\n\nExample 3 (number line): a snail climbs 3 m each day and slips back 1 m each night. How many days to reach the top of a 7 m wall? Draw the jumps: after day 1 night it is at 2 m, after day 2 night 4 m, and on day 3 it climbs from 4 m to 7 m. It reaches the top on day 3.\n\nSteps: read, draw, label with the numbers you know, mark the unknown, solve, check against the drawing.",
      objectives: [
        "Draw bar models, number lines and sketches to represent word problems.",
        "Use the diagram to solve and check the answer.",
      ],
      activities: [
        "Bar model practice: groups draw bar models for 'times as many' problems.",
        "Fence posts: model the garden problem with sticks and string outdoors.",
        "Gallery walk: groups display diagrams for the same problem and compare approaches.",
      ],
      practice: [
        p("Fatu has twice as many pencils as Momo. Together they have 36. How many does Fatu have?", "24"),
        p("A rope 20 m long is cut into pieces 4 m long. How many cuts are needed?", "4 cuts (5 pieces)"),
        p("A square field has sides of 12 m. A post is placed every 3 m around it, including the corners. How many posts?", "16"),
        p("Trees are planted in a straight row 5 m apart. The row is 25 m long with a tree at each end. How many trees?", "6"),
      ],
      homework: [
        p("A bag of rice and a bag of beans weigh 30 kg together. The rice weighs 4 times the beans. How much do the beans weigh?", "6 kg"),
        p("A frog is at the bottom of a 10 m well. It climbs 4 m each day and slips back 2 m each night. On which day does it get out?", "Day 4"),
        p("Draw a diagram for: a class of 30 has 6 more girls than boys. How many boys are there?", "12 boys (and 18 girls)"),
      ],
      quiz: [
        mcq("Ansu has 3 times as many marbles as Yah. Together they have 40. How many does Yah have?", ["10", "30", "13", "20"], "10"),
        mcq("A 12 m fence has posts every 3 m in a straight line, with posts at both ends. How many posts?", ["5", "4", "6", "3"], "5"),
        mcq("Which diagram best shows 'twice as many'?", ["A bar model with 1 bar and 2 equal bars", "A pie chart", "A clock", "A number line from 0 to 1"], "A bar model with 1 bar and 2 equal bars"),
      ],
      diagnosticCheck: mcq("What is 48 / 4?", ["12", "14", "11", "16"], "12"),
      assessment: mcq("A path 30 m long has a lamp every 5 m, with a lamp at each end. How many lamps?", ["7", "6", "5", "8"], "7"),
      teacherNotes: "Fence-post problems (counting posts versus gaps) are a known difficulty. Insist on drawing and counting before calculating.",
      materials: ["Sticks and string", "Exercise books"],
      offline: "Fully offline.",
    },
  }),
];
