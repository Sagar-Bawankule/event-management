import mongoose, { Document, Model, Schema } from "mongoose";

export interface IContactInfo extends Document {
  _id: mongoose.Types.ObjectId;
  phone: string;
  email: string;
  address: string;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ContactInfoSchema = new Schema<IContactInfo>(
  {
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    address: { type: String, required: true, trim: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const ContactInfo: Model<IContactInfo> =
  mongoose.models.ContactInfo ||
  mongoose.model<IContactInfo>("ContactInfo", ContactInfoSchema);

export default ContactInfo;
