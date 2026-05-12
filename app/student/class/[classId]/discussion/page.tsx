"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Thread = {
  id: string;
  title: string;
  authorId: string;
  authorRole: string;
  pinned: boolean;
  locked: boolean;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string | null };
  _count: { posts: number };
};

type Post = {
  id: string;
  body: string;
  authorId: string;
  authorRole: string;
  upvotes: number;
  flagged: boolean;
  pending: boolean;
  createdAt: string;
  author: { id: string; name: string | null };
  replies: Post[];
  upvoters: { id: string }[];
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function roleBadge(role: string) {
  if (role === "TEACHER")
    return (
      <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] text-sky-300 border border-sky-400/30">
        Teacher
      </span>
    );
  if (role === "ADMIN")
    return (
      <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] text-purple-300 border border-purple-400/30">
        Admin
      </span>
    );
  return (
    <span className="rounded-full bg-[var(--ll-surface-muted)] px-2 py-0.5 text-[10px] text-[var(--ll-text-muted)]">
      Student
    </span>
  );
}

export default function StudentClassDiscussionPage() {
  const params = useParams();
  const classId = params.classId as string;
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedThreadId, setExpandedThreadId] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [showNewThread, setShowNewThread] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");

  const loadThreads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/discussion/threads?classId=${classId}`);
      if (res.ok) setThreads(await res.json());
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const openThread = async (threadId: string) => {
    if (expandedThreadId === threadId) {
      setExpandedThreadId(null);
      return;
    }
    setExpandedThreadId(threadId);
    setPostsLoading(true);
    try {
      const res = await fetch(`/api/discussion/threads/${threadId}/posts`);
      if (res.ok) setPosts(await res.json());
    } finally {
      setPostsLoading(false);
    }
  };

  const handleNewThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newBody.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/discussion/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, title: newTitle, body: newBody }),
      });
      if (res.ok) {
        setNewTitle("");
        setNewBody("");
        setShowNewThread(false);
        await loadThreads();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (threadId: string, parentPostId?: string) => {
    if (!replyBody.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/discussion/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, body: replyBody, parentPostId }),
      });
      if (res.ok) {
        setReplyBody("");
        setReplyingTo(null);
        const postsRes = await fetch(`/api/discussion/threads/${threadId}/posts`);
        if (postsRes.ok) setPosts(await postsRes.json());
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpvote = async (postId: string) => {
    await fetch(`/api/discussion/posts/${postId}/upvote`, { method: "PATCH" });
    if (expandedThreadId) {
      const res = await fetch(`/api/discussion/threads/${expandedThreadId}/posts`);
      if (res.ok) setPosts(await res.json());
    }
  };

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 ll-page-enter">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/student/discussion" className="text-sm text-[var(--ll-yellow)]">
          &larr; All Discussions
        </Link>

        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-[var(--ll-text)]">Class Discussion</h1>
          <button
            type="button"
            onClick={() => setShowNewThread(!showNewThread)}
            className="rounded-xl bg-[var(--ll-yellow)] px-4 py-2 text-sm font-semibold text-[var(--ll-bg)]"
          >
            Ask a Question
          </button>
        </div>

        {showNewThread && (
          <form
            onSubmit={handleNewThread}
            className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-5 space-y-3"
          >
            <input
              type="text"
              placeholder="Title (required)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm text-[var(--ll-text)]"
              required
            />
            <textarea
              placeholder="Your question or message..."
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm text-[var(--ll-text)]"
              required
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-[var(--ll-yellow)] px-4 py-2 text-sm font-semibold text-[var(--ll-bg)] disabled:opacity-50"
              >
                {submitting ? "Posting..." : "Post Question"}
              </button>
              <button
                type="button"
                onClick={() => setShowNewThread(false)}
                className="rounded-lg border border-[var(--ll-border)] px-4 py-2 text-sm text-[var(--ll-text-muted)]"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--ll-surface)]" />
            ))}
          </div>
        ) : threads.length === 0 ? (
          <p className="text-sm text-[var(--ll-text-muted)]">
            No discussions yet. Ask the first question!
          </p>
        ) : (
          <div className="space-y-3">
            {threads.map((thread) => (
              <div
                key={thread.id}
                className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => openThread(thread.id)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[var(--ll-surface-muted)] transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[var(--ll-text)] text-sm">
                        {thread.title}
                      </span>
                      {thread.pinned && (
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300 border border-amber-400/30">
                          Pinned
                        </span>
                      )}
                      {thread.locked && (
                        <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] text-red-300 border border-red-400/30">
                          Locked
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--ll-text-muted)] mt-0.5">
                      {thread.author.name ?? "Unknown"} · {timeAgo(thread.createdAt)}
                    </p>
                  </div>
                  <span className="text-xs text-[var(--ll-text-faint)] shrink-0 ml-3">
                    {thread._count.posts} {thread._count.posts === 1 ? "reply" : "replies"}
                  </span>
                </button>

                {expandedThreadId === thread.id && (
                  <div className="border-t border-[var(--ll-border)] px-5 py-4 space-y-4">
                    {postsLoading ? (
                      <div className="h-8 animate-pulse rounded bg-[var(--ll-surface-muted)]" />
                    ) : posts.length === 0 ? (
                      <p className="text-xs text-[var(--ll-text-muted)]">No posts yet.</p>
                    ) : (
                      posts.map((post) => (
                        <div key={post.id} className="space-y-2">
                          <div className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-4">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className="h-6 w-6 rounded-full bg-[var(--ll-surface-muted)] flex items-center justify-center text-xs font-bold text-[var(--ll-text)]">
                                {(post.author.name ?? "?")[0].toUpperCase()}
                              </span>
                              <span className="text-xs font-medium text-[var(--ll-text)]">
                                {post.author.name ?? "Unknown"}
                              </span>
                              {roleBadge(post.authorRole)}
                              <span className="text-[10px] text-[var(--ll-text-faint)]">
                                {timeAgo(post.createdAt)}
                              </span>
                              {post.pending && (
                                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300 border border-amber-400/30">
                                  Awaiting approval
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-[var(--ll-text)] leading-relaxed">
                              {post.body}
                            </p>
                            <div className="flex items-center gap-3 mt-3">
                              <button
                                type="button"
                                onClick={() => handleUpvote(post.id)}
                                className="text-xs text-[var(--ll-text-muted)] hover:text-[var(--ll-yellow)] transition"
                              >
                                ▲ {post.upvotes}
                              </button>
                              {!thread.locked && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setReplyingTo(replyingTo === post.id ? null : post.id)
                                  }
                                  className="text-xs text-[var(--ll-text-muted)] hover:text-[var(--ll-text)] transition"
                                >
                                  Reply
                                </button>
                              )}
                            </div>
                            {replyingTo === post.id && (
                              <div className="mt-3 space-y-2">
                                <textarea
                                  value={replyBody}
                                  onChange={(e) => setReplyBody(e.target.value)}
                                  rows={2}
                                  placeholder="Write a reply..."
                                  className="w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm text-[var(--ll-text)]"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleReply(thread.id, post.id)}
                                  disabled={submitting}
                                  className="rounded-lg bg-[var(--ll-yellow)] px-3 py-1.5 text-xs font-semibold text-[var(--ll-bg)] disabled:opacity-50"
                                >
                                  Post Reply
                                </button>
                              </div>
                            )}
                          </div>
                          {post.replies.map((reply) => (
                            <div
                              key={reply.id}
                              className="ml-6 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)]/40 p-3"
                            >
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-xs font-medium text-[var(--ll-text)]">
                                  {reply.author.name ?? "Unknown"}
                                </span>
                                {roleBadge(reply.authorRole)}
                                <span className="text-[10px] text-[var(--ll-text-faint)]">
                                  {timeAgo(reply.createdAt)}
                                </span>
                                {reply.pending && (
                                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300 border border-amber-400/30">
                                    Awaiting approval
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-[var(--ll-text)]">{reply.body}</p>
                            </div>
                          ))}
                        </div>
                      ))
                    )}

                    {!thread.locked && (
                      <div className="space-y-2 pt-2 border-t border-[var(--ll-border)]">
                        <textarea
                          value={replyingTo ? "" : replyBody}
                          onChange={(e) => {
                            setReplyingTo(null);
                            setReplyBody(e.target.value);
                          }}
                          rows={2}
                          placeholder="Write a reply to this thread..."
                          className="w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm text-[var(--ll-text)]"
                        />
                        <button
                          type="button"
                          onClick={() => handleReply(thread.id)}
                          disabled={submitting}
                          className="rounded-lg bg-[var(--ll-yellow)] px-3 py-1.5 text-xs font-semibold text-[var(--ll-bg)] disabled:opacity-50"
                        >
                          Post Reply
                        </button>
                      </div>
                    )}
                    {thread.locked && (
                      <p className="text-xs text-[var(--ll-text-faint)] italic">
                        This thread is locked.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
