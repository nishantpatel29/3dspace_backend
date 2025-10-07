 const mongoose = require('mongoose');

 const DesignFileSchema = new mongoose.Schema({
   user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
   name: { type: String, required: true, trim: true },
   description: { type: String, trim: true },
   sceneData: { type: Object, required: true },
   createdAt: { type: Date, default: Date.now },
   updatedAt: { type: Date, default: Date.now },
 });

 DesignFileSchema.pre('save', function(next) {
   this.updatedAt = new Date();
   next();
 });

 module.exports = mongoose.model('DesignFile', DesignFileSchema);


