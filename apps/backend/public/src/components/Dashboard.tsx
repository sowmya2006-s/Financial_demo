import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { 
  Briefcase, DollarSign, Home, Activity, 
  TrendingUp, CreditCard, ShoppingCart, ArrowRight 
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [showLivingOption, setShowLivingOption] = useState(false);
  const [showInvest, setShowInvest] = useState(false);
  const [showSpend, setShowSpend] = useState(false);
  const [showLoan, setShowLoan] = useState(false);

  const loadData = async () => {
    try {
      const res = await api.get(`http://localhost:3005/api/dashboard/${id}`);
      setData(res.data);
      // If week 1 and no living option, show living option modal
      if (res.data.week === 1 && !res.data.player.livingOption && !res.data.mandatoryExpenses.find((e: any) => e.category === 'rent' && e.amount > 0)) {
        setShowLivingOption(true);
      } else {
        setShowLivingOption(false);
      }
    } catch (err) {
      console.error(err);
      navigate('/profiles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const handleNextWeek = async () => {
    try {
      // First submit empty decisions if needed
      await api.post(`http://localhost:3005/game/${id}/decisions`, { decisions: [] });
      await api.post(`http://localhost:3005/game/${id}/advance-week`);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to advance week');
    }
  };

  const handleSetLivingOption = async (option: string) => {
    try {
      await api.post(`http://localhost:3005/profiles/${id}/living-option`, { livingOption: option });
      setShowLivingOption(false);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Error setting living option');
    }
  };

  const formatMoney = (paise: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100);
  };

  if (loading || !data) return <div className="app-container">Loading...</div>;

  return (
    <div className="app-container animate-fade-in">
      <div className="header">
        <div>
          <h1 className="text-gradient">Financial Life Simulator</h1>
          <p className="text-muted">{data.player.name} | Age: {data.age} | {data.career} | Week {data.week} (Month {data.month})</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-outline" onClick={() => navigate('/profiles')}>Profiles</button>
          <button className="btn btn-primary pulse-primary" onClick={handleNextWeek}>
            Next Week <ArrowRight size={18} />
          </button>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="glass-panel metric-card">
          <div className="metric-label"><DollarSign size={16} /> Balance</div>
          <div className={`metric-value ${data.balance < 0 ? 'text-danger' : 'text-success'}`}>
            {formatMoney(data.balance)}
          </div>
        </div>
        
        <div className="glass-panel metric-card">
          <div className="metric-label"><Activity size={16} /> Net Worth</div>
          <div className={`metric-value ${data.netWorth < 0 ? 'text-danger' : ''}`}>
            {formatMoney(data.netWorth)}
          </div>
        </div>

        <div className="glass-panel metric-card">
          <div className="metric-label">Credit Score</div>
          <div className="metric-value">{data.creditScore}</div>
          <div className="progress-container">
            <div className="progress-bar progress-blue" style={{ width: `${(data.creditScore / 900) * 100}%` }}></div>
          </div>
        </div>

        <div className="glass-panel metric-card">
          <div className="metric-label">Well-Being</div>
          <div className="metric-value">{data.wellBeing}/100</div>
          <div className="progress-container">
            <div className="progress-bar progress-green" style={{ width: `${data.wellBeing}%` }}></div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}><Briefcase size={20} className="inline mr-2" /> Income & Expenses</h3>
          <div className="list-container">
            <div className="list-item">
              <span>Salary (Monthly)</span>
              <span className="text-success">+{formatMoney(data.salary)}</span>
            </div>
            {data.mandatoryExpenses.map((exp: any) => (
              <div className="list-item" key={exp.id}>
                <span style={{ textTransform: 'capitalize' }}>{exp.label}</span>
                <span className="text-danger">-{formatMoney(exp.amount)}</span>
              </div>
            ))}
          </div>
          
          <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button className="btn btn-outline" onClick={() => setShowInvest(true)}><TrendingUp size={16} /> Invest</button>
            <button className="btn btn-outline" onClick={() => setShowSpend(true)}><ShoppingCart size={16} /> Spend</button>
            <button className="btn btn-outline" onClick={() => setShowLoan(true)}><CreditCard size={16} /> Get Loan</button>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}><Home size={20} className="inline mr-2" /> Assets & Liabilities</h3>
          <div className="list-container">
            {data.investments.length === 0 && data.loans.length === 0 && (
              <p className="text-muted">No active investments or loans.</p>
            )}
            
            {data.investments.map((inv: any) => (
              <div className="list-item" key={inv.id}>
                <div>
                  <div style={{ fontWeight: 600 }}>{inv.name}</div>
                  <div className="text-muted" style={{ fontSize: '0.8rem' }}>{inv.type}</div>
                </div>
                <div className="text-success">{formatMoney(inv.currentValue)}</div>
              </div>
            ))}
            
            {data.loans.map((loan: any) => (
              <div className="list-item" key={loan.id}>
                <div>
                  <div style={{ fontWeight: 600 }}>{loan.type} Loan</div>
                  <div className="text-muted" style={{ fontSize: '0.8rem' }}>{loan.remainingMonths} months left</div>
                </div>
                <div className="text-danger">-{formatMoney(loan.remainingAmount)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Living Option Modal */}
      {showLivingOption && (
        <div className="modal-overlay">
          <div className="glass-modal modal-content animate-fade-in">
            <div className="modal-header">
              <h2>Select Living Option</h2>
            </div>
            <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
              Before you start your journey, choose your living arrangement. This affects your mandatory expenses and well-being.
            </p>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <button className="btn btn-outline" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '1.5rem' }} onClick={() => handleSetLivingOption('INDIVIDUAL_RENT')}>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--accent-primary)' }}>Individual House (Rent)</div>
                <div className="text-muted mt-2" style={{ marginTop: '0.5rem' }}>Cost: ₹8,000/mo</div>
                <div className="text-success" style={{ fontSize: '0.9rem' }}>+5 Well-being, +3 Social Status</div>
              </button>
              
              <button className="btn btn-outline" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '1.5rem' }} onClick={() => handleSetLivingOption('SHARED_RENT')}>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--accent-secondary)' }}>Shared Living (Hostel/PG)</div>
                <div className="text-muted" style={{ marginTop: '0.5rem' }}>Cost: ₹3,500/mo</div>
                <div className="text-danger" style={{ fontSize: '0.9rem' }}>-2 Well-being, Lower Privacy</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Basic implementations for other modals to avoid huge file, would expand in production */}
      {showInvest && <InvestModal onClose={() => { setShowInvest(false); loadData(); }} profileId={id!} />}
      {showSpend && <SpendModal onClose={() => { setShowSpend(false); loadData(); }} profileId={id!} />}
      {showLoan && <LoanModal onClose={() => { setShowLoan(false); loadData(); }} profileId={id!} />}
    </div>
  );
};

