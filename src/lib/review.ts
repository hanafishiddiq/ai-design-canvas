import type { DesignProject, ReviewReply, ReviewStatus, ReviewThread } from "./types";

let counter = 0;
const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}`;
const now = () => new Date().toISOString();

export function setReviewStatus(project: DesignProject, status: ReviewStatus): DesignProject {
  const next = structuredClone(project);
  next.review.status = status;
  next.updatedAt = now();
  return next;
}

export function addReviewThread(project: DesignProject, input: {
  pageId: string;
  nodeId?: string;
  x?: number;
  y?: number;
  author?: string;
  message: string;
}): DesignProject {
  if (!project.pages.some((page) => page.id === input.pageId)) throw new Error(`Page not found: ${input.pageId}`);
  if (input.nodeId && !project.pages.some((page) => page.nodes.some((node) => node.id === input.nodeId))) throw new Error(`Node not found: ${input.nodeId}`);
  if (!input.message.trim()) throw new Error("Review comment cannot be empty.");
  const timestamp = now();
  const thread: ReviewThread = {
    id: uid("review"),
    pageId: input.pageId,
    nodeId: input.nodeId,
    x: input.x,
    y: input.y,
    author: input.author?.trim() || "Reviewer",
    message: input.message.trim(),
    createdAt: timestamp,
    updatedAt: timestamp,
    resolved: false,
    replies: [],
  };
  const next = structuredClone(project);
  next.review.threads.push(thread);
  if (next.review.status === "draft") next.review.status = "in-review";
  next.updatedAt = timestamp;
  return next;
}

export function replyToReviewThread(project: DesignProject, threadId: string, message: string, author = "Reviewer"): DesignProject {
  if (!message.trim()) throw new Error("Reply cannot be empty.");
  const next = structuredClone(project);
  const thread = next.review.threads.find((item) => item.id === threadId);
  if (!thread) throw new Error(`Review thread not found: ${threadId}`);
  const timestamp = now();
  const reply: ReviewReply = { id: uid("reply"), author: author.trim() || "Reviewer", message: message.trim(), createdAt: timestamp };
  thread.replies.push(reply);
  thread.updatedAt = timestamp;
  next.updatedAt = timestamp;
  return next;
}

export function setReviewThreadResolved(project: DesignProject, threadId: string, resolved: boolean): DesignProject {
  const next = structuredClone(project);
  const thread = next.review.threads.find((item) => item.id === threadId);
  if (!thread) throw new Error(`Review thread not found: ${threadId}`);
  thread.resolved = resolved;
  thread.updatedAt = now();
  next.updatedAt = thread.updatedAt;
  return next;
}

export function removeReviewThread(project: DesignProject, threadId: string): DesignProject {
  const next = structuredClone(project);
  next.review.threads = next.review.threads.filter((thread) => thread.id !== threadId);
  next.updatedAt = now();
  return next;
}

export function reviewSummary(project: DesignProject) {
  const total = project.review.threads.length;
  const resolved = project.review.threads.filter((thread) => thread.resolved).length;
  return { status: project.review.status, total, resolved, open: total - resolved };
}
