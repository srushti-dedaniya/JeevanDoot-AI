import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../../components/layout/DashboardLayout';
import PatientSidebar from '../../components/layout/PatientSidebar';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import { doctorService } from '../../services/doctorService';
import { appointmentService } from '../../services/appointmentService';
import { patientService } from '../../services/patientService';
import { useAuth } from '../../hooks/useAuth';
import { formatDate } from '../../utils/formatDate';

const SPECIALTIES = [
  'General Medicine',
  'Cardiology',
  'Pediatrics',
  'Dermatology',
  'Orthopedics',
  'Neurology',
  'Gynecology',
  'Ophthalmology',
  'ENT',
  'Psychiatry',
];

export default function BookAppointment() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [filteredDoctors, setFilteredDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [form, setForm] = useState({
    date: '',
    startTime: '',
    purpose: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    const loadDoctors = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await doctorService.getAll();
        setDoctors(data);
        setFilteredDoctors(data);
      } catch (err) {
        console.error('Failed to load doctors:', err);
        setError(err?.message || 'Failed to load doctors');
      } finally {
        setLoading(false);
      }
    };
    loadDoctors();
  }, []);

  useEffect(() => {
    let filtered = doctors;
    if (search) {
      const term = search.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.name?.toLowerCase().includes(term) ||
          d.specialty?.toLowerCase().includes(term) ||
          d.hospital?.toLowerCase().includes(term)
      );
    }
    if (selectedSpecialty) {
      filtered = filtered.filter((d) => d.specialty === selectedSpecialty);
    }
    setFilteredDoctors(filtered);
  }, [search, selectedSpecialty, doctors]);

  const openBooking = (doctor) => {
    setSelectedDoctor(doctor);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setForm({
      date: tomorrow.toISOString().slice(0, 10),
      startTime: '09:00',
      purpose: 'General consultation',
      notes: '',
    });
    setSubmitError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedDoctor(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.date || !form.startTime || !form.purpose) {
      setSubmitError('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const patient = await patientService.getMyProfile();
      await appointmentService.create({
        patient: patient.id,
        doctor: selectedDoctor._id,
        purpose: form.purpose,
        date: form.date,
        startTime: form.startTime,
        notes: form.notes,
      });
      closeModal();
      window.location.href = '/patient/appointments';
    } catch (err) {
      console.error('Booking failed:', err);
      setSubmitError(err?.message || 'Failed to book appointment');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout
        sidebar={<PatientSidebar />}
        headerProps={{ title: t('patient.bookAppointment.title'), subtitle: t('patient.bookAppointment.subtitle') }}
      >
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout
        sidebar={<PatientSidebar />}
        headerProps={{ title: t('patient.bookAppointment.title'), subtitle: t('patient.bookAppointment.subtitle') }}
      >
        <Card className="max-w-2xl mx-auto text-center py-12">
          <span className="material-symbols-outlined text-6xl text-error mb-4 block">error</span>
          <h3 className="font-headline text-title-lg font-bold mb-2">{t('common.error')}</h3>
          <p className="text-on-surface-variant mb-6">{error}</p>
          <Button onClick={() => window.location.reload()} icon="refresh">
            {t('common.refresh')}
          </Button>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      sidebar={<PatientSidebar />}
      headerProps={{ title: t('patient.bookAppointment.title'), subtitle: t('patient.bookAppointment.subtitle') }}
    >
      <div className="space-y-6">
        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label={t('patient.bookAppointment.searchDoctors')}
              placeholder={t('patient.bookAppointment.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon="search"
            />
            <Input
              label={t('patient.bookAppointment.specialty')}
              placeholder={t('patient.bookAppointment.allSpecialties')}
              value={selectedSpecialty}
              onChange={(e) => setSelectedSpecialty(e.target.value)}
              type="select"
              options={['', ...SPECIALTIES].map((s) => ({ value: s, label: s || t('patient.bookAppointment.allSpecialties') }))}
              icon="medical_services"
            />
            <div className="flex items-end">
              <Button variant="outline" fullWidth icon="refresh" onClick={() => { setSearch(''); setSelectedSpecialty(''); }}>
                {t('common.clear')}
              </Button>
            </div>
          </div>
        </Card>

        {filteredDoctors.length === 0 ? (
          <Card className="p-12 text-center">
            <span className="material-symbols-outlined text-6xl text-on-surface-variant/50 mb-4 block">search_off</span>
            <h3 className="font-headline text-title-lg font-bold mb-2">{t('patient.bookAppointment.noDoctorsFound')}</h3>
            <p className="text-on-surface-variant">
              {search || selectedSpecialty ? t('patient.bookAppointment.tryDifferentFilters') : t('patient.bookAppointment.noDoctorsRegistered')}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDoctors.map((doctor) => (
              <Card key={doctor.id} className="h-full flex flex-col">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-primary-container flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-2xl text-on-primary-container">person</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-headline text-headline-sm font-bold text-on-surface truncate">{doctor.name}</h3>
                    <p className="text-label-md text-on-surface-variant truncate">{doctor.specialty || 'General Medicine'}</p>
                    <p className="text-label-sm text-on-surface-variant flex items-center gap-1 mt-1">
                      <span className="material-symbols-outlined text-xs">location_on</span>
                      {doctor.hospital || 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge variant="neutral" className="text-label-sm">
                    <span className="material-symbols-outlined text-xs mr-1">medical_services</span>
                    {doctor.specialty || 'General Medicine'}
                  </Badge>
                  {doctor.experience && (
                    <Badge variant="outline" className="text-label-sm">
                      <span className="material-symbols-outlined text-xs mr-1">star</span>
                      {doctor.experience} yrs exp
                    </Badge>
                  )}
                  {doctor.availability?.status && (
                    <Badge variant={doctor.availability.status === 'online' ? 'success' : 'neutral'} className="text-label-sm">
                      <span className="material-symbols-outlined text-xs mr-1">{doctor.availability.status === 'online' ? 'circle' : 'circle_outlined'}</span>
                      {t(`doctor.availability.${doctor.availability.status}`)}
                    </Badge>
                  )}
                </div>
                <div className="mt-auto pt-4 border-t border-outline-variant">
                  <Button fullWidth icon="event" onClick={() => openBooking(doctor)}>
                    {t('patient.bookAppointment.bookNow')}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Modal
          open={modalOpen}
          onClose={closeModal}
          title={selectedDoctor ? t('patient.bookAppointment.bookWith', { name: selectedDoctor.name }) : t('patient.bookAppointment.bookAppointment')}
          icon="event"
          size="lg"
          footer={
            <>
              <Button variant="outline" onClick={closeModal} disabled={submitting}>
                {t('common.cancel')}
              </Button>
              <Button icon="check" onClick={handleSubmit} loading={submitting} disabled={submitting}>
                {t('patient.bookAppointment.confirmBooking')}
              </Button>
            </>
          }
        >
          {selectedDoctor && (
            <div className="space-y-5">
              <div className="bg-surface-container-low rounded-lg p-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary-container flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl text-on-primary-container">person</span>
                  </div>
                  <div>
                    <p className="font-headline text-title-md font-bold text-on-surface">{selectedDoctor.name}</p>
                    <p className="text-label-md text-on-surface-variant">{selectedDoctor.specialty || 'General Medicine'}</p>
                    <p className="text-label-sm text-on-surface-variant flex items-center gap-1 mt-0.5">
                      <span className="material-symbols-outlined text-xs">location_on</span>
                      {selectedDoctor.hospital || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {submitError && (
                <div className="rounded-lg bg-error-container px-4 py-3 text-label-md text-on-error-container">
                  {submitError}
                </div>
              )}

              <div className="space-y-4">
                <Input
                  label={t('common.date')}
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  min={new Date().toISOString().slice(0, 10)}
                  required
                  icon="calendar_month"
                />
                <Input
                  label={t('common.time')}
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                  required
                  icon="schedule"
                />
                <Input
                  label={t('patient.bookAppointment.purpose')}
                  placeholder={t('patient.bookAppointment.purposePlaceholder')}
                  value={form.purpose}
                  onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
                  required
                  icon="medical_services"
                />
                <Input
                  label={t('common.notes')}
                  placeholder={t('patient.bookAppointment.notesPlaceholder')}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  icon="sticky_note_2"
                  multiline
                  rows={3}
                />
              </div>
            </div>
          )}
        </Modal>
      </div>
    </DashboardLayout>
  );
}