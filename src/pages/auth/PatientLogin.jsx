import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/layout/AuthLayout';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../utils/constants';

const REMEMBER_KEY = 'jd_patient_id';

export default function PatientLogin() {
  const [patientId, setPatientId] = useState(() => {
    try {
      return localStorage.getItem(REMEMBER_KEY) || '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(() => Boolean(localStorage.getItem(REMEMBER_KEY)));
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, isAuthenticated, login } = useAuth();

  const validate = () => {
    const nextErrors = {};
    if (!patientId.trim()) nextErrors.patientId = 'Patient ID is required';
    if (!password) nextErrors.password = 'Password is required';
    return nextErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    try {
      if (remember) localStorage.setItem(REMEMBER_KEY, patientId.trim());
      else localStorage.removeItem(REMEMBER_KEY);
    } catch {
      // ignore storage errors
    }

    setLoading(true);
    await login(ROLES.PATIENT, patientId.trim(), password);
    setLoading(false);
    navigate('/patient/dashboard');
  };

  if (isAuthenticated && user?.role === ROLES.PATIENT) {
    return <Navigate to="/patient/dashboard" replace />;
  }

  const illustration = (
    <div className="text-on-primary space-y-10 text-center relative z-10">
      <div className="bg-white/10 backdrop-blur-md rounded-3xl p-10 shadow-2xl max-w-lg">
        <h2 className="font-headline text-headline-2xl font-bold mb-4">
          Your health, in your hands.
        </h2>
        <p className="text-body-lg opacity-80">
          View appointments, prescriptions and reports — your complete health record in one place.
        </p>
        <div className="grid grid-cols-3 gap-6 mt-8">
          <div className="flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-4xl text-primary-fixed">calendar_month</span>
            <p className="text-label-sm opacity-80">Appointments</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-4xl text-primary-fixed">medical_information</span>
            <p className="text-label-sm opacity-80">Prescriptions</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-4xl text-primary-fixed">monitoring</span>
            <p className="text-label-sm opacity-80">Health Tracking</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <AuthLayout illustration={illustration}>
      <div className="flex flex-col items-center gap-6 text-center mb-10">
        <div className="w-20 h-20 rounded-2xl bg-primary shadow-elevation2 flex items-center justify-center">
          <img src="/logo.svg" alt="JeevanDoot logo" className="w-14 h-14" />
        </div>
        <div>
          <h1 className="font-headline text-headline-xl font-bold text-on-surface">Patient Login</h1>
          <p className="text-on-surface-variant mt-1">Sign in to access your health records</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Input
          label="Patient ID"
          type="text"
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          placeholder="e.g. PT-1001"
          icon="badge"
          error={errors.patientId}
          autoComplete="username"
        />
        <Input
          label="Password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          icon="lock"
          error={errors.password}
          autoComplete="current-password"
          rightAdornment={
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="text-on-surface-variant hover:text-primary"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <span className="material-symbols-outlined">
                {showPassword ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          }
        />

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-label-md text-on-surface-variant cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="rounded border-outline-variant text-primary focus:ring-primary"
            />
            Remember me
          </label>
          <a href="#" className="text-label-md text-primary font-semibold hover:underline">
            Forgot password?
          </a>
        </div>

        <Button type="submit" fullWidth loading={loading} size="lg">
          <span className="material-symbols-outlined">login</span>
          Login to Dashboard
        </Button>
      </form>

      <p className="text-center text-label-md text-on-surface-variant mt-8">
        Demo: use <span className="font-bold text-primary">PT-1001</span> with any 8+ char password
      </p>
    </AuthLayout>
  );
}
