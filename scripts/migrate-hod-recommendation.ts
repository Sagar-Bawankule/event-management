import "dotenv/config";
import mongoose from "mongoose";

type EventStatus = "pending" | "approved" | "rejected";
type HodRecommendation = "pending" | "recommended" | "not_recommended";

interface EventRecord {
  _id: mongoose.Types.ObjectId;
  title?: string;
  status: EventStatus;
  hodRecommendation?: string;
  hodReviewedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/Event_Management";

const EventSchema = new mongoose.Schema(
  {
    title: { type: String },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
    },
    hodRecommendation: {
      type: String,
      enum: ["pending", "recommended", "not_recommended"],
    },
    hodReviewedAt: { type: Date },
  },
  { timestamps: true, strict: false }
);

const Event =
  mongoose.models.Event || mongoose.model<EventRecord>("Event", EventSchema);

function isValidRecommendation(
  value: unknown
): value is HodRecommendation {
  return (
    value === "pending" ||
    value === "recommended" ||
    value === "not_recommended"
  );
}

function resolveRecommendation(event: EventRecord): HodRecommendation {
  const current = event.hodRecommendation;

  if (isValidRecommendation(current)) {
    if (event.status !== "pending" && current === "pending") {
      return "recommended";
    }
    return current;
  }

  return event.status === "pending" ? "pending" : "recommended";
}

async function run() {
  const applyChanges = process.argv.includes("--apply");

  console.log("Starting migration: HOD recommendation stage backfill");
  console.log(`Mode: ${applyChanges ? "APPLY" : "DRY-RUN"}`);

  await mongoose.connect(MONGODB_URI);

  try {
    const events = (await Event.find()
      .select(
        "title status hodRecommendation hodReviewedAt createdAt updatedAt"
      )
      .lean()) as EventRecord[];

    const plannedUpdates: Array<{
      id: mongoose.Types.ObjectId;
      set: { hodRecommendation: HodRecommendation; hodReviewedAt?: Date };
      before: string;
      after: string;
      title: string;
    }> = [];

    for (const event of events) {
      const nextRecommendation = resolveRecommendation(event);
      const needsReviewedAt =
        nextRecommendation !== "pending" && !event.hodReviewedAt;

      const hasRecommendationChange =
        event.hodRecommendation !== nextRecommendation;

      if (!hasRecommendationChange && !needsReviewedAt) {
        continue;
      }

      const reviewedAt =
        nextRecommendation !== "pending"
          ? event.hodReviewedAt || event.updatedAt || event.createdAt || new Date()
          : event.hodReviewedAt;

      plannedUpdates.push({
        id: event._id,
        set: {
          hodRecommendation: nextRecommendation,
          ...(reviewedAt ? { hodReviewedAt: reviewedAt } : {}),
        },
        before: event.hodRecommendation || "undefined",
        after: nextRecommendation,
        title: event.title || "Untitled Event",
      });
    }

    console.log(`Total events scanned: ${events.length}`);
    console.log(`Events needing update: ${plannedUpdates.length}`);

    if (plannedUpdates.length > 0) {
      console.log("Preview (up to 10 updates):");
      for (const update of plannedUpdates.slice(0, 10)) {
        console.log(
          `- ${update.title}: ${update.before} -> ${update.after} (${update.id.toString()})`
        );
      }
    }

    if (!applyChanges) {
      console.log(
        "Dry run complete. Run with --apply to persist migration changes."
      );
      return;
    }

    if (plannedUpdates.length === 0) {
      console.log("No updates required.");
      return;
    }

    const result = await Event.bulkWrite(
      plannedUpdates.map((update) => ({
        updateOne: {
          filter: { _id: update.id },
          update: { $set: update.set },
        },
      }))
    );

    console.log(`Migration completed. Modified events: ${result.modifiedCount}`);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
