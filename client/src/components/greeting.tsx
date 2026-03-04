import { motion } from 'framer-motion';
import { LineChart } from 'lucide-react';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { ChatMessage } from '@chat-template/core';
import { softNavigateToChatId } from '@/lib/navigation';
import { useAppConfig } from '@/contexts/AppConfigContext';

const sampleQuestions = [
  'What are the potential stocks that can get impacted as DOW plummeted by 800 points?',
  'What are the impacts of Trump tariffs on tech stocks?',
  'What are some best stocks to buy for long-term investment?',
  'Analyze the latest earnings reports for FAANG stocks',
  'Search for recent news about semiconductor industry trends',
];

interface GreetingProps {
  chatId: string;
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
}

export const Greeting = ({ chatId, sendMessage }: GreetingProps) => {
  const { chatHistoryEnabled } = useAppConfig();

  const handleQuestionClick = (question: string) => {
    // Navigate to the chat and send the message properly via React state
    softNavigateToChatId(chatId, chatHistoryEnabled);
    sendMessage({
      role: 'user',
      parts: [{ type: 'text', text: question }],
    });
  };

  return (
    <div
      key="overview"
      className="mx-auto flex size-full max-w-3xl flex-col items-center justify-center px-4 py-12"
    >
      {/* Icon */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/20 to-red-500/20 text-orange-500"
      >
        <LineChart className="h-8 w-8" />
      </motion.div>

      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-2 text-center font-semibold text-2xl md:text-3xl"
      >
        Equity Analyst
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-8 text-center text-muted-foreground"
      >
        Your equity research assistant powered by real-time data and web search
      </motion.p>

      {/* Try Asking Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="w-full"
      >
        <h2 className='mb-4 text-center font-medium text-muted-foreground text-xs uppercase tracking-wide'>
          Try Asking
        </h2>

        <div className="flex flex-col gap-2">
          {sampleQuestions.map((question, index) => (
            <motion.button
              key={question}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + index * 0.05 }}
              onClick={() => handleQuestionClick(question)}
              className="group w-full rounded-lg border border-border/50 bg-card/50 px-4 py-3 text-left text-sm transition-all hover:border-border hover:bg-card hover:shadow-md"
            >
              <span className="text-foreground/90 group-hover:text-foreground">
                {question}
              </span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
};
