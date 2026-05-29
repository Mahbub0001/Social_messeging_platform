import { supabase, isMockMode } from "../lib/supabase";
import { mockDb } from "./mockDb";
import type { Conversation, Message, MessageReaction, Profile } from "./mockDb";

export type { Conversation, Message, MessageReaction };

export interface MessageWithSender extends Message {
  sender?: Profile;
  reply_to?: MessageWithSender | null;
  reactions?: { [emoji: string]: string[] }; // emoji -> array of user_ids
}

export interface ConversationWithDetails extends Conversation {
  unread_count?: number;
  last_message?: Message | null;
  members?: Profile[];
}

type MessageSubscriptionCallback = (event: {
  type: "INSERT" | "UPDATE" | "DELETE";
  new: Message;
  old?: { id: string };
}) => void;

type TypingCallback = (payload: { userId: string; isTyping: boolean }) => void;
type PresenceCallback = (onlineUserIds: string[]) => void;

class ChatServiceClass {
  private typingListeners: Map<string, Set<TypingCallback>> = new Map();
  private presenceListeners: Set<PresenceCallback> = new Set();
  
  // Keep track of active channels for cleanup
  private activeMessageSubscriptions: Map<string, any> = new Map();
  private activeTypingChannels: Map<string, any> = new Map();

  constructor() {
    if (typeof window !== "undefined") {
      this.initGlobalListeners();
    }
  }

  private initGlobalListeners() {
    if (isMockMode) {
      // Listen to cross-tab/local events for messages
      window.addEventListener("kb_message_event", (e: any) => {
        const { conversationId, type, message } = e.detail;
        const subMap = this.activeMessageSubscriptions.get(conversationId);
        if (subMap) {
          subMap.forEach((cb: MessageSubscriptionCallback) => {
            cb({
              type,
              new: message,
              old: type === "DELETE" ? { id: message.id } : undefined,
            });
          });
        }
      });

      // Listen to local typing indicator events
      window.addEventListener("kb_typing_event", (e: any) => {
        const { conversationId, userId, isTyping } = e.detail;
        const listeners = this.typingListeners.get(conversationId);
        if (listeners) {
          listeners.forEach((cb) => cb({ userId, isTyping }));
        }
      });

      // Mock Presence Syncer (everyone is online or updated online)
      window.addEventListener("kb_presence_event", () => {
        this.syncMockPresence();
      });
    }
  }

  private syncMockPresence() {
    const profiles = mockDb.getProfiles();
    const onlineIds = profiles.filter((p) => p.is_online).map((p) => p.id);
    this.presenceListeners.forEach((cb) => cb(onlineIds));
  }

