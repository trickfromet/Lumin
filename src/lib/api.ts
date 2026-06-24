// Frontend API client for TreeHole backend

const BASE = "";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });

  let data;
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      data = await res.json();
    } catch {
      throw new Error(`无法解析响应内容 (状态码: ${res.status})`);
    }
  } else {
    // Non-JSON response (likely an error page or empty)
    const text = await res.text();
    if (!res.ok) {
      // CloudFlare Worker 限制 → 友好提示
      if (text.includes("Worker exceeded resource limits") || text.includes("Cloudflare")) {
        throw new Error("SERVER_BUSY");
      }
      throw new Error(text || `请求失败 (状态码: ${res.status})`);
    }
    data = {} as T;
  }
  if (!res.ok) {
    if (data?.error && typeof data.error === "string" && (
      data.error.includes("exceeded") || data.error.includes("resource") || data.error.includes("limit")
    )) {
      throw new Error("SERVER_BUSY");
    }
    throw new Error(data?.error || `请求失败 (状态码: ${res.status})`);
  }

  if (data && typeof data === "object" && "success" in data && "data" in data) {
    return (data as { data: T }).data;
  }
  return data as T;
}

// ── Auth ──
export const auth = {
  me: () => request<{ user: User | null }>("/api/auth/me"),
  login: (phoneOrEmail: string, password: string) =>
    request<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ phoneOrEmail, password }),
    }),
  register: (data: { phone?: string; email?: string; password: string; inviteCode?: string }) =>
    request<{ user: User; inviteCode?: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  resetPassword: (data: { email: string; inviteCode: string; newPassword: string }) =>
    request<{ message: string; user: User }>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  logout: () =>
    request<{ message: string }>("/api/auth/logout", { method: "POST" }),
};

// ── Categories ──
export const categories = {
  list: () => request<{ categories: Category[] }>("/api/categories"),
};

// ── Treeholes (Tags) ──
export const treeholes = {
  list: (params?: { range?: "day" | "week" | "month"; language?: string }) => {
    const qs = new URLSearchParams();
    if (params?.range) qs.set("range", params.range);
    if (params?.language) qs.set("language", params.language);
    return request<{ treeholes: TreeHole[]; meta?: { range: string | null } }>(
      `/api/treeholes?${qs}`,
    );
  },
};

