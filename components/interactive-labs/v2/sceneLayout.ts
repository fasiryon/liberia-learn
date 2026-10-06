// A17 shell geometry shared by every renderer. Portrait and desktop keep the clamped stage; a phone held in
// landscape puts the scene on the left at nearly the full height, beside a 40% controls sheet on the right.

/** A phone in landscape: wide but short. */
export const PHONE_LANDSCAPE_QUERY = "(orientation: landscape) and (max-height: 500px)";

/** The scene stage height on every profile (HIGH, STANDARD, LOW, FALLBACK_2D and the loading placeholders). */
export const SCENE_HEIGHT = "h-[clamp(420px,62vh,640px)] [@media(orientation:landscape)_and_(max-height:500px)]:h-[calc(100dvh-4.5rem)]";
