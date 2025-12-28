import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SettingDocument = Setting & Document;

@Schema({ timestamps: true })
export class Setting {
  @Prop({ required: true, unique: true })
  key: string;

  @Prop({ required: true })
  value: string;

  @Prop()
  description: string;

  @Prop({ default: 'general' })
  category: string;

  @Prop({ default: true })
  isPublic: boolean;
}

export const SettingSchema = SchemaFactory.createForClass(Setting);

// Indexes
SettingSchema.index({ key: 1 }, { unique: true });
SettingSchema.index({ category: 1 });
SettingSchema.index({ isPublic: 1 });
