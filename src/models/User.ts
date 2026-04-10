import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: "student" | "hod" | "admin";
  department?: string;
  interests: string[];
  avatar?: string;
  isBlocked: boolean;
  blockedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["student", "hod", "admin"],
      default: "student",
    },
    department: { type: String },
    interests: [{ type: String }],
    avatar: { type: String },
    isBlocked: { type: Boolean, default: false, index: true },
    blockedAt: { type: Date },
  },
  { timestamps: true }
);

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