  // ----------------------------------------------------
  // CONVERSATIONS
  // ----------------------------------------------------
  public async getConversations(userId: string): Promise<{ data: ConversationWithDetails[]; error: any }> {
    if (isMockMode) {
      const allConversations = mockDb.getConversations();
      const allMembers = mockDb.getConversationMembers();
      const allMessages = mockDb.getMessages();
      const profiles = mockDb.getProfiles();

      // Find conversations this user belongs to
      const userConversations = allMembers
        .filter((m) => m.user_id === userId)
        .map((m) => {
          const conv = allConversations.find((c) => c.id === m.conversation_id);
          if (!conv) return null;

          // Find other members
          const memberIds = allMembers
            .filter((mem) => mem.conversation_id === conv.id)
            .map((mem) => mem.user_id);
          
          const members = profiles.filter((p) => memberIds.includes(p.id));

          // Get last message
          const chatMessages = allMessages
            .filter((msg) => msg.conversation_id === conv.id)
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          
          const last_message = chatMessages.length > 0 ? chatMessages[chatMessages.length - 1] : null;

          return {
            ...conv,
            members,
            last_message,
            unread_count: 0, // Mocked for now
          } as ConversationWithDetails;
        })
        .filter(Boolean) as ConversationWithDetails[];

      // Sort by last message time or creation time
      userConversations.sort((a, b) => {
        const timeA = new Date(a.last_message ? a.last_message.created_at : a.created_at).getTime();
        const timeB = new Date(b.last_message ? b.last_message.created_at : b.created_at).getTime();
        return timeB - timeA;
      });

      return { data: userConversations, error: null };
    } else {
      // real Supabase query
      // Fetch user's conversation memberships first
      const { data: memberships, error: memError } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", userId);

      if (memError) return { data: [], error: memError };
      if (!memberships || memberships.length === 0) return { data: [], error: null };

      const conversationIds = memberships.map((m: any) => m.conversation_id);

      // Fetch conversations
      const { data: conversations, error: convError } = await supabase
        .from("conversations")
        .select(`
          *,
          conversation_members (
            user_id,
            profiles (*)
          ),
          messages (
            id,
            content,
            media_url,
            media_type,
            created_at,
            sender_id
          )
        `)
        .in("id", conversationIds);

      if (convError) return { data: [], error: convError };

      const conversationsWithDetails = (conversations || []).map((conv: any) => {
        // Map members
        const members = conv.conversation_members.map((m: any) => m.profiles);
        // Get last message (sorted in JS or DB)
        const sortedMsgs = (conv.messages || []).sort(
          (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const last_message = sortedMsgs.length > 0 ? sortedMsgs[sortedMsgs.length - 1] : null;

        return {
          id: conv.id,
          name: conv.name,
          avatar_url: conv.avatar_url,
          is_group: conv.is_group,
          created_at: conv.created_at,
          updated_at: conv.updated_at,
          members,
          last_message,
          unread_count: 0,
        };
      });

      // Sort conversations by last message or creation date descending
      conversationsWithDetails.sort((a: any, b: any) => {
        const timeA = new Date(a.last_message ? a.last_message.created_at : a.created_at).getTime();
        const timeB = new Date(b.last_message ? b.last_message.created_at : b.created_at).getTime();
        return timeB - timeA;
      });

      return { data: conversationsWithDetails, error: null };
    }
  }

  public async createConversation(
    userIds: string[],
    name: string | null,
    isGroup: boolean,
    avatarUrl: string | null = null
  ): Promise<{ data: ConversationWithDetails | null; error: any }> {
    if (isMockMode) {
      const newConvId = "conv-" + Math.random().toString(36).substr(2, 9);
      const newConv: Conversation = {
        id: newConvId,
        name,
        avatar_url: avatarUrl || (isGroup ? `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(name || "")}` : null),
        is_group: isGroup,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Add to conversations list
      const conversations = mockDb.getConversations();
      mockDb.saveConversations([newConv, ...conversations]);

      // Add conversation members
      const members = mockDb.getConversationMembers();
      const newMembers = userIds.map((uId, idx) => ({
        id: `mem-${newConvId}-${idx}`,
        conversation_id: newConvId,
        user_id: uId,
        role: (idx === 0 && isGroup ? "admin" : "member") as "admin" | "member",
        joined_at: new Date().toISOString(),
      }));
      mockDb.saveConversationMembers([...members, ...newMembers]);

      // Pull profiles details
      const profiles = mockDb.getProfiles();
      const mappedProfiles = profiles.filter((p) => userIds.includes(p.id));

      const detailedConv: ConversationWithDetails = {
        ...newConv,
        members: mappedProfiles,
        last_message: null,
        unread_count: 0,
      };

      // Dispatch event for active channels (tab communication)
      window.dispatchEvent(new CustomEvent("kb_conversation_created"));

      return { data: detailedConv, error: null };
    } else {
      // 1. Create conversation record
      const { data: conv, error: convError } = await supabase
        .from("conversations")
        .insert({ name, is_group: isGroup, avatar_url: avatarUrl })
        .select()
        .single();

      if (convError) return { data: null, error: convError };

      // 2. Create members links
      const memberInserts = userIds.map((uId, idx) => ({
        conversation_id: conv.id,
        user_id: uId,
        role: idx === 0 && isGroup ? "admin" : "member",
      }));

      const { error: memError } = await supabase
        .from("conversation_members")
        .insert(memberInserts);

      if (memError) return { data: null, error: memError };

      // 3. Fetch detailed conversation
      const { data: profiles, error: profError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", userIds);

      if (profError) return { data: null, error: profError };

      const detailedConv: ConversationWithDetails = {
        ...conv,
        members: profiles || [],
        last_message: null,
        unread_count: 0,
      };

      return { data: detailedConv, error: null };
    }
  }

  // ----------------------------------------------------
  // MESSAGES
  // ----------------------------------------------------
  public async getMessages(
    conversationId: string,
    limit: number = 50
  ): Promise<{ data: MessageWithSender[]; error: any }> {
    if (isMockMode) {
      const messages = mockDb.getMessages();
      const profiles = mockDb.getProfiles();
      const reactions = mockDb.getReactions();

      // Filter messages for this conversation
      const filtered = messages
        .filter((m) => m.conversation_id === conversationId)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      // Slice to get last limit messages
      const sliced = filtered.slice(-limit);

      // Map profiles, reactions, replies
      const messagesWithDetails = sliced.map((msg) => {
        const sender = profiles.find((p) => p.id === msg.sender_id);
        
        // Map reply-to message if it exists
        let reply_to: MessageWithSender | null = null;
        if (msg.reply_to_message_id) {
          const original = messages.find((m) => m.id === msg.reply_to_message_id);
          if (original) {
            reply_to = {
              ...original,
              sender: profiles.find((p) => p.id === original.sender_id),
            };
          }
        }

        // Map reactions: group emoji count
        const msgReactions = reactions.filter((r) => r.message_id === msg.id);
        const mappedReactions: { [emoji: string]: string[] } = {};
        msgReactions.forEach((r) => {
          if (!mappedReactions[r.emoji]) {
            mappedReactions[r.emoji] = [];
          }
          mappedReactions[r.emoji].push(r.user_id);
        });

        return {
          ...msg,
          sender,
          reply_to,
          reactions: mappedReactions,
        } as MessageWithSender;
      });

      return { data: messagesWithDetails, error: null };
    } else {
      const { data, error } = await supabase
        .from("messages")
        .select(`
          *,
          sender:profiles (*),
          message_reactions (*)
        `)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(limit);

      if (error) return { data: [], error };

      const messagesWithDetails = (data || []).map((msg: any) => {
        // Map reactions: group emoji count
        const mappedReactions: { [emoji: string]: string[] } = {};
        (msg.message_reactions || []).forEach((r: any) => {
          if (!mappedReactions[r.emoji]) {
            mappedReactions[r.emoji] = [];
          }
          mappedReactions[r.emoji].push(r.user_id);
        });

        // Pull reply context if needed in another query, or join inside. Let's do lazy resolved or basic structure
        return {
          ...msg,
          reactions: mappedReactions,
        } as MessageWithSender;
      });

      // Fetch parent messages for replies if any
      const parentIds = messagesWithDetails
        .map((m: any) => m.reply_to_message_id)
        .filter(Boolean) as string[];

      if (parentIds.length > 0) {
        const { data: parentMessages } = await supabase
          .from("messages")
          .select("*, sender:profiles(*)")
          .in("id", parentIds);

        if (parentMessages) {
          messagesWithDetails.forEach((msg: any) => {
            if (msg.reply_to_message_id) {
              const parent = parentMessages.find((pm: any) => pm.id === msg.reply_to_message_id);
              if (parent) {
                msg.reply_to = parent as MessageWithSender;
              }
            }
          });
        }
      }

      return { data: messagesWithDetails, error: null };
    }
  }

  public async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    mediaUrl: string | null = null,
    mediaType: "image" | "file" | "audio" | null = null,
    replyToMessageId: string | null = null
  ): Promise<{ data: MessageWithSender | null; error: any }> {
    if (isMockMode) {
      const newMsgId = "msg-" + Math.random().toString(36).substr(2, 9);
      const newMsg: Message = {
        id: newMsgId,
        conversation_id: conversationId,
        sender_id: senderId,
        content,
        media_url: mediaUrl || undefined,
        media_type: mediaType || undefined,
        reply_to_message_id: replyToMessageId,
        is_edited: false,
        created_at: new Date().toISOString(),
      };

      // Save to localStorage
      const messages = mockDb.getMessages();
      mockDb.saveMessages([...messages, newMsg]);

      // Get sender profile
      const profiles = mockDb.getProfiles();
      const sender = profiles.find((p) => p.id === senderId);

      // Get reply info
      let reply_to: MessageWithSender | null = null;
      if (replyToMessageId) {
        const parent = messages.find((m) => m.id === replyToMessageId);
        if (parent) {
          reply_to = {
            ...parent,
            sender: profiles.find((p) => p.id === parent.sender_id),
          };
        }
      }

      const detailedMsg: MessageWithSender = {
        ...newMsg,
        sender,
        reply_to,
        reactions: {},
      };

      // Dispatch event for active channels (tab communication)
      window.dispatchEvent(
        new CustomEvent("kb_message_event", {
          detail: {
            conversationId,
            type: "INSERT",
            message: detailedMsg,
          },
        })
      );

      // Trigger Chatbot simulation if texting Kotha Barta Bot
      if (conversationId === "conv-bot" && senderId !== "bot-id") {
        this.simulateBotReply(content, replyToMessageId);
      } else if (conversationId === "conv-sajeeb" && senderId !== "sajeeb-id") {
        this.simulateSajeebReply(content);
      }

      return { data: detailedMsg, error: null };
    } else {
      const { data, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          content,
          media_url: mediaUrl,
          media_type: mediaType,
          reply_to_message_id: replyToMessageId,
        })
        .select("*, sender:profiles(*)")
        .single();

      if (error) return { data: null, error };
      return { data: { ...data, reactions: {} }, error: null };
    }
  }

  public async editMessage(messageId: string, content: string): Promise<{ data: Message | null; error: any }> {
    if (isMockMode) {
      const messages = mockDb.getMessages();
      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx === -1) return { data: null, error: { message: "Message not found." } };

      messages[idx].content = content;
      messages[idx].is_edited = true;
      mockDb.saveMessages(messages);

      const updated = messages[idx];
      const profiles = mockDb.getProfiles();
      const detailed: MessageWithSender = {
        ...updated,
        sender: profiles.find((p) => p.id === updated.sender_id),
      };

      window.dispatchEvent(
        new CustomEvent("kb_message_event", {
          detail: {
            conversationId: updated.conversation_id,
            type: "UPDATE",
            message: detailed,
          },
        })
      );

      return { data: updated, error: null };
    } else {
      const { data, error } = await supabase
        .from("messages")
        .update({ content, is_edited: true })
        .eq("id", messageId)
        .select()
        .single();
      return { data, error };
    }
  }

  public async deleteMessage(messageId: string): Promise<{ error: any }> {
    if (isMockMode) {
      const messages = mockDb.getMessages();
      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx === -1) return { error: { message: "Message not found." } };

      const msg = messages[idx];
      
      // Soft deletion: update content and tag it
      msg.content = "This message was deleted";
      msg.media_url = undefined;
      msg.media_type = undefined;
      msg.reply_to_message_id = undefined;
      // We label it deleted in a custom attribute if needed, but PRD asks for a visual indicator,
      // changing the text content is the cleanest standard soft delete mechanism.
      mockDb.saveMessages(messages);

      const profiles = mockDb.getProfiles();
      const detailed: MessageWithSender = {
        ...msg,
        sender: profiles.find((p) => p.id === msg.sender_id),
      };

      window.dispatchEvent(
        new CustomEvent("kb_message_event", {
          detail: {
            conversationId: msg.conversation_id,
            type: "UPDATE",
            message: detailed,
          },
        })
      );

      return { error: null };
    } else {
      // In production, we do soft deletion for everyone by updating the text content
      const { error } = await supabase
        .from("messages")
        .update({ content: "This message was deleted", media_url: null, media_type: null, reply_to_message_id: null })
        .eq("id", messageId);
      return { error };
    }
  }

