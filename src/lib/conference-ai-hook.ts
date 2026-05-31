import type { InferChatMessages } from "@tanstack/ai-react";
import {
  createChatClientOptions,
  fetchServerSentEvents,
  useChat,
} from "@tanstack/ai-react";

// Default chat options for type inference
const defaultChatOptions = createChatClientOptions({
  connection: fetchServerSentEvents("/api/remy-chat"),
});

export type ConferenceChatMessages = InferChatMessages<
  typeof defaultChatOptions
>;

export const useConferenceChat = (speakerSlug?: string, talkSlug?: string) => {
  const chatOptions = createChatClientOptions({
    connection: fetchServerSentEvents("/api/remy-chat", {
      body: {
        speakerSlug,
        talkSlug,
      },
    }),
  });

  return useChat(chatOptions);
};
