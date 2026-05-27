import mongoose, { Schema, Document } from 'mongoose';

export interface IProfile extends Document {
  walletAddress: string;
  role: 'borrower' | 'investor' | 'admin';
  email?: string;
  companyName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProfileSchema = new Schema<IProfile>(
  {
    walletAddress: { type: String, required: true, unique: true, lowercase: true, index: true },
    role: { type: String, enum: ['borrower', 'investor', 'admin'], default: 'borrower' },
    email: { type: String },
    companyName: { type: String },
  },
  { timestamps: true }
);

export const Profile = mongoose.model<IProfile>('Profile', ProfileSchema);
