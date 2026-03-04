CREATE TABLE "ai_chatbot"."SentimentAnalysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"headline" text NOT NULL,
	"company" text,
	"status" varchar NOT NULL,
	"sentimentScore" real NOT NULL,
	"confidence" varchar(20) NOT NULL,
	"confidencePercent" integer NOT NULL,
	"rationale" text,
	"createdAt" timestamp NOT NULL
);
