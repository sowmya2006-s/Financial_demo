import React, { useEffect, useState } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';

export const Profiles: React.FC = () => {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [difficulty, setDifficulty] = useState('STANDARD');
  const [age, setAge] = useState(22);
  const navigate = useNavigate();

  const loadProfiles = async () => {
    try {
      const res = await api.get('http://localhost:3005/profiles');
      setProfiles(res.data.profiles);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('http://localhost:3005/profiles', { name, difficulty, age });
      // The profile might not have a living option set. We need to set it next.
      navigate(`/dashboard/${res.data.profile.id}`);
    } catch (err) {
      console.error(err);
      alert('Error creating profile');
    }
  };

  return (
    <div className="app-container animate-fade-in">
      <div className="header">
        <h1 className="text-gradient">Your Profiles</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={18} /> New Game
        </button>
      </div>

      <div className="metrics-grid">
        {profiles.map(p => (
          <div key={p.id} className="glass-panel metric-card" style={{ cursor: 'pointer' }} onClick={() => navigate(`/dashboard/${p.id}`)}>
            <h3>{p.name}</h3>
            <p className="text-muted">Career: {p.career}</p>
            <p className="text-muted">Difficulty: {p.difficulty}</p>
            <p className="text-muted">Status: {p.active ? 'ACTIVE' : 'INACTIVE'}</p>
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="modal-overlay">
          <div className="glass-modal modal-content animate-fade-in">
            <div className="modal-header">
              <h2>Create Profile</h2>
              <button className="close-btn" onClick={() => setShowCreate(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input className="form-control" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Age</label>
                <input type="number" className="form-control" value={age} onChange={e => setAge(parseInt(e.target.value))} required min={18} max={50} />
              </div>
              <div className="form-group">
                <label className="form-label">Difficulty</label>
                <select className="form-control" value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                  <option value="BEGINNER">Beginner</option>
                  <option value="STANDARD">Standard</option>
                  <option value="HARD">Hard</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Create</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
