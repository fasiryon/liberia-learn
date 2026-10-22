import inputs from "@/curriculum/factory-v4/draft5-inputs.json";
import { generateReferenceBatch, type ReferenceProfile } from "../referenceBatch";
import { referenceInputsSchema } from "../generation";
import { authorLesson, LESSON_AUTHOR_VERSION } from "./lessonAuthor";
import { DRAFT5_LESSONS } from "./lessons";

export const DRAFT5_PROFILE: ReferenceProfile = { version: "4.0.0-draft.5", executor: LESSON_AUTHOR_VERSION, inputs: referenceInputsSchema.parse(inputs), author: authorLesson, lessons: DRAFT5_LESSONS };
export const generateDraft5 = () => generateReferenceBatch(DRAFT5_PROFILE);
