// Shared types for the chat app

export type ID = string

export interface UserProfile {
  id: ID
  username: string
  displayName?: string | null
  email?: string
  bio?: string | null
  photoURL?: string | null
  verified: boolean
  role: "user" | "admin" | "superadmin"
  banned?: boolean
  online: boolean
  lastSeen: string | Date
  createdAt: string | Date
}

export interface Message {
  id: ID
  chatId?: string
  groupId?: string
  senderId: ID
  receiverId?: ID
  senderUsername?: string
  senderDisplayName?: string
  senderPhoto?: string | null
  senderVerified?: boolean
  text: string
  type: "text" | "image" | "video" | "audio" | "voice" | "document" | "system"
  mediaURL?: string | null
  status?: "sent" | "delivered" | "read"
  reactions: Record<string, string[]>
  replyToId?: string | null
  forwardedFrom?: string | null
  createdAt: string | Date | number
  mentions?: string[]
  pinned?: boolean
}

export interface GlobalMessage extends Message {
  pinned: boolean
}

export interface ChatListItem {
  partner: UserProfile
  lastMessage: {
    text: string
    createdAt: string | Date
    status: string
    type: string
    me: boolean
  }
  unread: number
}

export interface Story {
  id: ID
  ownerId: ID
  owner: {
    id: ID
    username: string
    displayName?: string | null
    photoURL?: string | null
    verified: boolean
  }
  type: "text" | "image" | "video"
  text?: string | null
  mediaURL?: string | null
  bg?: string
  duration: number
  audience: string
  expiresAt: string | Date
  createdAt: string | Date
  viewers?: { viewerId: string }[]
  reactions?: { userId: string; emoji: string }[]
}

export interface Group {
  id: ID
  name: string
  description?: string | null
  photoURL?: string | null
  ownerId: ID
  owner?: {
    username: string
    displayName?: string | null
    photoURL?: string | null
    verified: boolean
  }
  visibility: "public" | "private"
  joinPolicy: "open" | "approval"
  inviteCode?: string | null
  memberCount: number
  createdAt: string | Date
}

export interface GroupMember {
  id: ID
  groupId: ID
  userId: ID
  role: "owner" | "admin" | "member"
  joinedAt: string | Date
  user: UserProfile
}

export interface GroupMessage extends Message {
  groupId: ID
}

export interface Channel {
  id: ID
  name: string
  slug: string
  description?: string | null
  photoURL?: string | null
  ownerId: ID
  owner?: {
    username: string
    displayName?: string | null
    photoURL?: string | null
    verified: boolean
  }
  visibility: string
  followerCount: number
  createdAt: string | Date
}

export interface ChannelPost {
  id: ID
  channelId: ID
  authorId: ID
  authorUsername: string
  authorDisplayName?: string | null
  authorPhoto?: string | null
  authorVerified?: boolean
  text: string
  mediaURL?: string | null
  mediaType?: string | null
  pinned: boolean
  viewCount: number
  reactions: Record<string, string[]>
  createdAt: string | Date
}

export interface CallRecord {
  id: ID
  callerId: ID
  calleeId: ID
  callType: "voice" | "video"
  status: "ringing" | "active" | "ended" | "missed" | "rejected" | "failed"
  startedAt?: string | Date | null
  endedAt?: string | Date | null
  durationSeconds?: number | null
  caller?: { username: string; displayName?: string | null; photoURL?: string | null }
  callee?: { username: string; displayName?: string | null; photoURL?: string | null }
  createdAt: string | Date
}

export interface Notification {
  id: ID
  recipientId: ID
  actorId?: ID | null
  type: string
  targetType?: string | null
  targetId?: string | null
  text: string
  read: boolean
  createdAt: string | Date
}

export interface AdminStats {
  totalUsers: number
  onlineUsers: number
  bannedUsers: number
  verifiedUsers: number
  newUsersToday: number
  totalMessages: number
  messagesToday: number
  totalGroups: number
  totalChannels: number
  totalStories: number
  openReports: number
  totalCalls: number
  messagesPerDay: { day: string; count: number }[]
}
