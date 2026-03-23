-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SupportStatus" AS ENUM ('open', 'waiting_on_support', 'waiting_on_customer', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "SupportPriority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "MessageSender" AS ENUM ('customer', 'support', 'system', 'ai');

-- CreateEnum
CREATE TYPE "SupportMessageType" AS ENUM ('text', 'system_event', 'attachment');

-- CreateTable
CREATE TABLE "SupportConversation" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerUserId" TEXT,
    "subject" TEXT,
    "status" "SupportStatus" NOT NULL DEFAULT 'open',
    "priority" "SupportPriority" NOT NULL DEFAULT 'normal',
    "assignedAgentId" TEXT,
    "assignedAgentName" TEXT,
    "source" TEXT DEFAULT 'website_chat',
    "lastMessageAt" TIMESTAMP(3),
    "lastMessageBy" "MessageSender",
    "unreadForCustomer" INTEGER NOT NULL DEFAULT 0,
    "unreadForSupport" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderType" "MessageSender" NOT NULL,
    "senderName" TEXT,
    "senderEmail" TEXT,
    "body" TEXT NOT NULL,
    "messageType" "SupportMessageType" NOT NULL DEFAULT 'text',
    "isInternalNote" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupportConversation_publicId_key" ON "SupportConversation"("publicId");

-- CreateIndex
CREATE INDEX "SupportConversation_customerEmail_idx" ON "SupportConversation"("customerEmail");

-- CreateIndex
CREATE INDEX "SupportConversation_status_idx" ON "SupportConversation"("status");

-- CreateIndex
CREATE INDEX "SupportConversation_assignedAgentId_idx" ON "SupportConversation"("assignedAgentId");

-- CreateIndex
CREATE INDEX "SupportConversation_lastMessageAt_idx" ON "SupportConversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "SupportMessage_conversationId_createdAt_idx" ON "SupportMessage"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SupportConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
