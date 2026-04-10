import mongoose, { Schema, Document, Model } from "mongoose";

export interface IEvent extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  organizer: mongoose.Types.ObjectId;
  department?: string;
  date: Date;
  venue: string;
  category: string;
  status: "pending" | "approved" | "rejected";
  hodRecommendation: "pending" | "recommended" | "not_recommended";
  hodReviewedAt?: Date;
  bannerUrl?: string;
  registeredStudents: mongoose.Types.ObjectId[];
  interestedStudents: mongoose.Types.ObjectId[];
  capacity: number;
  createdAt: Date;
  updatedAt: Date;
}

const EventSchema = new Schema<IEvent>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    organizer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    department: { type: String, index: true },
    date: { type: Date, required: true },
    venue: { type: String, required: true },
    category: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    hodRecommendation: {
      type: String,
      enum: ["pending", "recommended", "not_recommended"],
      default: "pending",
      index: true,
    },
    hodReviewedAt: { type: Date },
    bannerUrl: { type: String },
    registeredStudents: [{ type: Schema.Types.ObjectId, ref: "User" }],
    interestedStudents: [{ type: Schema.Types.ObjectId, ref: "User" }],
    capacity: { type: Number, required: true },
  },
  { timestamps: true }
);

const Event: Model<IEvent> =
  mongoose.models.Event || mongoose.model<IEvent>("Event", EventSchema);

export default Event;
