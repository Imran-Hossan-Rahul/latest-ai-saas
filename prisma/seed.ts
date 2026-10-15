// Seed script — run with: npm run db:seed
// Creates a demo account with 30 days of realistic conversation data
// so every dashboard page (overview, inbox, analytics, settings) is populated.
//
// Demo credentials: demo@salesbot.ai / password123

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function daysAgo(maxDays: number, minDays = 0): Date {
  const ms = (minDays + Math.random() * (maxDays - minDays)) * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - ms);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log("🌱 Seeding database…");

  // ── Demo user ──────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("password123", 12);
  const user = await prisma.user.upsert({
    where: { email: "demo@salesbot.ai" },
    update: {},
    create: { name: "Demo Owner", email: "demo@salesbot.ai", passwordHash },
  });

  // ── Workspace ──────────────────────────────────────────────────────────────
  const workspace = await prisma.workspace.upsert({
    where: { slug: "demo-workspace" },
    update: {},
    create: {
      name: "Demo Clothing Store",
      slug: "demo-workspace",
      subscriptionStatus: "trialing",
    },
  });

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
    update: {},
    create: { workspaceId: workspace.id, userId: user.id, role: "owner" },
  });

  // ── Facebook page ──────────────────────────────────────────────────────────
  const page = await prisma.facebookPage.upsert({
    where: { workspaceId_pageId: { workspaceId: workspace.id, pageId: "demo-page-123" } },
    update: {},
    create: {
      workspaceId: workspace.id,
      pageId: "demo-page-123",
      pageName: "Demo Clothing Store",
      about: "Premium clothing for men and women. Fast delivery across Bangladesh.",
      encryptedAccessToken: "demo:demo:demo",
      isActive: true,
      webhookSubscribed: true,
    },
  });

  // ── Agent config ───────────────────────────────────────────────────────────
  await prisma.agentConfig.upsert({
    where: { facebookPageId: page.id },
    update: {},
    create: {
      facebookPageId: page.id,
      businessName: "Demo Clothing Store",
      businessType: "clothing store",
      productsInfo: [
        "T-Shirts: 500 BDT (S/M/L/XL, colors: white, black, navy)",
        "Jeans: 1200 BDT (28-36 waist, slim/regular fit)",
        "Hoodies: 900 BDT (S/M/L/XL, colors: grey, black)",
        "Polo Shirts: 700 BDT (S/M/L/XL, colors: white, blue, green)",
        "Free delivery on orders above 1500 BDT.",
      ].join("\n"),
      shippingInfo:
        "Delivery within Dhaka: 1-2 days (60 BDT). Outside Dhaka: 3-5 days (120 BDT).",
      faqs: JSON.stringify([
        { q: "Do you do cash on delivery?", a: "Yes! We accept COD, bKash, and Nagad." },
        { q: "Can I return items?", a: "Yes, within 7 days if unused and with tags." },
        { q: "Do you ship outside Bangladesh?", a: "Not yet, Bangladesh only for now." },
        { q: "How do I track my order?", a: "We send a tracking link via SMS after dispatch." },
      ]),
      agentName: "Riya",
      tone: "friendly",
      salesStyle: "soft",
      language: "auto",
      escalateOnAnger: true,
      escalateKeywords: "refund,complaint,manager,fraud,cancel",
    },
  });

  // ── 15 realistic conversations spread over 30 days ────────────────────────
  const customers = [
    { name: "Karim Ahmed",      psid: "psid-001", status: "ai",     tag: "hot_lead" },
    { name: "Fatima Begum",     psid: "psid-002", status: "human",  tag: null },
    { name: "Rahim Uddin",      psid: "psid-003", status: "closed", tag: "closed" },
    { name: "Nasrin Akter",     psid: "psid-004", status: "ai",     tag: "hot_lead" },
    { name: "Jamal Hossain",    psid: "psid-005", status: "ai",     tag: null },
    { name: "Sumaiya Islam",    psid: "psid-006", status: "ai",     tag: "hot_lead" },
    { name: "Arif Khan",        psid: "psid-007", status: "human",  tag: null },
    { name: "Mitu Chowdhury",   psid: "psid-008", status: "ai",     tag: "closed" },
    { name: "Rashed Mia",       psid: "psid-009", status: "ai",     tag: null },
    { name: "Tania Sultana",    psid: "psid-010", status: "closed", tag: "closed" },
    { name: "Imran Hossain",    psid: "psid-011", status: "ai",     tag: "hot_lead" },
    { name: "Sharmin Akter",    psid: "psid-012", status: "ai",     tag: null },
    { name: "Belal Ahmed",      psid: "psid-013", status: "ai",     tag: "spam" },
    { name: "Nusrat Jahan",     psid: "psid-014", status: "ai",     tag: null },
    { name: "Sabbir Rahman",    psid: "psid-015", status: "human",  tag: "hot_lead" },
  ] as const;

  // Message templates — varied Bengali/English conversations
  const templates = [
    [
      { role: "user",      content: "আপনাদের টি-শার্টের দাম কত?" },
      { role: "assistant", content: "আমাদের টি-শার্ট মাত্র ৫০০ টাকায়! S থেকে XL সাইজে, সাদা/কালো/নেভি রঙে। কোন সাইজ চাই? 😊" },
      { role: "user",      content: "M size white দিতে পারবেন?" },
      { role: "assistant", content: "অবশ্যই! M সাইজ সাদা আছে। ঠিকানা দিন, অর্ডার করে দিচ্ছি। 📦" },
    ],
    [
      { role: "user",      content: "Do you have jeans available?" },
      { role: "assistant", content: "Yes! Jeans are 1200 BDT, waist 28-36, slim or regular fit. Which size? 👖" },
      { role: "user",      content: "32 waist slim fit please" },
      { role: "assistant", content: "32 slim fit is in stock! Share your address and preferred payment (COD/bKash/Nagad). 😊" },
      { role: "user",      content: "Dhaka Mirpur 10, COD" },
      { role: "assistant", content: "Order confirmed! 1x Slim Jeans (32) → Mirpur 10. Total: 1260 BDT (incl. delivery). Ships in 1-2 days. 🎉" },
    ],
    [
      { role: "user",      content: "hoodie আছে কালো XL?" },
      { role: "assistant", content: "হ্যাঁ! Black XL হুডি আছে ৯০০ টাকায়। ঠিকানা দিন। ১৫০০+ অর্ডারে ডেলিভারি ফ্রি! 🎁" },
      { role: "user",      content: "Chittagong, Agrabad" },
      { role: "assistant", content: "Chittagong ডেলিভারি ১২০ টাকা, ৩-৫ দিন। মোট ১০২০ টাকা। bKash/Nagad/COD — কোনটা সুবিধা?" },
    ],
    [
      { role: "user",      content: "polo shirt blue L আছে?" },
      { role: "assistant", content: "আছে! Blue L পোলো ৭০০ টাকায়। দুটো নিলে ডেলিভারি ফ্রি হয়ে যায়! 😊" },
      { role: "user",      content: "একটাই নেব" },
      { role: "assistant", content: "ঠিক আছে! ঠিকানা দিন, অর্ডার করে দিচ্ছি।" },
    ],
    [
      { role: "user",      content: "What's your return policy?" },
      { role: "assistant", content: "Returns accepted within 7 days — unused, tags intact. We arrange pickup. Anything specific you're worried about? 😊" },
      { role: "user",      content: "ok thanks" },
      { role: "assistant", content: "Anytime! Let me know if you'd like to place an order. 🛍️" },
    ],
  ] as const;

  for (let i = 0; i < customers.length; i++) {
    const c = customers[i];
    const createdAt = daysAgo(30, 1);

    const conv = await prisma.conversation.upsert({
      where: { facebookPageId_customerPsid: { facebookPageId: page.id, customerPsid: c.psid } },
      update: {},
      create: {
        facebookPageId: page.id,
        customerPsid: c.psid,
        customerName: c.name,
        status: c.status,
        tag: c.tag,
        createdAt,
        updatedAt: new Date(createdAt.getTime() + 3600000),
      },
    });

    const existing = await prisma.message.count({ where: { conversationId: conv.id } });
    if (existing > 0) continue;

    const msgs = templates[i % templates.length];
    let t = new Date(createdAt.getTime());
    for (const msg of msgs) {
      t = new Date(t.getTime() + 30000 + Math.random() * 90000);
      await prisma.message.create({
        data: {
          conversationId: conv.id,
          role: msg.role,
          content: msg.content,
          createdAt: t,
        },
      });
    }
  }

  console.log("✅ Seed complete!");
  console.log("   Login: demo@salesbot.ai / password123");
  console.log(`   Seeded ${customers.length} conversations`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
