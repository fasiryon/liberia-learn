require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

console.log("DATABASE_URL length:", (process.env.DATABASE_URL || "").length);
console.log("DIRECT_URL length:", (process.env.DIRECT_URL || "").length);
console.log("NODE_ENV:", process.env.NODE_ENV);
