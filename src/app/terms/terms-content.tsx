"use client";

import { useEffect, useState } from "react";

const EFFECTIVE_DATE = "2026-05-12";

function isEnglishPreference(): boolean {
  if (typeof document === "undefined") return false;
  const hasEnglishClass = document.documentElement.classList.contains(
    "font-english",
  );
  if (hasEnglishClass) return true;
  try {
    return window.localStorage.getItem("langPref") === "en";
  } catch {
    return false;
  }
}

export default function TermsContent() {
  const [isEnglishMode, setIsEnglishMode] = useState(false);

  useEffect(() => {
    setIsEnglishMode(isEnglishPreference());
    const observer = new MutationObserver(() => {
      setIsEnglishMode(isEnglishPreference());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  if (isEnglishMode) {
    return (
      <main className="legal-page">
        <div className="legal-shell">
          <header className="legal-header">
            <p className="legal-eyebrow">Terms of Service</p>
            <h1>Lumin Terms of Service</h1>
            <p className="legal-sub">Effective Date: {EFFECTIVE_DATE}</p>
          </header>

          <section className="legal-section">
            <h2>1. Content Ownership and License</h2>
            <p>
              You retain ownership of your content. You grant the platform a
              limited license to use your content within product functions such
              as display, recommendation, and archiving.
            </p>
            <p>
              The recommendation system matches content based on post categories
              and interaction behavior. This use is necessary for product
              functionality and is further detailed in the Privacy Policy.
            </p>
            <p>
              The platform includes system-generated warm seed content to
              improve the new-user experience. Seed content is owned by the
              platform and is not associated with any personal user information.
            </p>
          </section>

          <section className="legal-section">
            <h2>2. Limits of Anonymity</h2>
            <p>
              We do not disclose the poster&apos;s identity to other users. We will
              comply with lawful requests from judicial or administrative
              authorities.
            </p>
          </section>

          <section className="legal-section">
            <h2>3. Prohibited Conduct and Enforcement</h2>
            <ul>
              <li>Posting illegal or unlawful content.</li>
              <li>Harassment, abuse, sexual solicitation, or inappropriate content.</li>
              <li>Impersonation or dissemination of false information.</li>
            </ul>
            <p>
              Enforcement actions are tied to the violation type and may include
              warnings, content removal, temporary suspension, or permanent ban.
              Appeals are available.
            </p>
          </section>

          <section className="legal-section">
            <h2>4. Minors</h2>
            <p>
              If you are under 14, you must use this service with guardian
              consent and guidance. We apply stricter safeguards to minors&apos;
              data.
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="legal-page">
      <div className="legal-shell">
        <header className="legal-header">
          <p className="legal-eyebrow">用户协议</p>
          <h1>Lumin 用户协议</h1>
          <p className="legal-sub">生效日期：{EFFECTIVE_DATE}</p>
        </header>

        <section className="legal-section">
          <h2>一、内容所有权与授权</h2>
          <p>
            用户发布内容的版权归用户所有。为实现产品功能（展示、推荐、归档等），
            你授予平台在必要范围内的使用许可。
          </p>
          <p>
            平台推荐系统会基于用户发布内容的分类和互动行为进行内容匹配推荐，
            该使用属于产品功能必需，已在隐私政策中详细说明。
          </p>
          <p>
            平台包含部分由系统生成的暖心种子内容，用于改善新用户体验。
            种子内容版权归平台所有，不关联任何用户个人信息。
          </p>
        </section>

        <section className="legal-section">
          <h2>二、匿名保护边界</h2>
          <p>
            平台不会主动向其他用户披露发帖者身份。该匿名保护不影响平台依法配合
            司法机关或行政执法机关的合法调查。
          </p>
        </section>

        <section className="legal-section">
          <h2>三、禁止行为与处罚</h2>
          <ul>
            <li>禁止发布违法违规内容。</li>
            <li>禁止骚扰、辱骂、性暗示或其他不当内容。</li>
            <li>禁止冒用他人身份或散布虚假信息。</li>
          </ul>
          <p>
            违规处罚与行为类型对应：警告与内容隐藏、禁言、永久封禁。
            具体处罚以平台规则与通知为准，用户可申请申诉。
          </p>
        </section>

        <section className="legal-section">
          <h2>四、未成年人条款</h2>
          <p>
            若你未满 14 周岁，请在监护人同意与指导下使用本服务。
            对未成年人数据我们将采取更严格的保护措施。
          </p>
        </section>
      </div>
    </main>
  );
}
