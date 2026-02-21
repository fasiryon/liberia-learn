// lib/localization/liberia-context.ts
// Replaces foreign cultural references with Liberian equivalents in AI-generated content.

const NAME_MAP: [RegExp, string][] = [
  [/\bJohn\b/g, "Tamba"],
  [/\bJane\b/g, "Musu"],
  [/\bMary\b/g, "Fatu"],
  [/\bBob\b/g, "Kollie"],
  [/\bAlice\b/g, "Tenneh"],
  [/\bTom\b/g, "Varney"],
  [/\bSarah\b/g, "Hawa"],
  [/\bDavid\b/g, "Flomo"],
  [/\bEmma\b/g, "Kumba"],
  [/\bJames\b/g, "Kpannah"],
  [/\bMike\b/g, "Sumo"],
  [/\bLisa\b/g, "Garmai"],
  [/\bSam\b/g, "Pewee"],
  [/\bKatie\b/g, "Yeamai"],
];

const CURRENCY_MAP: [RegExp, string][] = [
  [/\$(\d[\d,.]*)/g, "$1 LD"],
  [/(\d[\d,.]*)\s*(?:dollars?|USD)/gi, "$1 Liberian dollars"],
  [/\bcents?\b/gi, "Liberian cents"],
];

const PLACE_MAP: [RegExp, string][] = [
  [/\bNew York\b/gi, "Monrovia"],
  [/\bLos Angeles\b/gi, "Buchanan"],
  [/\bChicago\b/gi, "Gbarnga"],
  [/\bHouston\b/gi, "Kakata"],
  [/\bPhiladelphia\b/gi, "Voinjama"],
  [/\bSan Francisco\b/gi, "Harper"],
  [/\bBoston\b/gi, "Zwedru"],
  [/\bSeattle\b/gi, "Robertsport"],
  [/\bDenver\b/gi, "Sanniquellie"],
  [/\bAtlanta\b/gi, "Greenville"],
  [/\bthe park\b/gi, "the field"],
  [/\bthe mall\b/gi, "the market"],
  [/\bsupermarket\b/gi, "market"],
  [/\bgrocery store\b/gi, "market"],
];

const FOOD_MAP: [RegExp, string][] = [
  [/\bpizza\b/gi, "jollof rice"],
  [/\bhamburger\b/gi, "palm butter and rice"],
  [/\bhotdog\b/gi, "fried plantain"],
  [/\bsandwich(?:es)?\b/gi, "cassava leaf"],
  [/\bpasta\b/gi, "fufu"],
  [/\bcookie\b/gi, "chin-chin"],
  [/\bcookies\b/gi, "chin-chin"],
  [/\bcake\b/gi, "rice bread"],
  [/\bice cream\b/gi, "coconut candy"],
  [/\bcandy\b/gi, "sugarcane"],
  [/\bchocolate\b/gi, "cocoa"],
  [/\bcheese\b/gi, "palm oil"],
  [/\bpeanut butter\b/gi, "groundnut paste"],
  [/\bapple(?:s)?\b/gi, "mango"],
  [/\borange(?:s)?\b/gi, "orange"],
  [/\bstrawberr(?:y|ies)\b/gi, "papaya"],
  [/\bblueberr(?:y|ies)\b/gi, "pineapple"],
];

const ANIMAL_MAP: [RegExp, string][] = [
  [/\bsquirrel\b/gi, "bush squirrel"],
  [/\bdeer\b/gi, "bush deer"],
  [/\braccoon\b/gi, "ground hog"],
  [/\bbear\b/gi, "chimpanzee"],
  [/\bmoose\b/gi, "pygmy hippo"],
  [/\belk\b/gi, "forest elephant"],
  [/\bbison\b/gi, "bush cow"],
];

const UNIT_MAP: [RegExp, string][] = [
  [/\bmile(?:s)?\b/gi, "kilometer"],
  [/\bfoot\b/gi, "meter"],
  [/\bfeet\b/gi, "meters"],
  [/\binch(?:es)?\b/gi, "centimeter"],
  [/\byard(?:s)?\b/gi, "meter"],
  [/\bpound(?:s)?\b/gi, "kilogram"],
  [/\bounce(?:s)?\b/gi, "gram"],
  [/\bFahrenheit\b/gi, "Celsius"],
  [/\bgallon(?:s)?\b/gi, "liter"],
];

/**
 * Replaces Western/American cultural references with Liberian equivalents.
 * Safe to run on any text â€” idempotent for already-Liberian content.
 */
export function liberianize(text: string): string {
  let result = text;

  for (const [pattern, replacement] of NAME_MAP) result = result.replace(pattern, replacement);
  for (const [pattern, replacement] of CURRENCY_MAP) result = result.replace(pattern, replacement);
  for (const [pattern, replacement] of PLACE_MAP) result = result.replace(pattern, replacement);
  for (const [pattern, replacement] of FOOD_MAP) result = result.replace(pattern, replacement);
  for (const [pattern, replacement] of ANIMAL_MAP) result = result.replace(pattern, replacement);
  for (const [pattern, replacement] of UNIT_MAP) result = result.replace(pattern, replacement);

  return result;
}

