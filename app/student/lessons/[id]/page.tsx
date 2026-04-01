import LessonDeliveryClient from "./LessonDeliveryClient";

export default function StudentLessonPage({ params }: { params: { id: string } }) {
  return (
    <main className="ll-page min-h-screen px-4 py-8 text-slate-50">
      <div className="ll-shell max-w-5xl">
        <LessonDeliveryClient lessonId={params.id} />
      </div>
    </main>
  );
}
