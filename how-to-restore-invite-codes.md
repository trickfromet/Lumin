# How to Restore the Invite Code Feature (如何快速恢复邀请码功能)

This document provides step-by-step instructions on how to restore the invite code validation and input fields. We have commented out the code instead of deleting it, so it can be re-enabled quickly.

---

## 1. Re-enable Frontend UI (前端展示)

Open the home page file:
[src/app/page.tsx](file:///E:/Desktop/TreeHole/treehole/src/app/page.tsx)

1. Find the `ENABLE_INVITE_CODE` constant definition at the top of the Home component (around line 65):
   ```typescript
   const ENABLE_INVITE_CODE = false;
   ```
2. Change the value to `true`:
   ```typescript
   const ENABLE_INVITE_CODE = true;
   ```

*This toggles the display of the invite code inputs during registration and password reset, as well as the display of the auto-generated invite code after a successful registration.*

---

## 2. Re-enable Backend Validation (后端验证)

### Step A: Registration Endpoint
Open the registration API route file:
[src/app/api/auth/register/route.ts](file:///E:/Desktop/TreeHole/treehole/src/app/api/auth/register/route.ts)

1. Find and uncomment the **Validate invite code** block (around line 38):
   ```typescript
   // Validate invite code
   if (!inviteCode) {
     return error("请输入邀请码", 400);
   }
   const codeHash = hashInviteCode(inviteCode);
   const invite = await prisma.inviteCode.findUnique({
     where: { codeHash },
   });
   if (!invite) {
     return error("邀请码无效", 400);
   }
   if (invite.useCount >= invite.maxUses) {
     return error("邀请码已失效", 400);
   }
   ```
2. Find and uncomment the **Consume invite code** database update block (around line 80):
   ```typescript
   // Consume invite code
   await prisma.inviteCode.update({
     where: { id: invite.id },
     data: { useCount: { increment: 1 } },
   });
   ```

### Step B: Password Reset Endpoint
Open the password reset API route file:
[src/app/api/auth/reset-password/route.ts](file:///E:/Desktop/TreeHole/treehole/src/app/api/auth/reset-password/route.ts)

1. Find and uncomment the check for the `inviteCode` parameter (around line 31):
   ```typescript
   if (!inviteCode) {
     return error("请输入邀请码");
   }
   ```
2. Find and uncomment the **Validate invite code** block (around line 38):
   ```typescript
   // Validate invite code
   const codeHash = hashInviteCode(inviteCode);
   const invite = await prisma.inviteCode.findUnique({
     where: { codeHash },
   });
   if (!invite) {
     return error("邀请码无效", 400);
   }
   if (invite.useCount >= invite.maxUses) {
     return error("邀请码已失效", 400);
   }
   ```
3. Find and uncomment the database update to consume the code (around line 70):
   ```typescript
   await prisma.inviteCode.update({
     where: { id: invite.id },
     data: { useCount: { increment: 1 } },
   });
   ```

---

## 3. Seed/Generate Invite Codes

If you need to generate new invite codes for users, you can use the seed script:
```bash
# Set your environment variables in .env first
npm run seed  # Or run the specific script: npx ts-node src/scripts/seed-invite-codes.ts
```

---

> [!CAUTION]
> **Security Warning (安全警告)**:
> While the invite code validation is disabled/commented out, password reset does NOT verify any invite code or secondary auth factor. This is suitable for testing or open environments, but for a secure production release, either re-enable the invite codes or implement a verification email system to prevent unauthorized account takeovers.