  // ----------------------------------------------------
  // REACTIONS
  // ----------------------------------------------------
  public async addReaction(messageId: string, userId: string, emoji: string): Promise<{ error: any }> {
    if (isMockMode) {
      const reactions = mockDb.getReactions();
      
      // WhatsApp-style: Remove any existing reaction by this user on this message first
      const filtered = reactions.filter(
        (r) => !(r.message_id === messageId && r.user_id === userId)
      );

      const newReaction: MessageReaction = {
        id: "r-" + Math.random().toString(36).substr(2, 9),
        message_id: messageId,
        user_id: userId,
        emoji,
        created_at: new Date().toISOString(),
      };
      mockDb.saveReactions([...filtered, newReaction]);

      // Find conversation and dispatch update event
      const msg = mockDb.getMessages().find((m) => m.id === messageId);
      if (msg) {
        this.triggerMessageUpdateEvent(msg.conversation_id, messageId);
      }
      return { error: null };
    } else {
      // WhatsApp-style: Delete any existing reactions by this user on this message first
      await supabase
        .from("message_reactions")
        .delete()
        .eq("message_id", messageId)
        .eq("user_id", userId);

      // Insert the new reaction
      const { error } = await supabase
        .from("message_reactions")
        .insert({ message_id: messageId, user_id: userId, emoji });
      return { error };
    }
  }