// ── Posts ──
export const posts = {
  list: (params?: {
    page?: number;
    categoryId?: number;
    tag?: string;
    userId?: number;
    language?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.categoryId) qs.set("categoryId", String(params.categoryId));
    if (params?.tag) qs.set("tag", params.tag);
    if (params?.userId) qs.set("userId", String(params.userId));
    if (params?.language) qs.set("language", params.language);
    return request<{
      posts: Post[];
      total: number;
      page: number;
      totalPages: number;
    }>(`/api/posts?${qs}`);
  },
  get: (id: number) => request<{ post: Post }>(`/api/posts/${id}`),
  create: (data: {
    allowComments?: boolean;
    allowStrangerComments?: boolean;
    content: string;
    categoryId?: number;
    tags?: string[];
    imageUrl?: string;
  }) =>
    request<{ id: number; guestHint?: string }>("/api/posts", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    request<{ message: string }>(`/api/posts/${id}`, { method: "DELETE" }),
};

// ── Post Interactions ──
export const postInteractions = {
  like: (postId: number) =>
    request<{ liked: boolean; count: number }>(`/api/posts/${postId}/like`, {
      method: "POST",
    }),
  metoo: (postId: number) =>
    request<{
      metooed: boolean;
      count: number;
      tier: { name: string; description: string };
    }>(`/api/posts/${postId}/metoo`, { method: "POST" }),
  unmetoo: (postId: number) =>
    request<{
      metooed: boolean;
      count: number;
      tier: { name: string; description: string };
    }>(`/api/posts/${postId}/metoo`, { method: "DELETE" }),
  comments: {
    list: (postId: number, parentId?: number) => {
      const qs = parentId ? `?parentId=${parentId}` : "";
      return request<{ comments: Comment[] }>(
        `/api/posts/${postId}/comments${qs}`,
      );
    },
    create: (postId: number, data: { content: string; parentId?: number }) =>
      request<Comment>(`/api/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
};

// ── Recommendations ──
export const recommendations = {
  list: (params?: { limit?: number; categoryId?: number; language?: string }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.categoryId) qs.set("categoryId", String(params.categoryId));
    if (params?.language) qs.set("language", params.language);
    return request<{ posts: Post[] }>(`/api/recommendations?${qs}`);
  },
};

// ── Users ──
export const users = {
  me: () => request<{ user: UserProfile }>("/api/users/me"),
  updateMe: (data: {
    nickname?: string;
    bio?: string;
    birthday?: string;
    status?: string;
    backgroundUrl?: string | null;
  }) =>
    request<{ user: Partial<UserProfile> }>("/api/users/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteMe: () =>
    request<{ message: string }>("/api/users/me", { method: "DELETE" }),
  get: (id: number) => request<{ user: UserProfile }>(`/api/users/${id}`),
  uploadAvatar: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/users/me/avatar", {
      method: "POST",
      body: form,
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "上传失败");
    return data as { url: string };
  },
  uploadBackground: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/users/me/background", {
      method: "POST",
      body: form,
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "上传失败");
    return data as { url: string };
  },
};

// ── Collections ──
export const collections = {
  list: (page?: number) => {
    const qs = page ? `?page=${page}` : "";
    return request<{ collections: Collection[]; total: number }>(
      `/api/collections${qs}`,
    );
  },
  save: (postId: number) =>
    request<{ message: string }>(`/api/collections/${postId}`, {
      method: "POST",
    }),
  remove: (postId: number) =>
    request<{ message: string }>(`/api/collections/${postId}`, {
      method: "DELETE",
    }),
};

// ── Capsules ──
export const capsuleApi = {
  list: (page?: number) => {
    const qs = page ? `?page=${page}` : "";
    return request<{ capsules: Capsule[]; total: number }>(
      `/api/capsules${qs}`,
    );
  },
  create: (data: {
    allowComments?: boolean;
    allowStrangerComments?: boolean;
    content: string;
    delaySeconds: number;
    imageUrl?: string;
  }) =>
    request<Capsule>("/api/capsules", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  get: (id: number) => request<{ capsule: Capsule }>(`/api/capsules/${id}`),
  recall: (id: number) =>
    request<{ message: string }>(`/api/capsules/${id}`, { method: "DELETE" }),
  reserve: (id: number) =>
    request<{ message: string }>(`/api/capsules/${id}/reserve`, {
      method: "POST",
    }),
  unreserve: (id: number) =>
    request<{ message: string }>(`/api/capsules/${id}/reserve`, {
      method: "DELETE",
    }),
  feed: (page?: number) => {
    const qs = page ? `?page=${page}` : "";
    return request<{ capsules: Capsule[]; total: number }>(
      `/api/capsules/feed${qs}`,
    );
  },
};

// ── Notifications ──
export const notifications = {
  list: (page?: number) => {
    const qs = page ? `?page=${page}` : "";
    return request<{ notifications: Notification[]; total: number }>(
      `/api/notifications${qs}`,
    );
  },
  read: (id: number) =>
    request<{ message: string }>(`/api/notifications/${id}/read`, {
      method: "PATCH",
    }),
  readAll: () =>
    request<{ message: string }>("/api/notifications/read-all", {
      method: "PATCH",
    }),
  unreadCount: () =>
    request<{ count: number }>("/api/notifications/unread-count"),
};

// ── Reports ──
export const reportApi = {
  submit: (data: {
    reason: string;
    postId?: number;
    reportedUserId?: number;
  }) =>
    request<{ message: string }>("/api/reports", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// ── Feedback ──
export const feedbackApi = {
  submit: (data: { rating: string; content: string }) =>
    request<{ message: string }>("/api/feedback", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// ── Upload ──
export const upload = {
  image: async (file: File) => {
    const form = new FormData();
    form.append("image", file);
    const res = await fetch("/api/upload/image", {
      method: "POST",
      body: form,
      credentials: "include",
    });
    return res.json() as Promise<{ url: string }>;
  },
};

// ── Types ──
export interface User {
  id: number;
  nickname: string;
  phone?: string;
  email?: string;
  avatarUrl?: string;
  backgroundUrl?: string;
  bio?: string;
  birthday?: string;
  status: string;
  role: string;
  createdAt?: string;
}

export interface UserProfile extends User {
  zodiac?: string | null;
  _count?: {
    posts: number;
    comments: number;
    metoos: number;
    collections: number;
  };
}

export interface Category {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  _count: { posts: number };
}

export interface TreeHole {
  tag: string;
  count: number;
  recentCount?: number;
  latestAt?: string | null;
  preview?: string | null;
}

export interface Post {
  id: number;
  nickname: string;
  content: string;
  imageUrl?: string;
  category?: { id: number; name: string; icon?: string };
  tags: string[];
  createdAt: string;
  metooCount: number;
  metooTier?: { name: string; description: string };
  commentCount: number;
  userHasMetoed?: boolean;
}

export interface Comment {
  id: number;
  nickname: string;
  content: string;
  postId: number;
  parentId?: number;
  replyCount: number;
  createdAt: string;
}

export interface Collection {
  id: number;
  postId: number;
  createdAt: string;
  post: {
    id: number;
    nickname: string;
    content: string;
    imageUrl?: string;
    createdAt: string;
    _count: { metoos: number; comments: number };
  };
}

export interface Capsule {
  id: number;
  content?: string;
  imageUrl?: string;
  publishAt: string;
  isPublished: boolean;
  isRecalled: boolean;
  reservationCount: number;
  createdAt: string;
  countdown?: string;
}

export interface Notification {
  id: number;
  userId: number;
  type: string;
  title: string;
  content?: string;
  relatedId?: number;
  relatedType?: string;
  isRead: boolean;
  createdAt: string;
}
