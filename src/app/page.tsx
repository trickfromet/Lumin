"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  auth,
  treeholes as treeholeApi,
  posts as postsApi,
  recommendations,
  postInteractions,
  users,
  feedbackApi,
  type TreeHole,
  type Post,
  type User,
} from "@/lib/api";
import { audio } from "@/lib/audio";

const BRAND_PALETTE = [
  [235, 170, 155],
  [225, 200, 110],
  [180, 210, 170],
  [170, 195, 235],
  [195, 180, 230],
  [210, 180, 200],
  [210, 200, 150],
  [170, 210, 210],
];

const CATEGORY_EN_MAP: Record<string, string> = {
  心弦: "Heartstrings",
  求索: "Quest",
  尘网: "Web of Dust",
  屋檐: "Eaves",
  浮生: "Floating Life",
  幽壑: "Hidden Ravine",
  拾遗: "Gleanings",
  碎语: "Fragments",
  长卷: "Long Scroll",
};

function tCategory(
  zhName: string | undefined | null,
  isEnglish: boolean,
): string {
  if (!zhName) return "";
  return isEnglish ? CATEGORY_EN_MAP[zhName] || zhName : zhName;
}

function timeAgo(dateStr: string, isEnglish: boolean = false): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}${isEnglish ? "m ago" : "分钟前"}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}${isEnglish ? "h ago" : "小时前"}`;
  return `${Math.floor(hrs / 24)}${isEnglish ? "d ago" : "天前"}`;
}

function getAutoTheme(): number {
  const hour = new Date().getHours();
  if (hour >= 17 && hour < 20) return 2; // 傍晚 → 篝火
  if (hour >= 20 || hour < 6) return 0;  // 夜晚 → 星空
  return 1;                               // 白天 → 水面
}

const ENABLE_INVITE_CODE = false;

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);

  // ── 状态 ──
  const [themeIdx, setThemeIdx] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isEnglishMode, setIsEnglishMode] = useState(true);
  const t = useCallback(
    (zh: string, en: string) => (isEnglishMode ? en : zh),
    [isEnglishMode],
  );
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [treeholesData, setTreeholesData] = useState<TreeHole[]>([]);
  const [greetingPhase, setGreetingPhase] = useState<
    "init" | "center" | "fadeout" | "top" | "done"
  >("init");
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authError, setAuthError] = useState("");

  // 屏幕可见性
  const [readingVisible, setReadingVisible] = useState(false);
  const [composeVisible, setComposeVisible] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);

  // 阅读状态
  const [currentPost, setCurrentPost] = useState<Post | null>(null);
  const [currentCategoryName, setCurrentCategoryName] = useState("");
  const [currentClusterColor, setCurrentClusterColor] = useState<number[]>([
    170, 195, 235,
  ]);
  const [postCache, setPostCache] = useState<Post[]>([]);
  const [loadingPost, setLoadingPost] = useState(false);

  // 撰写状态
  const [composeText, setComposeText] = useState("");
  const [sinkActive, setSinkActive] = useState(false);

  // 个人主页状态
  const [profilePosts, setProfilePosts] = useState<Post[]>([]);

  // 登录表单
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authInviteCode, setAuthInviteCode] = useState("");
  const [registerAgreed, setRegisterAgreed] = useState(false);

  // 注册成功后的邀请码展示
  const [registrationInviteCode, setRegistrationInviteCode] = useState<string | null>(null);

  // 找回密码
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetInviteCode, setResetInviteCode] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);

  // 反馈表单
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<"good" | "bad" | "">("");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);

  // 空闲 10s 提示：从未进入过任何树洞时才弹
  const [showIdlePrompt, setShowIdlePrompt] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    setShowIdlePrompt(false);
  }, []);

  const startIdleTimer = useCallback(() => {
    clearIdleTimer();
    // 每次回到主页面空闲 10s 后弹出
    if (stateRef.current.greetingDone && !stateRef.current.anyScreenOpen) {
      idleTimerRef.current = setTimeout(() => {
        setShowIdlePrompt(true);
      }, 10000);
    }
  }, [clearIdleTimer]);

  const shuffleTreeholes = useCallback(() => {
    const st = stateRef.current;
    st.shuffleKey++;
    if (treeholesData.length > 0) {
      const shuffled = [...treeholesData].sort(() => Math.random() - 0.5);
      const indexByTag = shuffled.reduce<Record<string, number>>(
        (acc, item, idx) => { acc[item.tag] = idx; return acc; }, {},
      );
      st.clusters = buildClusters(shuffled, indexByTag, st.shuffleKey, st.isMobile);
    } else {
      st.clusters = buildClusters([], {}, st.shuffleKey, st.isMobile);
    }
    // 将百分比坐标转换为像素坐标（buildClusters 返回的 x=0,y=0）
    st.clusters.forEach((c) => {
      c.nodes.forEach((n) => {
        n.x = n.xPct * st.W;
        n.y = n.yPct * st.H;
        n.r = (n.rBase * Math.min(st.W, st.H)) / 844;
      });
    });
    // 重新创建 DOM 标签
    const labelFn = stateRef.current._createLabels;
    if (labelFn) requestAnimationFrame(() => labelFn(st.clusters));
  }, [treeholesData]);



  const [toast, setToast] = useState<{
    message: string;
    type: "info" | "warn" | "error";
    visible: boolean;
    exiting: boolean;
  }>({ message: "", type: "info", visible: false, exiting: false });

  const showToast = useCallback(
    (message: string, type: "info" | "warn" | "error" = "info") => {
      setToast({ message, type, visible: true, exiting: false });
      setTimeout(() => {
        setToast((prev) => ({ ...prev, exiting: true }));
        setTimeout(() => {
          setToast((prev) => ({ ...prev, visible: false, exiting: false }));
        }, 500);
      }, 4000);
    },
    [],
  );

  const greetingPlayedRef = useRef(false);
  const longStayTimeoutRef = useRef<number | null>(null);
  const userManuallySwitchedRef = useRef(false);
  const preloadingTagRef = useRef<string>("");
  const preloadControllerRef = useRef<AbortController | null>(null);
  const prefetchedPostsRef = useRef<Record<string, { zh: Post[]; en: Post[] }>>({});

  const preloadAllPosts = useCallback((data: TreeHole[]) => {
    if (data.length === 0) return;
    prefetchedPostsRef.current = {};
    data.forEach((hole) => {
      prefetchedPostsRef.current[hole.tag] = { zh: [], en: [] };
      
      // 预加载中文帖子
      postsApi
        .list({ tag: hole.tag, page: 1, language: "zh" })
        .then((pRes) => {
          if (pRes.posts && pRes.posts.length > 0) {
            prefetchedPostsRef.current[hole.tag] = {
              ...(prefetchedPostsRef.current[hole.tag] || { zh: [], en: [] }),
              zh: pRes.posts,
            };
          }
        })
        .catch(() => {});

      // 预加载英文帖子
      postsApi
        .list({ tag: hole.tag, page: 1, language: "en" })
        .then((pRes) => {
          if (pRes.posts && pRes.posts.length > 0) {
            prefetchedPostsRef.current[hole.tag] = {
              ...(prefetchedPostsRef.current[hole.tag] || { zh: [], en: [] }),
              en: pRes.posts,
            };
          }
        })
        .catch(() => {});
    });
  }, []);

  useEffect(() => {
    if (readingVisible) {
      longStayTimeoutRef.current = window.setTimeout(
        () => {
          audio.playLongStayEvent();
        },
        3 * 60 * 1000,
      ); // 3 minutes
    } else {
      if (longStayTimeoutRef.current) {
        window.clearTimeout(longStayTimeoutRef.current);
      }
    }
    return () => {
      if (longStayTimeoutRef.current) {
        window.clearTimeout(longStayTimeoutRef.current);
      }
    };
  }, [readingVisible]);

  // 动画状态引用（可变，不触发重新渲染）
  const stateRef = useRef({
    themeIdx: 0,
    isEnglishMode: true,
    spaceT: 1,
    waterT: 0,
    fireT: 0,
    THEME_SPEED: 0.5,
    parallaxX: 0,
    parallaxY: 0,
    targetPX: 0,
    targetPY: 0,
    cursorX: typeof window !== "undefined" ? window.innerWidth / 2 : 500,
    cursorY: typeof window !== "undefined" ? window.innerHeight / 2 : 400,
    explorerCurrentX: 0,
    explorerCurrentY: 0,
    explorerCurrentRot: 0,
    isTransitioning: false,
    transitionTarget: null as { x: number; y: number } | null,
    time: 0,
    lastFrame: 0,
    greetingDone: false,
    anyScreenOpen: false,
    clusters: [] as ReturnType<typeof buildClusters>,
    shuffleKey: 0,
    _createLabels: null as ((clusters: ReturnType<typeof buildClusters>) => void) | null,
    W: 0,
    H: 0,
    dpr: 1,
    isMobile: typeof window !== "undefined" ? window.innerWidth <= 768 : false,
    bgStars: [] as ReturnType<typeof buildBgStars>,
    waterRipples: [] as ReturnType<typeof buildWaterRipples>,
    labelEls: {} as Record<string, HTMLDivElement>,
  });

  // ── 构建函数 ──
  function buildBgStars(count = 5000) {
    const stars: {
      xPct: number;
      yPct: number;
      r: number;
      baseAlpha: number;
      twinkleSpeed: number;
      twinklePhase: number;
      layer: number;
      warmth: number;
      x: number;
      y: number;
    }[] = [];
    let seed = 42;
    const srand = (s: number) => {
      seed = s;
    };
    const rand = () => {
      seed = (seed * 16807 + 0) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    srand(7);
    for (let i = 0; i < count; i++) {
      const r = rand();
      stars.push({
        xPct: rand(),
        yPct: rand(),
        r:
          r < 0.5
            ? 0.3 + rand() * 0.4
            : r < 0.8
              ? 0.5 + rand() * 0.5
              : 0.8 + rand() * 0.8,
        baseAlpha: 0.02 + rand() * 0.08,
        twinkleSpeed: 0.1 + rand() * 0.4,
        twinklePhase: rand() * Math.PI * 2,
        layer: rand() < 0.3 ? 0 : rand() < 0.6 ? 1 : 2,
        warmth: rand(),
        x: 0,
        y: 0,
      });
    }
    return stars;
  }

  function buildWaterRipples() {
    const ripples: {
      yPct: number;
      widthPct: number;
      phase: number;
      speed: number;
    }[] = [];
    let seed = 42;
    const rand = () => {
      seed = (seed * 16807 + 0) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const randRange = (a: number, b: number) => a + rand() * (b - a);
    for (let i = 0; i < 25; i++) {
      ripples.push({
        yPct: rand(),
        widthPct: randRange(0.05, 0.2),
        phase: rand() * Math.PI * 2,
        speed: randRange(0.1, 0.4),
      });
    }
    return ripples;
  }

  function buildClusters(
    treeholes: TreeHole[],
    indexByTag: Record<string, number>,
    shuffleKey: number = 0,
    isMobile: boolean = false,
  ) {
    let seed = 12345 + shuffleKey * 1000;
    const srand = (s: number) => {
      seed = s;
    };
    const rand = () => {
      seed = (seed * 16807 + 0) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const randRange = (a: number, b: number) => a + rand() * (b - a);
    srand(seed);

    // 移动端缩放系数
    const mobileScale = isMobile ? 0.4 : 1;
    const count = treeholes.length;
    // 移动端环半径稍大让星群更分散，避免挤在一起
    const baseRadius = isMobile ? 0.32 + count * 0.008 : 0.26 + count * 0.01;
    const spreadX = 0.16 * mobileScale;
    const spreadY = 0.14 * mobileScale;

    return treeholes.map((hole, i) => {
      const stableIndex = indexByTag[hole.tag] ?? i;
      // 基本角度 + 随机扰动，避免完美的等距排列
      const baseAngle =
        (stableIndex / Math.max(1, count)) * Math.PI * 2 - Math.PI / 2;
      const seedR = stableIndex * 7919 + 1 + shuffleKey * 9973;
      const angleJitter = ((seedR % 1000) / 1000 - 0.5) * 0.45;
      const angle = baseAngle + angleJitter;
      // 半径也加随机扰动
      const radiusJitter = 1 + (((seedR * 7 + 13) % 1000) / 1000 - 0.5) * 0.35;
      const ringRadius = Math.min(0.40, baseRadius * radiusJitter);
      const cxPct = 0.5 + Math.cos(angle) * ringRadius;
      const cyPct = 0.5 + Math.sin(angle) * ringRadius * 0.85;
      const labelOffset = isMobile ? { x: -10, y: 32 } : { x: -20, y: 60 };
      const color = BRAND_PALETTE[stableIndex % BRAND_PALETTE.length];
      const postCount = hole.count || 0;
      const recentCount =
        (hole as TreeHole & { recentCount?: number }).recentCount || postCount;
      const weightedCount = Math.max(
        1,
        Math.round(postCount * 0.2 + recentCount * 0.8),
      );
      const nodeCount = Math.max(
        5,
        Math.min(18, 5 + Math.floor(Math.log(weightedCount + 1) * 3)),
      );
      // 基于加权计数的亮度因子（移动端整体提亮）
      const brightnessMin = isMobile ? 0.55 : 0.3;
      const brightness = Math.max(
        brightnessMin,
        Math.min(1.0, (isMobile ? 0.6 : 0.35) + Math.log(weightedCount + 1) * 0.12),
      );

      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      const nodes: {
        xPct: number;
        yPct: number;
        activityBase: number;
        activityPhase: number;
        twinkleSpeed: number;
        twinklePhase: number;
        flarePhase: number;
        flareSpeed: number;
        waterPhase: number;
        waterSpeedX: number;
        waterSpeedY: number;
        waterRadiusBase: number;
        rBase: number;
        x: number;
        y: number;
        r: number;
        responseSpeed: number;
        currentGlow: number;
      }[] = [];

      for (let j = 0; j < nodeCount; j++) {
        const angle = j * goldenAngle + rand() * 0.5 - 0.25;
        const dist = (0.15 + rand() * 0.85) * (j < 2 ? 0.3 : 1);
        nodes.push({
          xPct: cxPct + Math.cos(angle) * dist * spreadX * (0.5 + rand()),
          yPct: cyPct + Math.sin(angle) * dist * spreadY * (0.5 + rand()),
          activityBase: randRange(0.2, 0.8) * brightness,
          activityPhase: rand() * Math.PI * 2,
          twinkleSpeed: randRange(0.2, 0.8),
          twinklePhase: rand() * Math.PI * 2,
          flarePhase: rand() * Math.PI * 2,
          flareSpeed: randRange(0.1, 0.4),
          waterPhase: rand() * Math.PI * 2,
          waterSpeedX: randRange(0.2, 0.6),
          waterSpeedY: randRange(0.1, 0.4),
          waterRadiusBase: randRange(1.2, 2.8) * brightness * mobileScale,
          rBase: randRange(0.8, 2.5) * brightness * mobileScale,
          responseSpeed: randRange(0.02, 0.08),
          currentGlow: 0,
          x: 0,
          y: 0,
          r: 0,
        });
      }

      // 生成连接线
      const conns: { a: number; b: number; baseAlpha: number }[] = [];
      for (let j = 0; j < nodes.length; j++) {
        let best = -1,
          bestD = 0.08;
        for (let k = j + 1; k < nodes.length; k++) {
          const d = Math.hypot(
            nodes[k].xPct - nodes[j].xPct,
            nodes[k].yPct - nodes[j].yPct,
          );
          if (d < bestD) {
            bestD = d;
            best = k;
          }
        }
        if (best >= 0)
          conns.push({ a: j, b: best, baseAlpha: 0.25 * brightness });
      }

      return {
        id: hole.tag,
        name: hole.tag,
        tag: hole.tag,
        postCount,
        color,
        nodes,
        connections: conns,
        fadeIn: 0,
        fadeSpeed: 0.35 + Math.random() * 0.9,
        driftPhaseX: rand() * Math.PI * 2,
        driftPhaseY: rand() * Math.PI * 2,
        labelOffset,
      };
    });
  }

  // ── 初始化 ──
  useEffect(() => {
    let initialEnglish = true;
    try {
      const pref = localStorage.getItem("langPref");
      if (pref === "zh") {
        initialEnglish = false;
        setIsEnglishMode(false);
        document.documentElement.classList.remove("font-english");
      } else {
        initialEnglish = true;
        setIsEnglishMode(true);
        document.documentElement.classList.add("font-english");
      }
    } catch {}

    const st = stateRef.current;
    st.isEnglishMode = initialEnglish;
    st.bgStars = buildBgStars(
      typeof window !== "undefined" && window.innerWidth <= 768 ? 1500 : 5000,
    );
    st.waterRipples = buildWaterRipples();
    st.lastFrame = performance.now();

    // 获取用户
    auth
      .me()
      .then((res) => setCurrentUser(res.user))
      .catch(() => {});

    // 从标签获取树洞数据并构建星群
    treeholeApi
      .list()
      .then((res) => {
        const data = res.treeholes || [];
        const sorted = [...data].sort(
          (a, b) => b.count - a.count || a.tag.localeCompare(b.tag),
        );
        const indexByTag = sorted.reduce<Record<string, number>>(
          (acc, item, idx) => {
            acc[item.tag] = idx;
            return acc;
          },
          {},
        );
        setTreeholesData(data);
        st.clusters = buildClusters(data, indexByTag, st.shuffleKey, st.isMobile);
        // 在星群构建后创建标签元素
        requestAnimationFrame(() => createLabels(st.clusters));

        // 预加载所有标签下的第一页故事（双语预加载）
        preloadAllPosts(data);
      })
      .catch(() => {
        setTreeholesData([]);
        st.clusters = buildClusters([], {}, st.shuffleKey, st.isMobile);
        requestAnimationFrame(() => createLabels(st.clusters));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preloadAllPosts]);

  // ── 按时间自动切换主题（仅首次加载，手动切换后停止）──
  useEffect(() => {
    const autoTheme = getAutoTheme();
    applyTheme(autoTheme, false);

    const timer = setInterval(() => {
      // 如果用户已手动切换，不再自动覆盖
      if (userManuallySwitchedRef.current) return;
      const newAutoTheme = getAutoTheme();
      if (newAutoTheme !== stateRef.current.themeIdx) {
        applyTheme(newAutoTheme, false);
      }
    }, 60000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 创建标签 DOM 元素 ──
  const createLabels = useCallback(
    (clusters: ReturnType<typeof buildClusters>) => {
      const mainView = document.getElementById("mainView");
      if (!mainView) return;
      const st = stateRef.current;
      // 保存引用供 shuffleTreeholes 调用
      st._createLabels = createLabels;
      // 移除旧标签
      Object.values(st.labelEls).forEach((el) => el.remove());
      st.labelEls = {};
      clusters.forEach((c) => {
        const el = document.createElement("div");
        el.className = "constellation-label";
        el.textContent = tCategory(c.name, st.isEnglishMode);
        mainView.appendChild(el);
        st.labelEls[c.id] = el;

        if (st.W > 0) {
          const cx =
            c.nodes.reduce((s, n) => s + n.xPct * st.W, 0) / c.nodes.length;
          const cy =
            c.nodes.reduce((s, n) => s + n.yPct * st.H, 0) / c.nodes.length;
          el.style.left = cx + c.labelOffset.x + "px";
          el.style.top = cy + c.labelOffset.y + "px";
        }
      });
    },
    [],
  );

  // ── 画布大小调整 ──
  useEffect(() => {
    const st = stateRef.current;
    function updateCanvasSize() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const W = window.innerWidth;
      const H = window.innerHeight;
      const dpr = Math.min(
        window.devicePixelRatio || 1,
        W <= 768 ? 1 : 2,
      );
      if (st.W === W && st.H === H && st.dpr === dpr) return;
      st.dpr = dpr;
      st.W = W;
      st.H = H;
      st.isMobile = W <= 768;
      canvas.width = st.W * st.dpr;
      canvas.height = st.H * st.dpr;
      canvas.style.width = st.W + "px";
      canvas.style.height = st.H + "px";
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
    }
    function positionAll() {
      const st = stateRef.current;
      st.bgStars.forEach((s) => {
        s.x = s.xPct * st.W;
        s.y = s.yPct * st.H;
      });
      st.clusters.forEach((c) => {
        c.nodes.forEach((n) => {
          n.x = n.xPct * st.W;
          n.y = n.yPct * st.H;
          n.r = (n.rBase * Math.min(st.W, st.H)) / 844;
        });
        const label = st.labelEls[c.id];
        if (label) {
          const cx = c.nodes.reduce((s, n) => s + n.x, 0) / c.nodes.length;
          const cy = c.nodes.reduce((s, n) => s + n.y, 0) / c.nodes.length;
          label.style.left = cx + c.labelOffset.x + "px";
          label.style.top = cy + c.labelOffset.y + "px";
        }
      });
    }
    function resize() {
      updateCanvasSize();
      positionAll();
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [treeholesData]);


  // ── 鼠标 / 触摸跟踪 ──
  useEffect(() => {
    const st = stateRef.current;
    const updateCursor = (x: number, y: number) => {
      st.cursorX = x;
      st.cursorY = y;
      st.targetPX = (x / st.W - 0.5) * 10;
      st.targetPY = (y / st.H - 0.5) * 6;
    };
    const handleMouse = (e: MouseEvent) => {
      updateCursor(e.clientX, e.clientY);
    };
    const handleTouch = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        updateCursor(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const handleTouchEnd = () => {
      // 在移动端将光标重置到中心，防止标签卡住
      if (st.isMobile) {
        st.cursorX = st.W / 2;
        st.cursorY = st.H / 2;
      }
    };
    window.addEventListener("mousemove", handleMouse, { passive: true });
    window.addEventListener("touchmove", handleTouch, { passive: true });
    window.addEventListener("touchstart", handleTouch, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouse);
      window.removeEventListener("touchmove", handleTouch);
      window.removeEventListener("touchstart", handleTouch);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  // ── 问候动画（JS 控制阶段）──
  useEffect(() => {
    // 阶段1：显示居中问候
    const t1 = setTimeout(() => setGreetingPhase("center"), 100);
    // 阶段2：从中心淡出 (加长居中展示时间)
    const t2 = setTimeout(() => setGreetingPhase("fadeout"), 4500);
    // 阶段3：移到顶部并淡入
    const t3 = setTimeout(() => setGreetingPhase("top"), 6000);
    // 阶段4：完成
    const t4 = setTimeout(() => {
      setGreetingPhase("done");
      stateRef.current.greetingDone = true;
      greetingPlayedRef.current = true;
      document.documentElement.classList.add("app-ready");
      // 问候结束后启动空闲计时器
      startIdleTimer();
    }, 7500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  // ── 主绘制循环 ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function drawLanternPath(
      c: CanvasRenderingContext2D,
      w: number,
      h: number,
    ) {
      c.beginPath();
      c.moveTo(-w * 0.35, -h / 2);
      c.lineTo(w * 0.35, -h / 2);
      c.bezierCurveTo(w * 0.6, -h * 0.2, w * 0.6, h * 0.3, w * 0.4, h / 2);
      c.lineTo(-w * 0.4, h / 2);
      c.bezierCurveTo(-w * 0.6, h * 0.3, -w * 0.6, -h * 0.2, -w * 0.35, -h / 2);
      c.closePath();
    }

    function draw() {
      const st = stateRef.current;
      const now = performance.now();
      const dt = Math.min((now - st.lastFrame) / 1000, 0.05);
      st.lastFrame = now;
      st.time += dt;
      if (!ctx) return;

      const targetSpace = st.themeIdx === 0 ? 1 : 0;
      const targetWater = st.themeIdx === 1 ? 1 : 0;
      const targetFire = st.themeIdx === 2 ? 1 : 0;

      st.spaceT += (targetSpace - st.spaceT) * dt * st.THEME_SPEED * 3;
      st.waterT += (targetWater - st.waterT) * dt * st.THEME_SPEED * 3;
      st.fireT += (targetFire - st.fireT) * dt * st.THEME_SPEED * 3;

      st.parallaxX += (st.targetPX - st.parallaxX) * 0.03;
      st.parallaxY += (st.targetPY - st.parallaxY) * 0.03;

      // 探索者移动（低速度，体感更柔和）
      let targetExplorerX: number,
        targetExplorerY: number,
        targetExplorerRot: number;
      if (st.isTransitioning && st.transitionTarget) {
        targetExplorerX = st.transitionTarget.x - st.W / 2;
        targetExplorerY = st.transitionTarget.y - st.H / 2;
        targetExplorerRot = 0;
        st.explorerCurrentX += (targetExplorerX - st.explorerCurrentX) * 0.008;
        st.explorerCurrentY += (targetExplorerY - st.explorerCurrentY) * 0.008;
        st.explorerCurrentRot +=
          (targetExplorerRot - st.explorerCurrentRot) * 0.012;
      } else {
        targetExplorerX = (st.cursorX - st.W / 2) * 0.06;
        targetExplorerY = (st.cursorY - st.H / 2) * 0.06;
        targetExplorerRot = (st.cursorX - st.W / 2) * 0.01;
        st.explorerCurrentX += (targetExplorerX - st.explorerCurrentX) * 0.006;
        st.explorerCurrentY += (targetExplorerY - st.explorerCurrentY) * 0.006;
        st.explorerCurrentRot +=
          (targetExplorerRot - st.explorerCurrentRot) * 0.008;
      }

      const transformStr = `translate(${st.explorerCurrentX}px, ${st.explorerCurrentY}px) rotate(${st.explorerCurrentRot}deg)`;
      const boatEl = document.getElementById("boat-container");
      const capsuleEl = document.getElementById("capsule-container");
      if (boatEl) boatEl.style.transform = transformStr;
      if (capsuleEl) capsuleEl.style.transform = transformStr;

      // 背景
      const moonBreathe = Math.sin(st.time * 0.15) * 0.5 + 0.5;
      const cSpaceC = [10, 10, 18],
        cSpaceE = [4, 4, 10];
      const cWaterC = [240, 244, 248],
        cWaterE = [221, 227, 236];
      const cFireC = [55, 32, 18],   // warm firelit center
        cFireE = [28, 22, 42];    // twilight sky edge

      const cCenter = [
        Math.round(
          cSpaceC[0] * st.spaceT +
            cWaterC[0] * st.waterT +
            cFireC[0] * st.fireT,
        ),
        Math.round(
          cSpaceC[1] * st.spaceT +
            cWaterC[1] * st.waterT +
            cFireC[1] * st.fireT,
        ),
        Math.round(
          cSpaceC[2] * st.spaceT +
            cWaterC[2] * st.waterT +
            cFireC[2] * st.fireT,
        ),
      ];
      const cEdge = [
        Math.round(
          cSpaceE[0] * st.spaceT +
            cWaterE[0] * st.waterT +
            cFireE[0] * st.fireT,
        ),
        Math.round(
          cSpaceE[1] * st.spaceT +
            cWaterE[1] * st.waterT +
            cFireE[1] * st.fireT,
        ),
        Math.round(
          cSpaceE[2] * st.spaceT +
            cWaterE[2] * st.waterT +
            cFireE[2] * st.fireT,
        ),
      ];

      const bgGrad = ctx.createRadialGradient(
        st.W * 0.5,
        st.H * 0.4,
        0,
        st.W * 0.5,
        st.H * 0.4,
        Math.max(st.W, st.H) * (0.6 + 0.3 * moonBreathe),
      );
      bgGrad.addColorStop(0, `rgb(${cCenter.join(",")})`);
      bgGrad.addColorStop(1, `rgb(${cEdge.join(",")})`);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, st.W, st.H);

      // 水面涟漪（浅色主题）
      if (st.waterT > 0) {
        ctx.lineWidth = 1;
        st.waterRipples.forEach((r) => {
          const alpha =
            (Math.sin(st.time * r.speed + r.phase) + 1) *
            0.5 *
            0.08 *
            st.waterT;
          if (alpha > 0.01) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.beginPath();
            const rx =
              st.W / 2 +
              Math.sin(st.time * r.speed * 0.5 + r.phase) * (st.W / 3);
            const y = r.yPct * st.H;
            const wStr = r.widthPct * st.W;
            ctx.moveTo(rx - wStr / 2, y);
            ctx.lineTo(rx + wStr / 2, y);
            ctx.stroke();
          }
        });
      }

      // 背景星星（深色主题）
      if (st.spaceT > 0) {
        const darkAlphaMul = st.spaceT;
        st.bgStars.forEach((s) => {
          const px = st.parallaxX * s.layer * 0.5,
            py = st.parallaxY * s.layer * 0.5;
          const twinkle = Math.sin(st.time * s.twinkleSpeed + s.twinklePhase);
          const alpha =
            s.baseAlpha * Math.min(1, 0.8 + twinkle * 0.3) * darkAlphaMul;
          ctx.globalAlpha = Math.max(0, alpha);
          ctx.fillStyle =
            s.warmth > 0.7
              ? "rgba(240,225,185,1)"
              : s.warmth > 0.4
                ? "rgba(210,218,240,1)"
                : "rgba(195,200,220,1)";
          ctx.beginPath();
          ctx.arc(s.x + px, s.y + py, s.r, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;
      }

      // 星群淡入
      if (st.greetingDone) {
        st.clusters.forEach((c) => {
          if (c.fadeIn < 1) c.fadeIn = Math.min(1, c.fadeIn + dt * c.fadeSpeed);
        });
      }

      // 绘制星群
      st.clusters.forEach((c) => {
        const fade = c.fadeIn;
        if (fade <= 0) return;
        const driftMul = st.waterT + st.fireT * 0.5;
        const clDriftX =
          driftMul > 0
            ? Math.sin(st.time * 0.2 + c.driftPhaseX) * 20 * driftMul
            : 0;
        const clDriftY =
          driftMul > 0
            ? Math.cos(st.time * 0.15 + c.driftPhaseY) * 10 * driftMul
            : 0;
        let clCenterX = 0,
          clCenterY = 0;
        c.nodes.forEach((n) => {
          clCenterX += n.x;
          clCenterY += n.y;
        });
        clCenterX = clCenterX / c.nodes.length + st.parallaxX * 0.5 + clDriftX;
        clCenterY = clCenterY / c.nodes.length + st.parallaxY * 0.5 + clDriftY;

        // 连接线（深色主题）
        if (st.spaceT > 0) {
          c.connections.forEach((conn) => {
            const aNode = c.nodes[conn.a],
              bNode = c.nodes[conn.b];
            const ax = aNode.x + st.parallaxX * 0.5,
              ay = aNode.y + st.parallaxY * 0.5;
            const bx = bNode.x + st.parallaxX * 0.5,
              by = bNode.y + st.parallaxY * 0.5;
            const aAct =
              aNode.activityBase +
              Math.sin(st.time * 0.15 + aNode.activityPhase) * 0.3;
            const bAct =
              bNode.activityBase +
              Math.sin(st.time * 0.15 + bNode.activityPhase) * 0.3;
            const clampedAct = Math.max(0.1, Math.min(1, (aAct + bAct) / 2));
            const alphaLine = Math.max(
              0.01,
              conn.baseAlpha * fade * st.spaceT * clampedAct * 1.5,
            );
            ctx.strokeStyle = `rgba(${c.color.join(",")},${alphaLine})`;
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.stroke();
          });
        }

        // 悬停检测
        const distToCursor = Math.hypot(
          clCenterX - st.cursorX,
          clCenterY - st.cursorY,
        );
        const isHovered = distToCursor < (st.isMobile ? 120 : 180);

        let clusterTotalActivity = 0;
        c.nodes.forEach((n) => {
          // 每个星点独立亮度过渡
          const targetGlow = isHovered ? 1 : 0;
          n.currentGlow += (targetGlow - n.currentGlow) * n.responseSpeed;
          const nodeDriftMul = st.waterT + st.fireT * 0.5;
          const driftX =
            nodeDriftMul > 0
              ? Math.sin(st.time * n.waterSpeedX * 2 + n.waterPhase) *
                12 *
                nodeDriftMul
              : 0;
          const driftY =
            nodeDriftMul > 0
              ? Math.cos(st.time * n.waterSpeedY + n.waterPhase) *
                6 *
                nodeDriftMul
              : 0;
          const nx = n.x + st.parallaxX * 0.5 + clDriftX + driftX;
          const ny = n.y + st.parallaxY * 0.5 + clDriftY + driftY;
          const act =
            n.activityBase + Math.sin(st.time * 0.15 + n.activityPhase) * 0.3;
          const activity = Math.max(0.05, Math.min(1, act));
          clusterTotalActivity += activity;

          // 灯笼（浅色主题）
          if (st.waterT > 0) {
            const waterOp = st.waterT;
            const baseAlpha = (0.2 + activity * 0.7) * waterOp * fade;
            const scale =
              n.waterRadiusBase * (0.8 + activity * 0.8) * (0.5 + fade * 0.5);
            const w = scale * 4,
              h = scale * 5.2;

            ctx.save();
            ctx.translate(nx, ny);
            const breatheSlow = Math.sin(
              st.time * n.twinkleSpeed * 1.5 + n.waterPhase,
            );
            const breathe = n.currentGlow > 0.5
              ? 0.95 // 悬停呼吸稳定
              : 0.7 + 0.3 * breatheSlow; // 默认大幅摆动
            ctx.globalAlpha = baseAlpha * breathe;
            const glowR = h * (1.0 + activity * 1.8);
            const gGlow = ctx.createRadialGradient(
              0,
              h / 2,
              0,
              0,
              h / 2,
              glowR,
            );
            gGlow.addColorStop(
              0,
              `rgba(245, 180, 80, ${0.2 + activity * 0.3})`,
            );
            gGlow.addColorStop(1, "rgba(245, 180, 80, 0)");
            ctx.fillStyle = gGlow;
            ctx.beginPath();
            ctx.arc(0, h / 2, glowR, 0, Math.PI * 2);
            ctx.fill();

            const gBody = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
            gBody.addColorStop(0, "#F5C97A");
            gBody.addColorStop(1, "#E8965A");

            ctx.save();
            ctx.translate(0, h + 3);
            ctx.scale(1, -0.4);
            ctx.globalAlpha *= 0.25;
            ctx.fillStyle = gBody;
            drawLanternPath(ctx, w, h);
            ctx.fill();
            ctx.restore();

            ctx.strokeStyle = "#C8783A";
            ctx.lineWidth = Math.max(0.8, scale * 0.3);
            ctx.beginPath();
            const tLen = h * 0.4;
            ctx.moveTo(0, h / 2);
            ctx.lineTo(0, h / 2 + tLen);
            ctx.moveTo(-w * 0.2, h / 2);
            ctx.lineTo(-w * 0.25, h / 2 + tLen * 0.8);
            ctx.moveTo(w * 0.2, h / 2);
            ctx.lineTo(w * 0.25, h / 2 + tLen * 0.8);
            ctx.stroke();
            ctx.fillStyle = gBody;
            drawLanternPath(ctx, w, h);
            ctx.fill();
            ctx.restore();
          }

          // 星星（深色主题）
          if (st.spaceT > 0) {
            const starOp = st.spaceT;
            const cr = c.color[0],
              cg = c.color[1],
              cb = c.color[2];
            const twinkleSpeed = isHovered
              ? n.twinkleSpeed * 3
              : n.twinkleSpeed;
            const twinkle = Math.sin(
              st.time * twinkleSpeed + n.twinklePhase,
            );
            // 基础亮度：不受悬停影响的 activity-based 亮度
            const baseAct = (0.1 + activity * 0.8) * fade;
            // 闪烁调制：始终可见的大幅度闪烁 (±40%)
            const twinkleMod = 0.6 + 0.4 * twinkle;
            // 用 currentGlow 在「暗闪」和「亮稳」之间渐变过渡
            const glow = n.currentGlow;
            const brightness = baseAct * ((1 - glow) * twinkleMod + glow * 0.85);

            const g2 = ctx.createRadialGradient(nx, ny, 0, nx, ny, n.r * 8);
            g2.addColorStop(
              0,
              `rgba(${cr},${cg},${cb},${0.6 * brightness * starOp})`,
            );
            g2.addColorStop(1, "transparent");
            ctx.fillStyle = g2;
            ctx.beginPath();
            ctx.arc(nx, ny, n.r * 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = `rgba(255,252,245,${1.0 * brightness * starOp})`;
            ctx.beginPath();
            ctx.arc(nx, ny, n.r, 0, Math.PI * 2);
            ctx.fill();

            if (activity > 0.4) {
              const flare = Math.sin(st.time * n.flareSpeed + n.flarePhase);
              const spikeAlpha =
                (0.05 + flare * 0.05) * starOp * activity * fade;
              const spikeLen = n.r * (3 + flare * 2 + activity * 4);
              ctx.strokeStyle = `rgba(${cr},${cg},${cb},${spikeAlpha})`;
              ctx.lineWidth = 0.5;
              ctx.beginPath();
              ctx.moveTo(nx - spikeLen, ny);
              ctx.lineTo(nx + spikeLen, ny);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(nx, ny - spikeLen);
              ctx.lineTo(nx, ny + spikeLen);
              ctx.stroke();
            }
          }

          // 余烬（篝火主题）
          if (st.fireT > 0) {
            const fireOp = st.fireT;
            const cr = 242,
              cg = 109,
              cb = 33;
            const flicker = Math.sin(
              st.time * n.twinkleSpeed * 2 + n.twinklePhase,
            );
            const flickerMod = n.currentGlow > 0.5
              ? 0.95 // 悬停稳定
              : 0.5 + 0.5 * flicker; // 默认大幅噼啪
            const brightness =
              (0.3 + activity * 0.7) * fade * flickerMod;

            // 余烬照亮的隐约树洞阴影
            const holeR = n.r * 5;
            const holeGlow = ctx.createRadialGradient(
              nx - holeR * 0.3,
              ny,
              holeR * 0.1,
              nx - holeR * 0.3,
              ny,
              holeR * 1.5,
            );
            holeGlow.addColorStop(0, `rgba(5, 3, 2, ${0.2 * fireOp * fade})`);
            holeGlow.addColorStop(
              0.6,
              `rgba(40, 20, 10, ${0.1 * brightness * fireOp})`,
            );
            holeGlow.addColorStop(1, "transparent");

            ctx.fillStyle = holeGlow;
            ctx.beginPath();
            ctx.arc(nx - holeR * 0.3, ny, holeR * 1.5, 0, Math.PI * 2);
            ctx.fill();

            const g2 = ctx.createRadialGradient(nx, ny, 0, nx, ny, n.r * 6);
            g2.addColorStop(
              0,
              `rgba(${cr},${cg},${cb},${0.6 * brightness * fireOp})`,
            );
            g2.addColorStop(1, "transparent");
            ctx.fillStyle = g2;
            ctx.beginPath();
            ctx.arc(nx, ny, n.r * 6, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = `rgba(255,200,100,${0.9 * brightness * fireOp})`;
            ctx.beginPath();
            ctx.arc(nx, ny, Math.max(1, n.r * 1.5), 0, Math.PI * 2);
            ctx.fill();
          }
        });

        // 标签可见性
        if (c.fadeIn < 0.9) return;
        const label = st.labelEls[c.id];
        if (label) {
          if (driftMul > 0)
            label.style.transform = `translate(${clDriftX}px, ${clDriftY}px)`;
          else label.style.transform = "translate(0, 0)";
          const avgActivity = clusterTotalActivity / c.nodes.length;

          if (st.isMobile) {
            // 移动端始终显示所有星座标签——悬停跟踪不可靠
            if (st.greetingDone && !st.anyScreenOpen) {
              label.classList.add("visible");
            } else {
              label.classList.remove("visible");
            }
          } else {
            const shouldBeVisible = isHovered || avgActivity > 0.65;

            if (shouldBeVisible) {
              if (
                isHovered &&
                !label.classList.contains("visible") &&
                !st.isTransitioning &&
                st.greetingDone &&
                !st.anyScreenOpen
              ) {
                audio.playHover();
              }
              label.classList.add("visible");
            } else {
              label.classList.remove("visible");
            }
          }
        }
      });

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [treeholesData]);

  // ── 主题辅助函数 ──
  const applyTheme = useCallback((tIdx: number, playSound = false) => {
    stateRef.current.themeIdx = tIdx;
    setThemeIdx(tIdx);
    document.documentElement.classList.remove("light-theme", "campfire-theme");
    if (tIdx === 1) document.documentElement.classList.add("light-theme");
    if (tIdx === 2) document.documentElement.classList.add("campfire-theme");
    audio.setTheme(tIdx);
    if (playSound) audio.playThemeToggle();
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = (stateRef.current.themeIdx + 1) % 3;
    userManuallySwitchedRef.current = true;
    applyTheme(newTheme, true);
  }, [applyTheme]);

  // ── 字体切换 ──
  const toggleFont = useCallback(() => {
    // 以 DOM class 为真实来源，消除 React state 闭包滞后导致的竞态
    const hasEnglish = document.documentElement.classList.contains("font-english");
    const newFont = !hasEnglish;
    setIsEnglishMode(newFont);
    document.documentElement.classList.toggle("font-english", newFont);
    try {
      localStorage.setItem("langPref", newFont ? "en" : "zh");
    } catch {}

    // 清空当前单分类流的 cache，防止中英文混杂
    setPostCache([]);
    setCurrentPost(null);

    // 终止正在进行的单分类预加载
    if (preloadControllerRef.current) {
      preloadControllerRef.current.abort();
    }

    // 如果当前正打开阅读屏幕，需要立即重新加载新语言下的第一个故事
    if (readingVisible && currentCategoryName) {
      const isRecommend =
        currentCategoryName === "为你推荐" ||
        currentCategoryName === "Recommended" ||
        currentCategoryName === tCategory("为你推荐", true);

      if (isRecommend) {
        setLoadingPost(true);
        recommendations
          .list({ limit: 15, language: newFont ? "en" : "zh" })
          .then((res) => {
            if (res.posts.length > 0) {
              setCurrentPost(res.posts[0]);
              setPostCache(res.posts.slice(1));
            }
            setLoadingPost(false);
          })
          .catch(() => setLoadingPost(false));
      } else {
        // 如果有该分类在新语言下的预加载缓存，优先直接秒开
        const targetLang = newFont ? "en" : "zh";
        const cached = prefetchedPostsRef.current[currentCategoryName]?.[targetLang] || [];
        if (cached.length > 0) {
          const randomPost = cached[Math.floor(Math.random() * cached.length)];
          setCurrentPost(randomPost);
          setPostCache(cached.filter((p) => p.id !== randomPost.id));
        } else {
          // 没有缓存则走降级网络请求
          setLoadingPost(true);
          postsApi
            .list({ tag: currentCategoryName, page: 1, language: targetLang })
            .then((res) => {
              if (res.posts.length > 0) {
                const randomPost =
                  res.posts[Math.floor(Math.random() * res.posts.length)];
                setCurrentPost(randomPost);
                setPostCache(res.posts.filter((p) => p.id !== randomPost.id));
              }
              setLoadingPost(false);
            })
            .catch(() => setLoadingPost(false));
        }
      }
    }
  }, [
    // isEnglishMode 不再作为依赖 — DOM class 是真实来源
    readingVisible,
    currentCategoryName,
  ]);

  // ── 关闭所有屏幕 ──
  const closeAllScreens = useCallback(() => {
    if (readingVisible) {
      audio.playCloseReading();
    }
    setReadingVisible(false);
    setComposeVisible(false);
    setProfileVisible(false);
    setSettingsVisible(false);
    stateRef.current.isTransitioning = false;
    stateRef.current.transitionTarget = null;
    // 关闭屏幕后重新开启空闲计时（已进入过树洞则不再弹）
    startIdleTimer();
  }, [readingVisible, startIdleTimer]);

  // ── 画布点击 → 打开阅读 ──
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      const st = stateRef.current;
      if (st.isTransitioning || !st.greetingDone) return;
      const mx = e.clientX,
        my = e.clientY;

      for (const c of st.clusters) {
        if (c.fadeIn < 0.9) continue;
        let clCenterX = 0,
          clCenterY = 0;
        const driftMul = st.waterT + st.fireT * 0.5;
        const clDriftX =
          driftMul > 0
            ? Math.sin(st.time * 0.2 + c.driftPhaseX) * 20 * driftMul
            : 0;
        const clDriftY =
          driftMul > 0
            ? Math.cos(st.time * 0.15 + c.driftPhaseY) * 10 * driftMul
            : 0;
        c.nodes.forEach((n) => {
          clCenterX += n.x;
          clCenterY += n.y;
        });
        clCenterX = clCenterX / c.nodes.length + st.parallaxX * 0.5 + clDriftX;
        clCenterY = clCenterY / c.nodes.length + st.parallaxY * 0.5 + clDriftY;

        for (const n of c.nodes) {
          const nodeDriftMul = st.waterT + st.fireT * 0.5;
          const driftX =
            nodeDriftMul > 0
              ? Math.sin(st.time * n.waterSpeedX * 2 + n.waterPhase) *
                12 *
                nodeDriftMul
              : 0;
          const driftY =
            nodeDriftMul > 0
              ? Math.cos(st.time * n.waterSpeedY + n.waterPhase) *
                6 *
                nodeDriftMul
              : 0;
          const nx = n.x + st.parallaxX * 0.5 + clDriftX + driftX;
          const ny = n.y + st.parallaxY * 0.5 + clDriftY + driftY;
          const act =
            n.activityBase + Math.sin(st.time * 0.15 + n.activityPhase) * 0.3;
          const activity = Math.max(0.05, Math.min(1, act));
          const hitR = (n.waterRadiusBase || n.r) * (st.isMobile ? 30 : 15) * (0.8 + activity);

          if (Math.hypot(mx - nx, my - ny) < Math.max(30, hitR)) {
            // 触发过渡
            st.isTransitioning = true;
            audio.playClick();
            st.transitionTarget = { x: clCenterX, y: clCenterY };

            const glow = document.createElement("div");
            glow.className = "expanding-glow";
            glow.style.left = clCenterX + "px";
            glow.style.top = clCenterY + "px";
            if (st.themeIdx === 1) {
              glow.style.background =
                "radial-gradient(circle, rgba(245,180,80,1) 0%, transparent 80%)";
              glow.style.mixBlendMode = "normal";
            } else if (st.themeIdx === 2) {
              glow.style.background =
                "radial-gradient(circle, rgba(242,109,33,1) 0%, transparent 80%)";
              glow.style.mixBlendMode = "normal";
            } else {
              glow.style.background = `radial-gradient(circle, rgba(${c.color.join(",")},1) 0%, transparent 80%)`;
              glow.style.mixBlendMode = "screen";
            }
            document.body.appendChild(glow);
            void glow.offsetWidth;
            glow.classList.add("active");

            // 清空缓存 + 加载中
            clearIdleTimer(); // 进入树洞时清除提示
            setCurrentCategoryName(c.name);
            setCurrentClusterColor(c.color);

            // 检查是否有该分类的预加载内容 (按当前语言选择)
            const targetLang = isEnglishMode ? "en" : "zh";
            const prefetched = prefetchedPostsRef.current[c.tag]?.[targetLang] || [];
            if (prefetched.length > 0) {
              // 秒开：直接从缓存中选一个故事
              const randomPost = prefetched[Math.floor(Math.random() * prefetched.length)];
              setCurrentPost(randomPost);
              const others = prefetched.filter((p) => p.id !== randomPost.id);
              setPostCache(others);
              setLoadingPost(false); // 无需 loading 状态

              // 在后台默默刷新缓存 (同时刷新中英文)
              postsApi.list({ tag: c.tag, page: 1, language: "zh" })
                .then((res) => {
                  if (res.posts && res.posts.length > 0) {
                    prefetchedPostsRef.current[c.tag] = {
                      ...(prefetchedPostsRef.current[c.tag] || { zh: [], en: [] }),
                      zh: res.posts,
                    };
                  }
                })
                .catch(() => {});
              postsApi.list({ tag: c.tag, page: 1, language: "en" })
                .then((res) => {
                  if (res.posts && res.posts.length > 0) {
                    prefetchedPostsRef.current[c.tag] = {
                      ...(prefetchedPostsRef.current[c.tag] || { zh: [], en: [] }),
                      en: res.posts,
                    };
                  }
                })
                .catch(() => {});
            } else {
              // 降级：无缓存，显示正在寻找故事的等待框
              setPostCache([]);
              setCurrentPost(null);
              setLoadingPost(true);

              postsApi.list({ tag: c.tag, page: 1, language: targetLang })
                .then((res) => {
                  if (res.posts.length > 0) {
                    const randomPost =
                      res.posts[Math.floor(Math.random() * res.posts.length)];
                    setCurrentPost(randomPost);
                    const others = res.posts.filter((p) => p.id !== randomPost.id);
                    if (others.length > 0) {
                      setPostCache((prev) => {
                        const ids = new Set(prev.map((p) => p.id));
                        const fresh = others.filter((p) => !ids.has(p.id));
                        return [...prev, ...fresh].slice(0, 5);
                      });
                    }
                    setTimeout(() => preloadPosts(c.tag, 5), 500);
                  }
                  setLoadingPost(false);
                })
                .catch(() => {
                  setLoadingPost(false);
                });

              // 同时在后台异步加载中英文以填充缓存
              postsApi.list({ tag: c.tag, page: 1, language: "zh" })
                .then((res) => {
                  if (res.posts && res.posts.length > 0) {
                    prefetchedPostsRef.current[c.tag] = {
                      ...(prefetchedPostsRef.current[c.tag] || { zh: [], en: [] }),
                      zh: res.posts,
                    };
                  }
                })
                .catch(() => {});
              postsApi.list({ tag: c.tag, page: 1, language: "en" })
                .then((res) => {
                  if (res.posts && res.posts.length > 0) {
                    prefetchedPostsRef.current[c.tag] = {
                      ...(prefetchedPostsRef.current[c.tag] || { zh: [], en: [] }),
                      en: res.posts,
                    };
                  }
                })
                .catch(() => {});
            }

            // 动画 1.2s 后先打开阅读屏幕
            setTimeout(() => {
              closeAllScreens();
              setReadingVisible(true);
              setTimeout(() => {
                glow.style.opacity = "0";
                setTimeout(() => glow.remove(), 1500);
              }, 500);
            }, 1200);
            return;
          }
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [closeAllScreens, isEnglishMode],
  );

  // ── 打开撰写 ──
  const openCompose = useCallback(() => {
    closeAllScreens();
    setComposeVisible(true);
  }, [closeAllScreens]);

  // ── 打开个人主页 ──
  const openProfile = useCallback(() => {
    closeAllScreens();
    setProfileVisible(true);
    if (currentUser) {
      users
        .me()
        .then((res) => {
          setCurrentUser((prev) => (prev ? { ...prev, ...res.user } : prev));
        })
        .catch(() => {});
      postsApi
        .list({ userId: currentUser.id, page: 1 })
        .then((res) => {
          setProfilePosts(res.posts);
        })
        .catch(() => {});
    } else {
      setProfilePosts([]);
    }
  }, [closeAllScreens, currentUser]);

  // ── 登录处理 ──
  const handleAuth = useCallback(async () => {
    setAuthError("");
    if (!authEmail.trim()) {
      setAuthError(t("请输入邮箱", "Please enter email"));
      return;
    }
    if (!authPassword.trim()) {
      setAuthError(t("请输入密码", "Please enter password"));
      return;
    }
    if (authMode === "register" && !registerAgreed) {
      setAuthError(
        t(
          "请先同意用户协议与隐私政策",
          "Please agree to the Terms and Privacy Policy",
        ),
      );
      return;
    }
    try {
      if (authMode === "login") {
        const res = await auth.login(authEmail, authPassword);
        setCurrentUser(res.user);
        setShowAuth(false);
        setAuthEmail("");
        setAuthPassword("");
      } else {
        const res = await auth.register({
          email: authEmail,
          password: authPassword,
          inviteCode: authInviteCode,
        });
        setCurrentUser(res.user);
        if (res.inviteCode) {
          setRegistrationInviteCode(res.inviteCode);
        } else {
          setShowAuth(false);
        }
        setAuthEmail("");
        setAuthPassword("");
        setAuthInviteCode("");
        setRegisterAgreed(false);
      }
    } catch (e: unknown) {
      setAuthError(
        e instanceof Error
          ? e.message
          : t(t("操作失败", "Operation failed"), "Operation failed"),
      );
    }
  }, [authMode, authEmail, authPassword, authInviteCode, registerAgreed, t]);

  // ── 找回密码 ──
  const handleResetPassword = useCallback(async () => {
    setResetError("");
    setResetSuccess(false);
    if (!resetEmail.trim()) {
      setResetError(t("请输入邮箱", "Please enter email"));
      return;
    }
    if (!resetInviteCode.trim()) {
      setResetError(t("请输入邀请码", "Please enter invite code"));
      return;
    }
    if (!resetNewPassword.trim()) {
      setResetError(t("请输入新密码", "Please enter new password"));
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setResetError(t("两次密码不一致", "Passwords do not match"));
      return;
    }
    try {
      await auth.resetPassword({
        email: resetEmail,
        inviteCode: resetInviteCode,
        newPassword: resetNewPassword,
      });
      setResetSuccess(true);
      setResetError("");
      // Auto switch to login after 2s
      setTimeout(() => {
        setShowResetPassword(false);
        setAuthMode("login");
        setResetEmail("");
        setResetInviteCode("");
        setResetNewPassword("");
        setResetConfirmPassword("");
        setResetSuccess(false);
        setAuthError("");
      }, 2000);
    } catch (e: unknown) {
      setResetError(
        e instanceof Error
          ? e.message
          : t("操作失败", "Operation failed"),
      );
    }
  }, [resetEmail, resetInviteCode, resetNewPassword, resetConfirmPassword, t]);

  // ── 提交撰写 ──
  const handleComposeSubmit = useCallback(() => {
    if (!composeText.trim()) return;
    // 从内容中提取 #标签
    const tagMatches = composeText.match(/#(\S+)/g);
    const tags = tagMatches ? tagMatches.map((t) => t.slice(1)) : undefined;
    const text = composeText.trim();

    // 立即播放动画（不阻塞），2.6s 后关闭 compose
    audio.playSend();
    setSinkActive(true);
    setTimeout(() => {
      setSinkActive(false);
      setComposeText("");
      closeAllScreens();
    }, 2600);

    // 后台异步提交
    postsApi.create({ content: text, tags })
      .then((res) => {
        if (res.guestHint) {
          showToast(res.guestHint, "warn");
        }
        if (tags) {
          tags.forEach((tag) => {
            delete prefetchedPostsRef.current[tag];
          });
        }
      })
      .catch((e: unknown) => {
        const msg =
          e instanceof Error
            ? e.message
            : t(t("发布失败", "Post failed"), "Post failed");
        const isViolation = msg.includes("违规") || msg.includes("封禁");
        showToast(msg, isViolation ? "error" : "info");
      });
  }, [composeText, closeAllScreens, showToast, t]);

  // ── 共感（我也是）──
  const handleEmpathy = useCallback(() => {
    if (!currentPost) return;
    const prevPost = currentPost;

    if (currentPost.userHasMetoed) {
      // 即时取消共感
      setCurrentPost({
        ...prevPost,
        metooCount: Math.max(0, prevPost.metooCount - 1),
        userHasMetoed: false,
      });
      postInteractions.unmetoo(currentPost.id)
        .then((res) => {
          setCurrentPost((prev) =>
            prev ? { ...prev, metooCount: res.count, userHasMetoed: false } : prev,
          );
        })
        .catch((e: unknown) => {
          // 回滚
          setCurrentPost(prevPost);
          const msg = e instanceof Error ? e.message : "操作失敗";
          if (
            msg.includes("请先登录") ||
            msg.includes("Unauthorized") ||
            msg.includes("401")
          ) {
            setShowAuth(true);
          } else {
            showToast(msg, "error");
          }
        });
    } else {
      audio.playMeToo();
      // 即时共感
      setCurrentPost({
        ...prevPost,
        metooCount: prevPost.metooCount + 1,
        userHasMetoed: true,
      });
      postInteractions.metoo(currentPost.id)
        .then((res) => {
          setCurrentPost((prev) =>
            prev ? { ...prev, metooCount: res.count, userHasMetoed: true } : prev,
          );
        })
        .catch((e: unknown) => {
          // 回滚
          setCurrentPost(prevPost);
          const msg = e instanceof Error ? e.message : "操作失敗";
          if (
            msg.includes("请先登录") ||
            msg.includes("Unauthorized") ||
            msg.includes("401")
          ) {
            setShowAuth(true);
          } else {
            showToast(msg, "error");
          }
        });
    }
  }, [currentPost, showToast]);

  // ── 预加载故事到缓存 ──
  const preloadPosts = useCallback(
    (tag: string, count: number) => {
      if (!tag) return;
      if (preloadControllerRef.current) {
        preloadControllerRef.current.abort();
      }
      const controller = new AbortController();
      preloadControllerRef.current = controller;
      preloadingTagRef.current = tag;
      postsApi
        .list({ tag, page: 1, language: isEnglishMode ? "en" : "zh" })
        .then((res) => {
          if (controller.signal.aborted) return;
          // 洗牌 + 取前 count 条
          const shuffled = [...res.posts].sort(() => Math.random() - 0.5);
          setPostCache((prev) => {
            const ids = new Set(prev.map((p) => p.id));
            const fresh = shuffled.filter((p) => !ids.has(p.id));
            return [...prev, ...fresh].slice(0, count);
          });
        })
        .catch(() => {});
    },
    [isEnglishMode],
  );

  // ── 下一个故事 ──
  const handleNextStory = useCallback(() => {
    if (!currentCategoryName) return;
    // 从缓存里取下一个
    if (postCache.length > 0) {
      const [next, ...rest] = postCache;
      setPostCache(rest);
      setCurrentPost(next);
      // 尝试补充缓存
      if (rest.length < 3) {
        preloadPosts(currentCategoryName, 5);
      }
      return;
    }
    // 缓存用完了，fallback 到 API
    postsApi.list({ tag: currentCategoryName, page: 1, language: isEnglishMode ? "en" : "zh" }).then((res) => {
      if (res.posts.length > 0) {
        const randomPost =
          res.posts[Math.floor(Math.random() * res.posts.length)];
        setCurrentPost(randomPost);
      }
    }).catch(() => {});
  }, [currentCategoryName, postCache, preloadPosts, isEnglishMode]);

  // ── 推荐流 ──
  const _handleRecommend = useCallback(
    (categoryId?: number) => {
      setLoadingPost(true);
      closeAllScreens();
      setReadingVisible(true);
      setCurrentCategoryName(
        categoryId ? "" : t("为你推荐", "Recommended"),
      );

      recommendations
        .list({ limit: 15, categoryId, language: isEnglishMode ? "en" : "zh" })
        .then((res) => {
          if (res.posts.length > 0) {
            const first = res.posts[0];
            const rest = res.posts.slice(1);
            setCurrentPost(first);
            setPostCache(rest);
          }
          setLoadingPost(false);
        })
        .catch(() => {
          setLoadingPost(false);
        });
    },
    [closeAllScreens, t, isEnglishMode],
  );

  // ── 退出登录 ──
  const handleLogout = useCallback(async () => {
    try {
      await auth.logout();
      setCurrentUser(null);
      closeAllScreens();
    } catch {}
  }, [closeAllScreens]);

  // ── 提交反馈 ──
  const handleFeedbackSubmit = useCallback(async () => {
    if (!feedbackRating || !feedbackText.trim()) return;
    try {
      await feedbackApi.submit({
        rating: feedbackRating,
        content: feedbackText.trim(),
      });
      setFeedbackSent(true);
      setTimeout(() => {
        setFeedbackSent(false);
        setFeedbackRating("");
        setFeedbackText("");
      }, 2000);
    } catch (e: unknown) {
      showToast(
        e instanceof Error
          ? e.message
          : t(t("提交失败", "Submit failed"), "Submit failed"),
        "error",
      );
    }
  }, [feedbackRating, feedbackText, showToast, t]);

  // ── 删除动态 ──
  const handleDeletePost = useCallback(
    (postId: number) => {
      if (
        !confirm(
          t(
            t(
              "确定要删除这条动态吗？",
              "Are you sure you want to delete this moment?",
            ),
            "Are you sure you want to delete this moment?",
          ),
        )
      )
        return;
      // 保存被删的 post 用于回滚
      const removedPost = profilePosts.find((p) => p.id === postId);
      // 立即从列表移除
      setProfilePosts((prev) => prev.filter((p) => p.id !== postId));
      showToast(t("已删除", "Deleted"), "info");
      // 后台异步删除
      postsApi.delete(postId)
        .catch((e: unknown) => {
          // 回滚
          if (removedPost) {
            setProfilePosts((prev) => [removedPost, ...prev]);
          }
          showToast(
            e instanceof Error
              ? e.message
              : t(t("删除失败", "Delete failed"), "Delete failed"),
            "error",
          );
        });
    },
    [profilePosts, showToast, t],
  );

  const anyScreenOpen =
    readingVisible || composeVisible || profileVisible || settingsVisible;

  useEffect(() => {
    stateRef.current.anyScreenOpen = anyScreenOpen;
    if (anyScreenOpen) {
      clearIdleTimer();
    }
  }, [anyScreenOpen, clearIdleTimer]);

  useEffect(() => {
    stateRef.current.isEnglishMode = isEnglishMode;
    // 更新现有标签
    Object.keys(stateRef.current.labelEls).forEach((id) => {
      const el = stateRef.current.labelEls[id];
      if (el) {
        el.textContent = tCategory(id, isEnglishMode);
      }
    });
  }, [isEnglishMode]);

  return (
    <>
      <div className="app" ref={appRef} id="app">
        <div
          id="campsite-bg-container"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 0,
            opacity: themeIdx === 2 ? 1 : 0,
            transition: "opacity 2s ease",
            pointerEvents: "none",
          }}
        >
          <svg
            viewBox="-80 -80 160 160"
            width="240"
            height="240"
            style={{ overflow: "visible" }}
          >
            <g fill="none" strokeLinejoin="round">
              {/* Tree Trunk behind the fire */}
              <path
                d="M -75 80 Q -65 -20 -50 -80 L 50 -80 Q 65 -20 75 80 Z"
                fill="#1f1217"
                opacity="0.85"
              />
              {/* Tree Hole (Arch) with warm glow */}
              <path
                d="M -30 80 L -30 15 Q -30 -25 0 -25 Q 30 -25 30 15 L 30 80 Z"
                fill="#050304"
                stroke="#1a0e12"
                strokeWidth="2"
                opacity="0.65"
              />
              <path
                d="M -25 80 L -25 20 Q -25 -15 0 -15 Q 25 -15 25 20 L 25 80 Z"
                fill="#1f0f08"
                opacity="0.5"
              />
              {/* Bark texture */}
              <path
                d="M -40 80 Q -35 0 -30 -80 M 40 80 Q 35 0 30 -80 M -15 -80 L -15 -35 M 15 -80 L 15 -35"
                stroke="#2a1921"
                strokeWidth="1.5"
              />

              {/* Dynamic Tent on the right */}
              <g
                className="tent-group"
                style={{ transformOrigin: "60px 30px" }}
              >
                {/* Back flap */}
                <path d="M 40 35 L 55 5 L 80 35 Z" fill="#1c1110" />

                {/* Main canopy */}
                <path
                  className="tent-fabric"
                  d="M 35 35 Q 45 20 55 5 Q 65 20 85 35 Q 60 40 35 35 Z"
                  fill="#36211c"
                  stroke="#2a1510"
                  strokeWidth="1"
                  style={{ transformOrigin: "60px 30px" }}
                />

                {/* Tent Opening (Flaps folded back) */}
                <path
                  className="tent-flap-left"
                  d="M 55 5 Q 48 20 45 35 L 55 35 Z"
                  fill="#4a2e26"
                />
                <path
                  className="tent-flap-right"
                  d="M 55 5 Q 62 20 65 35 L 55 35 Z"
                  fill="#3e231b"
                />

                {/* Glowing interior */}
                <path
                  d="M 55 8 L 47 35 Q 55 37 63 35 Z"
                  fill="#d97a29"
                  opacity="0.3"
                />

                {/* Pegs & Ropes */}
                <line
                  x1="55"
                  y1="5"
                  x2="30"
                  y2="40"
                  stroke="#1a110e"
                  strokeWidth="0.5"
                />
                <line
                  x1="55"
                  y1="5"
                  x2="90"
                  y2="40"
                  stroke="#1a110e"
                  strokeWidth="0.5"
                />
              </g>
            </g>
          </svg>
        </div>

        <div
          id="canvas-container"
          style={{ pointerEvents: anyScreenOpen ? "none" : "auto" }}
        >
          <canvas id="mainCanvas" ref={canvasRef} onClick={handleCanvasClick} />
        </div>

        {/* Boat (light theme) */}
        <div id="boat-container">
          <div className="boat-ripple" />
          <div className="boat">
            <svg
              viewBox="-20 -12 40 24"
              width="80"
              height="48"
              style={{ overflow: "visible" }}
            >
              <g
                stroke="rgba(140, 150, 165, 0.8)"
                strokeWidth="1.2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <g
                  transform="translate(0, 5) scale(1, -0.3)"
                  stroke="rgba(140, 150, 165, 0.25)"
                >
                  <path d="M-16 -2 L16 -2 L10 4 L-10 4 Z" />
                  <path d="M-8 -2 L8 -2" />
                </g>
                <path d="M-16 -2 L16 -2 L10 4 L-10 4 Z" />
                <path d="M-8 -2 L8 -2" />
                <path d="M2 -2 L6 -8" />
              </g>
            </svg>
          </div>
        </div>

        {/* Capsule (dark theme) */}
        <div id="capsule-container">
          <div className="capsule">
            <svg
              viewBox="-30 -30 60 60"
              width="60"
              height="60"
              style={{ overflow: "visible" }}
            >
              <defs>
                <linearGradient id="capsuleBody" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(30, 40, 60, 0.9)" />
                  <stop offset="100%" stopColor="rgba(10, 15, 25, 0.9)" />
                </linearGradient>
              </defs>
              <circle cx="0" cy="-2" r="22" fill="rgba(180, 200, 255, 0.05)" />
              <path
                className="capsule-exhaust"
                d="M-5 14 L0 28 L5 14 Z"
                fill="rgba(120, 200, 255, 0.5)"
                filter="blur(2px)"
              />
              <rect
                x="-8"
                y="-14"
                width="16"
                height="28"
                rx="8"
                fill="url(#capsuleBody)"
                stroke="rgba(180, 200, 230, 0.7)"
                strokeWidth="1.5"
              />
              <circle cx="0" cy="-5" r="4.5" fill="rgba(220, 240, 255, 0.95)" />
              <path
                d="M-8 -1 L-14 2 M8 -1 L14 2"
                stroke="rgba(180, 200, 230, 0.5)"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              <path
                d="M-4 6 L4 6"
                stroke="rgba(180, 200, 230, 0.4)"
                strokeWidth="1"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Campfire (campfire theme) */}
        <div id="fire-container">
          <div className="fire-glow" />
          <div className="fire">
            <svg
              viewBox="-20 -20 40 40"
              width="60"
              height="60"
              style={{ overflow: "visible" }}
            >
              <g fill="none" strokeLinecap="round" strokeLinejoin="round">
                {/* Logs */}
                <path d="M-12 10 L8 2" stroke="#4a3022" strokeWidth="4" />
                <path d="M12 10 L-8 2" stroke="#3a2216" strokeWidth="4" />
                {/* Flames */}
                <path
                  d="M-2 4 Q -10 -6 -4 -16 Q 0 -6 2 4 Z"
                  fill="rgba(242, 109, 33, 0.9)"
                />
                <path
                  d="M2 5 Q 8 -2 5 -12 Q -2 -2 2 5 Z"
                  fill="rgba(255, 166, 0, 0.9)"
                />
                <path
                  d="M-5 6 Q -12 0 -8 -8 Q -2 0 -5 6 Z"
                  fill="rgba(242, 109, 33, 0.8)"
                />
                {/* Inner bright flame */}
                <path
                  d="M-1 5 Q -5 -2 -2 -8 Q 2 -2 -1 5 Z"
                  fill="rgba(255, 230, 150, 0.9)"
                />
                {/* Sparks */}
                <circle cx="-6" cy="-14" r="0.8" fill="#ffcc00" />
                <circle cx="4" cy="-18" r="0.6" fill="#ffaa00" />
                <circle cx="8" cy="-10" r="0.5" fill="#ff8800" />
              </g>
            </svg>
          </div>
        </div>

        <div className="grain" />
        <div className="vignette" />

        {/* ════ MAIN VIEW ════ */}
        <div className="ui-layer" id="mainView">
          <div className="top-bar">
            <div className="top-left">
              <div className="app-wordmark">Lumin</div>
              <button
                className="theme-toggle"
                onClick={toggleTheme}
                aria-label="Toggle theme"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {themeIdx === 0 ? (
                    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                  ) : themeIdx === 1 ? (
                    <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  ) : (
                    <path d="M17.5 19c-1.5 0-2.5-1-3-2-1 1.5-2.5 2-4.5 2C7 19 5 17 5 14c0-3 3-5 5-8 0 2 1.5 3.5 3 3.5 1.5 0 3-1.5 3-3.5 2 3 5 5 5 8 0 3-2 5-3.5 5z" />
                  )}
                </svg>
                <span>
                  {themeIdx === 0
                    ? t("星空", "Space")
                    : themeIdx === 1
                      ? t("水面", "Water")
                      : t("篝火", "Campfire")}
                </span>
              </button>
            </div>
            <nav className="top-nav">
              <button
                className={`sound-indicator ${isMuted ? "muted" : "playing"}`}
                onClick={() => {
                  const muted = audio.toggleMute();
                  if (!muted) {
                    audio.setTheme(themeIdx);
                  }
                  setIsMuted(muted);
                }}
                aria-label="Toggle sound"
                title={
                  isMuted ? t("开启音效", "Unmute") : t("关闭音效", "Mute")
                }
              >
                <div className="sound-bars">
                  <div className="sound-bar" />
                  <div className="sound-bar" />
                  <div className="sound-bar" />
                </div>
              </button>
              <button className="top-nav-link active">
                <span className="hidden md:inline">{t("广场", "Square")}</span>
                <span className="inline md:hidden">{t("广场", "S")}</span>
              </button>
              <button className="top-nav-link" onClick={openCompose}>
                <span className="hidden md:inline">{t("书写", "Write")}</span>
                <span className="inline md:hidden">{t("书写", "W")}</span>
              </button>
            </nav>
            <div className="top-auth">
              {currentUser ? (
                <button className="top-auth-btn" onClick={handleLogout}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    width="16"
                    height="16"
                  >
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>{t("登出", "Logout")}</span>
                </button>
              ) : (
                <button
                  className="top-auth-btn"
                  onClick={() => {
                    setAuthMode("login");
                    setShowAuth(true);
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    width="16"
                    height="16"
                  >
                    <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                  <span>{t("登录", "Login")}</span>
                </button>
              )}
            </div>
          </div>

          {/* ── 空闲换一批提示 ── */}
          {showIdlePrompt && <button
            className="idle-prompt"
            onClick={() => { shuffleTreeholes(); setShowIdlePrompt(false); startIdleTimer(); }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              width="16"
              height="16"
            >
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            <span>
              {t(
                "没有找到归属？试试换一批",
                "Can't find your place? Try another batch",
              )}
            </span>
          </button>}

          <div
            className={`greeting ${greetingPhase === "center" ? "phase-center" : greetingPhase === "fadeout" ? "phase-fadeout" : greetingPhase === "top" || greetingPhase === "done" ? "phase-top" : ""} ${greetingPhase === "done" && anyScreenOpen ? "hidden" : ""}`}
            id="greeting"
          >
            <div className="greeting-text" id="greetMain">
              {themeIdx === 0
                ? t(
                    "心事了吗？这里有人",
                    "Is something on your mind? We are here.",
                  )
                : themeIdx === 1
                  ? t("心要飘向何方？", "Where does your heart want to drift?")
                  : t("靠近一点，这里很暖", "Come closer, it's warm here")}
            </div>
            <div className="greeting-sub" id="greetSub">
              {themeIdx === 0
                ? t("点击一颗发光的星，走进它", "Click a glowing star to enter")
                : themeIdx === 1
                  ? t(
                      "点击湖面的微光，倾听它",
                      "Click the glimmer on the lake to listen",
                    )
                  : t(
                      "点击跳动的火光，感受它",
                      "Click the dancing firelight to feel it",
                    )}
            </div>
          </div>

          <div className="bottom-bar">
            <button className="nav-item active" onClick={closeAllScreens}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 12l9-8 9 8" />
                <path d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
              </svg>
              <span>
                <span className="hidden md:inline">{t("广场", "Square")}</span>
                <span className="inline md:hidden">{t("广场", "S")}</span>
              </span>
            </button>
            <button className="nav-item" onClick={openCompose}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              <span>
                <span className="hidden md:inline">{t("书写", "Write")}</span>
                <span className="inline md:hidden">{t("书写", "W")}</span>
              </span>
            </button>
            <button className="nav-item" onClick={openProfile}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M20 21a8 8 0 10-16 0" />
              </svg>
              <span>{t("我", "Me")}</span>
            </button>
          </div>
        </div>

        {/* ════ READING SCREEN ════ */}
        <div
          className={`screen ${readingVisible ? "visible" : ""}`}
          id="screen-reading"
        >
          <div
            className="warm-glow"
            id="warmGlow"
            style={
              themeIdx !== 1 && currentClusterColor
                ? {
                    background: `radial-gradient(ellipse at 50% 50%, rgba(${currentClusterColor.join(",")},0.15) 0%, transparent 60%)`,
                  }
                : undefined
            }
          />
          <div className="empathy-msg" id="empathyMsg">
            {t("你不是一个人。", "You are not alone.")}
          </div>
          <button
            className="screen-close"
            onClick={closeAllScreens}
            aria-label="Close"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <div className="reading-layout">
            <div className="reading-content">
              <button
                className="reading-back"
                onClick={closeAllScreens}
                aria-label="Back"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 6l-6 6 6 6" />
                </svg>{" "}
                {t("返回", "Back")}
              </button>
              <div className="reading-category" id="readingCategory">
                {tCategory(currentCategoryName, isEnglishMode)}
              </div>
              <div className="reading-text" id="readingText">
                {currentPost ? (
                  <p>{currentPost.content}</p>
                ) : loadingPost ? (
                  <p style={{ opacity: 0.6, textAlign: "center" }}>
                    <span style={{ display: "inline-block", animation: "pulse 1.2s ease-in-out infinite" }}>
                      {t("正在寻找故事...", "Searching for stories...")}
                    </span>
                  </p>
                ) : (
                  <p style={{ opacity: 0.5, fontStyle: "italic" }}>
                    {t(
                      "这个分类还没有故事，来写第一个吧。",
                      "No stories in this category yet. Write the first one.",
                    )}
                  </p>
                )}
              </div>
              {currentPost && (
                <div className="reading-time">
                  {timeAgo(currentPost.createdAt, isEnglishMode)} · {t("来自", "from ")}
                  {currentPost.nickname}
                </div>
              )}
              <div className="reading-actions">
                <div className="reading-hint">
                  {t("读完了", "Finished reading")}
                </div>
                <div className="reading-btns">
                  <button
                    className={`reading-btn ${currentPost?.userHasMetoed ? "primary" : ""}`}
                    onClick={handleEmpathy}
                  >
                    {t("我也是", "Me too")}{" "}
                    {currentPost ? `(${currentPost.metooCount})` : ""}
                  </button>
                  <div className="reading-dot" />
                  <button className="reading-btn" onClick={handleNextStory}>
                    {t("下一个故事", "Next story")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ════ COMPOSE SCREEN ════ */}
        <div
          className={`screen ${composeVisible ? "visible" : ""}`}
          id="screen-compose"
        >
          <button
            className="screen-close"
            onClick={closeAllScreens}
            aria-label="Close"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <div className="compose-layout">
            <div className="compose-header-inner">
              <button
                className="compose-back"
                onClick={closeAllScreens}
                aria-label="Back"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 6l-6 6 6 6" />
                </svg>{" "}
                返回
              </button>
              <div className="compose-category-label">
                {t("书写心事", "Write your mind")}
              </div>
            </div>
            <div className="compose-body">
              <textarea
                className="compose-textarea"
                placeholder={t(
                  "把心里的话，放在这里……",
                  "Put your heart's words here...",
                )}
                maxLength={800}
                value={composeText}
                onChange={(e) => setComposeText(e.target.value)}
              />
            </div>
            <div className="compose-footer">
              <div className="compose-char">
                <span>{composeText.length}</span> / 800
              </div>
              <button
                className="compose-send"
                disabled={composeText.trim().length === 0}
                onClick={handleComposeSubmit}
              >
                {themeIdx === 0
                  ? t("进入星辰", "Send to stars")
                  : themeIdx === 1
                    ? t("放入水面", "Release to water")
                    : t("投向篝火", "Toss into fire")}
              </button>
            </div>
          </div>
          {sinkActive && (
            <div
              id="sinkOverlay"
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 60,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(6,6,10,.95)",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "clamp(21px, 2.3vw, 30px)",
                  color: "var(--warm-white)",
                  maxWidth: 500,
                  textAlign: "center",
                  lineHeight: 2,
                  animation: "sinkTextAnim 2.2s ease forwards",
                }}
              >
                {composeText}
              </div>
              <div
                style={{
                  marginTop: 40,
                  fontFamily: "var(--font-serif)",
                  fontSize: 18,
                  fontStyle: "italic",
                  color: "var(--amber)",
                  opacity: 0.8,
                  animation: "sinkHintAnim 1.6s ease forwards",
                }}
              >
                {t("说出来了，就好。", "It's good to speak it out.")}
              </div>
            </div>
          )}
        </div>

        {/* ════ PROFILE SCREEN ════ */}
        <div
          className={`screen ${profileVisible ? "visible" : ""}`}
          id="screen-profile"
        >
          <button
            className="screen-close"
            onClick={closeAllScreens}
            aria-label="Close"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <button
            className="profile-settings-btn"
            onClick={() => {
              setProfileVisible(false);
              setSettingsVisible(true);
            }}
            aria-label="Settings"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              width="18"
              height="18"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>

          <div className="profile-layout screen-enter">
            <div className="profile-cover" style={{ position: "relative" }}>
              {currentUser?.backgroundUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentUser.backgroundUrl}
                  alt="cover"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    opacity: 0.6,
                  }}
                />
              )}
              {currentUser && (
                <div
                  style={{
                    position: "relative",
                    zIndex: 2,
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                <label
                  className="cover-hint"
                  style={{ cursor: "pointer", margin: 0 }}
                >
                  {t("点击更改背板", "Click to change cover")}
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const prevUrl = currentUser?.backgroundUrl;
                      // 立即本地预览
                      const localUrl = URL.createObjectURL(file);
                      setCurrentUser((prev) =>
                        prev ? { ...prev, backgroundUrl: localUrl } : prev,
                      );
                      // 后台异步上传
                      users.uploadBackground(file)
                        .then((res) => {
                          URL.revokeObjectURL(localUrl);
                          setCurrentUser((prev) =>
                            prev ? { ...prev, backgroundUrl: res.url } : prev,
                          );
                          showToast(t("背板已更新", "Cover updated"), "info");
                        })
                        .catch((err: unknown) => {
                          // 回滚
                          setCurrentUser((prev) =>
                            prev ? { ...prev, backgroundUrl: prevUrl } : prev,
                          );
                          const msg =
                            err instanceof Error
                              ? err.message
                              : t(
                                  t("上传失败", "Upload failed"),
                                  "Upload failed",
                                );
                          showToast(msg, "error");
                        });
                    }}
                  />
                </label>
                {currentUser?.backgroundUrl && (
                  <button
                    onClick={async () => {
                      try {
                        await users.updateMe({ backgroundUrl: null });
                        setCurrentUser((prev) =>
                          prev ? { ...prev, backgroundUrl: undefined } : prev,
                        );
                        showToast(t("背板已重置", "Cover reset"), "info");
                      } catch (err: unknown) {
                        showToast(
                          err instanceof Error
                            ? err.message
                            : t(t("重置失败", "Reset failed"), "Reset failed"),
                          "error",
                        );
                      }
                    }}
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 6,
                      padding: "4px 10px",
                      color: "var(--warm-faint)",
                      fontSize: 14,
                      cursor: "pointer",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    {t("恢复默认", "Reset")}
                  </button>
                )}
              </div>
            )}
            </div>

            <div className="profile-header">
              <div
                className="profile-avatar"
                style={{ position: "relative", cursor: currentUser ? "pointer" : "default" }}
              >
                {currentUser?.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt="avatar" />
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                )}
                {currentUser && (
                <label
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(0,0,0,0.4)",
                    borderRadius: "50%",
                    opacity: 0,
                    transition: "opacity .2s",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    width="20"
                    height="20"
                  >
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const prevUrl = currentUser?.avatarUrl;
                      // 立即本地预览
                      const localUrl = URL.createObjectURL(file);
                      setCurrentUser((prev) =>
                        prev ? { ...prev, avatarUrl: localUrl } : prev,
                      );
                      // 后台异步上传
                      users.uploadAvatar(file)
                        .then((res) => {
                          URL.revokeObjectURL(localUrl);
                          setCurrentUser((prev) =>
                            prev ? { ...prev, avatarUrl: res.url } : prev,
                          );
                          showToast(t("头像已更新", "Avatar updated"), "info");
                        })
                        .catch((err: unknown) => {
                          // 回滚
                          setCurrentUser((prev) =>
                            prev ? { ...prev, avatarUrl: prevUrl } : prev,
                          );
                          showToast(
                            err instanceof Error ? err.message : "上传失败",
                            "error",
                          );
                        });
                    }}
                  />
                </label>
                )}
              </div>
              <div className="profile-meta">
                <h2 className="profile-name">
                  {currentUser?.nickname ||
                    t(t("匿名用户", "Anonymous"), "Anonymous")}
                </h2>
                <div className="profile-tags">
                  <span className="profile-tag">
                    <i
                      className="status-dot"
                      style={{
                        background:
                          currentUser?.status === "online" ? "#4caf50" : "#888",
                        boxShadow:
                          currentUser?.status === "online"
                            ? "0 0 8px #4caf50"
                            : "none",
                      }}
                    />
                    <span>
                      {currentUser?.status === "online"
                        ? t(t("在线", "Online"), "Online")
                        : t(t("隐身", "Invisible"), "Invisible")}
                    </span>
                  </span>
                  {(currentUser as User & { zodiac?: string })?.zodiac && (
                    <span className="profile-tag">
                      {(currentUser as User & { zodiac?: string }).zodiac}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="profile-body">
              <div className="profile-tabs">
                <button className="profile-tab active">
                  {t("我的动态", "My Moments")}
                </button>
              </div>

              <div id="tab-moments" className="profile-tab-content">
                <button className="profile-add-btn" onClick={openCompose}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    width="20"
                    height="20"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  {t("记录一瞬", "Record a moment")}
                </button>
                {profilePosts.length > 0 ? (
                  profilePosts.map((post) => (
                    <div key={post.id} className="profile-post-card">
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                        }}
                      >
                        <div
                          className="reading-text profile-post-text"
                        >
                          <p>{post.content}</p>
                        </div>
                        {currentUser &&
                          post.nickname === currentUser.nickname && (
                            <button
                              onClick={() => handleDeletePost(post.id)}
                              className="post-delete-btn"
                              aria-label="Delete post"
                              style={{
                                background: "none",
                                border: "none",
                                padding: "8px",
                                color: "var(--warm-faint)",
                                opacity: 0.4,
                                cursor: "pointer",
                                transition: "all .2s",
                                marginLeft: 12,
                                marginTop: -4,
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.opacity = "1";
                                e.currentTarget.style.color = "#e57373";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.opacity = "0.4";
                                e.currentTarget.style.color =
                                  "var(--warm-faint)";
                              }}
                            >
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                width="18"
                                height="18"
                              >
                                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
                              </svg>
                            </button>
                          )}
                      </div>
                      <div className="profile-post-meta">
                        <span>
                          {post.category?.icon}{" "}
                          {tCategory(post.category?.name, isEnglishMode)}
                        </span>
                        <span>{timeAgo(post.createdAt, isEnglishMode)}</span>
                        <span>
                          {post.metooCount} {t("感同身受", "Me too")}
                        </span>
                        <span>
                          {post.commentCount} {t("回声", "Echoes")}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="profile-feed-empty">
                    {t(
                      "这里空空如也，像没有回音的山谷。",
                      "Empty here, like a valley with no echoes.",
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ════ SETTINGS SCREEN ════ */}
        <div
          className={`screen ${settingsVisible ? "visible" : ""}`}
          id="screen-settings"
        >
          <button
            className="screen-close"
            onClick={() => setSettingsVisible(false)}
            aria-label="Close"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>

          <div className="settings-layout screen-enter">
            <h2 className="settings-title">{t("设置", "Settings")}</h2>

            <div className="settings-section">
              <span className="settings-section-title">
                {t("偏好", "Preferences")}
              </span>
              <div className="settings-card">
                <div
                  className="settings-item"
                  onClick={toggleFont}
                  style={{ cursor: "pointer" }}
                >
                  <span>{t("字体模式 Font Mode", "Language & Font")}</span>
                  <div className="settings-item-val">
                    {isEnglishMode ? "English" : "中文"}{" "}
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <div className="settings-section">
              <span className="settings-section-title">
                {t("支持", "Support")}
              </span>
              <div className="settings-card">
                <div
                  className="settings-item"
                  onClick={() => setFeedbackOpen(!feedbackOpen)}
                  style={{ cursor: "pointer" }}
                >
                  <span>{t("联系与反馈", "Contact & Feedback")}</span>
                  <div className="settings-item-val">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        transform: feedbackOpen ? "rotate(90deg)" : "none",
                        transition: "transform .2s",
                      }}
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                </div>
                {feedbackOpen && (
                  <div
                    style={{
                      padding: "12px 16px",
                      borderTop: "1px solid var(--border)",
                    }}
                  >
                    {feedbackSent ? (
                      <div
                        style={{
                          textAlign: "center",
                          padding: "20px 0",
                          color: "var(--amber)",
                          fontFamily: "var(--font-serif)",
                          fontSize: 17,
                        }}
                      >
                        {t("感谢你的反馈！", "Thanks for your feedback!")}
                      </div>
                    ) : (
                      <>
                        <div
                          style={{ display: "flex", gap: 10, marginBottom: 12 }}
                        >
                          <button
                            onClick={() => setFeedbackRating("good")}
                            style={{
                              flex: 1,
                              padding: "8px 0",
                              borderRadius: 8,
                              border:
                                feedbackRating === "good"
                                  ? "1.5px solid var(--amber)"
                                  : "1px solid var(--border)",
                              background:
                                feedbackRating === "good"
                                  ? "rgba(245,180,80,0.1)"
                                  : "transparent",
                              color:
                                feedbackRating === "good"
                                  ? "var(--amber)"
                                  : "var(--warm-faint)",
                              fontFamily: "var(--font-body)",
                              fontSize: 16,
                              cursor: "pointer",
                              transition: "all .2s",
                            }}
                          >
                            {t("好评", "Good")}
                          </button>
                          <button
                            onClick={() => setFeedbackRating("bad")}
                            style={{
                              flex: 1,
                              padding: "8px 0",
                              borderRadius: 8,
                              border:
                                feedbackRating === "bad"
                                  ? "1.5px solid var(--amber)"
                                  : "1px solid var(--border)",
                              background:
                                feedbackRating === "bad"
                                  ? "rgba(245,180,80,0.1)"
                                  : "transparent",
                              color:
                                feedbackRating === "bad"
                                  ? "var(--amber)"
                                  : "var(--warm-faint)",
                              fontFamily: "var(--font-body)",
                              fontSize: 16,
                              cursor: "pointer",
                              transition: "all .2s",
                            }}
                          >
                            {t("差评", "Bad")}
                          </button>
                        </div>
                        <textarea
                          placeholder={t(
                            "写下你的建议或反馈…",
                            "Write your suggestions or feedback...",
                          )}
                          value={feedbackText}
                          onChange={(e) => setFeedbackText(e.target.value)}
                          maxLength={500}
                          style={{
                            width: "100%",
                            minHeight: 80,
                            padding: 10,
                            borderRadius: 8,
                            border: "1px solid var(--border)",
                            background: "rgba(255,255,255,0.03)",
                            color: "var(--warm-white)",
                            fontFamily: "var(--font-body)",
                            fontSize: 16,
                            resize: "vertical",
                            outline: "none",
                            boxSizing: "border-box",
                          }}
                        />
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginTop: 10,
                          }}
                        >
                          <span
                            style={{ fontSize: 14, color: "var(--warm-faint)" }}
                          >
                            {feedbackText.length} / 500
                          </span>
                          <button
                            onClick={handleFeedbackSubmit}
                            disabled={!feedbackRating || !feedbackText.trim()}
                            style={{
                              padding: "8px 20px",
                              borderRadius: 8,
                              border: "none",
                              background:
                                feedbackRating && feedbackText.trim()
                                  ? "var(--amber)"
                                  : "rgba(255,255,255,0.08)",
                              color:
                                feedbackRating && feedbackText.trim()
                                  ? "#1a1a2e"
                                  : "var(--warm-faint)",
                              fontFamily: "var(--font-body)",
                              fontSize: 16,
                              cursor:
                                feedbackRating && feedbackText.trim()
                                  ? "pointer"
                                  : "default",
                              transition: "all .2s",
                            }}
                          >
                            {t("发送", "Send")}
                          </button>
                        </div>
                        <div
                          style={{
                            marginTop: 8,
                            fontSize: 13,
                            color: "var(--warm-faint)",
                            opacity: 0.6,
                          }}
                        >
                          {t(
                            "反馈将发送至 support@yourdomain.com",
                            "Feedback will be sent to support@yourdomain.com",
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
                <div className="settings-item">
                  <span>{t("当前版本", "Version")}</span>
                  <div className="settings-item-val">v 1.0.2</div>
                </div>
              </div>
            </div>

            <div className="settings-section">
              <span className="settings-section-title">
                {t("法律", "Legal")}
              </span>
              <div className="settings-card">
                <Link className="settings-item" href="/terms">
                  <span>{t("用户协议", "Terms of Service")}</span>
                  <div className="settings-item-val">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                </Link>
                <Link className="settings-item" href="/privacy">
                  <span>{t("隐私政策", "Privacy Policy")}</span>
                  <div className="settings-item-val">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                </Link>
              </div>
            </div>

            <div className="settings-section">
              <span className="settings-section-title">
                {t("账号", "Account")}
              </span>
              <div className="settings-card">
                {currentUser ? (
                  <>
                    <div className="settings-item" onClick={handleLogout}>
                      <span>{t("退出登录", "Logout")}</span>
                    </div>
                    <div className="settings-item settings-danger">
                      <span>{t("注销账号", "Delete Account")}</span>
                    </div>
                  </>
                ) : (
                  <div
                    className="settings-item"
                    onClick={() => {
                      setSettingsVisible(false);
                      setShowAuth(true);
                    }}
                  >
                    <span>{t("登录 / 注册", "Login / Register")}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ════ AUTH MODAL ════ */}
      <div
        className={`auth-overlay ${showAuth ? "visible" : ""}`}
        onClick={() => {
          setShowAuth(false);
          setShowResetPassword(false);
          setResetSuccess(false);
          setResetError("");
          setRegistrationInviteCode(null);
        }}
      >
        <div className="auth-card" onClick={(e) => e.stopPropagation()}>
          {ENABLE_INVITE_CODE && registrationInviteCode ? (
            <>
              <div className="auth-title">
                {t("注册成功！", "Registered!")}
              </div>
              <div className="auth-invite-granted">
                <div className="auth-invite-granted-icon">✨</div>
                <div className="auth-invite-granted-text">
                  {t(
                    "你获得了一个邀请码，可以分享给朋友：",
                    "Share this invite code with a friend:",
                  )}
                </div>
                <div className="auth-invite-granted-code">
                  {registrationInviteCode}
                </div>
                <div className="auth-invite-granted-hint">
                  {t(
                    "（每个码可用 4 次）",
                    "(Each code can be used 4 times, for users with ID ≤ 3000)",
                  )}
                </div>
              </div>
              <button
                type="button"
                className="auth-btn"
                onClick={() => {
                  setShowAuth(false);
                  setRegistrationInviteCode(null);
                }}
              >
                {t("开始探索", "Start Exploring")}
              </button>
            </>
          ) : !showResetPassword ? (
            <>
              <div className="auth-title">
                {authMode === "login" ? t("登录", "Login") : t("注册", "Register")}
              </div>
              <div className="auth-error">{authError}</div>
              <input
                className="auth-input"
                type="email"
                placeholder={t("邮箱", "Email")}
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
              />
              <input
                className="auth-input"
                type="password"
                placeholder={t("密码", "Password")}
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAuth();
                }}
              />
              {ENABLE_INVITE_CODE && authMode === "register" && (
                <>
                  <input
                    className="auth-input"
                    type="text"
                    placeholder={t("邀请码", "Invite Code")}
                    value={authInviteCode}
                    onChange={(e) => setAuthInviteCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAuth();
                    }}
                  />
                  <div className="auth-invite-hint">
                    {t(
                      "嘘，目前处于限时内测阶段，凭暗号进入",
                      "Shh... limited beta, enter with a secret code",
                    )}
                  </div>
                </>
              )}
              <button type="button" className="auth-btn" onClick={handleAuth}>
                {authMode === "login" ? t("登录", "Login") : t("注册", "Register")}
              </button>
              <div className="auth-switch">
                {authMode === "login" ? (
                  <>
                    {t("还没有账号？", "No account yet?")}
                      <a
                        onClick={() => {
                          setAuthMode("register");
                          setAuthError("");
                          setRegisterAgreed(false);
                        }}
                      >
                        {t("注册", "Register")}
                      </a>
                    <div
                      className="auth-forgot"
                      onClick={() => {
                        setShowResetPassword(true);
                        setAuthError("");
                      }}
                    >
                      {t("找回账号密码", "Forgot password?")}
                    </div>
                  </>
                ) : (
                  <>
                    {t("已有账号？", "Already have an account?")}
                      <a
                        onClick={() => {
                          setAuthMode("login");
                          setAuthError("");
                          setRegisterAgreed(false);
                        }}
                      >
                        {t("登录", "Login")}
                      </a>
                  </>
                )}
                {authMode === "register" && (
                  <div className="auth-consent">
                    <label className="auth-consent-row">
                      <input
                        type="checkbox"
                        checked={registerAgreed}
                        onChange={(e) => setRegisterAgreed(e.target.checked)}
                      />
                      <span>
                        {t("我已阅读并同意", "I agree to the")}
                        <Link href="/terms">{t("用户协议", "Terms")}</Link>
                        {t("与", "and")}
                        <Link href="/privacy">{t("隐私政策", "Privacy")}</Link>
                      </span>
                    </label>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="auth-title">
                {t("找回密码", "Reset Password")}
              </div>
              <div className="auth-error">{resetError}</div>
              {resetSuccess ? (
                <div className="auth-reset-success">
                  {t("密码已重置，即将跳转登录...", "Password reset! Redirecting...")}
                </div>
              ) : (
                <>
                  <input
                    className="auth-input"
                    type="email"
                    placeholder={t("邮箱", "Email")}
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                  />
                  {ENABLE_INVITE_CODE && (
                    <input
                      className="auth-input"
                      type="text"
                      placeholder={t("邀请码", "Invite Code")}
                      value={resetInviteCode}
                      onChange={(e) => setResetInviteCode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleResetPassword();
                      }}
                    />
                  )}
                  <input
                    className="auth-input"
                    type="password"
                    placeholder={t("新密码", "New Password")}
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleResetPassword();
                    }}
                  />
                  <input
                    className="auth-input"
                    type="password"
                    placeholder={t("确认新密码", "Confirm New Password")}
                    value={resetConfirmPassword}
                    onChange={(e) => setResetConfirmPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleResetPassword();
                    }}
                  />
                  <button type="button" className="auth-btn" onClick={handleResetPassword}>
                    {t("重置密码", "Reset Password")}
                  </button>
                </>
              )}
              <div className="auth-switch">
                <a
                  onClick={() => {
                    setShowResetPassword(false);
                    setResetError("");
                    setResetSuccess(false);
                  }}
                >
                  {t("返回登录", "Back to Login")}
                </a>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ════ TOAST NOTIFICATION ════ */}
      {toast.visible && (
        <div className="toast-container">
          <div className={`toast ${toast.type} ${toast.exiting ? "exit" : ""}`}>
            {toast.type === "warn" || toast.type === "error" ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="18"
                height="18"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="18"
                height="18"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            )}
            {toast.message}
          </div>
        </div>
      )}
    </>
  );
}