  public async removeReaction(messageId: string, userId: string, emoji: string): Promise<{ error: any }> {
    if (isMockMode) {
      const reactions = mockDb.getReactions();
      const filtered = reactions.filter(
        (r) => !(r.message_id === messageId && r.user_id === userId && r.emoji === emoji)
      );
      mockDb.saveReactions(filtered);

      const msg = mockDb.getMessages().find((m) => m.id === messageId);
      if (msg) {
        this.triggerMessageUpdateEvent(msg.conversation_id, messageId);
      }
      return { error: null };
    } else {
      const { error } = await supabase
        .from("message_reactions")
        .delete()
        .eq("message_id", messageId)
        .eq("user_id", userId)
        .eq("emoji", emoji);
      return { error };
    }
  }

  private triggerMessageUpdateEvent(conversationId: string, messageId: string) {
    const messages = mockDb.getMessages();
    const profiles = mockDb.getProfiles();
    const reactions = mockDb.getReactions();
    const msg = messages.find((m) => m.id === messageId);

    if (msg) {
      const msgReactions = reactions.filter((r) => r.message_id === messageId);
      const mappedReactions: { [emoji: string]: string[] } = {};
      msgReactions.forEach((r) => {
        if (!mappedReactions[r.emoji]) {
          mappedReactions[r.emoji] = [];
        }
        mappedReactions[r.emoji].push(r.user_id);
      });

      const detailed: MessageWithSender = {
        ...msg,
        sender: profiles.find((p) => p.id === msg.sender_id),
        reactions: mappedReactions,
      };

      window.dispatchEvent(
        new CustomEvent("kb_message_event", {
          detail: {
            conversationId,
            type: "UPDATE",
            message: detailed,
          },
        })
      );
    }
  }

