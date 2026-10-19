import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/layout/AuthLayout';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../utils/constants';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const validate = () => {
    const nextErrors = {};
    if (!email) nextErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = 'Enter a valid email';
    if (!password) nextErrors.password = 'Password is required';
    return nextErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    setLoginError('');
    try {
      await login(ROLES.ADMIN, email, password);
      navigate('/admin/dashboard');
    } catch (err) {
      setLoginError(err?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const illustration = (
    <div className="text-on-primary space-y-10 text-center relative z-10">
      <div className="bg-white/10 backdrop-blur-md rounded-3xl p-10 shadow-2xl max-w-lg">
        <h2 className="font-headline text-headline-2xl font-bold mb-4">
          Command centre for community health.
        </h2>
        <p className="text-body-lg opacity-80">
          Monitor disease clusters, oversee doctor & health-worker performance and steer evidence-based public health decisions.
        </p>
        <div className="grid grid-cols-3 gap-6 mt-8">
          <div className="flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-4xl text-primary-fixed">analytics</span>
            <p className="text-label-sm opacity-80">Live Analytics</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-4xl text-primary-fixed">public_health</span>
            <p className="text-label-sm opacity-80">Disease Surveillance</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-4xl text-primary-fixed">shield_person</span>
            <p className="text-label-sm opacity-80">Audit Trail</p>
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
          <h1 className="font-headline text-headline-xl font-bold text-on-surface">
            Admin &amp; Government Login
          </h1>
          <p className="text-on-surface-variant mt-1">
            Secure access for administrators and government health officials
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Input
          label="Email address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@jeevandoot.org"
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
            Keep me signed in
          </label>
          <a href="#" className="text-label-md text-primary font-semibold hover:underline">
            Forgot password?
          </a>
        </div>

        {loginError && (
          <div className="rounded-lg bg-error-container px-4 py-3 text-label-md text-on-error-container">
            {loginError}
          </div>
        )}

        <Button type="submit" fullWidth loading={loading} size="lg">
          <span className="material-symbols-outlined">admin_panel_settings</span>
          Secure Sign In
        </Button>
      </form>

      <p className="text-center text-label-md text-on-surface-variant mt-8">
        Demo: use <span className="font-bold text-primary">admin@jeevandoot.org</span> with password <span className="font-bold text-primary">Password@123</span>
      </p>
    </AuthLayout>
  );
}
