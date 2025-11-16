const mongoose = require('mongoose');

const maintenanceSchema = new mongoose.Schema({
    isActive: {
        type: Boolean,
        default: false,
        required: true
    },
    estimatedEndTime: {
        type: Date,
        default: null
    },
    message: {
        type: String,
        default: 'We are currently performing scheduled maintenance. Please check back soon!'
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
}, {
    timestamps: true
});

maintenanceSchema.statics.getSetting = async function () {
    let setting = await this.findOne();
    if (!setting) {
        setting = await this.create({ isActive: false });
    }
    return setting;
};

maintenanceSchema.statics.updateSetting = async function (data, userId) {
    let setting = await this.findOne();
    if (!setting) {
        setting = new this({ ...data, updatedBy: userId });
    } else {
        Object.assign(setting, data);
        setting.updatedBy = userId;
    }
    await setting.save();
    return setting;
};

module.exports = mongoose.model('Maintenance', maintenanceSchema);