  // ----------------------------------------------------
  // REALTIME SUBSCRIPTIONS (MESSAGES)
  // ----------------------------------------------------
  public subscribeToMessages(conversationId: string, callback: MessageSubscriptionCallback) {
    if (isMockMode) {
      if (!this.activeMessageSubscriptions.has(conversationId)) {
        this.activeMessageSubscriptions.set(conversationId, new Set());
      }
      this.activeMessageSubscriptions.get(conversationId).add(callback);

      return () => {
        const subs = this.activeMessageSubscriptions.get(conversationId);
        if (subs) {
          subs.delete(callback);
          if (subs.size === 0) {
            this.activeMessageSubscriptions.delete(conversationId);
          }
        }
      };
    } else {
      // 1. Real Supabase channel subscription for messages
      const channelName = `messages:${conversationId}`;
      const channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          async (payload: any) => {
            // Fetch sender profile details to build MessageWithSender structure
            let updatedMsg: MessageWithSender = payload.new;
            
            if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
              const { data: sender } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", payload.new.sender_id)
                .single();
              
              // Load reactions
              const { data: reactData } = await supabase
                .from("message_reactions")
                .select("*")
                .eq("message_id", payload.new.id);
              
              const mappedReactions: { [emoji: string]: string[] } = {};
              (reactData || []).forEach((r: any) => {
                if (!mappedReactions[r.emoji]) {
                  mappedReactions[r.emoji] = [];
                }
                mappedReactions[r.emoji].push(r.user_id);
              });

              // Map reply message
              let reply_to = null;
              if (payload.new.reply_to_message_id) {
                const { data: parent } = await supabase
                  .from("messages")
                  .select("*, sender:profiles(*)")
                  .eq("id", payload.new.reply_to_message_id)
                  .single();
                reply_to = parent;
              }

              updatedMsg = {
                ...payload.new,
                sender: sender || undefined,
                reactions: mappedReactions,
                reply_to: reply_to as any,
              };
            }

            callback({
              type: payload.eventType,
              new: updatedMsg,
              old: payload.old,
            });
          }
        )
        .subscribe();

