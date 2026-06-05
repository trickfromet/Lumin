"use client";

import { useEffect } from "react";

function getThemeByTime(): "light" | "dark" {
  const hour = new Date().getHours();
  // 6:00 - 17:59 亮色，18:00 - 5:59 暗色
  return hour >= 6 && hour < 18 ? "light" : "dark";
}

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    function applyTheme() {
      const theme = getThemeByTime();
      document.documentElement.setAttribute("data-theme", theme);
    }

    applyTheme();
    // 每分钟检查一次
    const timer = setInterval(applyTheme, 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  return <>{children}</>;
}
