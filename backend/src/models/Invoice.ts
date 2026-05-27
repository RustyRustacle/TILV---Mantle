import mongoose, { Schema, Document } from 'mongoose';

export interface IInvoice extends Document {
  tokenId?: number;
  ownerAddress: string;
  amount: number;
  currency: string;
  riskScore?: number;
  riskTier?: 'prime' | 'growth' | 'emerging';
  status: 'pending' | 'funded' | 'repaid' | 'defaulted';
  fileUrl?: string;
  metadata?: Record<string, unknown>;
  ipfsCid?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceSchema = new Schema<IInvoice>(
  {
    tokenId: { type: Number, sparse: true },
    ownerAddress: { type: String, required: true, lowercase: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USDT' },
    riskScore: { type: Number },
    riskTier: { type: String, enum: ['prime', 'growth', 'emerging'] },
    status: { type: String, enum: ['pending', 'funded', 'repaid', 'defaulted'], default: 'pending', index: true },
    fileUrl: { type: String },
    metadata: { type: Schema.Types.Mixed },
    ipfsCid: { type: String },
  },
  { timestamps: true }
);

InvoiceSchema.index({ status: 1, createdAt: -1 });

export const Invoice = mongoose.model<IInvoice>('Invoice', InvoiceSchema);
