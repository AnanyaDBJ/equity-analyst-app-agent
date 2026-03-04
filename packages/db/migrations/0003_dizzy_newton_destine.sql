CREATE TABLE "ai_chatbot"."SectorNews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sectorId" varchar(50) NOT NULL,
	"headline" text NOT NULL,
	"source" varchar(100),
	"relatedSymbols" json,
	"sentimentStatus" varchar NOT NULL,
	"sentimentScore" real NOT NULL,
	"confidence" varchar(20) NOT NULL,
	"confidencePercent" integer NOT NULL,
	"impactScore" real DEFAULT 0 NOT NULL,
	"rationale" text,
	"analyzedAt" timestamp NOT NULL
);
