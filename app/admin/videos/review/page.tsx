import { redirect } from "next/navigation";

// Admin video moderation is served at /admin/video-moderation
export default function AdminVideosReviewPage() {
  redirect("/admin/video-moderation");
}
