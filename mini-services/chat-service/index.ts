import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ====== In-memory state (single instance) ======
interface OnlineUser {
  uid: string
  username: string
  sockets: Set<string>
}
const users = new Map<string, OnlineUser>()

// ====== Helper ======
function getUserSockets(uid: string): string[] {
  return Array.from(users.get(uid)?.sockets || [])
}

function emitToUser(uid: string, event: string, data: any) {
  for (const sid of getUserSockets(uid)) {
    io.to(sid).emit(event, data)
  }
}

function broadcastOnline() {
  const list = Array.from(users.values()).map((u) => ({ uid: u.uid, username: u.username }))
  io.emit('presence', list)
}

// ====== Connection handler ======
io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id}`)

  // ---- Auth on this socket ----
  socket.on('auth', (data: { uid: string; username: string }) => {
    if (!data?.uid || !data?.username) return
    socket.data.uid = data.uid
    socket.data.username = data.username
    let u = users.get(data.uid)
    if (!u) {
      u = { uid: data.uid, username: data.username, sockets: new Set() }
      users.set(data.uid, u)
    }
    u.sockets.add(socket.id)
    socket.join(`user:${data.uid}`)
    broadcastOnline()
    console.log(`[auth] ${data.username} (${data.uid}) — online total: ${users.size}`)
  })

  // ====== DIRECT MESSAGE ======
  socket.on('dm:send', (data: {
    id: string
    chatId: string
    senderId: string
    receiverId: string
    text: string
    type?: string
    mediaURL?: string
    createdAt: string
    senderUsername: string
  }) => {
    // Deliver to receiver
    emitToUser(data.receiverId, 'dm:message', {
      id: data.id,
      chatId: data.chatId,
      senderId: data.senderId,
      receiverId: data.receiverId,
      text: data.text,
      type: data.type || 'text',
      mediaURL: data.mediaURL,
      createdAt: data.createdAt,
      senderUsername: data.senderUsername,
    })
    // Echo to other sockets of sender (multi-device)
    socket.broadcast.to(`user:${data.senderId}`).emit('dm:message', {
      id: data.id,
      chatId: data.chatId,
      senderId: data.senderId,
      receiverId: data.receiverId,
      text: data.text,
      type: data.type || 'text',
      mediaURL: data.mediaURL,
      createdAt: data.createdAt,
      senderUsername: data.senderUsername,
    })
  })

  socket.on('dm:status', (data: { messageId: string; chatId: string; status: string; toUid: string }) => {
    emitToUser(data.toUid, 'dm:status', {
      messageId: data.messageId,
      chatId: data.chatId,
      status: data.status,
    })
  })

  socket.on('dm:typing', (data: { chatId: string; toUid: string; typing: boolean; username: string }) => {
    emitToUser(data.toUid, 'dm:typing', {
      chatId: data.chatId,
      typing: data.typing,
      username: data.username,
    })
  })

  socket.on('dm:reaction', (data: {
    messageId: string
    chatId: string
    emoji: string
    userIds: string[]
    toUid: string
    byUid: string
  }) => {
    emitToUser(data.toUid, 'dm:reaction', {
      messageId: data.messageId,
      chatId: data.chatId,
      emoji: data.emoji,
      userIds: data.userIds,
      byUid: data.byUid,
    })
  })

  socket.on('dm:delete', (data: { messageId: string; chatId: string; toUid: string; forEveryone: boolean }) => {
    emitToUser(data.toUid, 'dm:delete', {
      messageId: data.messageId,
      chatId: data.chatId,
      forEveryone: data.forEveryone,
    })
  })

  // ====== GLOBAL CHAT ======
  socket.on('global:send', (data: {
    id: string
    senderId: string
    senderUsername: string
    text: string
    type?: string
    mediaURL?: string
    createdAt: string
    replyToId?: string
    mentions?: string[]
  }) => {
    io.emit('global:message', data)
    // Notify mentions
    if (data.mentions?.length) {
      for (const username of data.mentions) {
        // Find by username (we have users map indexed by uid; need reverse)
        for (const u of users.values()) {
          if (u.username === username) {
            emitToUser(u.uid, 'notification', {
              type: 'mention',
              actorId: data.senderId,
              actorUsername: data.senderUsername,
              targetType: 'global',
              text: `${data.senderUsername} menyebutmu di Chat Global`,
              messageId: data.id,
            })
          }
        }
      }
    }
  })

  socket.on('global:reaction', (data: { messageId: string; emoji: string; userIds: string[]; byUid: string }) => {
    io.emit('global:reaction', data)
  })

  socket.on('global:delete', (data: { messageId: string }) => {
    io.emit('global:delete', data)
  })

  // ====== GROUP CHAT ======
  socket.on('group:join', (data: { groupId: string; uid: string; username: string }) => {
    socket.join(`group:${data.groupId}`)
    io.to(`group:${data.groupId}`).emit('group:member-joined', { groupId: data.groupId, uid: data.uid, username: data.username })
  })

  socket.on('group:leave', (data: { groupId: string; uid: string }) => {
    socket.leave(`group:${data.groupId}`)
    io.to(`group:${data.groupId}`).emit('group:member-left', { groupId: data.groupId, uid: data.uid })
  })

  socket.on('group:send', (data: {
    id: string
    groupId: string
    senderId: string
    senderUsername: string
    text: string
    type?: string
    mediaURL?: string
    createdAt: string
    replyToId?: string
    mentions?: string[]
  }) => {
    io.to(`group:${data.groupId}`).emit('group:message', data)
  })

  socket.on('group:reaction', (data: { groupId: string; messageId: string; emoji: string; userIds: string[]; byUid: string }) => {
    io.to(`group:${data.groupId}`).emit('group:reaction', data)
  })

  // ====== CHANNEL POSTS ======
  socket.on('channel:post', (data: {
    id: string
    channelId: string
    authorId: string
    authorUsername: string
    text: string
    mediaURL?: string
    createdAt: string
  }) => {
    io.emit('channel:post', data)
  })

  // ====== WEBRTC CALL SIGNALING ======
  // Caller -> Callee
  socket.on('call:offer', (data: {
    callId: string
    callerId: string
    callerUsername: string
    calleeId: string
    callType: string // voice | video
    offer: any
  }) => {
    emitToUser(data.calleeId, 'call:incoming', {
      callId: data.callId,
      callerId: data.callerId,
      callerUsername: data.callerUsername,
      callType: data.callType,
      offer: data.offer,
    })
  })

  // Callee -> Caller
  socket.on('call:answer', (data: { callId: string; callerId: string; calleeId: string; answer: any }) => {
    emitToUser(data.callerId, 'call:answered', {
      callId: data.callId,
      calleeId: data.calleeId,
      answer: data.answer,
    })
  })

  // Callee -> Caller: rejected
  socket.on('call:reject', (data: { callId: string; callerId: string; calleeId: string }) => {
    emitToUser(data.callerId, 'call:rejected', {
      callId: data.callId,
      calleeId: data.calleeId,
    })
  })

  // Either -> Other: end call
  socket.on('call:end', (data: { callId: string; callerId: string; calleeId: string; endedBy: string }) => {
    const otherUid = data.endedBy === data.callerId ? data.calleeId : data.callerId
    emitToUser(otherUid, 'call:ended', {
      callId: data.callId,
      endedBy: data.endedBy,
    })
  })

  // ICE candidate exchange
  socket.on('call:ice', (data: { callId: string; fromUid: string; toUid: string; candidate: any }) => {
    emitToUser(data.toUid, 'call:ice', {
      callId: data.callId,
      fromUid: data.fromUid,
      candidate: data.candidate,
    })
  })

  // ====== NOTIFICATIONS ======
  socket.on('notification:send', (data: { recipientId: string; type: string; text: string; actorId?: string; targetType?: string; targetId?: string }) => {
    emitToUser(data.recipientId, 'notification', data)
  })

  // ====== ADMIN BROADCAST ======
  socket.on('admin:broadcast', (data: { text: string; kind: string }) => {
    io.emit('admin:banner', data)
  })

  socket.on('admin:notification', (data: { text: string }) => {
    io.emit('admin:notification', data)
  })

  // ====== STORY ======
  socket.on('story:new', (data: { ownerId: string; ownerUsername: string; storyId: string }) => {
    io.emit('story:new', data)
  })

  socket.on('story:reaction', (data: { storyId: string; ownerId: string; emoji: string; byUid: string; byUsername: string }) => {
    emitToUser(data.ownerId, 'story:reaction', data)
  })

  socket.on('story:view', (data: { storyId: string; ownerId: string; viewerId: string; viewerUsername: string }) => {
    emitToUser(data.ownerId, 'story:view', data)
  })

  // ====== DISCONNECT ======
  socket.on('disconnect', () => {
    const uid = socket.data.uid
    if (uid) {
      const u = users.get(uid)
      if (u) {
        u.sockets.delete(socket.id)
        if (u.sockets.size === 0) {
          users.delete(uid)
          io.emit('presence:user-offline', { uid, username: u.username })
        }
      }
    }
    broadcastOnline()
    console.log(`[socket] disconnected: ${socket.id}`)
  })

  socket.on('error', (err) => {
    console.error(`[socket] error on ${socket.id}:`, err)
  })
})

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`[chat-service] WebSocket server running on port ${PORT}`)
})

process.on('SIGTERM', () => {
  console.log('[chat-service] SIGTERM received')
  httpServer.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  console.log('[chat-service] SIGINT received')
  httpServer.close(() => process.exit(0))
})