// Simplified sub-components for the modals
const InvestModal = ({ onClose, profileId }: { onClose: () => void, profileId: string }) => {
  const [type, setType] = useState('FD');
  const [amount, setAmount] = useState('');
  
  const handleInvest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('http://localhost:3005/api/invest', { profileId, type, amount: parseInt(amount) * 100 });
      onClose();
    } catch (err) {
      alert('Investment failed');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="glass-modal modal-content animate-fade-in">
        <div className="modal-header"><h2>Invest</h2><button className="close-btn" onClick={onClose}>&times;</button></div>
        <form onSubmit={handleInvest}>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-control" value={type} onChange={e => setType(e.target.value)}>
              <option value="FD">Fixed Deposit</option>
              <option value="MUTUAL_FUND">Mutual Fund</option>
              <option value="STOCK">Stocks</option>
              <option value="COURSE">Course (Self-Invest)</option>
              <option value="HOUSE">House</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Amount (₹)</label>
            <input type="number" className="form-control" value={amount} onChange={e => setAmount(e.target.value)} required min={1} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Confirm Investment</button>
        </form>
      </div>
    </div>
  );
};

const SpendModal = ({ onClose, profileId }: { onClose: () => void, profileId: string }) => {
  const [category, setCategory] = useState('GADGET');
  const [amount, setAmount] = useState('');
  
  const handleSpend = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('http://localhost:3005/api/spend', { profileId, category, itemName: category, amount: parseInt(amount) * 100 });
      onClose();
    } catch (err) {
      alert('Spend failed');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="glass-modal modal-content animate-fade-in">
        <div className="modal-header"><h2>Spend Money</h2><button className="close-btn" onClick={onClose}>&times;</button></div>
        <form onSubmit={handleSpend}>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="form-control" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="GADGET">Gadget</option>
              <option value="WATCH">Watch</option>
              <option value="VACATION">Vacation</option>
              <option value="DINING">Dining</option>
              <option value="ENTERTAINMENT">Entertainment</option>
              <option value="LUXURY">Luxury</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Amount (₹)</label>
            <input type="number" className="form-control" value={amount} onChange={e => setAmount(e.target.value)} required min={1} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Confirm Spend</button>
        </form>
      </div>
    </div>
  );
};

const LoanModal = ({ onClose, profileId }: { onClose: () => void, profileId: string }) => {
  const [type, setType] = useState('PERSONAL');
  const [amount, setAmount] = useState('');
  
  const handleLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('http://localhost:3005/api/loan/create', { profileId, type, amount: parseInt(amount) * 100 });
      onClose();
    } catch (err) {
      alert('Loan creation failed');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="glass-modal modal-content animate-fade-in">
        <div className="modal-header"><h2>Take a Loan</h2><button className="close-btn" onClick={onClose}>&times;</button></div>
        <form onSubmit={handleLoan}>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-control" value={type} onChange={e => setType(e.target.value)}>
              <option value="PERSONAL">Personal Loan</option>
              <option value="VEHICLE">Vehicle Loan</option>
              <option value="HOME">Home Loan</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Amount (₹)</label>
            <input type="number" className="form-control" value={amount} onChange={e => setAmount(e.target.value)} required min={1000} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Get Loan</button>
        </form>
      </div>
    </div>
  );
};
