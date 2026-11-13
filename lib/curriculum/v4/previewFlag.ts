/** Edge-safe feature boundary; deliberately imports no package loader or database. */
export const isLearningPreviewEnabled=(env:Record<string,string|undefined>=process.env)=>env.V4_LEARNING_PREVIEW_ENABLED==="1";
