'use client';
import { useState, useEffect } from 'react';
import { initDB, offlineWrite } from '@/lib/db';
import { signOut } from 'firebase/auth';
import { auth, db as firestore } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useTimer } from '@/hooks/useTimer';

interface Skate {
  id: string;
  name: string;
  status: 'Available' | 'Active' | 'Paused' | 'Maintenance';
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

interface Pricing {
  id: string;
  price30Min: number;
  price60Min: number;
}

const ActiveTimer = ({ session, onPause, onResume, onStop, onFinish }: any) => {
  const { formattedTime, isFinishing, isExpired } = useTimer(session.startTime, session.endTime, session.pausedAt);

  return (
    <div className="mt-auto pt-2">
      <div className={`text-center fw-bolder fs-3 mb-2 lh-1 ${session.pausedAt ? 'text-warning' : isExpired ? 'text-danger' : 'text-primary'}`}>
        {session.pausedAt ? 'PAUSED' : isExpired ? '0:00' : formattedTime}
      </div>
      
      <div className="d-flex justify-content-center gap-2">
        {session.pausedAt ? (
          <button onClick={onResume} className="btn btn-warning rounded-pill btn-sm fw-bold flex-grow-1"><i className="bi bi-play-fill"></i> Resume</button>
        ) : (
          <button onClick={onPause} className="btn btn-outline-primary rounded-pill btn-sm fw-bold flex-grow-1"><i className="bi bi-pause-fill"></i> Pause</button>
        )}

        {(isFinishing || isExpired) ? (
          <button onClick={onFinish} className="btn btn-success rounded-pill btn-sm fw-bold flex-grow-1"><i className="bi bi-check-circle-fill"></i> Finish</button>
        ) : (
          <button onClick={onStop} className="btn btn-outline-danger rounded-pill btn-sm fw-bold flex-grow-1"><i className="bi bi-stop-fill"></i> Stop</button>
        )}
      </div>
    </div>
  );
};

export default function TrainerDashboard() {
  const [skates, setSkates] = useState<Skate[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [pricing, setPricing] = useState<Pricing>({ id: 'default', price30Min: 150, price60Min: 250 });
  const [selectingSkate, setSelectingSkate] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(30);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2000);

    const unsubSkates = onSnapshot(collection(firestore, 'skates'), async (snapshot) => {
      const db = await initDB();
      const tx = db.transaction('skates', 'readwrite');
      snapshot.docChanges().forEach(change => {
        if (change.type === 'removed') {
          tx.objectStore('skates').delete(change.doc.id);
        } else {
          tx.objectStore('skates').put({ id: change.doc.id, ...change.doc.data() } as any);
        }
      });
      await tx.done;
      loadData();
    });

    const unsubSessions = onSnapshot(collection(firestore, 'sessions'), async (snapshot) => {
      const db = await initDB();
      const tx = db.transaction('sessions', 'readwrite');
      snapshot.docChanges().forEach(change => {
        if (change.type === 'removed') {
          tx.objectStore('sessions').delete(change.doc.id);
        } else {
          tx.objectStore('sessions').put({ id: change.doc.id, ...change.doc.data() } as any);
        }
      });
      await tx.done;
      loadData();
    });

    const unsubPricing = onSnapshot(collection(firestore, 'pricing'), async (snapshot) => {
      const db = await initDB();
      const tx = db.transaction('pricing', 'readwrite');
      snapshot.docChanges().forEach(change => {
        if (change.type === 'removed') {
          tx.objectStore('pricing').delete(change.doc.id);
        } else {
          tx.objectStore('pricing').put({ id: change.doc.id, ...change.doc.data() } as any);
        }
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
    const p = await db.get('pricing', 'default');
    
    setSkates(allSkates.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })));
    setSessions(allSessions.filter(s => s.status === 'active'));
    if (p) setPricing(p);
  };

  const handleStartSession = async (skateId: string, durationMin: number, price: number) => {
    const now = Date.now();
    const session: Session = {
      id: now.toString(),
      skateId,
      startTime: now,
      endTime: now + (durationMin * 60 * 1000),
      pausedAt: null,
      status: 'active',
      price
    };

    const skate = skates.find(s => s.id === skateId);
    if (!skate) return;

    await offlineWrite('sessions', session.id, session, 'set');
    await offlineWrite('skates', skateId, { ...skate, status: 'Active' }, 'update');
    
    setSessions([...sessions, session]);
    setSkates(skates.map(s => s.id === skateId ? { ...s, status: 'Active' } : s));
    setSelectingSkate(null);
  };

  const handlePauseSession = async (session: Session) => {
    const updated = { ...session, pausedAt: Date.now() };
    const skate = skates.find(s => s.id === session.skateId);
    
    await offlineWrite('sessions', session.id, updated, 'update');
    if (skate) await offlineWrite('skates', skate.id, { ...skate, status: 'Paused' }, 'update');
    
    loadData();
  };

  const handleResumeSession = async (session: Session) => {
    if (!session.pausedAt) return;
    const pausedDuration = Date.now() - session.pausedAt;
    const updated = { 
      ...session, 
      endTime: session.endTime + pausedDuration,
      pausedAt: null 
    };
    const skate = skates.find(s => s.id === session.skateId);

    await offlineWrite('sessions', session.id, updated, 'update');
    if (skate) await offlineWrite('skates', skate.id, { ...skate, status: 'Active' }, 'update');
    
    loadData();
  };

  const handleEndSession = async (session: Session, isCancelled: boolean) => {
    const updated = { ...session, status: (isCancelled ? 'cancelled' : 'completed') as any };
    const skate = skates.find(s => s.id === session.skateId);

    await offlineWrite('sessions', session.id, updated, 'update');
    if (skate) await offlineWrite('skates', skate.id, { ...skate, status: 'Available' }, 'update');
    
    loadData();
  };

  return (
    <div className="container-fluid p-0" style={{ backgroundColor: '#f8f9fa', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Top Bar */}
      <nav className="px-4 py-3 d-flex justify-content-between align-items-center" style={{ backgroundColor: '#1e2433', color: 'white' }}>
        <div className="d-flex align-items-center gap-3">
          <div style={{ width: '45px', height: '45px', backgroundColor: '#000', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}>
            <img src="/logo.jpg" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div className="lh-sm">
            <h5 className="m-0 fw-bold" style={{ letterSpacing: '0.5px' }}>AMBOO SHAGGAA SKATE</h5>
            <small className="text-white-50" style={{ fontSize: '0.85rem' }}>Trainer Dashboard</small>
          </div>
        </div>
        <button className="btn btn-outline-light border-secondary btn-sm rounded-pill d-flex align-items-center gap-2 px-3" onClick={() => signOut(auth)}>
          <i className="bi bi-box-arrow-right"></i> <span className="d-none d-md-inline fw-bold">Logout</span>
        </button>
      </nav>

      {/* Status Bar */}
      <div className="bg-white px-4 py-2 d-flex justify-content-between align-items-center shadow-sm">
        <span className="badge rounded-pill d-flex align-items-center gap-2 px-3 py-2" style={{ backgroundColor: '#e8f5e9', color: '#198754', fontSize: '0.75rem', letterSpacing: '0.5px' }}>
          <div style={{ width: '8px', height: '8px', backgroundColor: '#198754', borderRadius: '50%' }}></div> ONLINE
        </span>
        <span className="badge rounded-pill border border-success text-success bg-white d-flex align-items-center gap-1 px-3 py-2" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
          <i className="bi bi-check-circle-fill"></i> SYNCED
        </span>
      </div>

      <div className="p-4" style={{ paddingBottom: '100px' }}>
        
        {/* Stats Row */}
        <div className="row g-3 mb-4">
          <div className="col-6">
            <div className="card border-0 shadow-sm rounded-3 p-4 text-center">
              <small className="fw-bold text-muted mb-2 text-uppercase" style={{ fontSize: '0.8rem', letterSpacing: '1px' }}>ACTIVE</small>
              <h1 className="fw-bolder m-0" style={{ color: '#0d6efd' }}>{sessions.length}</h1>
            </div>
          </div>
          <div className="col-6">
            <div className="card border-0 shadow-sm rounded-3 p-4 text-center">
              <small className="fw-bold text-muted mb-2 text-uppercase" style={{ fontSize: '0.8rem', letterSpacing: '1px' }}>AVAILABLE</small>
              <h1 className="fw-bolder m-0 text-success">{skates.filter(s => s.status === 'Available').length}</h1>
            </div>
          </div>
        </div>

        {/* Skates Grid */}
        <div className="row g-3">
          {skates.map(skate => {
            const session = sessions.find(s => s.skateId === skate.id);
            
            // Determine dynamic styles based on status
            let borderColor = '#198754'; // Available - Green
            let statusColor = '#198754';
            let statusText = 'AVAILABLE';
            
            if (skate.status === 'Active') {
              borderColor = '#0d6efd'; // Active - Blue
              statusColor = '#0d6efd';
              statusText = 'ACTIVE';
            } else if (skate.status === 'Paused') {
              borderColor = '#ffc107'; // Paused - Yellow
              statusColor = '#ffc107';
              statusText = 'PAUSED';
            } else if (skate.status === 'Maintenance') {
              borderColor = '#6c757d'; // Maintenance - Gray
              statusColor = '#6c757d';
              statusText = 'MAINTENANCE';
            }

            return (
              <div key={skate.id} className="col-6 col-md-4 col-lg-3">
                <div className="card h-100 shadow-sm rounded-4 overflow-hidden" style={{ border: `2px solid ${borderColor}` }}>
                  <div className="card-body p-3 d-flex flex-column">
                    <div className="d-flex justify-content-between align-items-start mb-1">
                      <h2 className="fw-bolder m-0" style={{ color: '#1e2433', fontSize: '2rem' }}>{skate.name}</h2>
                      <span className="fw-bold d-flex align-items-center gap-1 mt-1" style={{ fontSize: '0.65rem', color: statusColor, letterSpacing: '0.5px' }}>
                        <div style={{ width: '6px', height: '6px', backgroundColor: statusColor, borderRadius: '50%' }}></div> {statusText}
                      </span>
                    </div>
                    <small className="text-muted fw-bold mb-4" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>SKATE</small>

                    {skate.status === 'Maintenance' && (
                      <div className="text-center mt-auto py-2">
                        <i className="bi bi-wrench fs-4 text-muted"></i>
                      </div>
                    )}

                    {skate.status === 'Available' && (
                      <div className="mt-auto">
                        <button onClick={() => { setSelectingSkate(skate.id); setSelectedDuration(30); }} className="btn btn-outline-success rounded-pill fw-bold w-100 py-2 d-flex align-items-center justify-content-center gap-2" style={{ fontSize: '0.9rem' }}>
                          <i className="bi bi-play-fill"></i> Start Session
                        </button>
                      </div>
                    )}

                    {(skate.status === 'Active' || skate.status === 'Paused') && session && (
                      <ActiveTimer 
                        session={session} 
                        onPause={() => handlePauseSession(session)}
                        onResume={() => handleResumeSession(session)}
                        onStop={() => { if(confirm("Cancel this session? No revenue will be recorded.")) handleEndSession(session, true) }}
                        onFinish={() => handleEndSession(session, false)}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Start Session Modal */}
      {selectingSkate && (
        <div className="position-fixed top-0 start-0 w-100 h-100 z-3 d-flex align-items-end align-items-md-center justify-content-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="bg-white w-100 rounded-top-4 rounded-md-4 p-4 p-md-5" style={{ maxWidth: '500px', animation: 'slideUp 0.3s ease-out' }}>
            
            <div className="text-center mb-4">
              <div className="d-inline-flex align-items-center justify-content-center bg-success text-white rounded-circle mb-3 shadow-sm" style={{ width: '60px', height: '60px' }}>
                <i className="bi bi-play-fill" style={{ fontSize: '2rem' }}></i>
              </div>
              <h3 className="fw-bolder m-0 text-dark">Start Skate #{skates.find(s => s.id === selectingSkate)?.name}</h3>
              <p className="text-muted m-0 mt-1">Confirm session details</p>
            </div>

            <div className="mb-4">
              <label className="fw-bold text-muted small mb-3">Select Duration</label>
              <div className="row g-3">
                <div className="col-6">
                  <div 
                    onClick={() => setSelectedDuration(30)}
                    className={`card text-center p-3 border-2 rounded-3 h-100 ${selectedDuration === 30 ? 'border-primary bg-primary text-white shadow' : 'bg-white text-dark'}`}
                    style={{ cursor: 'pointer', borderColor: selectedDuration === 30 ? '#0d6efd' : '#dee2e6' }}
                  >
                    <h5 className="fw-bolder m-0">30 Min</h5>
                    <small className={selectedDuration === 30 ? 'text-white-50' : 'text-muted'}>{pricing.price30Min} ETB</small>
                  </div>
                </div>
                <div className="col-6">
                  <div 
                    onClick={() => setSelectedDuration(60)}
                    className={`card text-center p-3 border-2 rounded-3 h-100 ${selectedDuration === 60 ? 'border-primary bg-primary text-white shadow' : 'bg-white text-dark'}`}
                    style={{ cursor: 'pointer', borderColor: selectedDuration === 60 ? '#0d6efd' : '#dee2e6' }}
                  >
                    <h5 className="fw-bolder m-0">1 Hour</h5>
                    <small className={selectedDuration === 60 ? 'text-white-50' : 'text-muted'}>{pricing.price60Min} ETB</small>
                  </div>
                </div>
              </div>
            </div>

            <div className="row g-3 mt-4">
              <div className="col-6">
                <button onClick={() => setSelectingSkate(null)} className="btn btn-outline-dark rounded-pill w-100 py-3 fw-bold border-2">
                  Cancel
                </button>
              </div>
              <div className="col-6">
                <button 
                  onClick={() => handleStartSession(selectingSkate, selectedDuration, selectedDuration === 30 ? pricing.price30Min : pricing.price60Min)} 
                  className="btn btn-success rounded-pill w-100 py-3 fw-bold"
                  style={{ backgroundColor: '#198754' }}
                >
                  Start
                </button>
              </div>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}
