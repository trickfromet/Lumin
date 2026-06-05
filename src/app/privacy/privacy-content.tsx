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

export default function PrivacyContent() {
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
            <p className="legal-eyebrow">Privacy Policy</p>
            <h1>Lumin Privacy Policy</h1>
            <p className="legal-sub">Effective Date: {EFFECTIVE_DATE}</p>
          </header>

          <section className="legal-section">
            <h2>1. Information We Collect and Why</h2>
            <p>We collect only what is necessary for functionality and safety.</p>
            <ul>
              <li>Phone number: for registration and identity compliance.</li>
              <li>Device information: for security and risk control.</li>
              <li>Post content: for publishing, display, and community features.</li>
              <li>Usage data: for recommendation and experience improvement.</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>2. Limits of Anonymity</h2>
            <p>
              Front-end displays are anonymous while the backend retains real
              identity binding. We do not disclose a poster&apos;s identity to other
              users.
            </p>
            <p>
              Identity may be linked only for lawful investigations by judicial
              or administrative authorities.
            </p>
            <p>
              Routine content reports do not reveal the poster&apos;s identity.
            </p>
          </section>

          <section className="legal-section">
            <h2>3. Storage and Security</h2>
            <ul>
              <li>Post content is stored with encryption.</li>
              <li>TLS is used for data transmission.</li>
              <li>Data is stored on servers located in mainland China.</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>4. Data Deletion After Account Cancellation</h2>
            <p>Your data will be fully deleted within 30 days after cancellation.</p>
            <p>
              Data that must be retained by law (such as violation records) will
              be kept for the required period.
            </p>
          </section>

          <section className="legal-section">
            <h2>5. Recommendation Algorithm</h2>
            <p>
              To help you discover interesting content, this platform uses a
              recommendation algorithm based on your posted content. We analyze
              the categories of your posts and interaction behavior (such as
              likes/MeToo) to recommend other public posts you may find
              relevant.
            </p>
            <p>
              This algorithm is based solely on category keyword matching and
              interaction history. It does not analyze personally identifiable
              information (such as phone numbers or email addresses).
            </p>
            <p>
              You can influence recommendation preferences by choosing different
              categories for your posts. Posts from different categories are
              not cross-recommended.
            </p>
          </section>

          <section className="legal-section">
            <h2>6. Seed Content Disclosure</h2>
            <p>
              To improve the new-user experience (i.e., the &quot;cold start&quot;
              problem), this platform includes warm, system-generated posts
              (&quot;seed posts&quot;). These posts are not associated with any real
              user identity and are used solely for community atmosphere and
              initial recommendation system filling.
            </p>
            <p>
              Seed posts contain only positive, warm community atmosphere
              content and do not include any commercial promotion or false
              information.
            </p>
          </section>

          <section className="legal-section">
            <h2>7. Third-Party Services</h2>
            <p>
              If we use third-party content safety services, we share only
              necessary data within the service scope and require equivalent
              processing standards.
            </p>
          </section>

          <section className="legal-section">
            <h2>8. Your Rights and Contact</h2>
            <p>
              You may request access, correction, or deletion of your personal
              information. Contact: privacy@yourdomain.com
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
          <p className="legal-eyebrow">隐私政策</p>
          <h1>Lumin 隐私政策</h1>
          <p className="legal-sub">生效日期：{EFFECTIVE_DATE}</p>
        </header>

        <section className="legal-section">
          <h2>一、我们收集的信息及用途</h2>
          <p>我们仅为实现产品功能与安全目的收集必要信息，并明确说明用途。</p>
          <ul>
            <li>手机号：用于注册与实名验证，保障社区安全与合规要求。</li>
            <li>设备信息：用于安全风控与异常行为识别。</li>
            <li>发帖内容：用于提供树洞发布、展示与社区互动功能。</li>
            <li>使用行为数据：用于推荐算法与体验优化。</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>二、匿名机制的边界说明</h2>
          <p>
            前端展示为匿名昵称，后台保留手机号实名。我们不会主动向其他用户披露发帖者身份。
          </p>
          <p>
            在以下情形中可能关联实名信息：配合司法机关或行政执法机关依法开展调查时。
          </p>
          <p>普通内容举报不会向其他用户透露发帖者身份。</p>
        </section>

        <section className="legal-section">
          <h2>三、数据存储与安全措施</h2>
          <ul>
            <li>帖子内容采用加密存储。</li>
            <li>传输过程使用 TLS 加密。</li>
            <li>数据存储在中国境内服务器。</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>四、注销后的数据处理</h2>
          <p>用户注销账号后，我们将在 30 天内完成数据的彻底删除。</p>
          <p>因法律法规要求需保留的数据（如违规记录）将依法留存至规定期限。</p>
        </section>

        <section className="legal-section">
          <h2>五、推荐算法说明</h2>
          <p>
            为帮助你发现感兴趣的内容，本平台使用基于发帖内容的推荐算法。我们分析你发布的帖子
            所属分类和互动行为（如点赞/共情），为你推荐可能感兴趣的其他公开帖子。
          </p>
          <p>该推荐算法完全基于分类关键词匹配和用户互动历史，不涉及用户个人身份信息（如手机号、邮箱）的分析。</p>
          <p>你可以在发布帖子时选择不同的分类来控制推荐内容的偏好方向。不同分类的帖子不会被交叉推荐。</p>
        </section>

        <section className="legal-section">
          <h2>六、暖心内容说明</h2>
          <p>
            为改善新用户体验（即“冷启动”问题），本平台包含由系统生成并发布的暖心内容（“种子帖子”）。
            这些帖子不关联任何真实用户身份，仅用于社区氛围建设和推荐系统的初始填充。
          </p>
          <p>
            种子帖子的内容均为积极、温暖的社区氛围类短文，不包含任何商业推广或虚假信息。
          </p>
        </section>

        <section className="legal-section">
          <h2>七、第三方服务披露</h2>
          <p>
            若使用第三方内容安全服务（如阿里云内容安全、腾讯云天御），我们会在服务范围内共享
            必要数据，并要求第三方遵守同等的数据处理规范。
          </p>
        </section>

        <section className="legal-section">
          <h2>八、你的权利与联系我们</h2>
          <p>
            你有权申请查询、更正、删除你的个人信息。可通过以下渠道联系我们：
            privacy@yourdomain.com
          </p>
        </section>
      </div>
    </main>
  );
}
