import type { SupportConversation } from "./supportDashboardTypes";

export const mockSupportConversations: SupportConversation[] = [
  {
    id: "demo-1",
    publicId: "conv_demo_001",
    customerName: "Michael Ye",
    customerEmail: "michael@example.com",
    subject: "Billing question",
    status: "waiting_on_support",
    priority: "high",
    assignedAgentName: "Ava",
    unreadForSupport: 2,
    unreadForCustomer: 0,
    lastMessageAt: new Date().toISOString(),
    messages: [
      {
        id: "m1",
        senderType: "customer",
        senderName: "Michael Ye",
        body: "I need help understanding my latest invoice.",
        createdAt: new Date().toISOString(),
      },
      {
        id: "m2",
        senderType: "ai",
        senderName: "AI Support",
        body: "Thanks — our team will review your billing question shortly.",
        createdAt: new Date().toISOString(),
      },
    ],
  },
  {
    id: "demo-2",
    publicId: "conv_demo_002",
    customerName: "Sarah Chen",
    customerEmail: "sarah@example.com",
    subject: "Technical issue",
    status: "open",
    priority: "urgent",
    assignedAgentName: "David",
    unreadForSupport: 1,
    unreadForCustomer: 0,
    lastMessageAt: new Date().toISOString(),
    messages: [
      {
        id: "m3",
        senderType: "customer",
        senderName: "Sarah Chen",
        body: "The Home Value tool is not loading on my page.",
        createdAt: new Date().toISOString(),
      },
    ],
  },
];
