import LessonDeliveryClient from "./LessonDeliveryClient";

export default function StudentLessonPage({ params }: { params: { id: string } }) {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
      <div className="mx-auto max-w-5xl">
        <LessonDeliveryClient lessonId={params.id} />
      </div>
    </main>
  );
}
