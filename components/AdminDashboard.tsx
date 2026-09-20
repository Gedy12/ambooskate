'use client';
import { useState, useEffect } from 'react';
import { initDB, offlineWrite } from '@/lib/db';
import { signOut, getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { initializeApp, getApps } from 'firebase/app';
import { auth, firebaseConfig, db as firestore } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Skate {
  id: string;
  name: string;
  status: 'Available' | 'Active' | 'Paused' | 'Finished' | 'Maintenance';
}

interface Session {
  id: string;
  skateId: string;
  startTime: number;
  endTime: number;
  pausedAt: number | null;
  status: 'active' | 'completed' | 'cancelled';
  price: number;
}

interface Trainer {
  id: string;
  email: string;
  password?: string;
  createdAt: number;
}

const mockChartData = [
  { name: 'Mon', revenue: 4000 },
  { name: 'Tue', revenue: 3000 },
  { name: 'Wed', revenue: 2000 },
  { name: 'Thu', revenue: 2780 },
  { name: 'Fri', revenue: 1890 },
  { name: 'Sat', revenue: 2390 },
  { name: 'Sun', revenue: 3490 },
];

export default function AdminDashboard() {
  const [skates, setSkates] = useState<Skate[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Trainer Form
  const [newTrainerEmail, setNewTrainerEmail] = useState('');
  const [newTrainerPassword, setNewTrainerPassword] = useState('');
  const [isCreatingTrainer, setIsCreatingTrainer] = useState(false);

  // Settings Form
  const [pricing, setPricing] = useState<{id: string, price30Min: number, price60Min: number}>({ id: 'default', price30Min: 150, price60Min: 250 });
  const [newSkateName, setNewSkateName] = useState('');

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);

    const unsubSkates = onSnapshot(collection(firestore, 'skates'), async (snapshot) => {
      const db = await initDB();
      const tx = db.transaction('skates', 'readwrite');
      snapshot.docChanges().forEach(change => {
        if (change.type === 'removed') tx.objectStore('skates').delete(change.doc.id);
        else tx.objectStore('skates').put({ id: change.doc.id, ...change.doc.data() } as any);
      });
      await tx.done;
      loadData();
    });

    const unsubSessions = onSnapshot(collection(firestore, 'sessions'), async (snapshot) => {
      const db = await initDB();
      const tx = db.transaction('sessions', 'readwrite');
      snapshot.docChanges().forEach(change => {
        if (change.type === 'removed') tx.objectStore('sessions').delete(change.doc.id);
        else tx.objectStore('sessions').put({ id: change.doc.id, ...change.doc.data() } as any);
      });
      await tx.done;
      loadData();
    });

    const unsubPricing = onSnapshot(collection(firestore, 'pricing'), async (snapshot) => {
      const db = await initDB();
      const tx = db.transaction('pricing', 'readwrite');
      snapshot.docChanges().forEach(change => {
        if (change.type === 'removed') tx.objectStore('pricing').delete(change.doc.id);
        else tx.objectStore('pricing').put({ id: change.doc.id, ...change.doc.data() } as any);
      });
      await tx.done;
      loadData();
    });

    return () => {
      clearInterval(interval);
      unsubSkates();
      unsubSessions();
      unsubPricing();
    };
  }, []);

  const loadData = async () => {
    const db = await initDB();
    const allSkates = await db.getAll('skates');
    const allSessions = await db.getAll('sessions');
    const allTrainers = await db.getAll('trainers');
    const p = await db.get('pricing', 'default');
    
    setSkates(allSkates.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })));
    setSessions(allSessions.sort((a, b) => b.startTime - a.startTime));
    setTrainers(allTrainers);
    if (p) setPricing(p);
  };

  const handleUpdatePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    await offlineWrite('pricing', 'default', pricing, 'set');
    alert('Pricing successfully updated!');
  };

  const handleAddSkate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkateName) return;
    const newSkate: Skate = {
      id: Date.now().toString(),
      name: newSkateName,
      status: 'Available'
    };
    await offlineWrite('skates', newSkate.id, newSkate, 'set');
    setSkates([...skates, newSkate].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })));
    setNewSkateName('');
  };

  const handleDeleteSkate = async (id: string) => {
    if (confirm("Are you sure you want to permanently delete this skate?")) {
      await offlineWrite('skates', id, null, 'delete');
      setSkates(skates.filter(s => s.id !== id));
    }
  };

  const handleSetMaintenance = async (skate: Skate) => {
    const newStatus = skate.status === 'Maintenance' ? 'Available' : 'Maintenance';
    const updated = { ...skate, status: newStatus as any };
    await offlineWrite('skates', skate.id, updated, 'update');
    setSkates(skates.map(s => s.id === skate.id ? updated : s));
  };

  const handleCreateTrainer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingTrainer(true);
    try {
      const secondaryApp = getApps().find(app => app.name === 'Secondary') || initializeApp(firebaseConfig, 'Secondary');
      const secondaryAuth = getAuth(secondaryApp);

      await createUserWithEmailAndPassword(secondaryAuth, newTrainerEmail, newTrainerPassword);
      await secondaryAuth.signOut();

      const newTrainer: Trainer = {
        id: Date.now().toString(),
        email: newTrainerEmail,
        password: newTrainerPassword,
        createdAt: Date.now()
      };

      await offlineWrite('trainers', newTrainer.id, newTrainer, 'set');
      setTrainers([...trainers, newTrainer]);
      setNewTrainerEmail('');
      setNewTrainerPassword('');
      alert('Trainer account successfully created!');
    } catch (error: any) {
      alert('Failed to create trainer: ' + error.message);
    }
    setIsCreatingTrainer(false);
  };

  const handleDeleteTrainer = async (trainer: Trainer) => {
    if (!confirm(`Are you sure you want to delete ${trainer.email}?`)) return;
    try {
      const secondaryApp = getApps().find(app => app.name === 'Secondary') || initializeApp(firebaseConfig, 'Secondary');
      const secondaryAuth = getAuth(secondaryApp);
      
      const credential = await signInWithEmailAndPassword(secondaryAuth, trainer.email, trainer.password || '');
      await deleteUser(credential.user);
      
      await offlineWrite('trainers', trainer.id, null, 'delete');
      setTrainers(trainers.filter(t => t.id !== trainer.id));
      alert('Trainer account securely wiped from Firebase.');
    } catch (error: any) {
      alert('Error deleting trainer: ' + error.message);
    }
  };

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;

  let totalRevenue = 0;
  let todayRevenue = 0;
  let yesterdayRevenue = 0;

  sessions.filter(s => s.status === 'completed').forEach(s => {
    totalRevenue += s.price;
    if (s.startTime >= todayStart) todayRevenue += s.price;
    else if (s.startTime >= yesterdayStart && s.startTime < todayStart) yesterdayRevenue += s.price;
  });

  const calculateDuration = (session: Session) => session.price === pricing.price30Min ? '30 min' : '60 min';

  return (
    <div className="d-flex flex-column flex-lg-row w-100" style={{ height: '100vh', backgroundColor: '#f9fafc', fontFamily: 'system-ui, -apple-system, sans-serif', overflow: 'hidden' }}>
      
      {/* Mobile/Tablet Header Toggle */}
      <div className="d-lg-none bg-dark text-white p-3 d-flex justify-content-between align-items-center w-100 z-3 sticky-top shadow-sm">
        <h5 className="m-0 fw-bold d-flex align-items-center gap-2">
          <i className="bi bi-speedometer2 text-primary"></i> ADMIN
        </h5>
        <button className="btn btn-outline-light btn-sm border-0" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
          <i className={`bi fs-3 ${isSidebarOpen ? 'bi-x' : 'bi-list'}`}></i>
        </button>
      </div>

      {/* Sidebar Overlay (Mobile/Tablet) */}
      {isSidebarOpen && (
        <div className="position-fixed top-0 start-0 w-100 h-100 bg-black bg-opacity-50 z-2 d-lg-none" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'position-fixed d-flex' : 'd-none d-lg-flex'} flex-column top-0 start-0 z-3 h-100 shadow-sm`} 
           style={{ width: '260px', backgroundColor: '#1a1f2c', color: 'white', transition: '0.3s', flexShrink: 0 }}>
        <div className="p-4 d-flex align-items-center gap-3">
          <div style={{ width: '35px', height: '35px', backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden' }}>
            <img src="/logo.jpg" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <h5 className="m-0 fw-bold lh-sm">AMBOO SHAGGAA<br/>SKATE</h5>
        </div>
        
        <div className="flex-grow-1 px-3 mt-3">
          <div className={`p-3 rounded-3 mb-2 d-flex align-items-center gap-3 ${activeTab === 'Dashboard' ? 'bg-primary' : 'text-white-50 hover-text-white'}`} style={{ cursor: 'pointer', transition: '0.2s', backgroundColor: activeTab === 'Dashboard' ? '#5a54f9' : 'transparent' }} onClick={() => { setActiveTab('Dashboard'); setIsSidebarOpen(false); }}>
            <i className="bi bi-house-door-fill fs-5"></i>
            <span className="fw-bold">Dashboard</span>
          </div>
          <div className={`p-3 rounded-3 mb-2 d-flex align-items-center gap-3 ${activeTab === 'Trainers' ? 'bg-primary' : 'text-white-50 hover-text-white'}`} style={{ cursor: 'pointer', transition: '0.2s', backgroundColor: activeTab === 'Trainers' ? '#5a54f9' : 'transparent' }} onClick={() => { setActiveTab('Trainers'); setIsSidebarOpen(false); }}>
            <i className="bi bi-people-fill fs-5"></i>
            <span className="fw-bold">Trainers</span>
          </div>
          <div className={`p-3 rounded-3 mb-2 d-flex align-items-center gap-3 ${activeTab === 'Settings' ? 'bg-primary' : 'text-white-50 hover-text-white'}`} style={{ cursor: 'pointer', transition: '0.2s', backgroundColor: activeTab === 'Settings' ? '#5a54f9' : 'transparent' }} onClick={() => { setActiveTab('Settings'); setIsSidebarOpen(false); }}>
            <i className="bi bi-gear-fill fs-5"></i>
            <span className="fw-bold">Settings</span>
          </div>
        </div>

        <div className="mt-auto border-top border-secondary p-3">
          <div className="d-flex align-items-center gap-3 p-2 rounded-3 mb-3" style={{ backgroundColor: '#141824' }}>
            <div className="rounded-circle bg-primary d-flex align-items-center justify-content-center fw-bold" style={{ width: '40px', height: '40px' }}>SA</div>
            <div>
              <div className="fw-bold small">Super Admin</div>
              <div className="small text-success d-flex align-items-center gap-1">
                <div className="rounded-circle bg-success" style={{ width: '8px', height: '8px' }}></div> Online
              </div>
            </div>
          </div>
          <div className="px-2 text-white-50 d-flex align-items-center gap-3" style={{ cursor: 'pointer' }} onClick={() => signOut(auth)}>
            <i className="bi bi-box-arrow-right fs-5"></i>
            <span className="fw-bold">Logout</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-grow-1 d-flex flex-column" style={{ overflowY: 'auto', overflowX: 'hidden' }}>
        
        {activeTab === 'Dashboard' && (
          <>
            <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-end p-4 p-md-5 pb-3 gap-3">
              <div>
                <h2 className="fw-bolder m-0" style={{ color: '#000' }}>Welcome back, Super Admin! 👋</h2>
                <p className="text-muted m-0 mt-2">Here's what's happening with your skate house today.</p>
              </div>
              <div>
                <button className="btn btn-white bg-white border shadow-sm rounded-3 d-flex align-items-center gap-2 fw-bold text-muted px-3 py-2 w-100 justify-content-between">
                  <span className="d-flex align-items-center gap-2"><i className="bi bi-calendar3"></i> Sep 20, 2026</span> <i className="bi bi-chevron-down ms-2"></i>
                </button>
              </div>
            </div>

            <div className="px-4 px-md-5">
              <div className="row g-3 mb-4">
                <div className="col-12 col-sm-6 col-xl">
                  <div className="card border-0 shadow-sm rounded-4 h-100 p-3">
                    <div className="d-flex align-items-start gap-3">
                      <div className="rounded-circle bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center" style={{ width: '50px', height: '50px', flexShrink: 0 }}><i className="bi bi-wallet2 fs-4"></i></div>
                      <div>
                        <div className="small text-muted fw-bold text-uppercase" style={{ fontSize: '10px' }}>Total Revenue</div>
                        <h3 className="fw-bolder m-0 text-primary">{totalRevenue.toLocaleString()} <span className="fs-6 text-muted">ETB</span></h3>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-12 col-sm-6 col-xl">
                  <div className="card border-0 shadow-sm rounded-4 h-100 p-3">
                    <div className="d-flex align-items-start gap-3">
                      <div className="rounded-circle bg-secondary bg-opacity-10 text-secondary d-flex align-items-center justify-content-center" style={{ width: '50px', height: '50px', flexShrink: 0 }}><i className="bi bi-calendar-x fs-4"></i></div>
                      <div>
                        <div className="small text-muted fw-bold text-uppercase" style={{ fontSize: '10px' }}>Yesterday</div>
                        <h3 className="fw-bolder m-0 text-secondary">{yesterdayRevenue.toLocaleString()} <span className="fs-6 text-muted">ETB</span></h3>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-12 col-sm-6 col-xl">
                  <div className="card border-0 shadow-sm rounded-4 h-100 p-3">
                    <div className="d-flex align-items-start gap-3">
                      <div className="rounded-circle bg-success bg-opacity-10 text-success d-flex align-items-center justify-content-center" style={{ width: '50px', height: '50px', flexShrink: 0 }}><i className="bi bi-calendar-check fs-4"></i></div>
                      <div>
                        <div className="small text-muted fw-bold text-uppercase" style={{ fontSize: '10px' }}>Today's Rev...</div>
                        <h3 className="fw-bolder m-0 text-success">{todayRevenue.toLocaleString()} <span className="fs-6 text-muted">ETB</span></h3>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="row g-4 mb-4">
                <div className="col-12 col-lg-7">
                  <div className="card border-0 shadow-sm rounded-4 h-100 p-4">
                    <div className="d-flex justify-content-between align-items-center mb-4">
                      <h5 className="fw-bold m-0 d-flex align-items-center gap-2"><i className="bi bi-clock-history text-primary"></i> Recent Sessions</h5>
                    </div>
                    <div className="table-responsive">
                      <table className="table table-borderless align-middle mb-0">
                        <thead>
                          <tr className="border-bottom">
                            <th className="text-dark fw-bold pb-3">Skate</th>
                            <th className="text-dark fw-bold pb-3">Status</th>
                            <th className="text-dark fw-bold pb-3">Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sessions.slice(0, 5).map(session => (
                            <tr key={session.id} className="border-bottom">
                              <td className="fw-bolder py-3">#{skates.find(s => s.id === session.skateId)?.name}</td>
                              <td className="py-3">
                                {session.status === 'active' ? <span className="badge bg-primary rounded-pill px-3 py-2">ACTIVE</span> : <span className="badge bg-success rounded-pill px-3 py-2">COMPLETED</span>}
                              </td>
                              <td className="py-3">{session.price} ETB</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                <div className="col-12 col-lg-5">
                  <div className="card border-0 shadow-sm rounded-4 h-100 p-4">
                    <div className="d-flex justify-content-between align-items-center mb-4">
                      <h5 className="fw-bold m-0"><i className="bi bi-graph-up text-primary"></i> Overview</h5>
                    </div>
                    <div style={{ height: '300px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={mockChartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} />
                          <YAxis axisLine={false} tickLine={false} />
                          <Tooltip />
                          <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'Trainers' && (
          <div className="p-4 p-md-5">
            <div className="mb-4">
              <h2 className="fw-bolder m-0" style={{ color: '#000' }}>Manage Trainers</h2>
              <p className="text-muted m-0 mt-2">Create and manage accounts for your staff. Deleting an account revokes Firebase access.</p>
            </div>
            
            <div className="row g-4">
              <div className="col-12 col-lg-4">
                <div className="card border-0 shadow-sm rounded-4 p-4">
                  <h5 className="fw-bold mb-4"><i className="bi bi-person-plus-fill text-primary me-2"></i>New Trainer</h5>
                  <form onSubmit={handleCreateTrainer}>
                    <div className="mb-3">
                      <label className="form-label small fw-bold text-muted">Email Address</label>
                      <input type="email" className="form-control bg-light border-0 py-2" value={newTrainerEmail} onChange={e => setNewTrainerEmail(e.target.value)} required />
                    </div>
                    <div className="mb-4">
                      <label className="form-label small fw-bold text-muted">Password</label>
                      <input type="password" className="form-control bg-light border-0 py-2" value={newTrainerPassword} onChange={e => setNewTrainerPassword(e.target.value)} required />
                    </div>
                    <button type="submit" disabled={isCreatingTrainer} className="btn btn-primary w-100 fw-bold rounded-3 py-2">
                      {isCreatingTrainer ? 'Creating...' : 'Create Account'}
                    </button>
                  </form>
                </div>
              </div>

              <div className="col-12 col-lg-8">
                <div className="card border-0 shadow-sm rounded-4 p-4 h-100">
                  <h5 className="fw-bold mb-4"><i className="bi bi-people-fill text-primary me-2"></i>Active Trainers</h5>
                  <div className="table-responsive">
                    <table className="table table-borderless align-middle">
                      <thead>
                        <tr className="border-bottom">
                          <th className="text-muted small fw-bold text-uppercase pb-3">Email Address</th>
                          <th className="text-muted small fw-bold text-uppercase pb-3">Created</th>
                          <th className="text-muted small fw-bold text-uppercase text-end pb-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trainers.map(trainer => (
                          <tr key={trainer.id} className="border-bottom">
                            <td className="fw-bold">{trainer.email}</td>
                            <td className="text-muted">{new Date(trainer.createdAt).toLocaleDateString()}</td>
                            <td className="text-end">
                              <button onClick={() => handleDeleteTrainer(trainer)} className="btn btn-sm btn-outline-danger fw-bold rounded-3 px-3">
                                <i className="bi bi-trash3-fill"></i> Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                        {trainers.length === 0 && (
                          <tr>
                            <td colSpan={3} className="text-center text-muted py-5">No trainers registered yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Settings' && (
          <div className="p-4 p-md-5">
            <div className="mb-4">
              <h2 className="fw-bolder m-0" style={{ color: '#000' }}>System Settings</h2>
              <p className="text-muted m-0 mt-2">Configure pricing and manage your physical skate fleet.</p>
            </div>
            
            <div className="row g-4">
              {/* Pricing Configuration */}
              <div className="col-12 col-lg-4">
                <div className="card border-0 shadow-sm rounded-4 h-100 p-4">
                  <h5 className="fw-bold mb-4"><i className="bi bi-currency-exchange text-warning me-2"></i>Automated Pricing Logic</h5>
                  <form onSubmit={handleUpdatePricing}>
                    <div className="mb-3">
                      <label className="form-label small fw-bold text-muted">30-Minute Price (ETB)</label>
                      <input 
                        type="number" 
                        className="form-control bg-light border-0 py-2 fw-bold" 
                        value={pricing.price30Min} 
                        onChange={e => setPricing({...pricing, price30Min: Number(e.target.value)})} 
                        required 
                      />
                    </div>
                    <div className="mb-4">
                      <label className="form-label small fw-bold text-muted">60-Minute Price (ETB)</label>
                      <input 
                        type="number" 
                        className="form-control bg-light border-0 py-2 fw-bold" 
                        value={pricing.price60Min} 
                        onChange={e => setPricing({...pricing, price60Min: Number(e.target.value)})} 
                        required 
                      />
                    </div>
                    <button type="submit" className="btn btn-warning w-100 fw-bold rounded-3 py-2">Save Pricing</button>
                  </form>
                </div>
              </div>

              {/* Live Fleet Monitoring */}
              <div className="col-12 col-lg-8">
                <div className="card border-0 shadow-sm rounded-4 h-100 p-4">
                  <h5 className="fw-bold mb-4"><i className="bi bi-ui-checks-grid text-primary me-2"></i>Skate Fleet Management</h5>
                  
                  <form onSubmit={handleAddSkate} className="mb-4 d-flex gap-2">
                    <input 
                      type="text" 
                      className="form-control bg-light border-0 py-2" 
                      placeholder="Enter Skate Number (e.g. 05)" 
                      value={newSkateName}
                      onChange={e => setNewSkateName(e.target.value)}
                    />
                    <button type="submit" className="btn btn-primary fw-bold text-nowrap rounded-3 px-4">
                      <i className="bi bi-plus-lg"></i> Add
                    </button>
                  </form>

                  <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    <table className="table table-borderless align-middle mb-0">
                      <thead className="sticky-top bg-white">
                        <tr className="border-bottom">
                          <th className="text-muted small fw-bold text-uppercase pb-3">Skate</th>
                          <th className="text-muted small fw-bold text-uppercase pb-3">Status</th>
                          <th className="text-muted small fw-bold text-uppercase text-end pb-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {skates.map(skate => (
                          <tr key={skate.id} className="border-bottom">
                            <td className="fw-bolder fs-5">#{skate.name}</td>
                            <td>
                              <span className={`badge rounded-pill px-3 py-2 ${skate.status === 'Available' ? 'bg-success' : skate.status === 'Active' ? 'bg-primary' : skate.status === 'Paused' ? 'bg-warning text-dark' : 'bg-danger'}`}>
                                {skate.status}
                              </span>
                            </td>
                            <td className="text-end">
                              <button 
                                onClick={() => handleSetMaintenance(skate)} 
                                className={`btn btn-sm fw-bold rounded-3 me-2 ${skate.status === 'Maintenance' ? 'btn-success' : 'btn-outline-warning'}`}
                                title={skate.status === 'Maintenance' ? 'Make Available' : 'Send to Maintenance'}
                              >
                                {skate.status === 'Maintenance' ? <i className="bi bi-check-lg"></i> : <i className="bi bi-wrench"></i>}
                              </button>
                              <button 
                                onClick={() => handleDeleteSkate(skate.id)} 
                                className="btn btn-sm btn-outline-danger fw-bold rounded-3"
                              >
                                <i className="bi bi-trash3-fill"></i>
                              </button>
                            </td>
                          </tr>
                        ))}
                        {skates.length === 0 && (
                          <tr>
                            <td colSpan={3} className="text-center text-muted py-5">No skates in fleet. Add one above.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Footer */}
        <div className="mt-auto px-5 py-4 d-flex justify-content-between text-muted small border-top bg-white">
          <div>© 2026 Skate House. All rights reserved.</div>
          <div>System Status: <span className="text-success fw-bold">● All Systems Operational</span></div>
        </div>
      </div>
    </div>
  );
}