      // 2. Real Supabase channel subscription for message reactions
      const reactionsChannel = supabase
        .channel(`reactions:${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "message_reactions",
          },
          async (payload: any) => {
            const messageId = payload.eventType === "DELETE" ? payload.old.message_id : payload.new.message_id;
            if (!messageId) return;

            // Fetch the updated reactions for this message
            const { data: reactData } = await supabase
              .from("message_reactions")
              .select("*")
              .eq("message_id", messageId);
            
            const mappedReactions: { [emoji: string]: string[] } = {};
            (reactData || []).forEach((r: any) => {
              if (!mappedReactions[r.emoji]) {
                mappedReactions[r.emoji] = [];
              }
              mappedReactions[r.emoji].push(r.user_id);
            });

            // Fetch original message
            const { data: msgData } = await supabase
              .from("messages")
              .select("*, sender:profiles(*)")
              .eq("id", messageId)
              .single();

            if (msgData && msgData.conversation_id === conversationId) {
              // Map reply message
              let reply_to = null;
              if (msgData.reply_to_message_id) {
                const { data: parent } = await supabase
                  .from("messages")
                  .select("*, sender:profiles(*)")
                  .eq("id", msgData.reply_to_message_id)
                  .single();
                reply_to = parent;
              }

              const updatedMsg: MessageWithSender = {
                ...msgData,
                reactions: mappedReactions,
                reply_to: reply_to as any,
              };

              callback({
                type: "UPDATE",
                new: updatedMsg,
              });
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
        supabase.removeChannel(reactionsChannel);
      };
    }
  }

  // ----------------------------------------------------
  // TYPING INDICATORS
  // ----------------------------------------------------
  public sendTypingIndicator(conversationId: string, userId: string, isTyping: boolean) {
    if (isMockMode) {
      window.dispatchEvent(
        new CustomEvent("kb_typing_event", {
          detail: { conversationId, userId, isTyping },
        })
      );
    } else {
      let channel = this.activeTypingChannels.get(conversationId);
      if (!channel) {
        channel = supabase.channel(`typing:${conversationId}`);
        channel.subscribe();
        this.activeTypingChannels.set(conversationId, channel);
      }
      
      channel.send({
        type: "broadcast",
        event: "typing",
        payload: { userId, isTyping },
      });
    }
  }

  public subscribeToTyping(conversationId: string, callback: TypingCallback) {
    if (isMockMode) {
      if (!this.typingListeners.has(conversationId)) {
        this.typingListeners.set(conversationId, new Set());
      }
      this.typingListeners.get(conversationId)!.add(callback);

      return () => {
        const listeners = this.typingListeners.get(conversationId);
        if (listeners) {
          listeners.delete(callback);
          if (listeners.size === 0) {
            this.typingListeners.delete(conversationId);
          }
        }
      };
    } else {
      const channel = supabase.channel(`typing:${conversationId}`);
      channel
        .on("broadcast", { event: "typing" }, (payload: any) => {
          callback(payload.payload);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }

  // ----------------------------------------------------
  // CONVERSATION CREATION / MEMBERSHIP REALTIME
  // ----------------------------------------------------
  public subscribeToNewConversations(userId: string, callback: () => void) {
    if (isMockMode) {
      const handler = () => {
        callback();
      };
      window.addEventListener("kb_conversation_created", handler);
      return () => {
        window.removeEventListener("kb_conversation_created", handler);
      };
    } else {
      const channel = supabase
        .channel(`user-memberships:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "conversation_members",
            filter: `user_id=eq.${userId}`,
          },
          () => {
            callback();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }

