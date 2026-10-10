"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AssistantRuntimeProvider,
  useAuiEvent,
  useLocalRuntime,
} from "@assistant-ui/react";
import { useTranslations } from "next-intl";
import { Composer } from "@/components/assistant-ui/composer";
import { Thread } from "@/components/assistant-ui/thread";
import { ChatUpgradeNotice } from "@/components/premium/chat-upgrade-notice";
import { useToast } from "@/hooks/use-toast";
import { createChatModelAdapter } from "@/lib/chat/chat-model-adapter";
import { ImageAttachmentAdapter } from "@/lib/chat/image-attachment-adapter";
import { MAX_IMAGES_PER_MESSAGE, type ModelId } from "@/lib/chat/limits";
import { cn } from "@/lib/utils";

const attachmentAdapter = new ImageAttachmentAdapter();

interface ChatProps {
  childId: string;
  className?: string;
}

export function Chat({ childId, className }: ChatProps) {
  const [conversationId, setConversationId] = useState(0);

  return (
    <Conversation
      key={conversationId}
      childId={childId}
      className={className}
      onNewConversation={() => setConversationId((id) => id + 1)}
    />
  );
}

interface ConversationProps extends ChatProps {
  onNewConversation: () => void;
}

function Conversation({ childId, className, onNewConversation }: ConversationProps) {
  const t = useTranslations("chat");
  const [model, setModel] = useState<ModelId>("sonnet");
  const modelRef = useRef(model);
  const [premiumRequired, setPremiumRequired] = useState(false);

  useEffect(() => {
    modelRef.current = model;
  }, [model]);

  const generic = t("errors.generic");
  const tooManyImages = t("errors.tooManyImages", { max: MAX_IMAGES_PER_MESSAGE });
  const adapter = useMemo(
    () =>
      createChatModelAdapter({
        childId,
        getModel: () => modelRef.current,
        onPremiumRequired: () => setPremiumRequired(true),
        errorMessages: { generic, tooManyImages },
      }),
    [childId, generic, tooManyImages]
  );

  const runtime = useLocalRuntime(adapter, {
    adapters: { attachments: attachmentAdapter },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AttachmentErrorToast />
      <div className={cn("h-full min-h-0", className)}>
        <Thread
          footer={
            premiumRequired ? (
              <ChatUpgradeNotice />
            ) : (
              <Composer
                model={model}
                onModelChange={setModel}
                onNewConversation={onNewConversation}
              />
            )
          }
        />
      </div>
    </AssistantRuntimeProvider>
  );
}

function AttachmentErrorToast() {
  const t = useTranslations("chat");
  const { toast } = useToast();

  useAuiEvent("composer.attachmentAddError", ({ message }) => {
    toast({
      title: t("errorTitle"),
      description:
        message === "image_too_large" ? t("errors.imageTooLarge") : t("errors.imageFailed"),
      variant: "destructive",
    });
  });

  return null;
}
