import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Setting, SettingDocument } from './schemas/setting.schema';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(Setting.name) private settingModel: Model<SettingDocument>,
  ) {}

  async create(createSettingDto: CreateSettingDto) {
    const existingSetting = await this.settingModel.findOne({ key: createSettingDto.key });
    if (existingSetting) {
      throw new ConflictException(`Setting with key "${createSettingDto.key}" already exists`);
    }
    const setting = new this.settingModel(createSettingDto);
    return setting.save();
  }

  async findAll(category?: string) {
    const query = category ? { category } : {};
    return this.settingModel.find(query).exec();
  }

  async findPublic() {
    return this.settingModel.find({ isPublic: true }).exec();
  }

  async findOne(id: string) {
    const setting = await this.settingModel.findById(id).exec();
    if (!setting) {
      throw new NotFoundException(`Setting with ID ${id} not found`);
    }
    return setting;
  }

  async findByKey(key: string) {
    const setting = await this.settingModel.findOne({ key }).exec();
    if (!setting) {
      throw new NotFoundException(`Setting with key "${key}" not found`);
    }
    return setting;
  }

  async update(id: string, updateSettingDto: UpdateSettingDto) {
    const setting = await this.settingModel
      .findByIdAndUpdate(id, updateSettingDto, { new: true })
      .exec();
    if (!setting) {
      throw new NotFoundException(`Setting with ID ${id} not found`);
    }
    return setting;
  }

  async remove(id: string) {
    const result = await this.settingModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Setting with ID ${id} not found`);
    }
    return { message: 'Setting deleted successfully' };
  }

  async seed() {
    const defaultSettings = [
      { key: 'site_name', value: 'Cinema Management System', description: 'Website name', category: 'general', isPublic: true },
      { key: 'site_description', value: 'Best cinema booking experience', description: 'Website description', category: 'general', isPublic: true },
      { key: 'contact_email', value: 'contact@cinema.com', description: 'Contact email', category: 'contact', isPublic: true },
      { key: 'contact_phone', value: '1900-1234', description: 'Contact phone number', category: 'contact', isPublic: true },
      { key: 'booking_timeout_minutes', value: '15', description: 'Booking timeout in minutes', category: 'booking', isPublic: false },
      { key: 'max_tickets_per_booking', value: '10', description: 'Maximum tickets per booking', category: 'booking', isPublic: false },
    ];

    for (const settingData of defaultSettings) {
      const existing = await this.settingModel.findOne({ key: settingData.key }).exec();
      if (!existing) {
        const setting = new this.settingModel(settingData);
        await setting.save();
      }
    }

    return { message: 'Default settings seeded successfully' };
  }
}