  // ----------------------------------------------------
  // PRESENCE
  // ----------------------------------------------------
  public trackPresence(userId: string, callback: PresenceCallback) {
    this.presenceListeners.add(callback);

    if (isMockMode) {
      // Set online status in mockDb
      const profiles = mockDb.getProfiles();
      const user = profiles.find((p) => p.id === userId);
      if (user) {
        user.is_online = true;
        user.last_seen = new Date().toISOString();
        mockDb.saveProfiles(profiles);
      }

      // Sync immediately
      this.syncMockPresence();

      // Dispatch presence update event
      window.dispatchEvent(new CustomEvent("kb_presence_event"));

      return () => {
        const currProfiles = mockDb.getProfiles();
        const currUser = currProfiles.find((p) => p.id === userId);
        if (currUser) {
          currUser.is_online = false;
          currUser.last_seen = new Date().toISOString();
          mockDb.saveProfiles(currProfiles);
        }
        window.dispatchEvent(new CustomEvent("kb_presence_event"));
        this.presenceListeners.delete(callback);
      };
    } else {
      const presenceChannel = supabase.channel("online-presence");

      presenceChannel
        .on("presence", { event: "sync" }, () => {
          const state = presenceChannel.presenceState();
          const onlineUserIds = Object.keys(state).flatMap((key) =>
            state[key].map((presence: any) => presence.user_id)
          );
          callback(onlineUserIds);
        })
        .subscribe(async (status: string) => {
          if (status === "SUBSCRIBED") {
            await presenceChannel.track({ user_id: userId });
          }
        });

      return () => {
        supabase.removeChannel(presenceChannel);
        this.presenceListeners.delete(callback);
      };
    }
  }

