'use client';
import { useAuth } from '@/components/AuthProvider';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useState } from 'react';
import TrainerDashboard from '@/components/TrainerDashboard';
import AdminDashboard from '@/components/AdminDashboard';

export default function Home() {
  const { user, loading, isAdmin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      alert("Login failed!");
    }
  };

  if (loading) return <div>Loading...</div>;

  if (!user) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '100vh', backgroundColor: '#fdfdfd', padding: '1rem' }}>
        
        {/* Brand Logo */}
        <div className="mb-3 text-center">
          <div style={{ width: '150px', height: '150px', margin: '0 auto', borderRadius: '15px', overflow: 'hidden', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }}>
            <img src="/logo.jpg" alt="Amboo Shaggaa Skate Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        </div>

        {/* Login Card */}
        <div className="card shadow-lg border-0 rounded-4 p-4 p-md-4" style={{ width: '100%', maxWidth: '420px', backgroundColor: '#fff' }}>
          <div className="text-center mb-4">
            <small className="fw-bold" style={{ color: '#ffae00', letterSpacing: '1px' }}>— WELCOME BACK! —</small>
            <h2 className="fw-bolder mt-1 mb-1" style={{ fontSize: '1.75rem' }}>SKATE <span style={{ color: '#ffae00' }}>HOUSE</span></h2>
            <p className="text-muted small m-0">Login to continue to your account</p>
          </div>
          
          <form onSubmit={handleLogin}>
            <div className="mb-3">
              <label className="form-label fw-bold small text-dark d-flex align-items-center gap-2 mb-1">
                <i className="bi bi-envelope-fill text-primary"></i> Email
              </label>
              <div className="input-group">
                <span className="input-group-text border-0 bg-light text-primary">
                  <i className="bi bi-envelope"></i>
                </span>
                <input 
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  className="form-control border-0 bg-light py-2" 
                  placeholder="admin@ambooshaggaa.com"
                  required 
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label fw-bold small text-dark d-flex align-items-center gap-2 mb-1">
                <i className="bi bi-lock-fill text-primary"></i> Password
              </label>
              <div className="input-group">
                <span className="input-group-text border-0 bg-light text-dark">
                  <i className="bi bi-lock-fill"></i>
                </span>
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  className="form-control border-0 bg-light py-2" 
                  placeholder="••••••••••"
                  required 
                />
                <span 
                  className="input-group-text border-0 bg-light text-muted" 
                  style={{ cursor: 'pointer' }}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <i className={`bi ${showPassword ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i>
                </span>
              </div>
            </div>

            <div className="text-end mb-4">
              <a href="#" className="text-decoration-none small fw-bold" style={{ color: '#007bff' }}>Forgot Password?</a>
            </div>

            <button type="submit" className="btn btn-primary w-100 fw-bold py-2 rounded-3 d-flex justify-content-center align-items-center gap-2" style={{ backgroundColor: '#007bff', border: 'none' }}>
              <i className="bi bi-unlock-fill"></i> LOGIN
            </button>
          </form>
        </div>

        {/* Footer Features */}
        <div className="mt-4 pt-2 w-100 row text-center" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="col-3">
            <i className="bi bi-shield-check text-primary fs-5 mb-1 d-block"></i>
            <small className="fw-bold" style={{ fontSize: '9px', letterSpacing: '0.5px' }}>SAFE & SECURE</small>
          </div>
          <div className="col-3">
            <i className="bi bi-lightning text-warning fs-4 mb-2 d-block"></i>
            <small className="fw-bold" style={{ fontSize: '10px', letterSpacing: '0.5px' }}>FAST & EASY</small>
          </div>
          <div className="col-3">
            <i className="bi bi-people text-primary fs-4 mb-2 d-block"></i>
            <small className="fw-bold" style={{ fontSize: '10px', letterSpacing: '0.5px' }}>COMMUNITY</small>
          </div>
          <div className="col-3">
            <i className="bi bi-trophy text-warning fs-4 mb-2 d-block"></i>
            <small className="fw-bold" style={{ fontSize: '10px', letterSpacing: '0.5px' }}>ACHIEVE MORE</small>
          </div>
        </div>
      </div>
    );

  }

  return (
    <>
      {isAdmin ? <AdminDashboard /> : <TrainerDashboard />}
    </>
  );
}
