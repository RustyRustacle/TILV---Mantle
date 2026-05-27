import mongoose, { Schema, Document } from 'mongoose';

export interface IVaultPosition extends Document {
  investorAddress: string;
  vaultTier: 0 | 1 | 2;
  deposited: number;
  yieldEarned: number;
  shares: number;
  createdAt: Date;
  updatedAt: Date;
}

const VaultPositionSchema = new Schema<IVaultPosition>(
  {
    investorAddress: { type: String, required: true, lowercase: true, index: true },
    vaultTier: { type: Number, enum: [0, 1, 2], required: true },
    deposited: { type: Number, default: 0 },
    yieldEarned: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
  },
  { timestamps: true }
);

VaultPositionSchema.index({ investorAddress: 1, vaultTier: 1 }, { unique: true });

export const VaultPosition = mongoose.model<IVaultPosition>('VaultPosition', VaultPositionSchema);
