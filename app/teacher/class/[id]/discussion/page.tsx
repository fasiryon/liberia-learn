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

export default function TeacherClassDiscussionPage() {
  const params = useParams();
  const classId = (params.id ?? params.classId) as string;
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedThreadId, setExpandedThreadId] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  const togglePin = async (threadId: string) => {
    await fetch(`/api/discussion/threads/${threadId}/pin`, { method: "PATCH" });
    await loadThreads();
  };

  const toggleLock = async (threadId: string) => {
    await fetch(`/api/discussion/threads/${threadId}/lock`, { method: "PATCH" });
    await loadThreads();
  };

  const deleteThread = async (threadId: string) => {
    if (!confirm("Delete this thread?")) return;
    await fetch(`/api/discussion/threads/${threadId}`, { method: "DELETE" });
    if (expandedThreadId === threadId) setExpandedThreadId(null);
    await loadThreads();
  };

  const deletePost = async (postId: string) => {
    if (!confirm("Delete this post?")) return;
    await fetch(`/api/discussion/posts/${postId}`, { method: "DELETE" });
    if (expandedThreadId) {
      const res = await fetch(`/api/discussion/threads/${expandedThreadId}/posts`);
      if (res.ok) setPosts(await res.json());
    }
  };

  const approvePost = async (postId: string) => {
    await fetch(`/api/discussion/posts/${postId}/approve`, { method: "PATCH" });
    if (expandedThreadId) {
      const res = await fetch(`/api/discussion/threads/${expandedThreadId}/posts`);
      if (res.ok) setPosts(await res.json());
    }
  };

  const handleReply = async (threadId: string) => {
    if (!replyBody.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/discussion/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, body: replyBody }),
      });
      if (res.ok) {
        setReplyBody("");
        const postsRes = await fetch(`/api/discussion/threads/${threadId}/posts`);
        if (postsRes.ok) setPosts(await postsRes.json());
      }
    } finally {
      setSubmitting(false);
    }
  };

  const pendingPosts = posts.filter((p) => p.pending);

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 ll-page-enter">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/teacher/discussion" className="text-sm text-[var(--ll-yellow)]">
          &larr; All Discussions
        </Link>
        <h1 className="text-2xl font-bold text-[var(--ll-text)]">Class Discussion (Teacher)</h1>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--ll-surface)]" />
            ))}
          </div>
        ) : threads.length === 0 ? (
          <p className="text-sm text-[var(--ll-text-muted)]">No discussions yet.</p>
        ) : (
          <div className="space-y-3">
            {threads.map((thread) => (
              <div
                key={thread.id}
                className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] overflow-hidden"
              >
                <div className="flex items-center gap-2 px-5 py-4">
                  <button
                    type="button"
                    onClick={() => openThread(thread.id)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-[var(--ll-text)]">
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
                      {thread.author.name ?? "Unknown"} · {timeAgo(thread.createdAt)} ·{" "}
                      {thread._count.posts} replies
                    </p>
                  </button>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => togglePin(thread.id)}
                      className="rounded px-2 py-1 text-xs border border-[var(--ll-border)] text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
                    >
                      {thread.pinned ? "Unpin" : "Pin"}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleLock(thread.id)}
                      className="rounded px-2 py-1 text-xs border border-[var(--ll-border)] text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
                    >
                      {thread.locked ? "Unlock" : "Lock"}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteThread(thread.id)}
                      className="rounded px-2 py-1 text-xs border border-red-500/30 text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {expandedThreadId === thread.id && (
                  <div className="border-t border-[var(--ll-border)] px-5 py-4 space-y-4">
                    {pendingPosts.length > 0 && (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                        <p className="text-xs font-semibold text-amber-300 uppercase tracking-wide">
                          Pending Approval ({pendingPosts.length})
                        </p>
                        {pendingPosts.map((post) => (
                          <div
                            key={post.id}
                            className="rounded border border-amber-500/20 bg-[var(--ll-bg)]/60 p-3"
                          >
                            <p className="text-xs text-[var(--ll-text-muted)] mb-1">
                              {post.author.name ?? "Unknown"} · {timeAgo(post.createdAt)}
                            </p>
                            <p className="text-sm text-[var(--ll-text)]">{post.body}</p>
                            <div className="flex gap-2 mt-2">
                              <button
                                type="button"
                                onClick={() => approvePost(post.id)}
                                className="rounded px-3 py-1 text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 hover:bg-emerald-500/30"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => deletePost(post.id)}
                                className="rounded px-3 py-1 text-xs bg-red-500/20 text-red-300 border border-red-400/30 hover:bg-red-500/30"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {postsLoading ? (
                      <div className="h-8 animate-pulse rounded bg-[var(--ll-surface-muted)]" />
                    ) : (
                      posts
                        .filter((p) => !p.pending)
                        .map((post) => (
                          <div
                            key={post.id}
                            className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-4 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-[var(--ll-text)]">
                                  {post.author.name ?? "Unknown"}
                                </span>
                                <span className="text-[10px] text-[var(--ll-text-faint)]">
                                  {timeAgo(post.createdAt)}
                                </span>
                                {post.flagged && (
                                  <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] text-red-300">
                                    Flagged
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => deletePost(post.id)}
                                className="text-xs text-red-400 hover:text-red-300"
                              >
                                Delete
                              </button>
                            </div>
                            <p className="text-sm text-[var(--ll-text)]">{post.body}</p>
                            <p className="text-[10px] text-[var(--ll-text-faint)]">
                              ▲ {post.upvotes} upvotes
                            </p>
                          </div>
                        ))
                    )}

                    {!thread.locked && (
                      <div className="space-y-2 pt-2 border-t border-[var(--ll-border)]">
                        <textarea
                          value={replyBody}
                          onChange={(e) => setReplyBody(e.target.value)}
                          rows={2}
                          placeholder="Reply as teacher..."
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
