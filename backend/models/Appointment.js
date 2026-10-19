import mongoose from 'mongoose';

export const APPOINTMENT_STATUSES = Object.freeze([
  'upcoming',
  'completed',
  'cancelled',
]);

const appointmentSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      index: true,
    },
    purpose: { type: String, default: 'general' },
    date: { type: Date, required: true },
    startTime: { type: String, required: true }, // e.g. "10:00"
    endTime: { type: String, default: '' },
    status: {
      type: String,
      enum: APPOINTMENT_STATUSES,
      default: 'upcoming',
      index: true,
    },
    notes: { type: String, default: '' },
    cancelledAt: { type: Date, default: null },
    cancelledReason: { type: String, default: '' },
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        return ret;
      },
    },
  }
);

appointmentSchema.index({ doctor: 1, date: 1, startTime: 1 });
appointmentSchema.index({ patient: 1, date: 1 });
// Database-level double-booking guard for upcoming slots. The application
// still checks first for friendly errors; 11000 violations surface as 409
// through the existing error handler.
appointmentSchema.index(
  { doctor: 1, date: 1, startTime: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'upcoming' } }
);

export const Appointment = mongoose.model('Appointment', appointmentSchema);
export default Appointment;
