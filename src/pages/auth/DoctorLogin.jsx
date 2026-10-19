import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/layout/AuthLayout';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../utils/constants';

export default function DoctorLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const validate = () => {
    const nextErrors = {};
    if (!email) nextErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = 'Enter a valid email';
    if (!password) nextErrors.password = 'Password is required';
    else if (password.length < 8) nextErrors.password = 'Password must be at least 8 characters';
    return nextErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    await login(ROLES.DOCTOR, email, password);
    setLoading(false);
    navigate('/doctor/dashboard');
  };

  const illustration = (
    <div className="text-on-primary space-y-10 text-center relative z-10">
      <div className="bg-white/10 backdrop-blur-md rounded-3xl p-10 shadow-2xl max-w-lg">
        <h2 className="font-headline text-headline-2xl font-bold mb-4">
          Healthcare that reaches every doorstep.
        </h2>
        <p className="text-body-lg opacity-80">
          JeevanDoot brings doctors, health workers and specialists together for seamless rural care.
        </p>
        <div className="grid grid-cols-3 gap-6 mt-8">
          <div className="flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-4xl text-primary-fixed">vaccines</span>
            <p className="text-label-sm opacity-80">Vaccination Drives</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-4xl text-primary-fixed">medical_information</span>
            <p className="text-label-sm opacity-80">E-Prescriptions</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-4xl text-primary-fixed">monitoring</span>
            <p className="text-label-sm opacity-80">Live Surveillance</p>
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
          <h1 className="font-headline text-headline-xl font-bold text-on-surface">Doctor Login</h1>
          <p className="text-on-surface-variant mt-1">Sign in to manage your consultations</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Input
          label="Email address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="doctor@jeevandoot.org"
          icon="mail"
          error={errors.email}
        />
        <Input
          label="Password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          icon="lock"
          error={errors.password}
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
            <input type="checkbox" className="rounded border-outline-variant text-primary focus:ring-primary" />
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
        Demo: use <span className="font-bold text-primary">doctor@jeevandoot.org</span> with any 8+ char password
      </p>
    </AuthLayout>
  );
}