  // ----------------------------------------------------
  // CHATBOT SIMULATIONS (MOCK MODE ONLY)
  // ----------------------------------------------------
  private simulateBotReply(userMsg: string, replyToId: string | null) {
    const delayTyping = 1000;
    const delayReply = 2500;

    // 1. Show bot typing
    setTimeout(() => {
      this.sendTypingIndicator("conv-bot", "bot-id", true);
    }, delayTyping);

    // 2. Add answer
    setTimeout(() => {
      this.sendTypingIndicator("conv-bot", "bot-id", false);

      let replyContent = "দুঃখিত, আমি বুঝতে পারিনি। আপনি কি 'features', 'developer', বা 'help' লিখে মেসেজ করবেন?";
      const cleaned = userMsg.toLowerCase().trim();

      if (cleaned.includes("help") || cleaned.includes("হ্যালো") || cleaned.includes("hi") || cleaned.includes("hello")) {
        replyContent = "হ্যালো! আমি কোথাবার্তা বট। আপনাকে কীভাবে সাহায্য করতে পারি? আপনি জানতে চাইতে পারেন:\n\n- 'features': এই প্রজেক্টের প্রধান ফিচারগুলো দেখতে\n- 'developer': ডেভেলপারের তথ্য জানতে\n- 'supa': সুপাবেস কানেকশন সম্পর্কে জানতে";
      } else if (cleaned.includes("feature") || cleaned.includes("ফিচার")) {
        replyContent = "কোথাবার্তা অ্যাপের দারুণ ফিচারসমূহ:\n1. 1-to-1 রিয়েল-টাইম চ্যাট\n2. গ্রুপ চ্যাট রুম\n3. ড্র্যাগ অ্যান্ড ড্রপ ফাইল/মিডিয়া শেয়ারিং\n4. অডিও মেসেজ রেকর্ডিং\n5. ইমোজি রিঅ্যাকশন\n6. টাইপিং ইন্ডিকেটর ও রিড রিসিটস\n7. ডার্ক/লাইট থিম ও ফ্রেমার মোশন অ্যানিমেশন।";
      } else if (cleaned.includes("dev") || cleaned.includes("sajeeb") || cleaned.includes("ডেভেলপার")) {
        replyContent = "এই প্রজেক্টের ডেভেলপার হলেন সজীব রহমান। তিনি একজন ফুল-স্ট্যাক ওয়েব ডেভেলপার যিনি React এবং Supabase ব্যবহার করে স্কেলেবল ওয়েব অ্যাপস তৈরি করেন। তার সাথে চ্যাট করতে সাইডবারের 'Sajeeb Rahman (Developer)' চ্যাটে ক্লিক করুন!";
      } else if (cleaned.includes("supa") || cleaned.includes("supabase")) {
        replyContent = "কোথাবার্তা ব্যাকএন্ডে Supabase ব্যবহার করে। এটি Supabase Auth (Oauth সহ), Supabase Realtime Channels (মেসেজ এবং টাইপিং ইন্ডিকেটরের জন্য), Supabase Database (RLS পলিসি সহ) এবং Supabase Storage (ফাইল শেয়ারিংয়ের জন্য) নিয়ে গঠিত।";
      }

      this.sendMessage("conv-bot", "bot-id", replyContent, null, null, replyToId);
    }, delayReply);
  }

  private simulateSajeebReply(_userMsg: string) {
    setTimeout(() => {
      this.sendTypingIndicator("conv-sajeeb", "sajeeb-id", true);
    }, 1200);

    setTimeout(() => {
      this.sendTypingIndicator("conv-sajeeb", "sajeeb-id", false);
      const responses = [
        "Thanks for writing! If you want to review the source code, check the GitHub repository. It shows optimized state management and RLS security.",
        "Yes! The typing indicators and message updates use optimistic UI updates so that the transitions are buttery smooth.",
        "Feel free to test sending reactions by hovering over this message, or upload a photo using the attachments clip! 📎",
        "If you want to hire me, I'm currently open to full-time remote developer positions! Let's schedule a call.",
      ];
      const randomMsg = responses[Math.floor(Math.random() * responses.length)];
      this.sendMessage("conv-sajeeb", "sajeeb-id", randomMsg);
    }, 3200);
  }
}

export const chatService = new ChatServiceClass();
export default chatService;
